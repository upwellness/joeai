import { sql } from "drizzle-orm";
import {
  conversations,
  lineIdentities,
  messages,
  mediaAttachments,
} from "@joeai/db";
import {
  createLogger,
  JOB_PATHS,
  type LineMessage,
  type LineWebhookEvent,
  type MessageEventJob,
} from "@joeai/shared";
import { db } from "../db";
import { getQueue } from "../queue";

const log = createLogger("handler.message-event");

function sourceToConversation(event: LineWebhookEvent): {
  lineSourceId: string;
  type: "user" | "group" | "room";
  senderLineUserId: string | undefined;
} {
  const src = event.source;
  if (src.type === "group") {
    return { lineSourceId: src.groupId, type: "group", senderLineUserId: src.userId };
  }
  if (src.type === "room") {
    return { lineSourceId: src.roomId, type: "room", senderLineUserId: src.userId };
  }
  return { lineSourceId: src.userId, type: "user", senderLineUserId: src.userId };
}

function extractMetadata(msg: LineMessage): Record<string, unknown> {
  const m = msg as unknown as Record<string, unknown>;
  const keep: Record<string, unknown> = {};
  for (const key of [
    "duration",
    "contentProvider",
    "fileName",
    "fileSize",
    "title",
    "address",
    "latitude",
    "longitude",
    "packageId",
    "stickerId",
  ]) {
    if (key in m) keep[key] = m[key];
  }
  return keep;
}

export async function handleMessageEvent(job: MessageEventJob): Promise<void> {
  const { event } = job;
  if (event.type !== "message") {
    log.debug({ type: event.type }, "Non-message event ignored");
    return;
  }

  const conv = sourceToConversation(event);

  const [conversation] = await db
    .insert(conversations)
    .values({
      lineSourceId: conv.lineSourceId,
      type: conv.type,
      purpose: conv.type === "user" ? "customer_support" : "sales_internal",
    })
    .onConflictDoUpdate({
      target: conversations.lineSourceId,
      set: { lineSourceId: sql`EXCLUDED.line_source_id` },
    })
    .returning();
  if (!conversation) throw new Error("Failed to upsert conversation");

  let identityId: string | null = null;
  if (conv.senderLineUserId) {
    const [identity] = await db
      .insert(lineIdentities)
      .values({
        lineUserId: conv.senderLineUserId,
        lastSeenAt: new Date(),
      })
      .onConflictDoUpdate({
        target: lineIdentities.lineUserId,
        set: { lastSeenAt: new Date() },
      })
      .returning();
    identityId = identity?.id ?? null;
  }

  const [message] = await db
    .insert(messages)
    .values({
      lineMessageId: event.message.id,
      conversationId: conversation.id,
      lineIdentityId: identityId,
      direction: "inbound",
      messageType: event.message.type as never,
      textContent:
        event.message.type === "text" ? event.message.text : null,
      mentions:
        event.message.type === "text" && event.message.mention
          ? event.message.mention.mentionees
          : [],
      lineTimestamp: new Date(event.timestamp),
      metadata: extractMetadata(event.message),
    })
    .onConflictDoNothing()
    .returning();

  if (!message) {
    log.info({ lineMessageId: event.message.id }, "Duplicate message, skipping");
    return;
  }

  const queue = getQueue();
  const mediaTypes = ["image", "video", "audio", "file"] as const;
  if (mediaTypes.includes(event.message.type as never)) {
    const [attachment] = await db
      .insert(mediaAttachments)
      .values({
        messageId: message.id,
        mediaType: event.message.type as never,
        status: "pending",
      })
      .returning();

    await queue.publish(
      JOB_PATHS.mediaDownload,
      {
        messageId: message.id,
        lineMessageId: event.message.id,
        mediaType: event.message.type as never,
      },
      { deduplicationId: `media-${attachment?.id ?? event.message.id}` }
    );
  }

  if (conversation.type === "user" && event.message.type === "image") {
    await queue.publish(
      JOB_PATHS.slipPipeline,
      { messageId: message.id },
      { deduplicationId: `slip-${message.id}`, delaySeconds: 5 }
    );
  }

  log.info(
    {
      messageId: message.id,
      type: event.message.type,
      convType: conversation.type,
    },
    "Message processed"
  );
}
