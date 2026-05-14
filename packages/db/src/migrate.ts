import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }

  console.log("Running migrations against", url.replace(/:[^:@]+@/, ":***@"));
  const sql = postgres(url, { max: 1 });
  const db = drizzle(sql);

  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations complete");

  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
