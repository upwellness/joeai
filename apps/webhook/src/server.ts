import Fastify from "fastify";
import { loggerOptions } from "@joeai/shared";
import { lineWebhookRoute } from "./routes/line-webhook";
import { healthRoute } from "./routes/health";

export async function buildServer() {
  const app = Fastify({
    logger: loggerOptions("webhook"),
    bodyLimit: 1024 * 1024, // 1MB — LINE payloads are small
    // CRITICAL: we need the raw body to verify HMAC signature.
    // Fastify lets us access it via `req.rawBody` when `onRequest` saves it.
  });

  // Save raw body for signature verification on the LINE route
  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (req, body, done) => {
      (req as unknown as { rawBody: string }).rawBody = body as string;
      try {
        const json = body.length > 0 ? JSON.parse(body as string) : {};
        done(null, json);
      } catch (err) {
        done(err as Error, undefined);
      }
    }
  );

  await app.register(healthRoute);
  await app.register(lineWebhookRoute, { prefix: "/webhook" });

  return app;
}
