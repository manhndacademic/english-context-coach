import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL ??
  "postgres://postgres:postgres@localhost:5432/english_context_coach";

const globalForDb = globalThis as unknown as {
  sql?: postgres.Sql;
};

export const sql =
  globalForDb.sql ??
  postgres(connectionString, {
    max: process.env.NODE_ENV === "test" ? 1 : 10,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.sql = sql;
}

export const db = drizzle(sql, { schema });
export { schema };

import { PgTransaction } from "drizzle-orm/pg-core";
import { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";

export type DrizzleClient = typeof db;
export type DrizzleTx = PgTransaction<
  PostgresJsQueryResultHKT,
  typeof schema,
  any
>;
export type DbClient = DrizzleClient | DrizzleTx;
