import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getEnv } from "@joeai/shared";

let _client: S3Client | undefined;

/**
 * Storage client targeting Cloudflare R2 via the S3-compatible API.
 *
 * R2 is free up to 10 GB of storage and has $0 egress, which makes it
 * a strict upgrade over S3 for our use case.
 */
function getR2Client(): S3Client {
  if (!_client) {
    const env = getEnv();
    _client = new S3Client({
      region: "auto", // R2 ignores region but the SDK requires a value
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return _client;
}

/**
 * Upload bytes (or a stream) to R2.
 *
 * @returns the public URL — assumes the bucket has a public dev URL or a
 *   custom domain set up in the R2 dashboard (R2_PUBLIC_URL_BASE).
 */
export async function uploadObject(args: {
  key: string;
  body: Buffer | Uint8Array | string | ReadableStream;
  contentType?: string;
}): Promise<{ url: string; key: string }> {
  const env = getEnv();
  const upload = new Upload({
    client: getR2Client(),
    params: {
      Bucket: env.R2_BUCKET,
      Key: args.key,
      Body: args.body as never,
      ContentType: args.contentType,
    },
  });
  await upload.done();
  return {
    url: `${env.R2_PUBLIC_URL_BASE.replace(/\/$/, "")}/${args.key}`,
    key: args.key,
  };
}

export function yearMonth(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
