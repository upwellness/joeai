import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import {
  verifyLineSignature,
  getEnv,
  makeMessageEventsQueue,
  type LineWebhookPayload,
} from "@joeai/shared";

interface RawBodyRequest extends FastifyRequest {
  rawBody?: string;
}

export const lineWebhookRoute: FastifyPluginAsync = async (app) => {
  const env = getEnv();
  const queue = makeMessageEventsQueue();

  // Graceful shutdown
  app.addHook("onClose", async () => {
    await queue.close();
  });

  app.post<{ Body: LineWebhookPayload }>("/line", async (request, reply) => {
    const req = request as RawBodyRequest;
    const signature = req.headers["x-line-signature"];
    const signatureStr = Array.isArray(signature) ? signature[0] : signature;

    if (!req.rawBody) {
      app.log.error("Missing raw body — content parser misconfigured?");
      return reply.code(500).send({ error: "internal_error" });
    }

    if (!verifyLineSignature(req.rawBody, signatureStr, env.LINE_CHANNEL_SECRET)) {
      app.log.warn(
        { ip: req.ip, signature: signatureStr },
        "LINE signature verification failed"
      );
      return reply.code(401).send({ error: "invalid_signature" });
    }

    const payload = request.body;
    if (!payload?.events || !Array.isArray(payload.events)) {
      return reply.code(400).send({ error: "invalid_payload" });
    }

    // Enqueue each event with a stable jobId for idempotency
    const receivedAt = new Date().toISOString();
    await Promise.all(
      payload.events.map((event) => {
        const jobId =
          event.webhookEventId ??
          ("message" in event && event.message?.id
            ? `msg-${event.message.id}`
            : `evt-${event.timestamp}-${Math.random().toString(36).slice(2)}`);

        return queue.add(
          "process",
          { event, receivedAt },
          { jobId }
        );
      })
    );

    app.log.info(
      { eventCount: payload.events.length, destination: payload.destination },
      "Enqueued LINE events"
    );

    // ACK quickly — LINE requires < 3s response
    return reply.code(200).send({ ok: true, enqueued: payload.events.length });
  });
};
