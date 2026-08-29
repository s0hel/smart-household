import type { PrismaClient } from "@household/db";
import { decryptToken, encryptToken } from "./tokenCrypto";
import {
  createGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  refreshAccessToken,
  updateGoogleCalendarEvent,
  type GoogleCalendarEventInput,
} from "./googleCalendar";

function toGooglePart(date: Date, allDay: boolean): { date?: string; dateTime?: string } {
  return allDay ? { date: date.toISOString().slice(0, 10) } : { dateTime: date.toISOString() };
}

async function withFreshToken<T>(
  prisma: PrismaClient,
  account: { id: string; accessToken: string | null; refreshToken: string | null },
  fn: (accessToken: string) => Promise<T>,
): Promise<T> {
  if (!account.accessToken || !account.refreshToken) {
    throw new Error("Calendar account has no stored tokens");
  }
  try {
    return await fn(decryptToken(account.accessToken));
  } catch {
    const refreshed = await refreshAccessToken(decryptToken(account.refreshToken));
    await prisma.calendarAccount.update({
      where: { id: account.id },
      data: { accessToken: encryptToken(refreshed.access_token) },
    });
    return fn(refreshed.access_token);
  }
}

/**
 * Mirrors an in-app-created/updated event to every connected+writable Google
 * account belonging to one of its assignees. Each push is tracked via
 * EventSourceLink (the same table inbound sync uses for dedup) so a re-push
 * updates the existing Google event in place, and so a later inbound sync
 * recognizes it as already-linked instead of importing it as a new Event.
 *
 * Best-effort: failures here shouldn't block the in-app save, since the local
 * DB is authoritative and the Google copy is a mirror. Callers should catch.
 */
export async function pushEventToGoogle(prisma: PrismaClient, eventId: string): Promise<void> {
  const event = await prisma.event.findUniqueOrThrow({
    where: { id: eventId },
    include: { assignees: true, sourceLinks: true },
  });

  const assigneeIds = event.assignees.map((a) => a.userId);
  if (assigneeIds.length === 0) return;

  const accounts = await prisma.calendarAccount.findMany({
    where: { householdId: event.householdId, ownerId: { in: assigneeIds }, provider: "GOOGLE", status: "connected" },
  });
  if (accounts.length === 0) return;

  const input: GoogleCalendarEventInput = {
    summary: event.title,
    location: event.location,
    description: event.description,
    start: toGooglePart(event.startAt, event.allDay),
    end: toGooglePart(event.endAt, event.allDay),
  };

  for (const account of accounts) {
    const link = event.sourceLinks.find((l) => l.calendarAccountId === account.id);
    await withFreshToken(prisma, account, async (accessToken) => {
      if (link) {
        await updateGoogleCalendarEvent(accessToken, link.sourceEventId, input);
      } else {
        const created = await createGoogleCalendarEvent(accessToken, input);
        await prisma.eventSourceLink.create({
          data: { eventId: event.id, calendarAccountId: account.id, sourceEventId: created.id },
        });
      }
    });
  }
}

/** Removes an in-app event from every Google calendar it was mirrored to. */
export async function retractEventFromGoogle(prisma: PrismaClient, eventId: string): Promise<void> {
  const links = await prisma.eventSourceLink.findMany({
    where: { eventId },
    include: { calendarAccount: true },
  });

  for (const link of links) {
    if (link.calendarAccount.provider !== "GOOGLE" || link.calendarAccount.status !== "connected") continue;
    await withFreshToken(prisma, link.calendarAccount, (accessToken) =>
      deleteGoogleCalendarEvent(accessToken, link.sourceEventId),
    );
  }
}
