import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { conversations } from "./conversations";
import { lineIdentities } from "./line-identities";
import { messageTypeEnum, messageDirectionEnum } from "./enums";

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    lineMessageId: text("line_message_id").notNull().unique(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    lineIdentityId: uuid("line_identity_id").references(
      () => lineIdentities.id,
      { onDelete: "set null" }
    ),
    direction: messageDirectionEnum("direction").notNull(),
    messageType: messageTypeEnum("message_type").notNull(),
    textContent: text("text_content"),
    transcript: text("transcript"),
    replyToLineMsgId: text("reply_to_line_msg_id"),
    mentions: jsonb("mentions").notNull().default(sql`'[]'::jsonb`),
    lineTimestamp: timestamp("line_timestamp", {
      withTimezone: true,
    }).notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
  },
  (t) => ({
    convTimeIdx: index("idx_messages_conversation_time").on(
      t.conversationId,
      t.lineTimestamp
    ),
    identityTimeIdx: index("idx_messages_identity_time").on(
      t.lineIdentityId,
      t.lineTimestamp
    ),
  })
);

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
