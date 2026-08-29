# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Picking up this project

**Read [TODO.md](TODO.md) first** — it's the standing handoff doc: current status, known local-dev gotchas, milestone checklist, and tech debt. Keep it up to date as you land work (update "Status as of" date, check off milestone items, add new gotchas/tech debt you discover). [README.md](README.md) has setup instructions; [technical-design.md](technical-design.md) has the full architecture spec (§ numbers referenced below); [business-requirements.md](business-requirements.md) is the PRD.

This is Milestone 1 of Phase 1 (see technical-design.md §13): core household, calendar, tasks/chores, and lists. Explicitly NOT built yet: external calendar sync, realtime multi-device push, kiosk device pairing/device-token auth, PWA offline support, meal planning, rewards redemption UI, AI Sidekick, and **no automated tests exist yet**.

## Commands

```bash
corepack enable
cp .env.example .env      # adjust AUTH_SECRET (openssl rand -base64 32)
pnpm install
docker compose up -d      # disposable Postgres 16 on :5432 (or point DATABASE_URL at your own)
pnpm db:migrate
pnpm db:seed
pnpm dev                  # http://localhost:3000
```

- `pnpm dev` / `pnpm build` — turbo across all packages, loads root `.env` via `dotenv-cli`
- `pnpm lint` / `pnpm typecheck` — turbo across all packages (only `apps/app` currently has a real lint script; `packages/*` just run `tsc --noEmit`)
- `pnpm db:migrate` — `prisma migrate dev` in `packages/db` (edit `packages/db/prisma/schema.prisma`, then run this to generate a migration)
- `pnpm db:seed` — reruns `packages/db/prisma/seed.ts`
- `pnpm db:studio` — Prisma Studio
- No test runner is configured anywhere in the repo (no Vitest/Jest/Playwright) — don't assume `pnpm test` exists.
- Demo login: `sohel@example.com` / `password123`. Seeded children switch profiles via PIN (Imran `1234`, Zara `5678`).

**Local-dev gotchas** (see TODO.md for full detail): Next.js only auto-loads `.env` from `apps/app/`, not the repo root — there must be a symlink `apps/app/.env -> ../../.env`. On macOS with Postgres.app, use `127.0.0.1` not `localhost` in `DATABASE_URL` (IPv6 resolution can hang behind a permission dialog).

## Architecture

TypeScript monorepo: pnpm workspaces + Turborepo, Next.js 15 App Router, tRPC v11, Prisma + Postgres, Auth.js v5 (credentials provider), Tailwind CSS. `packages/config` (`@household/config`) provides the shared `tsconfig.base.json` and Tailwind preset that everything else extends.

### One Next.js app, three surfaces

`apps/app` is the only deployable app. Three UI surfaces share the same tRPC routers and data layer, differentiated purely by route group / layout:

- `(web)` → `/dashboard`, `/calendar`, `/tasks`, `/lists`, `/family` — desktop/admin
- `(mobile)` → `/m/*` — mobile-optimized PWA layout
- `(display)` → `/display` — kiosk/household-display layout
- `(auth)` → `/sign-in`, `/sign-up`

Route protection is centralized in `apps/app/src/middleware.ts` (redirects unauthenticated requests hitting any protected prefix to `/sign-in`), not per-page.

### Auth and the "active profile" concept

Auth.js issues a JWT session for the adult who logs in with email/password (`apps/app/src/server/auth.ts`). Children don't get their own login — instead, a PIN-based **profile switch** on an already-authenticated device updates `session.activeProfileId` without a full re-auth (`trigger === "update"` in the `jwt` callback). This means `session.user.id` (who logged in) and `session.user.activeProfileId` (who is currently acting) can differ.

Every tRPC request re-resolves the **actor** fresh from the DB using `activeProfileId`, not from the JWT-cached role (`apps/app/src/server/trpc/context.ts`) — this avoids a stale JWT driving RBAC after a profile switch. Always use `ctx.actor`, never `ctx.session.user`, for authorization decisions in routers.

### RBAC: two-layer authorization

