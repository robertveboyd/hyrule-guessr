import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { config } from "@/lib/config";
import * as schema from "./schema";

declare global {
  var hyruleGuessrSql: ReturnType<typeof postgres> | undefined;
}

const { databaseUrl, isProd } = config;

function createSql() {
  return postgres(databaseUrl, {
    max: isProd ? 1 : 5,
  });
}

export const sql = globalThis.hyruleGuessrSql ?? createSql();

if (!isProd) {
  globalThis.hyruleGuessrSql = sql;
}

export const db = drizzle(sql, { schema });