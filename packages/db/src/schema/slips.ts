import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  numeric,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { messages } from "./messages";
import { mediaAttachments } from "./media";
import { customers } from "./customers";
import { employees } from "./employees";
import { bankTransactions } from "./statements";
import { slipStatusEnum } from "./enums";

export const slips = pgTable(
  "slips",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    messageId: uuid("message_id")
      .notNull()
      .unique()
      .references(() => messages.id, { onDelete: "cascade" }),
    mediaAttachmentId: uuid("media_attachment_id").references(
      () => mediaAttachments.id,
      { onDelete: "set null" }
    ),
    customerId: uuid("customer_id").references(() => customers.id, {
      onDelete: "set null",
    }),
    status: slipStatusEnum("status").notNull().default("received"),

    // OCR results
    ocrRawText: text("ocr_raw_text"),
    ocrProvider: text("ocr_provider"),
    ocrConfidence: numeric("ocr_confidence", { precision: 5, scale: 2 }),
    extractedAmount: numeric("extracted_amount", { precision: 15, scale: 2 }),
    extractedDatetime: timestamp("extracted_datetime", { withTimezone: true }),
    extractedRef: text("extracted_ref"),
    extractedBankFrom: text("extracted_bank_from"),
    extractedBankTo: text("extracted_bank_to"),
    extractedAccountTo: text("extracted_account_to"),
    extractedFields: jsonb("extracted_fields"),

    // Matching
    matchedTxnId: uuid("matched_txn_id").references(() => bankTransactions.id, {
      onDelete: "set null",
    }),
    matchConfidence: numeric("match_confidence", { precision: 5, scale: 2 }),
    matchMethod: text("match_method"),
    matchedBy: uuid("matched_by").references(() => employees.id, {
      onDelete: "set null",
    }),
    matchedAt: timestamp("matched_at", { withTimezone: true }),

    // Reply tracking
    replySentAt: timestamp("reply_sent_at", { withTimezone: true }),
    replyTemplate: text("reply_template"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    statusIdx: index("idx_slips_status").on(t.status, t.createdAt),
    customerIdx: index("idx_slips_customer").on(t.customerId),
  })
);

export type Slip = typeof slips.$inferSelect;
export type NewSlip = typeof slips.$inferInsert;
