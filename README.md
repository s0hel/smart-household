# Smart Household

Monorepo for the household operating system described in [business-requirements.md](business-requirements.md) and [technical-design.md](technical-design.md). This is Milestone 1 of Phase 1 (see the plan referenced in that doc): core household, calendar, tasks/chores, and lists — no external calendar sync, realtime, kiosk pairing, or PWA offline support yet.

**Picking this up in a new session? Start with [TODO.md](TODO.md)** — it has the resume commands, a full status snapshot, and the checklist for what's next.

## Stack

TypeScript monorepo (pnpm + Turborepo), Next.js 15 App Router, tRPC, Prisma + Postgres, Auth.js (credentials), Tailwind CSS.

## Setup

```bash
corepack enable
cp .env.example .env   # adjust AUTH_SECRET (openssl rand -base64 32)
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev                # http://localhost:3000
```

You need a local Postgres reachable at the `DATABASE_URL` in `.env` (default: `household`/`household`@`localhost:5432/household`). Either works:
- Your own local Postgres (e.g. Postgres.app) — create a `household` role/database matching `.env`.
- `docker compose up -d` — starts a disposable Postgres 16 container on the same port (don't run both at once, they'll fight over :5432).

Sign in with the seeded demo account: **sohel@example.com / password123**.

## Layout

- `apps/app` — the one Next.js app. Three surfaces share the same routes/data:
  - `/dashboard`, `/calendar`, `/tasks`, `/lists`, `/family` — desktop/admin web
  - `/m` — mobile-optimized PWA layout
  - `/display` — kiosk/household-display layout
- `packages/db` — Prisma schema, migrations, seed script
- `packages/domain` — zod schemas + the RBAC capability table (`rbac.ts`) shared by the API and UI
- `packages/ui` — shared component library (calendar grid, event/task/list cards) used by all three surfaces
- `packages/config` — shared TypeScript/Tailwind config

## Demo household

Seeded via `pnpm db:seed`: "The Rahman Household" with 2 adults (Sohel — admin, Partner — parent) and 2 children (Imran, Zara — PIN `1234`/`5678`), plus sample events, chores, rewards, and a grocery list drawn from the PRD's own examples.

## What's next

See [TODO.md](TODO.md) for the full milestone-by-milestone checklist, known tech debt, and open questions.
