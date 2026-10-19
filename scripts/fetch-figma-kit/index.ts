import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { config as loadEnv } from "dotenv";
import { z } from "zod";

import { parseWithZod } from "../lib/parse-flags";

loadEnv({ path: ".env.local", quiet: true });

const DEFAULT_OUT = "figma";
const API = "https://api.figma.com/v1";
const FILL_CONCURRENCY = 6;
const MAX_RETRIES = 8;
const MAX_RETRY_WAIT_MS = 60_000;
const COMPONENT_BATCH = 8;
const MIN_IMAGE_INTERVAL_MS = 7_000;
const FILE_KEY_ERROR =
  "Pass a Figma file key as the first argument, e.g. pnpm figma:fetch-kit -- <file-key>.";

const { values, positionals } = parseArgs({
  args: process.argv.slice(2).filter((arg) => arg !== "--"),
  options: {
    "file-key": { type: "string" },
    out: { type: "string" },
    scale: { type: "string" },
    "dry-run": { type: "boolean", default: false },
    "skip-fills": { type: "boolean", default: false },
    "skip-renders": { type: "boolean", default: false },
    "skip-file": { type: "boolean", default: false },
    "refresh-file": { type: "boolean", default: false },
    renders: { type: "boolean", default: false },
    svgs: { type: "boolean", default: false },
    "svg-frames": { type: "boolean", default: false },
  },
  strict: true,
  allowPositionals: true,
});

if (positionals.length > 1) {
  console.error("Pass only one Figma file key.");
  process.exit(1);
}

const flags = parseWithZod(
  z.object({
    "file-key": z
      .string({ error: FILE_KEY_ERROR })
      .min(1, { error: FILE_KEY_ERROR }),
    out: z.string().min(1).default(DEFAULT_OUT),
    scale: z.coerce.number().min(0.01).max(4).default(2),
    "dry-run": z.boolean(),
    "skip-fills": z.boolean(),
    "skip-renders": z.boolean(),
    "skip-file": z.boolean(),
    "refresh-file": z.boolean(),
    renders: z.boolean(),
    svgs: z.boolean(),
    "svg-frames": z.boolean(),
  }),
  {
    ...values,
    "file-key": positionals[0] ?? values["file-key"],
  },
);

type FigmaPaint = {
  type?: string;
  imageRef?: string;
};

type FigmaNode = {
  id: string;
  name: string;
  type: string;
  children?: FigmaNode[];
  fills?: FigmaPaint[] | unknown;
  strokes?: FigmaPaint[] | unknown;
  effects?: unknown;
  style?: unknown;
  styles?: Partial<
    Record<"fill" | "fills" | "stroke" | "strokes" | "text" | "effect" | "effects", string>
  >;
  componentPropertyDefinitions?: unknown;
  componentSetId?: string;
};

type ComponentMeta = {
  name: string;
  description?: string;
  key?: string;
  componentSetId?: string;
};

type ComponentSetMeta = {
  name: string;
  description?: string;
  key?: string;
};

type StyleMeta = {
  name: string;
  styleType: string;
  key?: string;
  description?: string;
};

type FigmaFile = {
  name: string;
  lastModified: string;
  version: string;
  document: FigmaNode;
  components?: Record<string, ComponentMeta>;
  componentSets?: Record<string, ComponentSetMeta>;
  styles?: Record<string, StyleMeta>;
};

type RenderJob = { id: string; name: string; kind: "frame" | "component" };
type ExportFormat = "png" | "svg";
type FillUse = {
  imageRef: string;
  nodeId: string;
  nodeName: string;
  nodeType: string;
  pageId?: string;
  pageName?: string;
  parentId?: string;
  parentName?: string;
  role: "fill" | "stroke";
};

class RateLimitedError extends Error {
  constructor(pathname: string, retryAfterSec: number | null) {
    const extra =
      retryAfterSec != null ? ` Retry-After=${retryAfterSec}s.` : "";
    super(
      `Figma 429 on ${pathname}.${extra} Retry-After is longer than a leaky-bucket pause; the file may still be on a Starter plan or the token is a View seat.`,
    );
    this.name = "RateLimitedError";
  }
}

