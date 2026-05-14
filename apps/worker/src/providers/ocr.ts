import { getEnv } from "@joeai/shared";

export interface OcrResult {
  rawText: string;
  confidence: number;
  durationMs: number;
  provider: "typhoon" | "google_vision" | "mock";
}

export interface OcrProvider {
  name: string;
  extract(args: { s3Bucket: string; s3Key: string }): Promise<OcrResult>;
}

/**
 * Mock provider — used in dev and tests.
 * Returns deterministic fake text based on key suffix.
 */
export class MockOcrProvider implements OcrProvider {
  name = "mock";
  async extract(args: { s3Bucket: string; s3Key: string }): Promise<OcrResult> {
    const start = Date.now();
    // Pretend it takes ~50ms
    await new Promise((r) => setTimeout(r, 50));
    return {
      rawText: `
        โอนเงินสำเร็จ
        ธนาคารกสิกรไทย
        จำนวนเงิน 1,500.00 บาท
        วันที่ ${new Date().toLocaleDateString("th-TH")} เวลา 10:00 น.
        เลขที่อ้างอิง: MOCK${args.s3Key.slice(-6).toUpperCase()}
      `,
      confidence: 0.85,
      durationMs: Date.now() - start,
      provider: "mock",
    };
  }
}

export class GoogleVisionOcrProvider implements OcrProvider {
  name = "google_vision";
  constructor(private apiKey: string) {}
  async extract(_args: { s3Bucket: string; s3Key: string }): Promise<OcrResult> {
    // Production: fetch object from S3, base64-encode, POST to Vision API,
    // parse fullTextAnnotation. Stub for v1.
    throw new Error("GoogleVisionOcrProvider not implemented yet");
  }
}

export class TyphoonOcrProvider implements OcrProvider {
  name = "typhoon";
  constructor(private endpoint: string) {}
  async extract(_args: { s3Bucket: string; s3Key: string }): Promise<OcrResult> {
    // Production: POST image bytes to Typhoon OCR service.
    throw new Error("TyphoonOcrProvider not implemented yet");
  }
}

export function getOcrProvider(): OcrProvider {
  const env = getEnv();
  switch (env.OCR_PROVIDER) {
    case "google_vision":
      if (!env.GOOGLE_VISION_API_KEY) throw new Error("GOOGLE_VISION_API_KEY required");
      return new GoogleVisionOcrProvider(env.GOOGLE_VISION_API_KEY);
    case "typhoon":
      if (!env.TYPHOON_OCR_ENDPOINT) throw new Error("TYPHOON_OCR_ENDPOINT required");
      return new TyphoonOcrProvider(env.TYPHOON_OCR_ENDPOINT);
    case "mock":
    default:
      return new MockOcrProvider();
  }
}
