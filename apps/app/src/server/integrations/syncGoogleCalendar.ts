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

function canonicalHash(googleEventId: string): string {
  return crypto.createHash("sha256").update(`google:${googleEventId}`).digest("hex");
}

function toDate(part: { date?: string; dateTime?: string } | undefined): { date: Date; allDay: boolean } | null {
  if (!part) return null;
  if (part.dateTime) return { date: new Date(part.dateTime), allDay: false };
  if (part.date) return { date: new Date(`${part.date}T00:00:00`), allDay: true };
  return null;
}

/**
 * Pulls the connected Google account's primary calendar for a rolling window
 * and upserts it into the shared Event table, keyed on (calendarAccountId,
 * sourceEventId) so re-syncs update in place rather than duplicating.
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
    if (event.status === "cancelled") {
      await prisma.event.deleteMany({
        where: { calendarAccountId: account.id, sourceEventId: event.id },
      });
      continue;
    }

    const start = toDate(event.start);
    const end = toDate(event.end) ?? start;
    if (!start || !end) continue;

    await prisma.event.upsert({
      where: {
        calendarAccountId_sourceEventId: { calendarAccountId: account.id, sourceEventId: event.id },
      },
      create: {
        householdId: account.householdId,
        title: event.summary ?? "(untitled)",
        startAt: start.date,
        endAt: end.date,
        allDay: start.allDay,
        location: event.location,
        description: event.description,
        calendarAccountId: account.id,
        sourceEventId: event.id,
        canonicalHash: canonicalHash(event.id),
      },
      update: {
        title: event.summary ?? "(untitled)",
        startAt: start.date,
        endAt: end.date,
        allDay: start.allDay,
        location: event.location,
        description: event.description,
        canonicalHash: canonicalHash(event.id),
      },
    });
  }

  await prisma.calendarAccount.update({
    where: { id: account.id },
    data: { lastSyncedAt: new Date(), status: "connected" },
  });
}