function token() {
  const value = process.env.FIGMA_TOKEN?.trim();
  if (!value) {
    throw new Error(
      "FIGMA_TOKEN is missing. Set it in .env.local (file_content:read).",
    );
  }
  return value;
}

function outRoot() {
  return path.resolve(flags.out);
}

function slug(name: string, id: string) {
  const base =
    name
      .replaceAll("&amp;", "and")
      .replaceAll(/[/\\?%*:|"<>]/g, "-")
      .replaceAll(/\s+/g, " ")
      .trim()
      .slice(0, 80) || "node";
  return `${base.replaceAll(" ", "_")}_${id.replaceAll(":", "-")}`;
}

async function exists(file: string) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatFetchError(error: unknown) {
  if (!(error instanceof Error)) return String(error);
  const cause = (error as Error & { cause?: unknown }).cause;
  if (cause instanceof Error) {
    const code =
      "code" in cause && typeof cause.code === "string" ? cause.code : "";
    return `${error.message}${code ? ` (${code})` : ""}: ${cause.message}`;
  }
  return error.message;
}

function retryWait(response: Response | null, delay: number) {
  let ms = delay;
  const raw = response?.headers.get("retry-after")?.trim();
  if (raw) {
    const asNumber = Number(raw);
    if (Number.isFinite(asNumber) && asNumber >= 0) {
      ms = asNumber * 1000;
    } else {
      const when = Date.parse(raw);
      if (Number.isFinite(when)) ms = Math.max(0, when - Date.now());
    }
  }
  return Math.min(Math.max(ms, 1000), MAX_RETRY_WAIT_MS);
}

async function figmaFetch(pathname: string) {
  return fetch(`${API}${pathname}`, {
    headers: {
      "X-Figma-Token": token(),
      "User-Agent": "hyrule-guessr-figma-fetch",
    },
  });
}

async function figmaJson<T>(pathname: string): Promise<T> {
  let delay = 2000;
  let lastError = `Figma gave up after ${MAX_RETRIES} tries: ${pathname}`;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    let response: Response;
    try {
      response = await figmaFetch(pathname);
    } catch (error) {
      lastError = formatFetchError(error);
      console.warn(
        `Network error on ${pathname} (${attempt}/${MAX_RETRIES}): ${lastError}`,
      );
      await sleep(delay);
      delay = Math.min(delay * 2, MAX_RETRY_WAIT_MS);
      continue;
    }
    if (response.status === 429) {
      const retryAfter = Number(response.headers.get("retry-after"));
      if (Number.isFinite(retryAfter) && retryAfter > 180) {
        throw new RateLimitedError(pathname, retryAfter);
      }
      const wait = retryWait(response, delay);
      console.warn(`Rate limited on ${pathname}; waiting ${wait}ms`);
      await sleep(wait);
      delay = Math.min(Math.max(delay, wait) * 2, MAX_RETRY_WAIT_MS);
      continue;
    }
    if (!response.ok) {
      const body = (await response.text()).slice(0, 400);
      throw new Error(`Figma ${response.status} ${pathname}: ${body}`);
    }
    return (await response.json()) as T;
  }
  throw new Error(lastError);
}

async function download(url: string, destFile: string) {
  if (await exists(destFile)) return "exists" as const;
  let delay = 2000;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(url, {
        headers: { "User-Agent": "hyrule-guessr-figma-fetch" },
      });
    } catch (error) {
      console.warn(
        `Network error downloading (${attempt}/${MAX_RETRIES}): ${formatFetchError(error)}`,
      );
      await sleep(delay);
      delay = Math.min(delay * 2, MAX_RETRY_WAIT_MS);
      continue;
    }
    if (response.status === 429) {
      const wait = retryWait(response, delay);
      await sleep(wait);
      delay = Math.min(Math.max(delay, wait) * 2, MAX_RETRY_WAIT_MS);
      continue;
    }
    if (!response.ok) {
      throw new Error(`Download HTTP ${response.status}`);
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    await mkdir(path.dirname(destFile), { recursive: true });
    await writeFile(destFile, bytes);
    return "saved" as const;
  }
  throw new Error(`Download gave up after ${MAX_RETRIES} tries`);
}

