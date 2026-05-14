import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  integer,
  date,
  numeric,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { employees } from "./employees";

export const statementUploads = pgTable(
  "statement_uploads",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    uploadedBy: uuid("uploaded_by")
      .notNull()
      .references(() => employees.id, { onDelete: "restrict" }),
    bank: text("bank").notNull(),
    accountNumber: text("account_number"),
    statementDate: date("statement_date").notNull(),
    fileS3Key: text("file_s3_key"),
    rowCount: integer("row_count"),
    status: text("status").notNull().default("parsed"),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    bankDateIdx: index("idx_statement_bank_date").on(t.bank, t.statementDate),
  })
);

export const bankTransactions = pgTable(
  "bank_transactions",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    statementUploadId: uuid("statement_upload_id")
      .notNull()
      .references(() => statementUploads.id, { onDelete: "cascade" }),
    bank: text("bank").notNull(),
    accountNumber: text("account_number"),
    txnDatetime: timestamp("txn_datetime", { withTimezone: true }).notNull(),
    amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
    description: text("description"),
    referenceNumber: text("reference_number"),
    channel: text("channel"),
    rawRow: jsonb("raw_row"),
    // matchedSlipId is set when a slip is matched to this transaction;
    // we don't FK it here to avoid circular import — enforced at app level.
    matchedSlipId: uuid("matched_slip_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    matchLookupIdx: index("idx_bank_txn_match_lookup").on(
      t.txnDatetime,
      t.amount
    ),
    refIdx: index("idx_bank_txn_ref").on(t.referenceNumber),
    uniqueTxn: uniqueIndex("idx_bank_txn_unique").on(
      t.bank,
      t.accountNumber,
      t.txnDatetime,
      t.amount,
      t.referenceNumber
    ),
  })
);

export type StatementUpload = typeof statementUploads.$inferSelect;
export type NewStatementUpload = typeof statementUploads.$inferInsert;
export type BankTransaction = typeof bankTransactions.$inferSelect;
export type NewBankTransaction = typeof bankTransactions.$inferInsert;
