import crypto from "node:crypto";
import type { CalendarAccount, PrismaClient } from "@household/db";
import { withGoogleAccessToken } from "./googleAccessToken";
import {
  fetchPrimaryCalendarEvents,
  SyncTokenExpiredError,
  type GoogleCalendarEvent,
} from "./googleCalendar";

/**
 * How far back a full sync reaches. There is deliberately no forward bound:
 * Google freezes the originating request's `timeMin`/`timeMax` into the
 * `syncToken` it hands back, so a `timeMax` would permanently hide events
 * scheduled beyond it from every later incremental sync.
 */
const SYNC_WINDOW_PAST_DAYS = 30;

function canonicalHash(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002";
}

function toDate(part: { date?: string; dateTime?: string } | undefined): { date: Date; allDay: boolean } | null {
  if (!part) return null;
  if (part.dateTime) return { date: new Date(part.dateTime), allDay: false };
  if (part.date) return { date: new Date(`${part.date}T00:00:00Z`), allDay: true };
  return null;
}

/**
 * Drops this account's claim on an event that has disappeared from Google.
 *
 * If another connected calendar still links to the same Event (the
 * cross-account dedup case — two parents invited to "Dentist - Emma"), the
 * Event survives and only this account owner's attendance is removed.
 */
async function detachSourceLink(
  prisma: PrismaClient,
  account: CalendarAccount,
  link: { id: string; eventId: string; event: { sourceLinks: { id: string }[] } },
): Promise<void> {
  const remainingLinks = link.event.sourceLinks.filter((other) => other.id !== link.id);
  await prisma.$transaction(async (tx) => {
    await tx.eventSourceLink.delete({ where: { id: link.id } });
    if (remainingLinks.length === 0) {
      await tx.event.delete({ where: { id: link.eventId } });
    } else {
      await tx.eventAssignee.deleteMany({ where: { eventId: link.eventId, userId: account.ownerId } });
    }
  });
}

/**
 * Pulls the connected Google account's primary calendar and upserts it into
 * the shared Event table.
 *
 * Two modes, chosen by whether `syncCursor` holds a Google sync token:
 *
 * - **Full sync** (no cursor, or the cursor was rejected) — everything from
 *   `SYNC_WINDOW_PAST_DAYS` ago onward, followed by a reconciliation pass that
 *   removes anything we still have in that window which Google no longer
 *   returns.
 * - **Incremental sync** (cursor present) — only what changed since the token
 *   was issued, including cancellations. This is what a push notification
 *   triggers, so a webhook ping costs one small API call rather than a rescan
 *   of the whole calendar.
 *
 * Every (calendarAccount, providerEventId) pair is tracked via an
 * EventSourceLink. Before creating a new Event, we check whether another
 * connected calendar in this household already synced an event with the same
 * canonicalHash (derived from Google's cross-account-stable `iCalUID`) — if
 * so, this is the same real-world event arriving a second time, so we link to
 * the existing Event and add this account's owner as an assignee instead of
 * creating a duplicate calendar entry.
 */
export async function syncGoogleCalendarAccount(prisma: PrismaClient, calendarAccountId: string): Promise<void> {
  const account = await prisma.calendarAccount.findUniqueOrThrow({ where: { id: calendarAccountId } });
  if (account.provider !== "GOOGLE") {
    throw new Error("Calendar account is not a connected Google account");
  }

  const timeMin = new Date(Date.now() - SYNC_WINDOW_PAST_DAYS * 86_400_000);
  let isFullSync = !account.syncCursor;
  let result;

  try {
    result = await withGoogleAccessToken(prisma, account, (token) =>
      account.syncCursor
        ? fetchPrimaryCalendarEvents(token, { syncToken: account.syncCursor })
        : fetchPrimaryCalendarEvents(token, { timeMin }),
    );
  } catch (error) {
    if (!(error instanceof SyncTokenExpiredError)) throw error;
    // Token aged out — start over from a full sync.
    await prisma.calendarAccount.update({ where: { id: account.id }, data: { syncCursor: null } });
    isFullSync = true;
    result = await withGoogleAccessToken(prisma, account, (token) =>
      fetchPrimaryCalendarEvents(token, { timeMin }),
    );
  }

  for (const event of result.events) {
    await applyGoogleEvent(prisma, account, event);
  }

  if (isFullSync) {
    await reconcileDeletions(prisma, account, result.events, timeMin);
  }

  await prisma.calendarAccount.update({
    where: { id: account.id },
    data: {
      lastSyncedAt: new Date(),
      status: "connected",
      ...(result.nextSyncToken ? { syncCursor: result.nextSyncToken } : {}),
    },
  });
}