function extFromUrl(url: string) {
  const match = /\.([a-zA-Z0-9]+)(?:\?|$)/.exec(url);
  const ext = match?.[1]?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg" || ext === "png" || ext === "gif" || ext === "webp") {
    return ext === "jpeg" ? "jpg" : ext;
  }
  return "png";
}

async function writeJson(file: string, value: unknown, pretty = true) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(
    file,
    pretty ? `${JSON.stringify(value, null, 2)}\n` : `${JSON.stringify(value)}\n`,
  );
}

function walk(
  node: FigmaNode,
  visit: (node: FigmaNode, parent?: FigmaNode) => void,
) {
  const stack: Array<{ node: FigmaNode; parent?: FigmaNode }> = [{ node }];
  while (stack.length > 0) {
    const current = stack.pop()!;
    visit(current.node, current.parent);
    const children = current.node.children;
    if (!children) continue;
    for (let i = children.length - 1; i >= 0; i -= 1) {
      stack.push({ node: children[i], parent: current.node });
    }
  }
}

function collectJobs(file: FigmaFile): RenderJob[] {
  const pages = file.document.children ?? [];
  const jobs: RenderJob[] = [];
  const seen = new Set<string>();

  function add(job: RenderJob) {
    if (seen.has(job.id)) return;
    seen.add(job.id);
    jobs.push(job);
  }

  for (const page of pages) {
    for (const child of page.children ?? []) {
      if (child.type === "INSTANCE") continue;
      add({ id: child.id, name: child.name, kind: "frame" });
    }
  }

  for (const [id, meta] of Object.entries(file.components ?? {})) {
    add({ id, name: meta.name, kind: "component" });
  }

  walk(file.document, (node) => {
    if (node.type === "COMPONENT") {
      add({ id: node.id, name: node.name, kind: "component" });
    }
  });

  return jobs;
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
  await Promise.all(Array.from({ length: FILL_CONCURRENCY }, pump));
}

async function loadJobsFromDisk(
  dest: string,
  fileKey: string,
): Promise<RenderJob[] | null> {
  const manifestPath = path.join(dest, "meta", "manifest.json");
  const framesPath = path.join(dest, "meta", "frames.json");
  const componentsPath = path.join(dest, "meta", "components.json");
  if (
    !(await exists(manifestPath)) ||
    !(await exists(framesPath)) ||
    !(await exists(componentsPath))
  ) {
    return null;
  }
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
    fileKey?: string;
  };
  if (manifest.fileKey !== fileKey) return null;
  const frames = JSON.parse(await readFile(framesPath, "utf8")) as RenderJob[];
  const components = JSON.parse(
    await readFile(componentsPath, "utf8"),
  ) as RenderJob[];
  return [...frames, ...components];
}

async function loadFileFromDisk(dest: string): Promise<FigmaFile | null> {
  const documentPath = path.join(dest, "meta", "document.json");
  if (!(await exists(documentPath))) return null;
  return JSON.parse(await readFile(documentPath, "utf8")) as FigmaFile;
}

