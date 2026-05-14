import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { conversationTypeEnum, conversationPurposeEnum } from "./enums";

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    lineSourceId: text("line_source_id").notNull().unique(),
    type: conversationTypeEnum("type").notNull(),
    purpose: conversationPurposeEnum("purpose").notNull().default("unknown"),
    name: text("name"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    typeIdx: index("idx_conversations_type").on(t.type),
    purposeIdx: index("idx_conversations_purpose").on(t.purpose),
  })
);

export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
