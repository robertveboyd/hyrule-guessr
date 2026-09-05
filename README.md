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

Logged-in **Map** on home opens `/map`. Local tiles: `NEXT_PUBLIC_MAP_TILES_URL=/maptex/{z}/{x}/{y}.png`. Production points that env at Vercel Blob (`pnpm map:upload-tiles`); do not commit the pyramid.

```bash
pnpm test
pnpm lint
```

Planning notes live in `internal-docs/` (gitignored).