async function applyGoogleEvent(
  prisma: PrismaClient,
  account: CalendarAccount,
  event: GoogleCalendarEvent,
): Promise<void> {
  const existingLink = await prisma.eventSourceLink.findUnique({
    where: { calendarAccountId_sourceEventId: { calendarAccountId: account.id, sourceEventId: event.id } },
    include: { event: { include: { sourceLinks: true } } },
  });

  if (event.status === "cancelled") {
    if (existingLink) await detachSourceLink(prisma, account, existingLink);
    return;
  }

  const start = toDate(event.start);
  const end = toDate(event.end) ?? start;
  if (!start || !end) return;

  // iCalUID alone identifies a recurring *series*, not one occurrence —
  // every weekly instance of "Piano lesson" shares the same iCalUID.
  // Folding in the occurrence's own start instant keeps same-occurrence
  // cross-calendar dedup working while stopping different occurrences of
  // the same series from collapsing into a single Event.
  const hash = canonicalHash(`${event.iCalUID ?? `google:${event.id}`}|${start.date.toISOString()}`);
  const fields = {
    title: event.summary ?? "(untitled)",
    startAt: start.date,
    endAt: end.date,
    allDay: start.allDay,
    location: event.location ?? null,
    description: event.description ?? null,
    canonicalHash: hash,
  };

  if (existingLink) {
    // Already-linked event from this same account — keep it fresh in place.
    await prisma.event.update({ where: { id: existingLink.eventId }, data: fields });
    return;
  }

  const duplicate = await prisma.event.findFirst({
    where: { householdId: account.householdId, canonicalHash: hash },
  });

  if (duplicate) {
    // Same real-world event, already synced from a different connected
    // calendar — link to it and add this account's owner as an assignee
    // rather than creating a second calendar entry. Content stays owned by
    // whichever calendar synced it first.
    try {
      await prisma.$transaction([
        prisma.eventSourceLink.create({
          data: { eventId: duplicate.id, calendarAccountId: account.id, sourceEventId: event.id },
        }),
        prisma.eventAssignee.upsert({
          where: { eventId_userId: { eventId: duplicate.id, userId: account.ownerId } },
          create: { eventId: duplicate.id, userId: account.ownerId },
          update: {},
        }),
      ]);
    } catch (error) {
      // Another notification linked the same event a moment ago; the unique
      // index settled it and there is nothing left to add.
      if (!isUniqueViolation(error)) throw error;
    }
    return;
  }

  try {
    const created = await prisma.event.create({
      data: {
        ...fields,
        householdId: account.householdId,
        calendarAccountId: account.id,
        sourceEventId: event.id,
        assignees: { create: [{ userId: account.ownerId }] },
      },
    });
    await prisma.eventSourceLink.create({
      data: { eventId: created.id, calendarAccountId: account.id, sourceEventId: event.id },
    });
  } catch (error) {
    // Two notifications for the same change can arrive close enough together
    // to race here. `@@unique([calendarAccountId, sourceEventId])` is what
    // actually decides the winner; the loser has nothing left to do.
    if (!isUniqueViolation(error)) throw error;
  }
}

/**
 * After a full sync, removes events this account had synced into the window
 * that Google no longer returns — they were deleted while we weren't looking
 * (or while a sync token was expired, which is exactly when we get here).
 *
 * Scoped to `startAt >= timeMin` because a full sync only asked for that far
 * back; older events are absent because they weren't requested, not because
 * they're gone.
 */
async function reconcileDeletions(
  prisma: PrismaClient,
  account: CalendarAccount,
  events: GoogleCalendarEvent[],
  timeMin: Date,
): Promise<void> {
  const seen = new Set(events.map((event) => event.id));
  const links = await prisma.eventSourceLink.findMany({
    where: { calendarAccountId: account.id, event: { startAt: { gte: timeMin } } },
    include: { event: { include: { sourceLinks: true } } },
  });

  for (const link of links) {
    if (seen.has(link.sourceEventId)) continue;
    await detachSourceLink(prisma, account, link);
  }
}
