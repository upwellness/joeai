import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index";

export type DbClient = ReturnType<typeof createDbClient>;

export function createDbClient(connectionUrl?: string) {
  const url =
    connectionUrl ??
    process.env.DATABASE_URL ??
    "postgresql://joeai:joeai@localhost:5432/joeai";

  const sql = postgres(url, {
    max: 10,
    idle_timeout: 30,
    connect_timeout: 10,
  });

  return drizzle(sql, { schema });
}

let _db: DbClient | undefined;

export function getDb(): DbClient {
  if (!_db) {
    _db = createDbClient();
  }
  return _db;
}

export { schema };
