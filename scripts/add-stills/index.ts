import { readFile } from "node:fs/promises";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { z } from "zod";

import {
  addStill,
  createBlobPutter,
  formatAddStillLog,
  refineDestFlags,
  resolveTarget,
  stillsJsonSchema,
} from "../add-still/add-still";
import { parseFlags, parseWithZod } from "../lib/parse-flags";

loadEnv({ path: ".env.local", quiet: true });

const flags = parseFlags(
  {
    dev: { type: "boolean", default: false },
    from: { type: "string" },
    token: { type: "string" },
    "database-url": { type: "string" },
  },
  z
    .object({
      dev: z.boolean(),
      from: z
        .string({ error: "Pass --from with a JSON file." })
        .min(1, { error: "Pass --from with a JSON file." }),
      token: z.string().optional(),
      "database-url": z.string().optional(),
    })
    .superRefine(refineDestFlags),
);

async function main() {
  const from = path.resolve(flags.from);
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(from, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`${flags.from} does not exist.`);
    }
    throw new Error(`${flags.from} is not valid JSON.`);
  }
  const entries = parseWithZod(stillsJsonSchema, parsed);

  const { target, databaseUrl } = resolveTarget(flags);
  const sqlClient = postgres(databaseUrl, { max: 1 });
  const db = drizzle(sqlClient);
  const putBlob = createBlobPutter();
  const dest = flags.dev ? "dev" : "prod";
  let processed = 0;
  let created = 0;
  let skipped = 0;
  let updated = 0;
  try {
    for (const entry of entries) {
      const still = await addStill(entry, target, db, putBlob);
      processed += 1;
      if (still.outcome === "skipped") skipped += 1;
      else if (still.outcome === "updated") updated += 1;
      else created += 1;
      console.log(formatAddStillLog(still, dest));
    }
  } catch (error) {
    const remaining = entries.length - processed;
    const suffix = remaining > 0 ? ` Stopped; ${remaining} still(s) not added.` : "";
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${message}${suffix}`);
  } finally {
    await sqlClient.end();
  }
  console.log(
    `Added ${created}, skipped ${skipped}, updated ${updated}.`,
  );
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
