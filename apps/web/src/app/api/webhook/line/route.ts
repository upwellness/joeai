import { NextResponse, type NextRequest } from "next/server";
import {
  verifyLineSignature,
  getEnv,
  JOB_PATHS,
  type LineWebhookPayload,
} from "@joeai/shared";
import { getQueue } from "../../../../lib/queue";

export const runtime = "nodejs"; // need crypto.createHmac
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const env = getEnv();
  const rawBody = await req.text();
  const signature = req.headers.get("x-line-signature") ?? undefined;

  if (!verifyLineSignature(rawBody, signature, env.LINE_CHANNEL_SECRET)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  let payload: LineWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!payload.events || !Array.isArray(payload.events)) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const queue = getQueue();
  const receivedAt = new Date().toISOString();

  await Promise.all(
    payload.events.map((event) => {
      const dedup =
        event.webhookEventId ??
        ("message" in event && event.message?.id
          ? `msg-${event.message.id}`
          : `evt-${event.timestamp}-${Math.random().toString(36).slice(2)}`);

      return queue.publish(
        JOB_PATHS.messageEvent,
        { event, receivedAt },
        { deduplicationId: dedup }
      );
    })
  );

  return NextResponse.json({ ok: true, enqueued: payload.events.length });
}
