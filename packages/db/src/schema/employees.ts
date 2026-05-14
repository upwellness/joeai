import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { employeeRoleEnum } from "./enums";

export const employees = pgTable(
  "employees",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    employeeCode: text("employee_code").notNull().unique(),
    fullName: text("full_name").notNull(),
    nickname: text("nickname"),
    email: text("email"),
    phone: text("phone"),
    team: text("team"),
    role: employeeRoleEnum("role").notNull().default("sale"),
    passwordHash: text("password_hash"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    emailIdx: index("idx_employees_email").on(t.email),
    activeRoleIdx: index("idx_employees_active_role").on(t.active, t.role),
  })
);

export type Employee = typeof employees.$inferSelect;
export type NewEmployee = typeof employees.$inferInsert;
