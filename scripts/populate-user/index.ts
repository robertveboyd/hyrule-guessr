import { hash } from "argon2";
import { config as loadEnv } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { z } from "zod";

import { argon2Options } from "../../lib/auth/argon2-options";
import { getPgError, PgCode } from "../../lib/db/errors";
import { users, UsersUnique } from "../../lib/db/schema/users";
import { parseFlags, parseWithZod } from "../lib/parse-flags";

loadEnv({ path: ".env.local", quiet: true });

const flags = parseFlags(
  {
    email: { type: "string" },
    password: { type: "string" },
    username: { type: "string" },
    "database-url": { type: "string" },
  },
  z.object({
    email: z
      .string({ error: "Email is required." })
      .trim()
      .toLowerCase()
      .min(1, { error: "Email is required." }),
    password: z
      .string({ error: "Password is required." })
      .min(8, { error: "Password must be at least 8 characters." }),
    username: z
      .string({ error: "Username is required." })
      .trim()
      .regex(/^[A-Za-z0-9_]{3,20}$/, {
        error:
          "Username must be 3–20 characters: letters, numbers, or underscore.",
      }),
    "database-url": z.string().optional(),
  }),
);

const databaseUrl = parseWithZod(
  z
    .string({
      error:
        "DATABASE_URL is not set. Pass --database-url or set it in .env.local.",
    })
    .min(1, {
      error:
        "DATABASE_URL is not set. Pass --database-url or set it in .env.local.",
    })
    .regex(/^postgres(ql)?:\/\//, {
      error: "DATABASE_URL must start with postgres:// or postgresql://",
    }),
  flags["database-url"] ?? process.env.DATABASE_URL,
);

const { email, password, username } = flags;

async function main() {
  const passwordHash = await hash(password, argon2Options);
  const sqlClient = postgres(databaseUrl, { max: 1 });
  const db = drizzle(sqlClient);

  try {
    const [created] = await db
      .insert(users)
      .values({ email, password: passwordHash, username })
      .returning({
        id: users.id,
        email: users.email,
        username: users.username,
      });

    console.log(
      `Created user ${created.username} <${created.email}> (${created.id}).`,
    );
  } catch (error) {
    const pg = getPgError(error);
    if (pg.code === PgCode.UniqueViolation) {
      if (pg.constraint === UsersUnique.email) {
        throw new Error(`A user with email ${email} already exists.`);
      }
      if (pg.constraint === UsersUnique.username) {
        throw new Error(`A user with username ${username} already exists.`);
      }
      throw new Error("A user with that email or username already exists.");
    }
    throw error;
  } finally {
    await sqlClient.end();
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
