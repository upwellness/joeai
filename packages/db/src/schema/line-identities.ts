import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { employees } from "./employees";
import { customers } from "./customers";

export const lineIdentities = pgTable(
  "line_identities",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    lineUserId: text("line_user_id").notNull().unique(),
    currentDisplayName: text("current_display_name"),
    pictureUrl: text("picture_url"),
    employeeId: uuid("employee_id").references(() => employees.id, {
      onDelete: "set null",
    }),
    customerId: uuid("customer_id").references(() => customers.id, {
      onDelete: "set null",
    }),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
  },
  (t) => ({
    employeeIdx: index("idx_line_identities_employee").on(t.employeeId),
    customerIdx: index("idx_line_identities_customer").on(t.customerId),
    lastSeenIdx: index("idx_line_identities_last_seen").on(t.lastSeenAt),
  })
);

export type LineIdentity = typeof lineIdentities.$inferSelect;
export type NewLineIdentity = typeof lineIdentities.$inferInsert;