async function fetchFigmaFile(
  fileKey: string,
  dest: string,
): Promise<FigmaFile> {
  try {
    console.log("GET /v1/files (full tree, no depth cap)…");
    return await figmaJson<FigmaFile>(`/files/${fileKey}`);
  } catch (error) {
    if (error instanceof RateLimitedError) throw error;
    const pagesPath = path.join(dest, "meta", "pages.json");
    if (!(await exists(pagesPath))) throw error;
    const pages = JSON.parse(await readFile(pagesPath, "utf8")) as Array<{
      id: string;
      name: string;
    }>;
    const ids = pages.map((page) => page.id).filter(Boolean);
    if (ids.length === 0) throw error;
    console.warn(
      `Full file fetch failed (${formatFetchError(error)}); fetching ${ids.length} pages via /nodes.`,
    );
    const body = await figmaJson<{
      name?: string;
      lastModified?: string;
      version?: string;
      nodes?: Record<
        string,
        {
          document?: FigmaNode;
          components?: Record<string, ComponentMeta>;
          componentSets?: Record<string, ComponentSetMeta>;
          styles?: Record<string, StyleMeta>;
        } | null
      >;
    }>(`/files/${fileKey}/nodes?ids=${encodeURIComponent(ids.join(","))}`);
    const canvases: FigmaNode[] = [];
    const components: Record<string, ComponentMeta> = {};
    const componentSets: Record<string, ComponentSetMeta> = {};
    const styles: Record<string, StyleMeta> = {};
    for (const id of ids) {
      const node = body.nodes?.[id];
      if (!node?.document) continue;
      canvases.push(node.document);
      Object.assign(components, node.components ?? {});
      Object.assign(componentSets, node.componentSets ?? {});
      Object.assign(styles, node.styles ?? {});
    }
    return {
      name: body.name ?? "Zelda BOTW UI Kit (Community)",
      lastModified: body.lastModified ?? "",
      version: body.version ?? "",
      document: {
        id: "0:0",
        name: "Document",
        type: "DOCUMENT",
        children: canvases,
      },
      components,
      componentSets,
      styles,
    };
  }
}

function imageRefsFromPaints(paints: unknown): string[] {
  if (!Array.isArray(paints)) return [];
  const refs: string[] = [];
  for (const paint of paints) {
    if (!paint || typeof paint !== "object") continue;
    const typed = paint as FigmaPaint;
    if (typed.type === "IMAGE" && typed.imageRef) refs.push(typed.imageRef);
  }
  return refs;
}

function collectFillIdentity(file: FigmaFile): FillUse[] {
  const uses: FillUse[] = [];
  const pages = file.document.children ?? [];
  for (const page of pages) {
    walk(page, (node, parent) => {
      for (const role of ["fill", "stroke"] as const) {
        const refs = imageRefsFromPaints(
          role === "fill" ? node.fills : node.strokes,
        );
        for (const imageRef of refs) {
          uses.push({
            imageRef,
            nodeId: node.id,
            nodeName: node.name,
            nodeType: node.type,
            pageId: page.id,
            pageName: page.name,
            parentId: parent?.id,
            parentName: parent?.name,
            role,
          });
        }
      }
    });
  }
  return uses;
}

function collectStyles(file: FigmaFile) {
  const styles = Object.entries(file.styles ?? {}).map(([id, meta]) => ({
    id,
    name: meta.name,
    styleType: meta.styleType,
    key: meta.key,
    description: meta.description,
    samples: [] as Array<{
      nodeId: string;
      nodeName: string;
      pageName?: string;
      fills?: unknown;
      strokes?: unknown;
      style?: unknown;
      effects?: unknown;
    }>,
  }));
  const byId = new Map(styles.map((style) => [style.id, style]));
  const pages = file.document.children ?? [];
  for (const page of pages) {
    walk(page, (node) => {
      const bound = node.styles;
      if (!bound) return;
      const ids = Object.values(bound).filter(
        (value): value is string => typeof value === "string",
      );
      for (const id of ids) {
        const style = byId.get(id);
        if (!style || style.samples.length >= 3) continue;
        style.samples.push({
          nodeId: node.id,
          nodeName: node.name,
          pageName: page.name,
          fills: node.fills,
          strokes: node.strokes,
          style: node.style,
          effects: node.effects,
        });
      }
    });
  }
  return styles;
}

