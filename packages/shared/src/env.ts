import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),

  // --- Database (Neon / Vercel Postgres) ---
  DATABASE_URL: z.string().url(),

  // --- LINE Messaging API ---
  LINE_CHANNEL_SECRET: z.string().min(1),
  LINE_CHANNEL_ACCESS_TOKEN: z.string().min(1),

  // --- QStash (Upstash) — replaces BullMQ on Vercel ---
  QSTASH_TOKEN: z.string().min(1),
  QSTASH_CURRENT_SIGNING_KEY: z.string().min(1),
  QSTASH_NEXT_SIGNING_KEY: z.string().min(1),

  // The base URL of THIS deployment (used for QStash callbacks).
  // Vercel sets VERCEL_URL automatically for previews; PROD is set manually.
  APP_BASE_URL: z.string().url(),

  // --- Vercel Blob (media + statement storage) ---
  BLOB_READ_WRITE_TOKEN: z.string().min(1),

  // --- OCR provider ---
  OCR_PROVIDER: z.enum(["typhoon", "google_vision", "mock"]).default("mock"),
  GOOGLE_VISION_API_KEY: z.string().optional(),
  TYPHOON_OCR_ENDPOINT: z.string().url().optional(),

  // --- STT provider ---
  STT_PROVIDER: z
    .enum(["whisper_local", "google_stt", "mock"])
    .default("mock"),
  GOOGLE_STT_API_KEY: z.string().optional(),

  // --- Auth ---
  AUTH_SECRET: z.string().min(16),
  SESSION_COOKIE_NAME: z.string().default("joeai_session"),

  // --- Slip matching thresholds ---
  SLIP_AUTO_REPLY_CONFIDENCE_THRESHOLD: z.coerce.number().default(0.9),
  SLIP_REVIEW_CONFIDENCE_THRESHOLD: z.coerce.number().default(0.6),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env | undefined;

export function getEnv(): Env {
  if (!_env) {
    // Vercel populates VERCEL_URL on deployments — surface it as APP_BASE_URL
    // unless the user set their own.
    const candidate = { ...process.env } as Record<string, string | undefined>;
    if (!candidate.APP_BASE_URL && candidate.VERCEL_URL) {
      candidate.APP_BASE_URL = `https://${candidate.VERCEL_URL}`;
    }

    const result = envSchema.safeParse(candidate);
    if (!result.success) {
      console.error("❌ Invalid environment variables:");
      console.error(result.error.flatten().fieldErrors);
      throw new Error("Invalid environment configuration");
    }
    _env = result.data;
  }
  return _env;
}
