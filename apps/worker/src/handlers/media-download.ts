import { eq } from "drizzle-orm";
import { mediaAttachments } from "@joeai/db";
import {
  LineClient,
  createLogger,
  getEnv,
  makeOcrQueue,
  makeSttQueue,
  type MediaDownloadJob,
} from "@joeai/shared";
import { db } from "../db";
import { uploadStream } from "../storage/s3";

const log = createLogger("worker.media-download");
const ocrQueue = makeOcrQueue();
const sttQueue = makeSttQueue();

function extensionFor(mediaType: string, contentType?: string | null): string {
  if (contentType) {
    if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
    if (contentType.includes("png")) return "png";
    if (contentType.includes("mp4")) return "mp4";
    if (contentType.includes("m4a")) return "m4a";
    if (contentType.includes("mpeg")) return "mp3";
    if (contentType.includes("ogg")) return "ogg";
    if (contentType.includes("pdf")) return "pdf";
  }
  switch (mediaType) {
    case "image": return "jpg";
    case "video": return "mp4";
    case "audio": return "m4a";
    case "file":  return "bin";
    default:      return "bin";
  }
}

function yearMonth(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function handleMediaDownload(job: MediaDownloadJob): Promise<void> {
  const env = getEnv();
  const line = new LineClient(env.LINE_CHANNEL_ACCESS_TOKEN);

  const [attachment] = await db
    .select()
    .from(mediaAttachments)
    .where(eq(mediaAttachments.messageId, job.messageId))
    .limit(1);

  if (!attachment) {
    log.warn({ job }, "No attachment row found");
    return;
  }

  if (attachment.status === "stored") {
    log.info({ id: attachment.id }, "Already stored, skipping");
    return;
  }

  await db
    .update(mediaAttachments)
    .set({ status: "downloading", downloadAttempts: (attachment.downloadAttempts ?? 0) + 1 })
    .where(eq(mediaAttachments.id, attachment.id));

  try {
    const res = await line.getMessageContent(job.lineMessageId);
    const contentType = res.headers.get("content-type") ?? undefined;
    const ext = extensionFor(job.mediaType, contentType);
    const key = `line-media/${yearMonth()}/${attachment.id}.${ext}`;

    if (!res.body) throw new Error("Empty body from LINE Content API");

    await uploadStream({
      bucket: env.S3_BUCKET_MEDIA,
      key,
      body: res.body as ReadableStream,
      contentType,
    });

    await db
      .update(mediaAttachments)
      .set({
        status: "stored",
        s3Bucket: env.S3_BUCKET_MEDIA,
        s3Key: key,
        contentType: contentType ?? null,
        storedAt: new Date(),
      })
      .where(eq(mediaAttachments.id, attachment.id));

    log.info({ id: attachment.id, key }, "Media stored");

    // Downstream pipelines
    if (job.mediaType === "audio") {
      await sttQueue.add(
        "transcribe",
        { mediaAttachmentId: attachment.id },
        { jobId: `stt-${attachment.id}` }
      );
    }
  } catch (err) {
    log.error({ err, id: attachment.id }, "Media download failed");
    await db
      .update(mediaAttachments)
      .set({
        status: "failed",
        downloadError: err instanceof Error ? err.message : String(err),
      })
      .where(eq(mediaAttachments.id, attachment.id));
    throw err; // re-throw for BullMQ retry
  }
}
