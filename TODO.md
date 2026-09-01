# TODO / Continuation Guide

This is the handoff doc for picking this project back up in a fresh Claude session. Read this first, then [README.md](README.md) (setup) and [technical-design.md](technical-design.md) (full architecture) as needed.

**Status as of 2026-09-01 (session 6, uncommitted):** Added a theme switcher — light (the original "Sapphire Standard" look, still default), dark, plus two new alternate palettes ("Meadow" green, "Sunset" terracotta). See "What changed this session (session 6)" below. **Confirms session 5's flagged DB mystery still stands as-is**: root `.env`'s `DATABASE_URL` is still the hosted `pooled.db.prisma.io` URL (not local docker), and it works fine for dev (signed in, reseeded, browsed every page) — so whichever DB this is meant to be, it's functional; the "is this intentional" question is still an open human decision, not a bug.

**Status as of 2026-08-31 (session 5, uncommitted):** Upgraded Prisma 5.22.0 → 7.10.0 (via 6.19.3) in `packages/db`, prompted by the `prisma studio` update nag. This is a real breaking-change migration, not a version bump — see "What changed this session (session 5)" below before touching `packages/db` or the root `lint`/`typecheck`/`build` scripts. **Also found and left unresolved: the root `.env`'s `DATABASE_URL` points to a Prisma-hosted Postgres (`pooled.db.prisma.io`) that has zero tables, not the documented local docker Postgres (`.env.example`'s `127.0.0.1:5432`, backed by the already-running `household_postgres` container, which does have the seeded demo household from prior sessions). Didn't touch `.env` or run any migration against the hosted URL — needs a human decision on which DB is actually meant to be local dev's `DATABASE_URL`.**

**Status as of 2026-08-31 (session 4):** Fixed Vercel deployment — the project's dashboard settings had **Framework Preset set to "NestJS"** and **Root Directory set to `./`** (repo root) instead of Next.js/`apps/app`, so every deploy failed post-build with `Error: No entrypoint found` (Vercel's generic Node builder searching for `src/main.ts` etc., since it wasn't being treated as a Next.js app at all). This was a Vercel project-settings misconfiguration, not a code issue — nothing in the repo needed to change. Fixed via the Vercel dashboard (Settings → Build and Deployment): Framework Preset → Next.js, Root Directory → `apps/app` (kept "Include files outside the Root Directory" enabled, required for the pnpm workspace deps). Redeployed and verified the production URL (`s0hel-smart-household.vercel.app`) loads and correctly redirects to `/sign-in`. All 5 required env vars (`DATABASE_URL`, `AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `CALENDAR_TOKEN_ENCRYPTION_KEY`) were already set correctly for Production/Preview — no changes needed there.

**Status as of 2026-08-31 (session 3):** Fixed the Vercel production build (was failing) and upgraded Next.js 15.1.2 → 16.3.3. Since committed — see "What changed this session (session 3)" below.

**Status as of 2026-08-29 (session 2):** Milestone 2's calendar dedup + two-way Google write-back landed, and Phase 2's meal planning/grocery auto-gen + rewards redemption UI landed. Committed (`a9991e2`). The user reconnected Google Calendar under the new scope and the write-back push was verified live (create/update/delete) — see "What changed this session (session 2)" below.

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

## What changed this session (session 6, 2026-09-01, NOT yet committed)

