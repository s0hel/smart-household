import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@household/db";
import { syncGoogleCalendarAccount } from "@/server/integrations/syncGoogleCalendar";

/**
 * Google Calendar push notifications.
 *
 * Google POSTs here (no body — the interesting parts are all `X-Goog-*`
 * headers) whenever anything changes on a watched calendar, which is what
 * makes "create it in Google, see it in the app" feel immediate instead of
 * waiting for the next poll. The ping says only *that* something changed, so
 * the actual work is an incremental sync against the account's stored sync
 * token.
 *
 * This endpoint is necessarily unauthenticated — Google calls it, not a signed
 * -in browser. `X-Goog-Channel-Token` is the shared secret we handed Google
 * when opening the channel, and matching it against the stored value is the
 * only thing standing between a stranger's POST and a sync run. Note that
 * `proxy.ts` excludes `/api` from its matcher, so no session redirect applies.
 */
export async function POST(request: Request) {
  const channelId = request.headers.get("x-goog-channel-id");
  const channelToken = request.headers.get("x-goog-channel-token");
  const resourceState = request.headers.get("x-goog-resource-state");

  if (!channelId) {
    return NextResponse.json({ error: "missing channel id" }, { status: 400 });
  }

  const account = await prisma.calendarAccount.findUnique({ where: { channelId } });

  // Unknown channel — most likely one we replaced during a renewal, or one
  // belonging to a disconnected account. Answering 2xx lets it lapse quietly
  // instead of putting Google into a retry loop over something we will never
  // act on.
  if (!account?.channelToken) {
    return NextResponse.json({ ok: true, ignored: "unknown channel" });
  }

  if (!tokensMatch(channelToken, account.channelToken)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Sent once when the channel opens, purely to confirm it works.
  if (resourceState === "sync") {
    return NextResponse.json({ ok: true, ignored: "channel handshake" });
  }

  try {
    await syncGoogleCalendarAccount(prisma, account.id);
  } catch (error) {
    console.error(`Google Calendar push sync failed for account ${account.id}`, error);
    await prisma.calendarAccount
      .update({ where: { id: account.id }, data: { status: "error" } })
      .catch(() => undefined);
    // A 5xx asks Google to retry with backoff, which is the right answer for
    // the transient failures (a blip talking to Google, a database hiccup)
    // this mostly sees.
    return NextResponse.json({ error: "sync failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

function tokensMatch(received: string | null, expected: string): boolean {
  if (!received) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on a length mismatch, so that has to be checked
  // first — and checking it separately leaks only the length, not the value.
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
