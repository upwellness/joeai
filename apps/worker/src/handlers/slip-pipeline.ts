import { eq } from "drizzle-orm";
import { mediaAttachments, messages, slips } from "@joeai/db";
import {
  createLogger,
  makeOcrQueue,
  type SlipPipelineJob,
} from "@joeai/shared";
import { db } from "../db";

const log = createLogger("worker.slip-pipeline");
const ocrQueue = makeOcrQueue();

/**
 * Create a slip row for a message and kick off OCR.
 */
export async function handleSlipPipeline(job: SlipPipelineJob): Promise<void> {
  const [message] = await db
    .select()
    .from(messages)
    .where(eq(messages.id, job.messageId))
    .limit(1);

  if (!message) {
    log.warn({ messageId: job.messageId }, "Message not found");
    return;
  }

  const [attachment] = await db
    .select()
    .from(mediaAttachments)
    .where(eq(mediaAttachments.messageId, job.messageId))
    .limit(1);

  if (!attachment) {
    log.warn(
      { messageId: job.messageId },
      "No media attachment yet — will re-queue"
    );
    throw new Error("media_not_ready"); // BullMQ will retry
  }

  if (attachment.status !== "stored") {
    log.info(
      { messageId: job.messageId, status: attachment.status },
      "Media not yet stored, retrying"
    );
    throw new Error("media_not_stored");
  }

  // Idempotent insert
  const [slip] = await db
    .insert(slips)
    .values({
      messageId: message.id,
      mediaAttachmentId: attachment.id,
      status: "ocr_pending",
    })
    .onConflictDoNothing()
    .returning();

  if (!slip) {
    log.info({ messageId: job.messageId }, "Slip already exists");
    return;
  }

  await ocrQueue.add(
    "ocr",
    { slipId: slip.id },
    { jobId: `ocr-${slip.id}` }
  );

  log.info({ slipId: slip.id }, "Slip created, OCR queued");
}
