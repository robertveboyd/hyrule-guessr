import { createHash, randomUUID } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { BlobServiceRateLimited, put } from "@vercel/blob";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { z } from "zod";

import {
  WORLD_X_MAX,
  WORLD_X_MIN,
  WORLD_Z_MAX,
  WORLD_Z_MIN,
} from "../../lib/game/crs";
import { getPgError, PgCode } from "../../lib/db/errors";
import { stills, StillsUnique } from "../../lib/db/schema/stills";
import { parseWithZod } from "../lib/parse-flags";
import {
  PUBLIC_CATALOG_DIR,
  blobStillPathname,
  catalogImageUrl,
  contentTypeForExt,
  isAllowedImageFile,
  normalizeImageExt,
} from "./paths";

const MAX_BLOB_RETRIES = 8;

export const stillJsonEntrySchema = z.object({
  file: z.string().min(1),
  x: z.number({ error: "x must be a number." }),
  z: z.number({ error: "z must be a number." }),
});

export const stillsJsonSchema = z
  .array(stillJsonEntrySchema)
  .min(1, { error: "JSON must be a non-empty array of { file, x, z }." });

export type StillInput = z.infer<typeof stillJsonEntrySchema>;

export type AddStillTarget =
  | { dev: true }
  | { dev: false; databaseUrl: string; token: string };

export type AddStillOutcome = "created" | "skipped" | "updated";

export type AddStillResult = {
  id: string;
  imageUrl: string;
  x: number;
  z: number;
  outcome: AddStillOutcome;
};

type Db = ReturnType<typeof drizzle>;

type StoredStill = {
  id: string;
  imageUrl: string;
  x: number;
  z: number;
};

const stillReturning = {
  id: stills.id,
  imageUrl: stills.imageUrl,
  x: stills.x,
  z: stills.z,
} as const;

export function postgresUrl(value: string | undefined, error: string) {
  return parseWithZod(
    z
      .string({ error })
      .min(1, { error })
      .regex(/^postgres(ql)?:\/\//, {
        error: "DATABASE_URL must start with postgres:// or postgresql://",
      }),
    value,
  );
}

export function blobToken(flag: string | undefined) {
  return parseWithZod(
    z
      .string({
        error:
          "BLOB_READ_WRITE_TOKEN is not set. Pass --token (do not put it in .env.local).",
      })
      .min(1, {
        error:
          "BLOB_READ_WRITE_TOKEN is not set. Pass --token (do not put it in .env.local).",
      }),
    flag ?? process.env.BLOB_READ_WRITE_TOKEN,
  );
}

export function refineDestFlags(
  value: { dev: boolean; "database-url"?: string },
  ctx: z.RefinementCtx,
) {
  if (value.dev && value["database-url"]) {
    ctx.addIssue({
      code: "custom",
      message: "Do not pass --database-url with --dev.",
    });
  }
  if (!value.dev && !value["database-url"]) {
    ctx.addIssue({
      code: "custom",
      message:
        "Pass --database-url for production, or --dev to insert into local Docker.",
    });
  }
}

export function resolveTarget(flags: {
  dev: boolean;
  token?: string;
  "database-url"?: string;
}): { target: AddStillTarget; databaseUrl: string } {
  if (flags.dev) {
    const databaseUrl = postgresUrl(
      process.env.DATABASE_URL,
      "DATABASE_URL is not set in .env.local.",
    );
    return { target: { dev: true }, databaseUrl };
  }
  const databaseUrl = postgresUrl(
    flags["database-url"],
    "Pass --database-url for production.",
  );
  return {
    target: { dev: false, databaseUrl, token: blobToken(flags.token) },
    databaseUrl,
  };
}

export function hashStillBytes(body: Uint8Array): string {
  return createHash("sha256").update(body).digest("hex");
}

export function existingStillAction(
  existing: { x: number; z: number } | undefined,
  input: { x: number; z: number },
): "create" | "skip" | "update" {
  if (!existing) return "create";
  if (existing.x === input.x && existing.z === input.z) return "skip";
  return "update";
}

