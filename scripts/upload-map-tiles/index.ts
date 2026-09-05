import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { BlobServiceRateLimited, list, put } from "@vercel/blob";
import { z } from "zod";

import { parseFlags, parseWithZod } from "../lib/parse-flags";

const DEFAULT_DEST = "public/maptex";
const BLOB_PREFIX = "maptex";
const DEFAULT_CONCURRENCY = 2;
const MAX_RETRIES = 8;

const flags = parseFlags(
  {
    dest: { type: "string" },
    token: { type: "string" },
    concurrency: { type: "string" },
  },
  z.object({
    dest: z.string().min(1).default(DEFAULT_DEST),
    token: z.string().optional(),
    concurrency: z.coerce.number().int().min(1).max(8).default(DEFAULT_CONCURRENCY),
  }),
);

const token = parseWithZod(
  z
    .string({
      error:
        "BLOB_READ_WRITE_TOKEN is not set. Pass --token (do not put it in .env.local).",
    })
    .min(1, {
      error:
        "BLOB_READ_WRITE_TOKEN is not set. Pass --token (do not put it in .env.local).",
    }),
  flags.token ?? process.env.BLOB_READ_WRITE_TOKEN,
);

function destRoot() {
  return path.resolve(flags.dest);
}

function blobPathname(relativeFile: string) {
  return `${BLOB_PREFIX}/${relativeFile.split(path.sep).join("/")}`;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

let rateLimitedUntil = 0;

async function waitIfRateLimited() {
  const wait = rateLimitedUntil - Date.now();
  if (wait > 0) await sleep(wait);
}

async function withRateLimitRetry<T>(op: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    await waitIfRateLimited();
    try {
      return await op();
    } catch (error) {
      if (!(error instanceof BlobServiceRateLimited) || attempt >= MAX_RETRIES) {
        throw error;
      }
      const seconds = Math.max(error.retryAfter || 60, 1);
      rateLimitedUntil = Math.max(rateLimitedUntil, Date.now() + seconds * 1000);
      console.warn(`Rate limited; retrying in ${seconds}s…`);
    }
  }
}

async function listExisting(): Promise<Set<string>> {
  const paths = new Set<string>();
  let cursor: string | undefined;
  do {
    const page = await withRateLimitRetry(() =>
      list({
        prefix: `${BLOB_PREFIX}/`,
        token,
        cursor,
        limit: 1000,
      }),
    );
    for (const blob of page.blobs) {
      paths.add(blob.pathname);
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return paths;
}

async function localPngs(root: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await localPngs(full)));
    } else if (entry.isFile() && entry.name.endsWith(".png")) {
      files.push(full);
    }
  }
  return files;
}

async function runPool<T>(
  items: T[],
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  async function pump() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      await worker(items[i]);
    }
  }
  await Promise.all(Array.from({ length: flags.concurrency }, pump));
}

async function main() {
  const dest = destRoot();
  try {
    const info = await stat(dest);
    if (!info.isDirectory()) {
      throw new Error(`${dest} is not a directory.`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(
        `${dest} is missing. Run pnpm map:mirror-tiles first.`,
      );
    }
    throw error;
  }

  const files = await localPngs(dest);
  if (files.length === 0) {
    throw new Error(
      `No PNG files in ${dest}. Run pnpm map:mirror-tiles first.`,
    );
  }

  console.log(`Listing existing blobs under ${BLOB_PREFIX}/…`);
  const existing = await listExisting();
  console.log(
    `Uploading ${files.length} files from ${dest} → ${BLOB_PREFIX}/ (${existing.size} already in store, concurrency ${flags.concurrency}).`,
  );

  let uploaded = 0;
  let skipped = 0;
  let sampleUrl: string | undefined;

  await runPool(files, async (file) => {
    const pathname = blobPathname(path.relative(dest, file));
    if (existing.has(pathname)) {
      skipped += 1;
    } else {
      const body = await readFile(file);
      const blob = await withRateLimitRetry(() =>
        put(pathname, body, {
          access: "public",
          addRandomSuffix: false,
          contentType: "image/png",
          token,
        }),
      );
      sampleUrl ??= blob.url;
      uploaded += 1;
    }
    const done = uploaded + skipped;
    if (done % 250 === 0 || done === files.length) {
      console.log(
        `… ${done}/${files.length} (${uploaded} uploaded, ${skipped} existed)`,
      );
    }
  });

  if (!sampleUrl && existing.size > 0) {
    const page = await withRateLimitRetry(() =>
      list({
        prefix: `${BLOB_PREFIX}/`,
        token,
        limit: 1,
      }),
    );
    sampleUrl = page.blobs[0]?.url;
  }

  console.log(
    `Done. Uploaded ${uploaded}, already present ${skipped}.`,
  );
  if (sampleUrl) {
    const origin = new URL(sampleUrl).origin;
    console.log(
      `Set Vercel NEXT_PUBLIC_MAP_TILES_URL to:\n${origin}/${BLOB_PREFIX}/{z}/{x}/{y}.png`,
    );
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
