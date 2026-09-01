import "server-only";

import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  DATABASE_URL: z
    .string({ error: "DATABASE_URL is not set" })
    .min(1, { error: "DATABASE_URL is not set" })
    .regex(/^postgres(ql)?:\/\//, {
      error: "DATABASE_URL must start with postgres:// or postgresql://",
    }),
});

const env = envSchema.parse(process.env);

const isProd = env.NODE_ENV === "production";

export const config = {
    databaseUrl: env.DATABASE_URL,
    isProd
}

