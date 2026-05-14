import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().default("us-east-1"),
  S3_ACCESS_KEY: z.string(),
  S3_SECRET_KEY: z.string(),
  S3_BUCKET_MEDIA: z.string().default("joeai-media"),
  S3_BUCKET_STATEMENTS: z.string().default("joeai-statements"),
  S3_FORCE_PATH_STYLE: z
    .string()
    .optional()
    .transform((v) => v === "true"),

  LINE_CHANNEL_SECRET: z.string().min(1),
  LINE_CHANNEL_ACCESS_TOKEN: z.string().min(1),

  OCR_PROVIDER: z.enum(["typhoon", "google_vision", "mock"]).default("mock"),
  GOOGLE_VISION_API_KEY: z.string().optional(),
  TYPHOON_OCR_ENDPOINT: z.string().url().optional(),

  STT_PROVIDER: z
    .enum(["whisper_local", "google_stt", "mock"])
    .default("mock"),
  WHISPER_BIN: z.string().default("whisper"),
  GOOGLE_STT_API_KEY: z.string().optional(),

  WEBHOOK_PORT: z.coerce.number().default(3001),
  API_PORT: z.coerce.number().default(3002),
  WEB_PORT: z.coerce.number().default(3000),

  AUTH_SECRET: z.string().min(16),
  SESSION_COOKIE_NAME: z.string().default("joeai_session"),

  SLIP_AUTO_REPLY_CONFIDENCE_THRESHOLD: z.coerce.number().default(0.9),
  SLIP_REVIEW_CONFIDENCE_THRESHOLD: z.coerce.number().default(0.6),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env | undefined;

export function getEnv(): Env {
  if (!_env) {
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
      console.error("❌ Invalid environment variables:");
      console.error(result.error.flatten().fieldErrors);
      throw new Error("Invalid environment configuration");
    }
    _env = result.data;
  }
  return _env;
}
