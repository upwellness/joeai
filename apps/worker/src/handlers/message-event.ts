import { sql } from "drizzle-orm";
import {
  conversations,
  lineIdentities,
  messages,
  mediaAttachments,
} from "@joeai/db";
import {
  createLogger,
  makeMediaDownloadQueue,
  makeSlipPipelineQueue,
  type LineMessage,
  type LineWebhookEvent,
  type MessageEventJob,
} from "@joeai/shared";
import { db } from "../db";

const log = createLogger("worker.message-event");
const mediaQueue = makeMediaDownloadQueue();
const slipPipeline = makeSlipPipelineQueue();

function sourceToConversation(event: LineWebhookEvent): {
  lineSourceId: string;
  type: "user" | "group" | "room";
  senderLineUserId: string | undefined;
} {
  const src = event.source;
  if (src.type === "group") {
    return {
      lineSourceId: src.groupId,
      type: "group",
      senderLineUserId: src.userId,
    };
  }
  if (src.type === "room") {
    return {
      lineSourceId: src.roomId,
      type: "room",
      senderLineUserId: src.userId,
    };
  }
  return {
    lineSourceId: src.userId,
    type: "user",
    senderLineUserId: src.userId,
  };
}

export async function handleMessageEvent(job: MessageEventJob): Promise<void> {
  const { event } = job;

  if (event.type !== "message") {
    // TODO: handle follow/unfollow/join — out of scope for v1
    log.debug({ type: event.type }, "Non-message event ignored");
    return;
  }

  const conv = sourceToConversation(event);

  // Upsert conversation
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

  // Upsert LINE identity (sender)
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

  // Insert message (idempotent on line_message_id)
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
    // Duplicate webhook delivery — fine, skip
    log.info(
      { lineMessageId: event.message.id },
      "Duplicate message, skipping"
    );
    return;
  }

  // Branch on media types
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

    await mediaQueue.add(
      "download",
      {
        messageId: message.id,
        lineMessageId: event.message.id,
        mediaType: event.message.type as never,
      },
      { jobId: `media-${attachment?.id ?? event.message.id}` }
    );
  }

  // Customer slip detection: 1-on-1 chat + image
  if (conversation.type === "user" && event.message.type === "image") {
    await slipPipeline.add(
      "create-slip",
      { messageId: message.id },
      {
        jobId: `slip-${message.id}`,
        delay: 5_000, // small delay to let media download finish
      }
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
