import { config as loadEnv } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { z } from "zod";

import {
  addStill,
  formatAddStillLog,
  refineDestFlags,
  resolveTarget,
} from "./add-still";
import { parseFlags } from "../lib/parse-flags";

loadEnv({ path: ".env.local", quiet: true });

const flags = parseFlags(
  {
    dev: { type: "boolean", default: false },
    file: { type: "string" },
    x: { type: "string" },
    z: { type: "string" },
    token: { type: "string" },
    "database-url": { type: "string" },
  },
  z
    .object({
      dev: z.boolean(),
      file: z.string({ error: "Pass --file." }).min(1, { error: "Pass --file." }),
      x: z.coerce.number({ error: "Pass --x." }),
      z: z.coerce.number({ error: "Pass --z." }),
      token: z.string().optional(),
      "database-url": z.string().optional(),
    })
    .superRefine(refineDestFlags),
);

async function main() {
  const { target, databaseUrl } = resolveTarget(flags);
  const sqlClient = postgres(databaseUrl, { max: 1 });
  const db = drizzle(sqlClient);
  try {
    const still = await addStill(
      { file: flags.file, x: flags.x, z: flags.z },
      target,
      db,
    );
    console.log(formatAddStillLog(still, flags.dev ? "dev" : "prod"));
  } finally {
    await sqlClient.end();
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
