import bcrypt from "bcryptjs";
import { createDbClient } from "./client";
import { employees, customers } from "./schema/index";

// Default password for ALL seeded employees on first run.
// CHANGE THIS IMMEDIATELY after first login (no UI yet — update via SQL).
const DEFAULT_PASSWORD = process.env.SEED_DEFAULT_PASSWORD ?? "changeme";

async function main() {
  const db = createDbClient();
  console.log("Seeding test data...");

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);

  await db
    .insert(employees)
    .values([
      {
        employeeCode: "ADM001",
        fullName: "System Admin",
        email: "admin@example.com",
        role: "admin",
        passwordHash,
      },
      {
        employeeCode: "EMP001",
        fullName: "Somchai Salee",
        nickname: "Joe",
        email: "joe@example.com",
        team: "Bangkok Field Sales",
        role: "sale",
        passwordHash,
      },
      {
        employeeCode: "EMP002",
        fullName: "Naree Manager",
        email: "naree@example.com",
        team: "Bangkok Field Sales",
        role: "manager",
        passwordHash,
      },
      {
        employeeCode: "ACC001",
        fullName: "Accounting Lead",
        email: "accounting@example.com",
        role: "accounting",
        passwordHash,
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(customers)
    .values([
      {
        displayName: "ABC Trading Co., Ltd.",
        phone: "0812345678",
        notes: "Long-time customer, prefers PromptPay",
      },
    ])
    .onConflictDoNothing();

  console.log(`Seed complete. Login with admin@example.com / ${DEFAULT_PASSWORD}`);
  console.log("⚠️  Change all default passwords before going live.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
