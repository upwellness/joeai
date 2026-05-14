import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getEnv } from "@joeai/shared";

let _client: S3Client | undefined;

export function getS3Client(): S3Client {
  if (!_client) {
    const env = getEnv();
    _client = new S3Client({
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT,
      forcePathStyle: env.S3_FORCE_PATH_STYLE ?? false,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY,
        secretAccessKey: env.S3_SECRET_KEY,
      },
    });
  }
  return _client;
}

export async function uploadStream(args: {
  bucket: string;
  key: string;
  body: ReadableStream | Buffer;
  contentType?: string;
}): Promise<{ etag?: string; size?: number }> {
  const client = getS3Client();
  const upload = new Upload({
    client,
    params: {
      Bucket: args.bucket,
      Key: args.key,
      Body: args.body as never,
      ContentType: args.contentType,
      ServerSideEncryption: "AES256",
    },
  });

  const result = await upload.done();
  return {
    etag: result.ETag,
  };
}
