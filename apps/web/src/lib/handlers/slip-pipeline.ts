import { eq } from "drizzle-orm";
import { mediaAttachments, messages, slips } from "@joeai/db";
import {
  createLogger,
  JOB_PATHS,
  type SlipPipelineJob,
} from "@joeai/shared";
import { db } from "../db";
import { getQueue } from "../queue";

const log = createLogger("handler.slip-pipeline");

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
    throw new Error("media_not_ready");
  }
  if (attachment.status !== "stored") {
    throw new Error("media_not_stored");
  }

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

  await getQueue().publish(
    JOB_PATHS.ocr,
    { slipId: slip.id },
    { deduplicationId: `ocr-${slip.id}` }
  );

  log.info({ slipId: slip.id }, "Slip created, OCR queued");
}
