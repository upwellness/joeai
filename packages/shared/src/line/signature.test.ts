import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { verifyLineSignature } from "./signature";

const SECRET = "test-channel-secret";
const BODY = JSON.stringify({ events: [], destination: "U123" });
const VALID_SIG = createHmac("sha256", SECRET).update(BODY).digest("base64");

describe("verifyLineSignature", () => {
  it("accepts a valid signature", () => {
    expect(verifyLineSignature(BODY, VALID_SIG, SECRET)).toBe(true);
  });

  it("rejects a wrong signature", () => {
    expect(verifyLineSignature(BODY, "wrong", SECRET)).toBe(false);
  });

  it("rejects missing signature header", () => {
    expect(verifyLineSignature(BODY, undefined, SECRET)).toBe(false);
  });

  it("rejects when body is tampered", () => {
    expect(verifyLineSignature(BODY + " ", VALID_SIG, SECRET)).toBe(false);
  });

  it("rejects when secret is wrong", () => {
    expect(verifyLineSignature(BODY, VALID_SIG, "different-secret")).toBe(false);
  });

  it("works with Buffer body", () => {
    const buf = Buffer.from(BODY);
    expect(verifyLineSignature(buf, VALID_SIG, SECRET)).toBe(true);
  });
});
