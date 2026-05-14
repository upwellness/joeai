import { createDbClient } from "./client";
import { employees, customers, conversations } from "./schema/index";

async function main() {
  const db = createDbClient();

  console.log("Seeding test data...");

  // Sample employees
  await db
    .insert(employees)
    .values([
      {
        employeeCode: "EMP001",
        fullName: "Somchai Salee",
        nickname: "Joe",
        email: "joe@example.com",
        team: "Bangkok Field Sales",
        role: "sale",
      },
      {
        employeeCode: "EMP002",
        fullName: "Naree Manager",
        email: "naree@example.com",
        team: "Bangkok Field Sales",
        role: "manager",
      },
      {
        employeeCode: "ADM001",
        fullName: "System Admin",
        email: "admin@example.com",
        role: "admin",
      },
    ])
    .onConflictDoNothing();

  // Sample customer
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

  console.log("Seed complete");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