1. **Capability table** (`packages/domain/src/rbac.ts`) — coarse `Role -> Resource -> Action[]` grid per PRD §26, checked by `capabilityProcedure(resource, action)` in `apps/app/src/server/trpc/trpc.ts`. This is a tRPC middleware gate; a request that fails it never reaches the handler.
2. **Ownership check** — some actions (e.g. `task.complete`, `rewardRedemption.create`) pass the capability gate for a role but still require the handler to verify the actor owns/is the target of the specific record (see `setCompletion` in `apps/app/src/server/trpc/routers/task.ts` checking `task.assigneeId !== ctx.actor.id` for `CHILD`). `requiresOwnershipCheck()` in `rbac.ts` documents which resource/action pairs need this — it's not automatically enforced, routers must call it out explicitly.

When adding a new resource or action, update the `CAPABILITIES` table in `rbac.ts` first, then wire the router with `capabilityProcedure`, then add an ownership check in the handler if the action is in `OWNERSHIP_SCOPED`.

Household scoping (multi-tenancy) is enforced entirely at the tRPC middleware/handler layer — every query filters by `ctx.householdId`, and every mutation on an existing record re-fetches with `findFirstOrThrow({ where: { id, householdId: ctx.householdId } })` before acting, so a request can't touch another household's data by ID guessing. There is no Postgres RLS (flagged as Phase 2+ hardening).

### tRPC router pattern

Each router (`apps/app/src/server/trpc/routers/*.ts`) follows the same shape: `list`/`create`/`update`/`delete` (plus resource-specific mutations like `setCompletion`) built on `capabilityProcedure`, with mutations calling `logAudit()` (`apps/app/src/server/audit.ts`) to write an `AuditLog` row after every create/update/delete/complete. Follow this pattern for new routers and register them in `apps/app/src/server/trpc/routers/_app.ts`. Input validation uses zod schemas from `packages/domain/src/schemas.ts`, shared between client and server. The client (`apps/app/src/lib/trpc.ts`, wired up in `apps/app/src/app/providers.tsx`) uses `httpBatchLink` + `superjson` transformer — dates and other non-JSON types survive the wire intact, so don't manually stringify/parse them.

### Package boundaries

- `packages/db` (`@household/db`) — Prisma schema/migrations/seed; re-exports the `PrismaClient` singleton and all `@prisma/client` types. Never instantiate `PrismaClient` elsewhere — import `prisma` from here.
- `packages/domain` (`@household/domain`) — framework-agnostic shared logic: zod schemas (`schemas.ts`), the RBAC capability table (`rbac.ts`), and password/PIN hashing (`credentials.ts`, bcryptjs). Consumed by both server (tRPC routers) and could be consumed client-side (schemas) since it has no server-only dependencies.
- `packages/ui` (`@household/ui`) — presentational component library (calendar grid views, event/task/list cards, form primitives) shared across all three app surfaces. Pure React + Tailwind, no data fetching.
- `packages/config` (`@household/config`) — shared `tsconfig.base.json` and Tailwind preset only; not a runtime package.

### Data model touchpoints

`packages/db/prisma/schema.prisma` is the source of truth for the domain. Key relationships to know before touching data: `Household` is the tenancy root everything hangs off; `Task` has a `frequency` string (RRULE-ish, e.g. `FREQ=DAILY`) that is **not currently expanded into occurrences anywhere** — the dashboard just shows all active tasks regardless of whether today is a due day (real occurrence calculation is a known gap, see TODO.md tech debt); `ChoreCompletion` is keyed `@@unique([taskId, occurrenceDate])` so completion toggling is an upsert/delete keyed on today's date; `CalendarAccount` and `Device` models exist in the schema but are unused stubs for Milestone 2/3 (calendar sync, kiosk pairing).

### Path aliases

`apps/app` uses `@/*` → `apps/app/src/*` (see `apps/app/tsconfig.json`). Cross-package imports use the workspace package names (`@household/db`, `@household/domain`, `@household/ui`, `@household/config`), resolved via pnpm workspaces (`workspace:*`).