- **Theme switcher: light (default), dark, Meadow, Sunset.** Architecture: `paper`/`surface`/`ink`/`sapphire`/`gold` in `packages/config/tailwind.preset.js` now resolve to `rgb(var(--color-x) / <alpha-value>)` instead of literal hex; the four palettes are defined as CSS custom properties per `[data-theme="..."]` block in `apps/app/src/app/globals.css`. This means every existing component that already used `bg-paper`/`text-ink-900`/`bg-sapphire-600`/etc. re-themes automatically — no `dark:` variants needed anywhere, and no component files needed touching for the palette swap itself. `household` (the 8 per-person badge colors) is deliberately left as static hex and NOT themed — it's an identity system, not a surface color, and should stay recognizable across themes (matches the existing design rationale already in that file's comment).
  - Dark's `ink` scale is the light scale with shade order reversed (50↔900) — since `ink` is used purely as a neutral text/border/tint scale (never as a background needing a specific role), this one trick makes every existing `text-ink-900`/`bg-ink-100`/`border-ink-200` usage correctly invert without per-component changes. `sapphire`/`gold` (which double as button/active-state backgrounds, not just text) got hand-tuned dark ramps instead, anchored so the primary-button shade (`600`) keeps reasonable contrast both as white-on-button and as text-on-dark-page.
  - `next-themes` (`ThemeProvider` in `apps/app/src/app/providers.tsx`, `attribute="data-theme"`) drives the switch and persists the choice to `localStorage` — no DB/schema changes, no new tRPC router. `packages/ui/src/components/ThemeToggle.tsx` is the picker UI (swatch-dot dropdown, same interaction pattern as the existing `ProfileSwitcher`); wired into the web sidebar (`AppShell`), the mobile header (`(mobile)/m/layout.tsx`, collapsed/icon-only), and the kiosk display corner (`(display)/display/layout.tsx`, collapsed).
  - Replaced literal `bg-white` with the new `bg-surface` token across 16 files (cards, dialogs, the sidebar, calendar grid views) — these were the one place raw un-themed hex had crept in outside the preset; everything else already went through `ink`/`sapphire`/`gold`/`paper` tokens.
  - **Real bug found and fixed via browser verification, not just typecheck**: `EventCard`'s full (non-`dense`) variant and `TaskCard`'s due/points row used theme-reactive `text-ink-*` Tailwind classes on top of a background computed by `colorUtils.ts`'s `tintColor()`/`shadeColor()` — which always mixes toward literal white/black regardless of theme, by design (event/task cards keep a fixed soft tint of the assignee's color so "whose is this" reads at a glance in every theme). In dark mode `ink-900` inverts to near-white, landing near-white text on a still-light-tinted card — invisible. Fixed by switching those text colors to `shadeColor(accentColor, ...)` (computed from the same per-person color the background is tinted from), matching the pattern `EventCard`'s `dense` variant already used correctly. Caught by actually logging in and screenshotting the dashboard in dark mode with Playwright, not by lint/typecheck (both were clean before and after — this was a visual-only regression).
  - Verified in a real browser (Playwright, headless Chromium, logged in as the seeded demo user) across all 4 themes on: dashboard, calendar (week view), tasks, rewards, lists, family, and the mobile (`/m`) layout. No remaining contrast issues found after the `EventCard`/`TaskCard` fix.
  - Added `next-themes` as a dependency of both `apps/app` and `packages/ui` (the latter needs it directly since `ThemeToggle` calls `useTheme()`).
  - `pnpm typecheck` and `pnpm lint` clean across all packages.
- Files touched: `packages/config/tailwind.preset.js`, `apps/app/src/app/globals.css`, `apps/app/src/app/{layout,providers}.tsx`, `packages/ui/src/components/ThemeToggle.tsx` (new), `packages/ui/src/index.ts`, `packages/ui/src/components/{EventCard,TaskCard,Card,calendar/{DayView,WeekView,MonthView}}.tsx`, `apps/app/src/components/{AppShell,Dashboard,EventDetailsDialog,EventFormDialog,MealPlanPage,ProfileSwitcher,RewardsPage,TaskFormDialog}.tsx`, `apps/app/src/app/(mobile)/m/layout.tsx`, `apps/app/src/app/(display)/display/layout.tsx`, `apps/app/src/app/(auth)/{sign-in,sign-up}/page.tsx`, `apps/app/package.json`, `packages/ui/package.json`, `pnpm-lock.yaml`.
- **Not done**: nothing committed yet (left for review). No per-user/household DB-persisted theme preference — intentionally out of scope, `localStorage` via `next-themes` covers the ask without a schema migration; revisit only if cross-device sync of the theme choice is actually requested.

## What changed this session (session 5, 2026-08-31, NOT yet committed)

