import { eq } from "drizzle-orm";
import { mediaAttachments, messages } from "@joeai/db";
import { createLogger, type SttJob } from "@joeai/shared";
import { db } from "../db";
import { getSttProvider } from "../providers/stt";

const log = createLogger("handler.stt");

export async function handleStt(job: SttJob): Promise<void> {
  const [media] = await db
    .select()
    .from(mediaAttachments)
    .where(eq(mediaAttachments.id, job.mediaAttachmentId))
    .limit(1);

  if (!media || !media.s3Key) {
    throw new Error("Media not stored yet");
  }
  if (media.mediaType !== "audio") return;

  const provider = getSttProvider();
  const result = await provider.transcribe({
    url: media.s3Key,
    language: "th",
  });

  await db
    .update(messages)
    .set({ transcript: result.transcript })
    .where(eq(messages.id, media.messageId));

  log.info(
    {
      mediaId: media.id,
      provider: result.provider,
      durationMs: result.durationMs,
    },
    "Transcript stored"
  );
}
