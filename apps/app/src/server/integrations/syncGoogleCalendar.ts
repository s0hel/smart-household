import crypto from "node:crypto";
import type { PrismaClient } from "@household/db";
import { decryptToken, encryptToken } from "./tokenCrypto";
import {
  fetchPrimaryCalendarEvents,
  refreshAccessToken,
  type GoogleCalendarEvent,
} from "./googleCalendar";

const SYNC_WINDOW_PAST_DAYS = 30;
const SYNC_WINDOW_FUTURE_DAYS = 180;

function canonicalHash(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

function toDate(part: { date?: string; dateTime?: string } | undefined): { date: Date; allDay: boolean } | null {
  if (!part) return null;
  if (part.dateTime) return { date: new Date(part.dateTime), allDay: false };
  if (part.date) return { date: new Date(`${part.date}T00:00:00`), allDay: true };
  return null;
}

/**
 * Pulls the connected Google account's primary calendar for a rolling window
 * and upserts it into the shared Event table.
 *
 * Every (calendarAccount, providerEventId) pair is tracked via an
 * EventSourceLink. Before creating a new Event, we check whether another
 * connected calendar in this household already synced an event with the same
 * canonicalHash (derived from Google's cross-account-stable `iCalUID`) — if
 * so, this is the same real-world event arriving a second time (e.g. two
 * parents both invited to "Dentist - Emma"), so we link to the existing Event
 * and add this account's owner as an assignee instead of creating a
 * duplicate calendar entry.
 */
export async function syncGoogleCalendarAccount(prisma: PrismaClient, calendarAccountId: string): Promise<void> {
  const account = await prisma.calendarAccount.findUniqueOrThrow({ where: { id: calendarAccountId } });
  if (account.provider !== "GOOGLE" || !account.accessToken || !account.refreshToken) {
    throw new Error("Calendar account is not a connected Google account");
  }

  const timeMin = new Date(Date.now() - SYNC_WINDOW_PAST_DAYS * 86_400_000);
  const timeMax = new Date(Date.now() + SYNC_WINDOW_FUTURE_DAYS * 86_400_000);

  let accessToken = decryptToken(account.accessToken);
  let events: GoogleCalendarEvent[];
  try {
    events = await fetchPrimaryCalendarEvents(accessToken, timeMin, timeMax);
  } catch {
    // Access token most likely expired — refresh once and retry.
    const refreshed = await refreshAccessToken(decryptToken(account.refreshToken));
    accessToken = refreshed.access_token;
    await prisma.calendarAccount.update({
      where: { id: account.id },
      data: { accessToken: encryptToken(accessToken) },
    });
    events = await fetchPrimaryCalendarEvents(accessToken, timeMin, timeMax);
  }

  for (const event of events) {
    const existingLink = await prisma.eventSourceLink.findUnique({
      where: { calendarAccountId_sourceEventId: { calendarAccountId: account.id, sourceEventId: event.id } },
      include: { event: { include: { sourceLinks: true } } },
    });

    if (event.status === "cancelled") {
      if (!existingLink) continue;
      const remainingLinks = existingLink.event.sourceLinks.filter((link) => link.id !== existingLink.id);
      await prisma.$transaction(async (tx) => {
        await tx.eventSourceLink.delete({ where: { id: existingLink.id } });
        if (remainingLinks.length === 0) {
          // No other connected calendar still references this event.
          await tx.event.delete({ where: { id: existingLink.eventId } });
        } else {
          // Other calendars still have it — just drop this owner's attendance.
          await tx.eventAssignee.deleteMany({ where: { eventId: existingLink.eventId, userId: account.ownerId } });
        }
      });
      continue;
    }

    const start = toDate(event.start);
    const end = toDate(event.end) ?? start;
    if (!start || !end) continue;

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
      continue;
    }

    const duplicate = await prisma.event.findFirst({
      where: { householdId: account.householdId, canonicalHash: hash },
    });

    if (duplicate) {
      // Same real-world event, already synced from a different connected
      // calendar — link to it and add this account's owner as an assignee
      // rather than creating a second calendar entry. Content stays owned by
      // whichever calendar synced it first.
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
      continue;
    }

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
  }

  await prisma.calendarAccount.update({
    where: { id: account.id },
    data: { lastSyncedAt: new Date(), status: "connected" },
  });
}
