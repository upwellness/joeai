import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  integer,
  bigint,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { messages } from "./messages";
import { mediaStatusEnum, messageTypeEnum } from "./enums";

export const mediaAttachments = pgTable(
  "media_attachments",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    messageId: uuid("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    mediaType: messageTypeEnum("media_type").notNull(),
    status: mediaStatusEnum("status").notNull().default("pending"),
    s3Bucket: text("s3_bucket"),
    s3Key: text("s3_key"),
    contentType: text("content_type"),
    sizeBytes: bigint("size_bytes", { mode: "number" }),
    durationMs: integer("duration_ms"),
    width: integer("width"),
    height: integer("height"),
    downloadAttempts: integer("download_attempts").notNull().default(0),
    downloadError: text("download_error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    storedAt: timestamp("stored_at", { withTimezone: true }),
  },
  (t) => ({
    msgIdx: index("idx_media_message").on(t.messageId),
    statusIdx: index("idx_media_status").on(t.status),
  })
);

export type MediaAttachment = typeof mediaAttachments.$inferSelect;
export type NewMediaAttachment = typeof mediaAttachments.$inferInsert;