export function formatAddStillLog(
  still: AddStillResult,
  dest: "dev" | "prod",
): string {
  const where = `(x ${still.x}, z ${still.z}) [${dest}]`;
  if (still.outcome === "skipped") {
    return `Skipped still ${still.id} ${still.imageUrl} ${where} (same image).`;
  }
  if (still.outcome === "updated") {
    return `Updated still ${still.id} ${still.imageUrl} ${where} (same image, new coordinates).`;
  }
  return `Created still ${still.id} ${still.imageUrl} ${where}.`;
}

function inMainField(x: number, z: number) {
  if (x < WORLD_X_MIN || x > WORLD_X_MAX || z < WORLD_Z_MIN || z > WORLD_Z_MAX) {
    throw new Error(
      `Coordinates must be inside MainField (x ${WORLD_X_MIN}…${WORLD_X_MAX}, z ${WORLD_Z_MIN}…${WORLD_Z_MAX}).`,
    );
  }
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function requireStill(
  still: StoredStill | undefined,
  action: string,
): StoredStill {
  if (!still) {
    throw new Error(`${action} did not return a still.`);
  }
  return still;
}

export function createBlobPutter() {
  let rateLimitedUntil = 0;
  return async function putWithRetry(
    pathname: string,
    body: Buffer,
    token: string,
    contentType: string,
  ) {
    for (let attempt = 0; ; attempt++) {
      const wait = rateLimitedUntil - Date.now();
      if (wait > 0) await sleep(wait);
      try {
        return await put(pathname, body, {
          access: "public",
          addRandomSuffix: false,
          allowOverwrite: true,
          contentType,
          token,
        });
      } catch (error) {
        if (
          !(error instanceof BlobServiceRateLimited) ||
          attempt >= MAX_BLOB_RETRIES
        ) {
          throw error;
        }
        const seconds = Math.max(error.retryAfter || 60, 1);
        rateLimitedUntil = Date.now() + seconds * 1000;
        console.warn(`Rate limited; retrying in ${seconds}s…`);
      }
    }
  };
}

async function stillByHash(db: Db, contentHash: string) {
  const [existing] = await db
    .select(stillReturning)
    .from(stills)
    .where(eq(stills.contentHash, contentHash))
    .limit(1);
  return existing;
}

async function applyExisting(
  db: Db,
  existing: StoredStill,
  input: StillInput,
): Promise<AddStillResult> {
  if (existingStillAction(existing, input) === "skip") {
    return { ...existing, outcome: "skipped" };
  }
  const [updated] = await db
    .update(stills)
    .set({ x: input.x, z: input.z })
    .where(eq(stills.id, existing.id))
    .returning(stillReturning);
  return { ...requireStill(updated, "Update"), outcome: "updated" };
}

export async function addStill(
  input: StillInput,
  target: AddStillTarget,
  db: Db,
  putBlob = createBlobPutter(),
): Promise<AddStillResult> {
  inMainField(input.x, input.z);

  const file = path.resolve(input.file);
  try {
    const info = await stat(file);
    if (!info.isFile()) {
      throw new Error(`${input.file} is not a file.`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`${input.file} does not exist.`);
    }
    throw error;
  }
  if (!isAllowedImageFile(file)) {
    throw new Error(`${input.file} must be a .jpg or .png file.`);
  }

  const body = await readFile(file);
  const contentHash = hashStillBytes(body);
  const existing = await stillByHash(db, contentHash);
  if (existing) {
    return applyExisting(db, existing, input);
  }

  const id = randomUUID();
  const ext = normalizeImageExt(file);
  const catalogRoot = path.resolve(PUBLIC_CATALOG_DIR);

  let imageUrl: string;
  if (target.dev) {
    imageUrl = catalogImageUrl(file, catalogRoot);
  } else {
    const pathname = blobStillPathname(contentHash, ext);
    const blob = await putBlob(
      pathname,
      body,
      target.token,
      contentTypeForExt(ext),
    );
    imageUrl = blob.url;
  }

  try {
    const [created] = await db
      .insert(stills)
      .values({ id, imageUrl, contentHash, x: input.x, z: input.z })
      .returning(stillReturning);
    return { ...requireStill(created, "Insert"), outcome: "created" };
  } catch (error) {
    const pg = getPgError(error);
    if (pg.code === PgCode.UniqueViolation && pg.constraint === StillsUnique.contentHash) {
      const raced = await stillByHash(db, contentHash);
      if (raced) {
        return applyExisting(db, raced, input);
      }
    }
    throw error;
  }
}
