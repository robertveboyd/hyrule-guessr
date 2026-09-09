# Hyrule Guessr

Invite-only GeoGuessr-style game set in *Breath of the Wild*. Fan project; not affiliated with Nintendo or GeoGuessr.

## Local run

1. `pnpm install`. Copy `.env.example` to `.env.local` and set `AUTH_SECRET` (`openssl rand -base64 32`). Put the same `SESSION_ROOM_SECRET` in gitignored `.dev.vars` for wrangler.
2. Start Postgres and apply migrations:

```bash
docker compose up -d
pnpm db:migrate
```

3. Seed a user:

```bash
pnpm db:populate-user -- --email you@example.com --password '…' --username Link
```

4. Two terminals (open the app at **http://localhost:3000**, not `127.0.0.1:3000`):

```bash
pnpm party:dev
pnpm dev
```

`pnpm party:dev` binds `127.0.0.1:8787`. wrangler/workerd needs **macOS 13.5+**.

Mirror BotW map tiles once (gitignored `public/maptex/`; Nintendo art, sourced from [objmap](https://objmap.zeldamods.org/)):

```bash
pnpm map:mirror-tiles
```

Home is **Practice** or **Versus** (Versus is disabled until multiplayer). Practice shows the current mode (**Practice: Casual** or **Practice: Timed**); the chevron chooses the mode, and the button starts it. An in-progress run replaces those choices with **Continue**. **Friends** is on home and at `/friends` (search, requests, list). A Messenger-style dock on lobby screens shows who is online; it is hidden on `/play` and `/map`. Online requires `pnpm party:dev` (UserSession socket). The still is full-bleed; round and running score sit top-right, the timed clock top-center, and the guess map is a GeoGuessr-style overlay (hover or **M** to enlarge). Local tiles: `NEXT_PUBLIC_MAP_TILES_URL=/maptex/{z}/{x}/{y}.png`. Production points that env at Vercel Blob (`pnpm map:upload-tiles`); do not commit the pyramid.

Logged-in **Map** (`/map`) is **development only** (`pnpm dev`) and sits on the home screen as a tool, not a game mode. Click a point to read BotW `(x, z)` when cataloging stills. Production 404s that route. The `/play` overlay does not print coordinates.

Operator stills (gitignored `public/catalog/`; do not commit). Use `/map` in `pnpm dev` to read `(x, z)` after you capture a photomode still:

```bash
pnpm catalog:add -- --dev --file public/catalog/00001.jpg --x -1023 --z 1796
pnpm catalog:add-stills -- --dev --from scripts/add-stills/stills.json
pnpm catalog:add-stills -- --from scripts/add-stills/stills.json \
  --database-url 'postgresql://…' --token 'vercel_blob_rw_…'
```

`--dev` inserts `/catalog/…` into local Docker. Without `--dev`, files are uploaded to Blob and inserted into the given database. The JPEG bytes are hashed (SHA-256); a re-run of the same files skips the upload and insert. If only `x`/`z` changed, the existing row is updated. `stills.json` is gitignored (coordinates); see `stills.example.json` for the shape.

```bash
pnpm test
pnpm lint
```

Planning notes live in `internal-docs/` (gitignored).
