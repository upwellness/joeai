/**
 * QStash — HTTP-based queue for serverless (Vercel-friendly).
 *
 * Producer side: POST to QStash REST API → QStash POSTs your destination URL.
 * Consumer side: a route handler receives the POST + verifies the signature.
 *
 * Docs: https://docs.upstash.com/qstash
 */

import { createHmac, timingSafeEqual } from "node:crypto";

const QSTASH_BASE = "https://qstash.upstash.io/v2/publish";

export interface PublishOptions {
  /** Idempotency / dedup key — QStash will swallow duplicate publishes. */
  deduplicationId?: string;
  /** Delay before delivery, in seconds. */
  delaySeconds?: number;
  /** Max retry count (QStash default = 3 on free tier). */
  retries?: number;
  /** Set the target URL's content type for the delivery. */
  contentType?: string;
}

export class QStashClient {
  constructor(
    private token: string,
    /** Base URL of THIS deployment, used to resolve job paths. */
    private appBaseUrl: string
  ) {}

  async publish<T>(
    jobPath: string,
    payload: T,
    options: PublishOptions = {}
  ): Promise<{ messageId: string }> {
    const url = `${this.appBaseUrl.replace(/\/$/, "")}${jobPath}`;
    const endpoint = `${QSTASH_BASE}/${encodeURIComponent(url)}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
      "Content-Type": options.contentType ?? "application/json",
    };
    if (options.deduplicationId) {
      headers["Upstash-Deduplication-Id"] = options.deduplicationId;
    }
    if (options.delaySeconds) {
      headers["Upstash-Delay"] = `${options.delaySeconds}s`;
    }
    if (options.retries !== undefined) {
      headers["Upstash-Retries"] = String(options.retries);
    }

    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`QStash publish failed: ${res.status} ${body}`);
    }
    return (await res.json()) as { messageId: string };
  }
}

/**
 * Verify a QStash delivery signature.
 *
 * QStash sends `Upstash-Signature: t=<timestamp>,v1=<sig>` where
 * v1 = HMAC-SHA256(body, signingKey).
 *
 * Pass BOTH current and next signing keys — QStash rotates them.
 */
export function verifyQStashSignature(
  rawBody: string,
  signatureHeader: string | undefined,
  signingKeys: { current: string; next?: string }
): boolean {
  if (!signatureHeader) return false;

  const parts = signatureHeader.split(",").map((p) => p.trim());
  const sigParts = Object.fromEntries(
    parts.map((p) => {
      const idx = p.indexOf("=");
      return [p.slice(0, idx), p.slice(idx + 1)];
    })
  );

  const v1 = sigParts.v1;
  if (!v1) return false;

  for (const key of [signingKeys.current, signingKeys.next].filter(
    (x): x is string => Boolean(x)
  )) {
    const expected = createHmac("sha256", key).update(rawBody).digest("base64");
    const a = Buffer.from(expected);
    const b = Buffer.from(v1);
    if (a.length === b.length && timingSafeEqual(a, b)) {
      return true;
    }
  }
  return false;
}
