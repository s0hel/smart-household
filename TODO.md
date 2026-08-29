# TODO / Continuation Guide

This is the handoff doc for picking this project back up in a fresh Claude session. Read this first, then [README.md](README.md) (setup) and [technical-design.md](technical-design.md) (full architecture) as needed.

**Status as of 2026-08-29 (session 2):** Milestone 2's calendar dedup + two-way Google write-back landed, and Phase 2's meal planning/grocery auto-gen + rewards redemption UI landed. Not yet committed to git — see "What changed this session (session 2)" below. One item needs the user to manually reconnect Google Calendar to verify live (see that section).

**Status as of 2026-08-29 (session 1):** Phase 1 / Milestone 1 is built and committed. Since then: the recurrence engine tech-debt item is fixed, Milestone 2's first checklist item (Google Calendar OAuth connect + initial one-way sync) is built and verified end-to-end against a real Google account, and two calendar week/day-view layout bugs were fixed (content overflow, then short-event legibility). All committed — see "What changed this session (session 1)" below for commit-by-commit detail.

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

## What changed this session (session 2, 2026-08-29, NOT yet committed)

Scope for this session was explicitly chosen with the user from the full M2 + Phase 2 lists below (the rest is intentionally still unchecked):

- **M2: `canonicalHash` dedup for events arriving via multiple connected calendars.** New `EventSourceLink` model (`packages/db/prisma/schema.prisma`) maps every `(calendarAccount, providerEventId)` pair to a shared `Event`, replacing the old assumption that an `Event` has at most one source. `apps/app/src/server/integrations/syncGoogleCalendar.ts` was rewritten: `canonicalHash` is now derived from Google's `iCalUID` (stable across every attendee's own copy of an event) instead of `google:${event.id}` (stable only within one account). When an incoming event's hash matches an `Event` already synced from a *different* connected calendar, sync links to it and adds the new account's owner as an assignee instead of creating a duplicate calendar entry; cancellation on one calendar only removes that account's link/assignment, not the whole event, unless it was the last remaining link.
  - **Bug found and fixed during verification**: the 27 events already synced in a prior session only had the old direct `Event.calendarAccountId`/`sourceEventId` columns set, no `EventSourceLink` row (the table didn't exist yet) — re-syncing that account crashed with a unique-constraint violation because sync now looks up `EventSourceLink` first, finds nothing, and tries to `create` a duplicate. Fixed with a second migration (`20260829051656_backfill_event_source_links`) that backfills `EventSourceLink` from every pre-existing `Event.calendarAccountId`/`sourceEventId` pair. **If you're reading this in a fresh session and see the same unique-constraint error on `calendarAccount.sync`, check whether that migration actually ran.**
  - Verified: re-synced the real connected Google account twice in a row post-fix — event count stayed stable at 19 (no duplicates), confirming idempotency.
- **M2: Two-way write-back for Google.** OAuth scope widened from `calendar.readonly` to `calendar.events` (`apps/app/src/server/integrations/googleCalendar.ts`). New `apps/app/src/server/integrations/writebackGoogleCalendar.ts`: `pushEventToGoogle` mirrors an in-app-created/updated `Event` to every connected+writable Google account belonging to one of its *assignees* (not just the creator), tracked via the same `EventSourceLink` table so re-pushes update in place and inbound sync recognizes them as already-linked instead of re-importing; `retractEventFromGoogle` deletes the mirrored copy on in-app delete. Wired into `event.create`/`update`/`delete` in `apps/app/src/server/trpc/routers/event.ts`, wrapped so a Google API failure never blocks the in-app save (logs and continues — the local DB is authoritative).
  - **Not fully verified live**: the household's one connected Google account was authorized under the *old* readonly scope, so a real push attempt correctly failed with Google's 403 `insufficientPermissions`/`ACCESS_TOKEN_SCOPE_INSUFFICIENT` — expected, since that token predates the scope change. The failure was caught cleanly (event save still succeeded, no crash). **To actually verify a live push, disconnect and reconnect Google Calendar from `/family`** (forces re-consent under the new scope) **then create/edit/delete an event assigned to that account's owner and confirm it appears/updates/disappears on the real Google Calendar.** I did not do this myself — reconnecting requires walking through Google's own OAuth consent screen, which needs the user's real Google login.
  - Design limitation worth knowing: an `Event` pushes to an assignee's calendar only if they're already an `EventAssignee` on it — there's no "push to creator regardless of assignment" fallback.
- **Phase 2: Meal planning + recipes + grocery-list auto-generation.** New `Recipe`, `RecipeIngredient`, `MealPlanEntry` models + `MealType` enum. New `recipe` and `mealPlan` tRPC routers (`apps/app/src/server/trpc/routers/{recipe,mealPlan}.ts`); `mealPlan.generateGroceryList` builds a `GROCERY`-type `List` from every recipe planned in a date range, merging duplicate ingredients by lowercased/trimmed name (quantities are concatenated as text, e.g. "1.5 lb + 1 lb" — **no unit conversion**, by design, since ingredient quantities are free-text strings). New `/meal-plan` page (`apps/app/src/components/MealPlanPage.tsx`): a 7-day × 4-meal-type grid to assign a recipe or custom title per slot, a recipe catalog with an add-recipe form (dynamic ingredient rows), and a "Generate grocery list for this week" button. Verified end-to-end in the browser: assigned two seeded recipes to the week grid, generated a list, and confirmed the resulting list in `/lists` correctly merged "Chicken breast" and "Tomatoes" quantities across both recipes.
- **Phase 2: Rewards redemption approval UI.** New `reward` and `rewardRedemption` tRPC routers. Points balance is computed live (never stored) as `sum(ChoreCompletion.pointsAwarded)` minus `sum(costPoints of APPROVED redemptions)`, per user — see `rewardRedemption.balances` in `apps/app/src/server/trpc/routers/rewardRedemption.ts`. A `CHILD` can only redeem for themselves (ownership-checked, matching the existing `OWNERSHIP_SCOPED` pattern in `packages/domain/src/rbac.ts`); redemption is blocked server-side if the balance is insufficient. `reward.delete` soft-deletes (`active: false`) rather than hard-deleting, to preserve `RewardRedemption` history. New `/rewards` page: catalog with a live-disabled "Redeem"/"Not enough points" button per reward, a parent-only pending-approval queue (Approve/Deny), and a recent-activity feed. Verified end-to-end in the browser as both a `CHILD` (Imran: seeded to 60 pts, redeemed the 50-pt reward) and `ADMIN` (Sohel: saw the pending request, approved it, confirmed Imran's balance dropped to 10 via a direct API check) — full request → approve → balance-deduction loop confirmed working.
- Added `apps/app/src/components/RewardsPage.tsx`, `MealPlanPage.tsx`; added `/meal-plan` and `/rewards` to `AppShell` nav; added `recipe`/`mealPlanEntry` to the RBAC `Resource` union and capability table (ADMIN/PARENT full CRUD, CHILD/READONLY read-only).
- Extended `packages/db/prisma/seed.ts` with 30 days of `ChoreCompletion` history for Imran/Zara (so the Rewards page has real balances out of the box) and two demo recipes + meal-plan entries. **Note: `seed.ts` was already not safely re-runnable against a non-empty DB** (hard-fails on the `User.email` unique constraint) — this predates this session and wasn't fixed; the new blocks added this session are written to be idempotent (check-before-insert) specifically because the demo household already existed and re-running the full seed wasn't an option. See new tech-debt entry below.
- Cross-session coordination note: another Claude Code session (`smart-household-0d`) was working in this same repo/DB concurrently. Its `pnpm dev` process (port 3000) held a Windows file lock on the Prisma query-engine DLL, which blocked `prisma generate` after the first migration. Coordinated via `SendMessage` — it paused its dev server, I regenerated, it resumed. If you're picking this up fresh and `prisma generate` fails with `EPERM ... query_engine-windows.dll.node`, check for another running `next dev`/`prisma generate` process first.
- Verification dev server: ran on port 3001 via a new `household-dev-alt-port` entry in `.claude/launch.json` (added so this session's browser testing didn't collide with the other session's server on :3000) — safe to remove that launch.json entry once no longer needed, or keep it for future parallel-session work.
- **Everything above is uncommitted.** `pnpm typecheck` and `pnpm lint` are clean across all packages as of this write-up.

## What changed this session (session 1, 2026-08-29, all committed)

- **Recurrence engine** (was tech debt, see below — now fixed, commit `5f64c14`): `packages/domain/src/recurrence.ts` uses `rrule` to compute whether a task is due on a given date, anchored on `task.dueAt ?? task.createdAt`. Wired into `task.list` (returns a `dueToday` flag per task) and the Dashboard's "To Do" section now filters on it. The `/tasks` management page intentionally still shows all tasks regardless of due day (it's the CRUD view). No frequency → always due (covers `ONE_TIME` tasks).
- **Milestone 2, item 1: Google Calendar OAuth connect + initial sync — done and verified end-to-end** against a real Google account (connect → Google consent → callback → token storage → sync all worked; 27 real events landed in the `Event` table on first sync). Commit `f0955cc`. Added:
  - `apps/app/src/app/api/calendar/google/connect` and `.../callback` route handlers (state-cookie CSRF protection, `prompt=consent`+`access_type=offline` to guarantee a refresh token).
  - `apps/app/src/server/integrations/{googleCalendar,tokenCrypto,syncGoogleCalendar}.ts` — hand-rolled `fetch`-based Google OAuth/Calendar client (no `googleapis` dependency), AES-256-GCM token encryption at rest (`CALENDAR_TOKEN_ENCRYPTION_KEY` env var — the design doc claimed encrypted tokens but the schema/code never did this before), and a one-way sync that upserts Google events into the shared `Event` table keyed on `(calendarAccountId, sourceEventId)`.
  - `calendarAccount` tRPC router (`list`/`disconnect`/`sync`) + RBAC resource (ADMIN/PARENT only).
  - "Calendar sync" card on `/family` to connect/sync/disconnect — confirmed showing "Connected · last synced ..." after a real connect.
  - Schema: added `@@unique([householdId, ownerId, provider])` on `CalendarAccount` and `@@unique([calendarAccountId, sourceEventId])` on `Event` (needed for the upsert-based sync).
  - **Not done / not yet verified**: Microsoft/Apple providers, incremental sync via push channels (needs a public HTTPS endpoint — deferred, manual "Sync now" only), two-way write-back, refresh-token-expiry retry path (the retry-once-on-fetch-failure logic in `syncGoogleCalendarAccount` hasn't hit a real expired-token case yet), and disconnect/re-connect wasn't exercised in this session.
- **Fixed (two passes)**: calendar week/day view event cards looked cluttered/broken once real synced Google events (much shorter, more numerous, longer titles than the seed data) populated the grid.
  - Pass 1 (commit `1382714`): cards could overflow their rounded border when an event had multiple assignees or long text in a short time slot (assignee badges spilling below the card) — fixed with `overflow-hidden` on `EventCard`.
  - Pass 2 (commit `44c0da1`): overflow-hidden alone wasn't enough — short events (a few real events are only 15-45 min) rendered as an almost-invisible clipped sliver with no visible card boundary, since a full-size card layout doesn't fit in a ~15-45px absolutely-positioned slot. `WeekView`/`DayView` now pass a `dense={height < 48}` prop to `EventCard`, which renders short events as a single-line pill (truncated title, small colored dots for assignees instead of named badges, time) that stays fully contained. Also added `truncate`/`min-w-0` to the non-dense title so long titles ellipsize instead of wrapping. Verified visually against the real synced calendar data.
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

- [x] Google Calendar OAuth connect flow (`CalendarAccount` row per connection); initial full sync — done and verified end-to-end against a real Google account (commit `f0955cc` — see "What changed this session (session 1)")
- [ ] Incremental sync via Google push channels (currently manual "Sync now" only; needs a public HTTPS webhook endpoint)
- [ ] Microsoft Graph OAuth connect + webhook sync
- [ ] Apple/iCloud via CalDAV + app-specific password (read-only to start); poll on a Vercel Cron-equivalent interval since there's no push webhook
- [x] `canonicalHash` dedup logic for events arriving via multiple connected calendars — session 2, verified (see above); Google only (Microsoft/Apple dedup will need the same treatment once those providers exist)
- [x] Two-way write-back for Google (create/update/delete in-app → push to provider) — session 2, built and exercised (failed with an expected 403 against a not-yet-reconnected account; needs a live reconnect to fully verify — see above). Microsoft write-back still not built.
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

- [ ] **Phase 2**:
  - [x] Meal planning + recipes + grocery list auto-generation from meal plan — session 2, built and verified (see above)
  - [x] Rewards redemption approval UI — session 2, built and verified (see above)
  - [ ] Instacart export
  - [ ] Multi-kiosk-per-household polish
  - [ ] Photo screensaver
  - [ ] Weather/countdown widgets
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
- **`packages/db/prisma/seed.ts` isn't safely re-runnable** against a non-empty DB — `prisma.user.create` hard-fails on the `email` unique constraint the moment the demo household already exists. Fine for a truly fresh DB (`docker compose up -d` + first-ever `pnpm db:migrate && pnpm db:seed`), but breaks the "just re-run the resume command block" story for anyone iterating on seed data. Worth making idempotent (upsert by email, or a guard at the top that bails if the demo household already exists) before it grows further.
- **Meal-plan grocery-list generation does no unit conversion or smart merging** — duplicate ingredients across recipes are merged by exact lowercased name only, and quantities are concatenated as text (e.g. "2 cups + 1 tbsp"), left for the shopper to reconcile. Fine for MVP; a real implementation would need a unit-aware quantity parser.
- **Two-way Google write-back only pushes to an event's existing assignees' calendars** — there's no "always push to the creator" fallback, so an event with zero assignees never mirrors anywhere even if the creator has Google connected. Revisit if that turns out to be surprising in practice.
- **Concurrent-session file locking on Windows**: `prisma generate` fails with `EPERM ... query_engine-windows.dll.node` if another `next dev` process (this session's own or a different Claude Code session in the same repo) has the Prisma client DLL loaded. No code fix needed — just something to know when working in this repo from multiple sessions/terminals at once. See "What changed this session (session 2)" for how this was handled.

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
