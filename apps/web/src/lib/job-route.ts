import { NextResponse, type NextRequest } from "next/server";
import { verifyQStashSignature, createLogger } from "@joeai/shared";
import { getSigningKeys } from "./queue";

const log = createLogger("job-route");

/**
 * Wraps a Next.js POST handler with QStash signature verification.
 * The handler receives the typed payload — any thrown error returns 500
 * so QStash retries.
 */
export function jobHandler<T>(
  jobName: string,
  handler: (payload: T) => Promise<void>
) {
  return async function POST(req: NextRequest): Promise<NextResponse> {
    const rawBody = await req.text();
    const signature =
      req.headers.get("upstash-signature") ??
      req.headers.get("Upstash-Signature") ??
      undefined;

    // Allow local dev without QStash by setting DISABLE_QSTASH_VERIFY=1
    const allowUnsigned =
      process.env.NODE_ENV === "development" &&
      process.env.DISABLE_QSTASH_VERIFY === "1";

    if (!allowUnsigned) {
      const keys = getSigningKeys();
      if (!verifyQStashSignature(rawBody, signature, keys)) {
        log.warn({ jobName, signature }, "QStash signature verification failed");
        return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
      }
    }

    let payload: T;
    try {
      payload = JSON.parse(rawBody) as T;
    } catch {
      return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }

    try {
      await handler(payload);
      return NextResponse.json({ ok: true });
    } catch (err) {
      log.error(
        { jobName, err: err instanceof Error ? err.message : String(err) },
        "Job handler failed"
      );
      // 500 → QStash will retry per its retry policy
      return NextResponse.json(
        { error: "handler_failed", detail: err instanceof Error ? err.message : String(err) },
        { status: 500 }
      );
    }
  };
}
