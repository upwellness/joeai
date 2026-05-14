import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verify a LINE Messaging API webhook signature.
 *
 * LINE signs the request body with HMAC-SHA256 using the channel secret,
 * then base64-encodes it. Caller MUST pass the raw body bytes — not the
 * parsed JSON — because any whitespace change breaks the HMAC.
 *
 * @param rawBody  exact bytes/string LINE POSTed
 * @param signatureHeader value of `x-line-signature`
 * @param channelSecret  LINE channel secret
 */
export function verifyLineSignature(
  rawBody: string | Buffer,
  signatureHeader: string | undefined,
  channelSecret: string
): boolean {
  if (!signatureHeader) return false;

  const computed = createHmac("sha256", channelSecret)
    .update(rawBody)
    .digest("base64");

  // timing-safe compare — both must be same length first
  const a = Buffer.from(computed);
  const b = Buffer.from(signatureHeader);
  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}
