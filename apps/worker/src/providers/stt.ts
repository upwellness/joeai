import { getEnv } from "@joeai/shared";

export interface SttResult {
  transcript: string;
  language: string;
  durationMs: number;
  provider: "whisper_local" | "google_stt" | "mock";
}

export interface SttProvider {
  name: string;
  transcribe(args: {
    s3Bucket: string;
    s3Key: string;
    language?: string;
  }): Promise<SttResult>;
}

export class MockSttProvider implements SttProvider {
  name = "mock";
  async transcribe(_args: {
    s3Bucket: string;
    s3Key: string;
    language?: string;
  }): Promise<SttResult> {
    const start = Date.now();
    await new Promise((r) => setTimeout(r, 50));
    return {
      transcript: "[mock transcript] ลูกค้าโอนเงินมาแล้วครับ ยอด 1500 บาท",
      language: "th",
      durationMs: Date.now() - start,
      provider: "mock",
    };
  }
}

export function getSttProvider(): SttProvider {
  const env = getEnv();
  switch (env.STT_PROVIDER) {
    case "mock":
    default:
      return new MockSttProvider();
    // whisper_local + google_stt to be implemented in production
  }
}