function collectComponentSets(file: FigmaFile) {
  const sets = new Map<
    string,
    {
      id: string;
      name: string;
      key?: string;
      description?: string;
      componentPropertyDefinitions?: unknown;
      variants: Array<{ id: string; name: string; key?: string }>;
    }
  >();

  for (const [id, meta] of Object.entries(file.componentSets ?? {})) {
    sets.set(id, {
      id,
      name: meta.name,
      key: meta.key,
      description: meta.description,
      variants: [],
    });
  }

  for (const [id, meta] of Object.entries(file.components ?? {})) {
    const setId = meta.componentSetId;
    if (!setId) continue;
    const set = sets.get(setId) ?? {
      id: setId,
      name: setId,
      variants: [],
    };
    if (!set.variants.some((variant) => variant.id === id)) {
      set.variants.push({ id, name: meta.name, key: meta.key });
    }
    sets.set(setId, set);
  }

  walk(file.document, (node) => {
    if (node.type !== "COMPONENT_SET") return;
    const set = sets.get(node.id) ?? {
      id: node.id,
      name: node.name,
      variants: [],
    };
    set.name = node.name || set.name;
    set.componentPropertyDefinitions = node.componentPropertyDefinitions;
    for (const child of node.children ?? []) {
      if (child.type !== "COMPONENT") continue;
      if (!set.variants.some((variant) => variant.id === child.id)) {
        set.variants.push({ id: child.id, name: child.name });
      }
    }
    sets.set(node.id, set);
  });

  return [...sets.values()];
}

async function writeDerivedMeta(dest: string, file: FigmaFile) {
  const metaDir = path.join(dest, "meta");
  await mkdir(metaDir, { recursive: true });
  await writeJson(path.join(metaDir, "document.json"), file, false);

  const styles = collectStyles(file);
  await writeJson(path.join(metaDir, "styles.json"), styles);

  const componentSets = collectComponentSets(file);
  await writeJson(path.join(metaDir, "component-sets.json"), componentSets);

  const uses = collectFillIdentity(file);
  const byRef: Record<string, FillUse[]> = {};
  for (const use of uses) {
    (byRef[use.imageRef] ??= []).push(use);
  }
  let knownRefs: string[] = [];
  const fillsPath = path.join(metaDir, "fills.json");
  if (await exists(fillsPath)) {
    knownRefs = JSON.parse(await readFile(fillsPath, "utf8")) as string[];
  }
  const used = new Set(Object.keys(byRef));
  const unusedRefs = knownRefs.filter((ref) => !used.has(ref));
  await writeJson(path.join(metaDir, "fill-identity.json"), {
    uses: uses.length,
    refs: Object.keys(byRef).length,
    unusedRefs,
    byRef,
  });

  console.log(
    `Wrote document tree, ${styles.length} styles, ${componentSets.length} component sets, ${uses.length} fill uses (${Object.keys(byRef).length} refs).`,
  );
}

function createPacer() {
  let lastImageAt = 0;
  return async function paceImages() {
    const wait = MIN_IMAGE_INTERVAL_MS - (Date.now() - lastImageAt);
    if (wait > 0) await sleep(wait);
    lastImageAt = Date.now();
  };
}

