# TODO / Continuation Guide

This is the handoff doc for picking this project back up in a fresh Claude session. Read this first, then [README.md](README.md) (setup) and [technical-design.md](technical-design.md) (full architecture) as needed.

**Status as of 2026-08-29:** Phase 1 / Milestone 1 is built and committed. Since then, in an uncommitted working-tree session: the recurrence engine tech-debt item is fixed, Milestone 2's first checklist item (Google Calendar OAuth connect + initial one-way sync) is built and verified end-to-end against a real Google account, and a calendar-week/day-view overflow bug was fixed. See "What changed this session" below before committing.

---

## Resume in one command block

```bash
corepack enable
pnpm install
docker compose up -d   # or point .env at your own local Postgres — see README
pnpm db:migrate
pnpm db:seed            # optional if DB already seeded
pnpm dev                # http://localhost:3000
```

Demo login: `sohel@example.com` / `password123`. Seeded children: Imran (PIN `1234`), Zara (PIN `5678`).

**Known local-dev gotcha:** if `next-auth` throws `MissingSecret` or `DATABASE_URL not found`, it's because Next.js only auto-loads `.env` from `apps/app/`, not the repo root. There should already be a symlink at `apps/app/.env -> ../../.env`; if it's missing, recreate it (`cd apps/app && ln -sf ../../.env .env`) and restart `next dev` (a full restart, not hot-reload — the Prisma client singleton bakes in env at first import).

**Known local-dev gotcha #2:** if using Postgres.app on macOS with `shared_preload_libraries=auth_permission_dialog`, connections to `localhost` can silently hang because that resolves to `::1` and Postgres.app's permission dialog gates new IPv6 client connections with a GUI prompt nothing automated can click. Use `127.0.0.1` explicitly in `DATABASE_URL` instead.

---

## What changed this session (2026-08-29, uncommitted)

