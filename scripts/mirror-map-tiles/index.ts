import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

import {
  MAX_NATIVE_ZOOM,
  MIN_ZOOM,
  tileGridAtZoom,
} from "../../lib/game/crs";
import { parseFlags } from "../lib/parse-flags";

const DEFAULT_SOURCE = "https://objmap.zeldamods.org/game_files/maptex";
const DEFAULT_DEST = "public/maptex";
const CONCURRENCY = 8;

const flags = parseFlags(
  {
    source: { type: "string" },
    dest: { type: "string" },
  },
  z.object({
    source: z.url().default(DEFAULT_SOURCE),
    dest: z.string().min(1).default(DEFAULT_DEST),
  }),
);

function destRoot() {
  return path.resolve(flags.dest);
}

function sourceRoot() {
  return flags.source.replace(/\/$/, "");
}

async function exists(file: string) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function download(
  url: string,
  destFile: string,
): Promise<"saved" | "exists" | "missing"> {
  if (await exists(destFile)) return "exists";
  const response = await fetch(url, {
    headers: { "user-agent": "hyrule-guessr-map-mirror" },
  });
  if (response.status === 404) return "missing";
  if (!response.ok) {
    throw new Error(`${url} → HTTP ${response.status}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  await mkdir(path.dirname(destFile), { recursive: true });
  await writeFile(destFile, bytes);
  return "saved";
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
  await Promise.all(Array.from({ length: CONCURRENCY }, pump));
}

async function main() {
  const dest = destRoot();
  const source = sourceRoot();
  let saved = 0;
  let existed = 0;
  let missing = 0;

  const jobs: Array<{ url: string; file: string }> = [
    { url: `${source}/base.png`, file: path.join(dest, "base.png") },
  ];

  for (let z = 0; z <= MAX_NATIVE_ZOOM; z++) {
    const { cols, rows } = tileGridAtZoom(z);
    for (let x = 0; x < cols; x++) {
      for (let y = 0; y < rows; y++) {
        jobs.push({
          url: `${source}/${z}/${x}/${y}.png`,
          file: path.join(dest, String(z), String(x), `${y}.png`),
        });
      }
    }
  }

  console.log(
    `Mirroring ${jobs.length} files from ${source} → ${dest} (zooms 0–${MAX_NATIVE_ZOOM}; min play zoom ${MIN_ZOOM}).`,
  );

  await runPool(jobs, async (job) => {
    const result = await download(job.url, job.file);
    if (result === "saved") saved += 1;
    else if (result === "exists") existed += 1;
    else missing += 1;
    const done = saved + existed + missing;
    if (done % 250 === 0 || done === jobs.length) {
      console.log(
        `… ${done}/${jobs.length} (${saved} saved, ${existed} existed, ${missing} missing)`,
      );
    }
  });

  console.log(
    `Done. Saved ${saved}, already present ${existed}, skipped ${missing} (404).`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
