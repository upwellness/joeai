import { eq } from "drizzle-orm";
import { mediaAttachments, slips } from "@joeai/db";
import { createLogger, JOB_PATHS, type OcrJob } from "@joeai/shared";
import { extractSlipFields } from "@joeai/extractor";
import { db } from "../db";
import { getQueue } from "../queue";
import { getOcrProvider } from "../providers/ocr";

const log = createLogger("handler.ocr");

export async function handleOcr(job: OcrJob): Promise<void> {
  const [slip] = await db
    .select()
    .from(slips)
    .where(eq(slips.id, job.slipId))
    .limit(1);
  if (!slip || !slip.mediaAttachmentId) {
    log.warn({ slipId: job.slipId }, "Slip or media missing");
    return;
  }

  const [media] = await db
    .select()
    .from(mediaAttachments)
    .where(eq(mediaAttachments.id, slip.mediaAttachmentId))
    .limit(1);
  if (!media || !media.s3Key) {
    throw new Error("Media not stored yet");
  }

  const provider = getOcrProvider();
  const result = await provider.extract({ url: media.s3Key });
  const fields = extractSlipFields(result.rawText);

  await db
    .update(slips)
    .set({
      status: "ocr_done",
      ocrRawText: result.rawText,
      ocrProvider: result.provider,
      ocrConfidence: result.confidence.toString(),
      extractedAmount: fields.amount?.toString() ?? null,
      extractedDatetime: fields.datetime,
      extractedRef: fields.referenceNumber,
      extractedBankFrom: fields.bankFrom,
      extractedBankTo: fields.bankTo,
      extractedAccountTo: fields.accountTo,
      extractedFields: fields,
      updatedAt: new Date(),
    })
    .where(eq(slips.id, slip.id));

  log.info(
    {
      slipId: slip.id,
      provider: result.provider,
      amount: fields.amount,
      hasRef: !!fields.referenceNumber,
    },
    "OCR done"
  );

  await getQueue().publish(
    JOB_PATHS.slipMatching,
    { slipId: slip.id },
    { deduplicationId: `match-${slip.id}` }
  );
}
