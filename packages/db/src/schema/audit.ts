import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  bigserial,
  timestamp,
  jsonb,
  inet,
  index,
} from "drizzle-orm/pg-core";
import { employees } from "./employees";

export const auditLog = pgTable(
  "audit_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    actorId: uuid("actor_id").references(() => employees.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id"),
    beforeState: jsonb("before_state"),
    afterState: jsonb("after_state"),
    ipAddress: inet("ip_address"),
    userAgent: text("user_agent"),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    entityIdx: index("idx_audit_entity").on(t.entityType, t.entityId, t.occurredAt),
    actorIdx: index("idx_audit_actor").on(t.actorId, t.occurredAt),
  })
);

export const consents = pgTable(
  "consents",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    lineUserId: text("line_user_id").notNull(),
    consentType: text("consent_type").notNull(),
    consentVersion: text("consent_version").notNull(),
    granted: text("granted").notNull(),
    grantedAt: timestamp("granted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    evidenceUrl: text("evidence_url"),
    metadata: jsonb("metadata"),
  },
  (t) => ({
    userTypeIdx: index("idx_consent_user_type").on(
      t.lineUserId,
      t.consentType,
      t.consentVersion
    ),
  })
);

export type AuditLogEntry = typeof auditLog.$inferSelect;
export type NewAuditLogEntry = typeof auditLog.$inferInsert;
export type Consent = typeof consents.$inferSelect;
export type NewConsent = typeof consents.$inferInsert;
