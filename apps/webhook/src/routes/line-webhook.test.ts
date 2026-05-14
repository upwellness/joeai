import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { createHmac } from "node:crypto";

// Mock env BEFORE importing shared
process.env.LINE_CHANNEL_SECRET = "test-secret";
process.env.LINE_CHANNEL_ACCESS_TOKEN = "test-token";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.REDIS_URL = "redis://localhost:6379";
process.env.AUTH_SECRET = "test-auth-secret-must-be-long";
process.env.S3_ACCESS_KEY = "test";
process.env.S3_SECRET_KEY = "test";

// Mock queue so we don't need real Redis in unit tests
vi.mock("@joeai/shared", async (importActual) => {
  const actual = (await importActual()) as Record<string, unknown>;
  return {
    ...actual,
    makeMessageEventsQueue: () => ({
      add: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    }),
  };
});

const { buildServer } = await import("../server");

describe("POST /webhook/line", () => {
  let app: Awaited<ReturnType<typeof buildServer>>;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  function sign(body: string) {
    return createHmac("sha256", "test-secret").update(body).digest("base64");
  }

  it("rejects missing signature", async () => {
    const body = JSON.stringify({ destination: "U1", events: [] });
    const res = await app.inject({
      method: "POST",
      url: "/webhook/line",
      headers: { "content-type": "application/json" },
      payload: body,
    });
    expect(res.statusCode).toBe(401);
  });

  it("rejects wrong signature", async () => {
    const body = JSON.stringify({ destination: "U1", events: [] });
    const res = await app.inject({
      method: "POST",
      url: "/webhook/line",
      headers: {
        "content-type": "application/json",
        "x-line-signature": "wrong",
      },
      payload: body,
    });
    expect(res.statusCode).toBe(401);
  });

  it("accepts valid signature with empty events", async () => {
    const body = JSON.stringify({ destination: "U1", events: [] });
    const res = await app.inject({
      method: "POST",
      url: "/webhook/line",
      headers: {
        "content-type": "application/json",
        "x-line-signature": sign(body),
      },
      payload: body,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, enqueued: 0 });
  });

  it("enqueues message events", async () => {
    const payload = {
      destination: "U1",
      events: [
        {
          type: "message",
          webhookEventId: "evt-1",
          timestamp: Date.now(),
          source: { type: "user", userId: "Uabc" },
          message: { id: "m1", type: "text", text: "hi" },
        },
      ],
    };
    const body = JSON.stringify(payload);
    const res = await app.inject({
      method: "POST",
      url: "/webhook/line",
      headers: {
        "content-type": "application/json",
        "x-line-signature": sign(body),
      },
      payload: body,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, enqueued: 1 });
  });

  it("rejects invalid payload shape", async () => {
    const body = JSON.stringify({ wrong: "shape" });
    const res = await app.inject({
      method: "POST",
      url: "/webhook/line",
      headers: {
        "content-type": "application/json",
        "x-line-signature": sign(body),
      },
      payload: body,
    });
    expect(res.statusCode).toBe(400);
  });
});