- **Upgraded Prisma 5.22.0 → 7.10.0** in `packages/db` (via 6.19.3 as an intermediate stop — no `prisma migrate dev` diff was produced at that stop, confirmed empirically against the local docker Postgres: the schema has no implicit many-to-many relations and no `Bytes` fields, so neither of v6's breaking-change footguns applied here).
- **Prisma 7 is a real architecture change, not just a version bump**: the `prisma-client-js` generator is gone (now `provider = "prisma-client"` with a required `output` path — generates to `packages/db/generated/prisma`, already covered by the existing `.gitignore` entry); the Rust query engine is gone in favor of a driver-adapter model (added `@prisma/adapter-pg` + `pg` as deps); `datasource { url = env(...) }` in `schema.prisma` is **rejected outright** (not just deprecated) — connection config now lives in a new `packages/db/prisma.config.ts`; and the CLI **no longer auto-loads env vars or `.env` files at all**, for *any* subcommand including plain `prisma generate`.
  - `packages/db/src/index.ts` and `packages/db/prisma/seed.ts` now import `PrismaClient` from `../generated/prisma/client` (not `@prisma/client`) and construct it with `new PrismaPg({ connectionString: process.env.DATABASE_URL })` passed as the `adapter` option.
  - Because the CLI needs `DATABASE_URL` resolvable for *every* invocation now (even `generate`, which never touches the DB), two previously-unwrapped root scripts broke: `pnpm lint` and `pnpm typecheck` are now wrapped with `dotenv -e .env --` (matching `dev`/`build`, which already were).
  - **Turborepo strips the parent shell's env vars from task sandboxes by default** — this was previously invisible because no task ever needed a real env var, but `@household/db`'s `build` script (`prisma generate`) now does. Fixed by adding `"env": ["DATABASE_URL"]` to the `@household/db#build` task in `turbo.json`. **This would have broken the Vercel production build too** (Vercel's monorepo build also runs through turbo) had it not been caught here — worth confirming on the next real Vercel deploy that `DATABASE_URL` is actually reaching the build.
- **Automatic seeding after `prisma migrate dev` is gone in v7** — confirmed empirically (no seed prompt fired). `pnpm db:seed` (`prisma db seed` under the hood) still works as a separate, explicit step; no script changes needed since this repo already ran seed as its own command.
- Verified against the local docker Postgres (`household_postgres`, already seeded from a prior session): `prisma migrate dev` reports "Already in sync"; `prisma db seed` correctly reproduces the pre-existing, already-documented "not safely re-runnable" unique-constraint failure (see tech debt below) — which also confirms the new driver-adapter query path works end-to-end (a real write reached Postgres and got a real `P2002` back). Did **not** run migrate/seed against the mystery `pooled.db.prisma.io` URL in root `.env` — see the flag at the top of this file.
- Ran `pnpm typecheck`, `pnpm lint`, and a full `pnpm build` (Next.js/Turbopack production build) after all of the above — all clean, no `next.config.mjs` changes needed (`transpilePackages` + Turbopack handled the relocated generated client and the `pg` adapter's native module without any `serverExternalPackages`/tracing additions).
- Files touched: `packages/db/package.json`, `packages/db/prisma/schema.prisma`, `packages/db/prisma/seed.ts`, `packages/db/src/index.ts`, `packages/db/prisma.config.ts` (new), `package.json` (root `lint`/`typecheck` scripts), `turbo.json`, `pnpm-lock.yaml`.
- **Not done**: nothing was committed (left for review). Vercel env vars weren't touched or re-verified against this change — worth a real deploy check given the turbo env-passthrough fix above.

## What changed this session (session 3, 2026-08-31, committed)

- **Fixed the Vercel production build**, which was failing with `Parameter 'm' implicitly has an 'any' type` in `CalendarPage.tsx`. Root cause: Vercel's build environment runs pnpm v10, which blocks dependency `postinstall` scripts (including `@prisma/client`'s `prisma generate`) by default unless allowlisted — so Prisma Client was never generated, `ctx.prisma.*` calls collapsed to `any`, and that propagated through tRPC into every `.find()` callback on query results. Fixed by adding `"build": "prisma generate"` to `packages/db/package.json` — Turborepo's existing `dependsOn: ["^build"]` pipeline (`turbo.json`) now runs it automatically before `@household/app` builds, with no reliance on install-time lifecycle scripts.
  - **A second, separate issue surfaced once that was fixed**: `/family` calls `useSearchParams()` (reads calendar-OAuth-callback status query params) without a Suspense boundary, which Next.js requires for static prerendering. Fixed by wrapping `<FamilyPage />` in `<Suspense>` in `apps/app/src/app/(web)/family/page.tsx`.
  - Verified with a full local `turbo run build` — completes cleanly, all routes generate.
- **Upgraded Next.js 15.1.2 → 16.3.3** (React 19.0 → 19.2.8, `eslint-config-next` 15.1.2 → 16.3.3, `next-auth` 5.0.0-beta.25 → 5.0.0-beta.32 for its Next 16 peer-dep support). Scan of the [Next 16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16) against this codebase found no usage of the big-ticket breaking changes (no dynamic page routes reading `params`/`searchParams` synchronously, no `images.domains`/AMP/`revalidateTag`/parallel-routes usage). Two things actually needed changing:
  - `apps/app/src/middleware.ts` → `apps/app/src/proxy.ts` (Next 16 renames the file/convention; `CLAUDE.md`'s architecture section updated to match). Bonus: `proxy` always runs on the Node.js runtime rather than Edge, which cleared up the `bcryptjs`/Edge-Runtime build warnings that `next-auth`'s credentials provider was triggering.
  - `apps/app`'s `lint` script (`next lint`, removed in 16) → `eslint .` against a new flat `apps/app/eslint.config.mjs` (replaces `.eslintrc.json`), per the `eslint-config-next` flat-config setup. Surfaced one pre-existing style warning in `postcss.config.mjs` (anonymous default export — flat config lints config files that `next lint` didn't); fixed trivially.
  - Also bumped `package.json` `engines.node` to the new `>=20.9.0` floor and `@types/react`/`@types/react-dom` to match React 19.2.
  - **Turbopack is now the default** for both `next dev` and `next build` (previously Webpack implicitly) — no custom webpack config existed in `next.config.mjs`, so this was a non-event, but worth knowing if a future dependency needs a webpack-only workaround.
  - Verified: full `turbo run build`/`typecheck`/`lint` all clean, plus a manual browser smoke test of `next dev` — signed in, checked `/dashboard`, `/family` (the Suspense fix), `/m`, `/display`, signed out, confirmed `proxy.ts` still redirects an unauthenticated request to `/sign-in`, signed back in. No console errors on any surface.
  - **Not touched, flagged as remaining risk**: `@trpc/*` is still pinned to `11.0.0-rc.688`, a stale prerelease — tRPC has since shipped stable `11.18.0`. It works fine against Next 16/React 19.2 as-is (peer deps are satisfied), so left alone as out-of-scope for this upgrade, but worth bumping to stable opportunistically. `next-auth` is still on a beta (`5.0.0-beta.32`, the latest beta) — v5 hasn't gone stable yet, nothing to do there but wait upstream.

## What changed this session (session 2, 2026-08-29, NOT yet committed)

Scope for this session was explicitly chosen with the user from the full M2 + Phase 2 lists below (the rest is intentionally still unchecked):

- **M2: `canonicalHash` dedup for events arriving via multiple connected calendars.** New `EventSourceLink` model (`packages/db/prisma/schema.prisma`) maps every `(calendarAccount, providerEventId)` pair to a shared `Event`, replacing the old assumption that an `Event` has at most one source. `apps/app/src/server/integrations/syncGoogleCalendar.ts` was rewritten: `canonicalHash` is now derived from Google's `iCalUID` (stable across every attendee's own copy of an event) instead of `google:${event.id}` (stable only within one account). When an incoming event's hash matches an `Event` already synced from a *different* connected calendar, sync links to it and adds the new account's owner as an assignee instead of creating a duplicate calendar entry; cancellation on one calendar only removes that account's link/assignment, not the whole event, unless it was the last remaining link.
  - **Bug found and fixed during verification**: the 27 events already synced in a prior session only had the old direct `Event.calendarAccountId`/`sourceEventId` columns set, no `EventSourceLink` row (the table didn't exist yet) — re-syncing that account crashed with a unique-constraint violation because sync now looks up `EventSourceLink` first, finds nothing, and tries to `create` a duplicate. Fixed with a second migration (`20260829051656_backfill_event_source_links`) that backfills `EventSourceLink` from every pre-existing `Event.calendarAccountId`/`sourceEventId` pair. **If you're reading this in a fresh session and see the same unique-constraint error on `calendarAccount.sync`, check whether that migration actually ran.**
  - Verified: re-synced the real connected Google account twice in a row post-fix — event count stayed stable at 19 (no duplicates), confirming idempotency.
- **M2: Two-way write-back for Google.** OAuth scope widened from `calendar.readonly` to `calendar.events` (`apps/app/src/server/integrations/googleCalendar.ts`). New `apps/app/src/server/integrations/writebackGoogleCalendar.ts`: `pushEventToGoogle` mirrors an in-app-created/updated `Event` to every connected+writable Google account belonging to one of its *assignees* (not just the creator), tracked via the same `EventSourceLink` table so re-pushes update in place and inbound sync recognizes them as already-linked instead of re-importing; `retractEventFromGoogle` deletes the mirrored copy on in-app delete. Wired into `event.create`/`update`/`delete` in `apps/app/src/server/trpc/routers/event.ts`, wrapped so a Google API failure never blocks the in-app save (logs and continues — the local DB is authoritative).
  - **Verified live end-to-end** (follow-up, after the user reconnected Google Calendar from `/family` under the new `calendar.events` scope): created an event assigned to the connected account's owner — `pushEventToGoogle` returned a real Google-assigned event id and an `EventSourceLink` row was created; edited the event — update pushed with no error; deleted the event — retract pushed with no error. (Before the reconnect, a push attempt correctly failed with Google's 403 `insufficientPermissions`/`ACCESS_TOKEN_SCOPE_INSUFFICIENT` against the old readonly-scoped token, and was caught cleanly without blocking the save — expected, since that token predated the scope change.)
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
- [x] Two-way write-back for Google (create/update/delete in-app → push to provider) — session 2, built and verified live end-to-end (see above). Microsoft write-back still not built.
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