function batchJobs(jobs: RenderJob[]) {
  const batches: RenderJob[][] = [];
  let current: RenderJob[] = [];
  for (const job of jobs) {
    const limit = job.kind === "frame" ? 1 : COMPONENT_BATCH;
    if (current.length === 0) {
      current.push(job);
      if (limit === 1) {
        batches.push(current);
        current = [];
      }
      continue;
    }
    if (current[0].kind !== job.kind || current.length >= limit) {
      batches.push(current);
      current = [job];
      if (limit === 1) {
        batches.push(current);
        current = [];
      }
      continue;
    }
    current.push(job);
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

async function exportNodes(opts: {
  dest: string;
  fileKey: string;
  jobs: RenderJob[];
  format: ExportFormat;
  scale: number;
  pace: () => Promise<void>;
}) {
  const ext = opts.format === "svg" ? "svg" : "png";
  const label = opts.format === "svg" ? "SVGs" : "Renders";
  const failuresFile =
    opts.format === "svg" ? "svg-failures.json" : "render-failures.json";
  let saved = 0;
  let existed = 0;
  let failed = 0;
  let processed = 0;
  const failures: Array<{ id: string; name: string; error: string }> = [];

  function jobPath(job: RenderJob) {
    const root =
      opts.format === "svg" ? path.join(opts.dest, "svgs") : opts.dest;
    return path.join(
      root,
      job.kind === "frame" ? "frames" : "components",
      `${slug(job.name, job.id)}.${ext}`,
    );
  }

  async function renderIds(ids: string[], scale: number) {
    await opts.pace();
    const query = new URLSearchParams({
      ids: ids.join(","),
      format: opts.format,
    });
    if (opts.format === "png") query.set("scale", String(scale));
    const rendered = await figmaJson<{
      err?: string | null;
      images?: Record<string, string | null>;
    }>(`/images/${opts.fileKey}?${query.toString()}`);
    if (rendered.err) throw new Error(String(rendered.err));
    return rendered.images ?? {};
  }

  async function saveImages(
    batch: RenderJob[],
    images: Record<string, string | null>,
  ) {
    for (const job of batch) {
      const url = images[job.id];
      if (!url) {
        failed += 1;
        failures.push({
          id: job.id,
          name: job.name,
          error: "Figma returned no image URL",
        });
        continue;
      }
      const result = await download(url, jobPath(job));
      if (result === "saved") saved += 1;
      else existed += 1;
    }
  }

  async function renderBatch(batch: RenderJob[]): Promise<void> {
    try {
      const images = await renderIds(
        batch.map((job) => job.id),
        opts.scale,
      );
      await saveImages(batch, images);
      return;
    } catch (error) {
      if (error instanceof RateLimitedError) throw error;
      if (batch.length > 1) {
        console.warn(
          `Batch of ${batch.length} failed (${formatFetchError(error)}); retrying one at a time.`,
        );
        for (const job of batch) {
          try {
            await renderBatch([job]);
          } catch (inner) {
            if (inner instanceof RateLimitedError) throw inner;
            const message = formatFetchError(inner);
            failed += 1;
            failures.push({
              id: job.id,
              name: job.name,
              error: message,
            });
            console.warn(`Skip ${job.id} (${job.name}): ${message}`);
          }
        }
        return;
      }
      if (opts.format === "png" && opts.scale !== 1) {
        console.warn(
          `Retry ${batch[0].id} at scale 1: ${formatFetchError(error)}`,
        );
        const images = await renderIds([batch[0].id], 1);
        await saveImages(batch, images);
        return;
      }
      throw error;
    }
  }

  const pending: RenderJob[] = [];
  for (const job of opts.jobs) {
    if (await exists(jobPath(job))) existed += 1;
    else pending.push(job);
  }
  const batches = batchJobs(pending);
  console.log(
    `${label}: ${pending.length} nodes in ${batches.length} requests (~${MIN_IMAGE_INTERVAL_MS / 1000}s apart, frames 1-wide, components ${COMPONENT_BATCH}-wide).`,
  );

  try {
    for (const batch of batches) {
      try {
        await renderBatch(batch);
      } catch (error) {
        if (error instanceof RateLimitedError) throw error;
        const message = formatFetchError(error);
        for (const job of batch) {
          failed += 1;
          failures.push({ id: job.id, name: job.name, error: message });
          console.warn(`Skip ${job.id} (${job.name}): ${message}`);
        }
      }
      processed += batch.length;
      if (processed % 24 < batch.length || processed === pending.length) {
        console.log(
          `${label} … ${processed}/${pending.length} pending (${saved} saved, ${existed} existed, ${failed} failed)`,
        );
      }
    }
  } catch (error) {
    if (error instanceof RateLimitedError) {
      console.error(error.message);
    } else {
      throw error;
    }
  }

  await writeJson(path.join(opts.dest, "meta", failuresFile), failures);
  console.log(
    `${label} done. Saved ${saved}, already present ${existed}, failed ${failed}.`,
  );
}

async function writeJobLists(dest: string, file: FigmaFile, jobs: RenderJob[]) {
  const pages = (file.document.children ?? []).map((page) => ({
    id: page.id,
    name: page.name,
    children: (page.children ?? []).length,
  }));
  const frames = jobs.filter((job) => job.kind === "frame");
  const components = jobs.filter((job) => job.kind === "component");
  await mkdir(path.join(dest, "meta"), { recursive: true });
  await writeJson(path.join(dest, "meta", "manifest.json"), {
    fileKey: flags["file-key"],
    name: file.name,
    version: file.version,
    lastModified: file.lastModified,
    fetchedAt: new Date().toISOString(),
    scale: flags.scale,
    pages,
    counts: {
      frames: frames.length,
      components: components.length,
      styles: Object.keys(file.styles ?? {}).length,
      componentSets: Object.keys(file.componentSets ?? {}).length,
    },
  });
  await writeJson(path.join(dest, "meta", "pages.json"), pages);
  await writeJson(path.join(dest, "meta", "frames.json"), frames);
  await writeJson(path.join(dest, "meta", "components.json"), components);
  console.log(
    `${file.name}: ${pages.length} pages, ${frames.length} top-level frames, ${components.length} components.`,
  );
}

async function main() {
  const dest = outRoot();
  const fileKey = flags["file-key"];
  console.log(`File ${fileKey} → ${dest}`);

  let jobs = await loadJobsFromDisk(dest, fileKey);
  if (jobs) {
    console.log(
      `Resuming render jobs from ${path.join(dest, "meta")} (${jobs.length} jobs).`,
    );
  }

  let file: FigmaFile | null = null;
  const documentPath = path.join(dest, "meta", "document.json");
  if (!flags["skip-file"]) {
    if (!flags["refresh-file"]) file = await loadFileFromDisk(dest);
    if (file) {
      console.log(`Loaded full tree from ${documentPath}.`);
    } else {
      file = await fetchFigmaFile(fileKey, dest);
    }
    if (!flags["dry-run"]) await writeDerivedMeta(dest, file);
  } else {
    console.log("Skipping GET /v1/files.");
  }

  if (!jobs) {
    if (!file) {
      throw new Error(
        "No render job lists on disk and no file tree. Re-run without --skip-file.",
      );
    }
    jobs = collectJobs(file);
    if (!flags["dry-run"]) await writeJobLists(dest, file, jobs);
  }

  if (flags["dry-run"]) {
    console.log(`Dry run; ${jobs.length} render jobs. Nothing written.`);
    return;
  }

  if (!flags["skip-fills"]) {
    const fillsBody = await figmaJson<{
      images?: Record<string, string | null>;
      meta?: { images?: Record<string, string | null> };
    }>(`/files/${fileKey}/images`);
    const fillMap = fillsBody.images ?? fillsBody.meta?.images ?? {};
    const fills = Object.entries(fillMap).filter(
      (entry): entry is [string, string] =>
        typeof entry[1] === "string" && entry[1].length > 0,
    );
    let saved = 0;
    let existed = 0;
    await runPool(fills, async ([ref, url]) => {
      const filePath = path.join(dest, "fills", `${ref}.${extFromUrl(url)}`);
      const result = await download(url, filePath);
      if (result === "saved") saved += 1;
      else existed += 1;
    });
    console.log(`Fills: saved ${saved}, already present ${existed}.`);
  } else {
    console.log("Skipping fills.");
  }

  const pace = createPacer();
  const wantRenders = flags.renders && !flags["skip-renders"];
  if (wantRenders) {
    await exportNodes({
      dest,
      fileKey,
      jobs,
      format: "png",
      scale: flags.scale,
      pace,
    });
  } else {
    console.log("Skipping PNG renders.");
  }

  if (flags.svgs) {
    const svgJobs = flags["svg-frames"]
      ? jobs
      : jobs.filter((job) => job.kind === "component");
    await exportNodes({
      dest,
      fileKey,
      jobs: svgJobs,
      format: "svg",
      scale: flags.scale,
      pace,
    });
  } else {
    console.log(
      "Skipping SVG exports. Pass --svgs for components, or --svgs --svg-frames for boards too.",
    );
  }

  console.log(`Wrote ${path.join(dest, "meta", "manifest.json")}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