- **Recurrence engine** (was tech debt, see below — now fixed): `packages/domain/src/recurrence.ts` uses `rrule` to compute whether a task is due on a given date, anchored on `task.dueAt ?? task.createdAt`. Wired into `task.list` (returns a `dueToday` flag per task) and the Dashboard's "To Do" section now filters on it. The `/tasks` management page intentionally still shows all tasks regardless of due day (it's the CRUD view). No frequency → always due (covers `ONE_TIME` tasks).
- **Milestone 2, item 1: Google Calendar OAuth connect + initial sync — done and verified end-to-end** against a real Google account (connect → Google consent → callback → token storage → sync all worked; 27 real events landed in the `Event` table on first sync). Added:
  - `apps/app/src/app/api/calendar/google/connect` and `.../callback` route handlers (state-cookie CSRF protection, `prompt=consent`+`access_type=offline` to guarantee a refresh token).
  - `apps/app/src/server/integrations/{googleCalendar,tokenCrypto,syncGoogleCalendar}.ts` — hand-rolled `fetch`-based Google OAuth/Calendar client (no `googleapis` dependency), AES-256-GCM token encryption at rest (`CALENDAR_TOKEN_ENCRYPTION_KEY` env var — the design doc claimed encrypted tokens but the schema/code never did this before), and a one-way sync that upserts Google events into the shared `Event` table keyed on `(calendarAccountId, sourceEventId)`.
  - `calendarAccount` tRPC router (`list`/`disconnect`/`sync`) + RBAC resource (ADMIN/PARENT only).
  - "Calendar sync" card on `/family` to connect/sync/disconnect — confirmed showing "Connected · last synced ..." after a real connect.
  - Schema: added `@@unique([householdId, ownerId, provider])` on `CalendarAccount` and `@@unique([calendarAccountId, sourceEventId])` on `Event` (needed for the upsert-based sync).
  - **Not done / not yet verified**: Microsoft/Apple providers, incremental sync via push channels (needs a public HTTPS endpoint — deferred, manual "Sync now" only), two-way write-back, refresh-token-expiry retry path (the retry-once-on-fetch-failure logic in `syncGoogleCalendarAccount` hasn't hit a real expired-token case yet), and disconnect/re-connect wasn't exercised in this session.
- **Fixed**: calendar week/day view event cards could overflow their rounded border when an event had multiple assignees or long text in a short time slot (assignee badges spilling below the card). Fix: `overflow-hidden` on `EventCard` (`packages/ui/src/components/EventCard.tsx`) so extra content clips instead of spilling — a fuller fix (e.g. showing "+N more") is possible later if it matters in practice.
- **New local-dev finding**: this repo's `packages/db/prisma/migrations/` was already committed with one migration, but `prisma migrate dev` refuses to run non-interactively (fails with "environment is non-interactive" the moment schema drift needs a new migration) — needed `prisma migrate diff --from-url ... --to-schema-datamodel ... --script` piped into a hand-written migration folder, then `prisma migrate deploy`. Fine interactively (`pnpm db:migrate` as documented) but worth knowing if scripting this.
- **New local-dev finding**: creating the `apps/app/.env` symlink needs Developer Mode enabled or an elevated shell on Windows (`New-Item -ItemType SymbolicLink` fails with `PermissionDenied` otherwise) — copying `.env` into `apps/app/.env` works as a fallback but won't stay in sync if you edit the root `.env` later.

---

## What's actually built (Milestone 1)

- Turborepo monorepo: `apps/app` (Next.js 15 App Router) + `packages/{db,domain,ui,config}`
- Prisma schema covering Household, User, Device, CalendarAccount (stub), Event (+assignees/checklist), Task/ChoreCompletion, Reward/RewardRedemption, List/ListItem, AuditLog
- Auth.js credentials login for adults; PIN-based profile switching for children (session's `activeProfileId` vs. `id` — see `apps/app/src/server/auth.ts`)
- RBAC capability table in `packages/domain/src/rbac.ts`, enforced via tRPC middleware (`apps/app/src/server/trpc/trpc.ts`) — every procedure is both role-gated and household-scoped
- tRPC routers: `household`, `familyMember`, `event`, `task`, `list`
- Full CRUD UI: Day/Week/Month/Agenda calendar, tasks/chores with completion + points, custom lists, family member management
- Three layout surfaces sharing one codebase: `/` (web/admin), `/m` (mobile), `/display` (kiosk) — see [technical-design.md §3](technical-design.md#3-monorepo-structure)
- `pnpm lint` and `pnpm typecheck` both clean

**Explicitly NOT built yet** (by design — see Milestones below): external calendar sync, realtime multi-device push, kiosk device pairing/device-token auth, PWA offline/service worker/web push, meal planning, rewards redemption UI, AI Sidekick, any automated tests.

---

## Milestone 2 — Calendar Sync + Realtime

Ref: [technical-design.md §6](technical-design.md#6-calendar-sync-engine) and [§7](technical-design.md#7-real-time-device-sync).

- [x] Google Calendar OAuth connect flow (`CalendarAccount` row per connection); initial full sync — done and verified end-to-end this session against a real Google account (uncommitted — see "What changed this session")
- [ ] Incremental sync via Google push channels (currently manual "Sync now" only; needs a public HTTPS webhook endpoint)
- [ ] Microsoft Graph OAuth connect + webhook sync
- [ ] Apple/iCloud via CalDAV + app-specific password (read-only to start); poll on a Vercel Cron-equivalent interval since there's no push webhook
- [ ] `canonicalHash` dedup logic for events arriving via multiple connected calendars
- [ ] Two-way write-back for Google/Microsoft (create/update in-app → push to provider)
- [ ] Realtime pub/sub (Pusher or Ably — pick one, see open question below) wired so kiosk/mobile/web all live-update on any household mutation, not just polling via React Query
- [ ] Offline-friendly client cache (service worker + local queue) so a kiosk that loses wifi still shows last-known state and queues writes

## Milestone 3 — Kiosk Pairing + PWA

Ref: [technical-design.md §5](technical-design.md#5-auth--permissions) (device pairing) and §7 (offline).

- [ ] Device pairing flow: kiosk shows a 6-digit code, admin enters it in web/mobile to link; issue a long-lived device token (the `Device` model already exists in schema, unused so far)
- [ ] Device-token auth path distinct from user sessions — a paired kiosk should work without any user being "logged in" on it
- [ ] PWA manifest + service worker (installability, offline shell)
- [ ] Web Push (VAPID) for notifications — note the iOS limitation in the open questions below
- [ ] Kiosk lockdown UX: settings screen behind a PIN, sleep schedule, fullscreen lock

## Milestone 4+ — Later phases

- [ ] **Phase 2**: meal planning + recipes, grocery list auto-generation from meal plan, Instacart export, rewards redemption approval UI (schema already exists — `Reward`/`RewardRedemption` — just needs UI + router), multi-kiosk-per-household polish, photo screensaver, weather/countdown widgets
- [ ] **Phase 3 (AI Sidekick)**: `AIIngestionJob` model, inbound email parsing, Vercel Workflow extraction pipeline, Claude structured-output schemas per PRD §18–19
- [ ] **Phase 4 (Household Agent)**: tool-calling agent, conflict detection job, proactive notifications — see [technical-design.md §9](technical-design.md#9-household-agent-phase-4)

---

## Tech debt / follow-ups noticed during Milestone 1

None of these block M2, but worth fixing opportunistically:

- **No automated tests.** No test runner is set up at all (no Vitest/Jest/Playwright). Given RBAC correctness is security-sensitive, at minimum the `packages/domain/rbac.ts` capability table and the tRPC ownership checks (`task.setCompletion`) deserve unit/integration tests before this grows further.
- **Row-level security not applied.** Household scoping is enforced entirely in the tRPC middleware layer (`apps/app/src/server/trpc/trpc.ts`). Fine for now; Postgres RLS was flagged as Phase 2+ hardening in the design doc.
- **`packages/domain`, `packages/ui`, `packages/db` have no lint script**, only `apps/app` does. Not urgent since they're pure TS with no framework-specific rules, but worth adding eslint configs if the packages grow.
- **Kiosk layout's `ProfileSwitcher`** is fixed at `bottom-4 right-4` and can overlap dashboard content on short viewports — fine on an actual large kiosk display, worth revisiting once real device sizes are known.
- A stray root `package-lock.json` was found and removed during Milestone 1 (this is a pnpm-only repo). If it reappears, something (possibly an IDE) is running plain `npm install` — worth checking IDE Node.js integration settings.

## Open questions (from technical-design.md §14, still unanswered)

1. iOS Safari requires "Add to Home Screen" before Web Push works at all — how much do we lean on email/SMS for iOS households in the meantime?
2. Does Apple/iCloud calendar sync ship alongside Google/Microsoft in M2, or slip until the core loop is validated with the easier two providers?
3. Is SMS notification a Premium-only feature (ties to the PRD's subscription split) or free-tier with a volume cap?
4. Is "fullscreen PWA + settings-screen PIN" enough kiosk lockdown for MVP, or do we need real device-level MDM/kiosk mode?
5. Realtime vendor: Pusher vs. Ably vs. something else — any existing preference/contract?

---

## Key files to orient a fresh session

| What | Where |
|---|---|
| Product requirements | [business-requirements.md](business-requirements.md) |
| Full architecture | [technical-design.md](technical-design.md) |
| DB schema | [packages/db/prisma/schema.prisma](packages/db/prisma/schema.prisma) |
| RBAC rules | [packages/domain/src/rbac.ts](packages/domain/src/rbac.ts) |
| Auth + profile switching | [apps/app/src/server/auth.ts](apps/app/src/server/auth.ts) |
| tRPC middleware (RBAC + household scoping) | [apps/app/src/server/trpc/trpc.ts](apps/app/src/server/trpc/trpc.ts) |
| Seed data | [packages/db/prisma/seed.ts](packages/db/prisma/seed.ts) |
