import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@household/db";
import { ensureWatchChannel } from "@/server/integrations/calendarWatch";
import { syncGoogleCalendarAccount } from "@/server/integrations/syncGoogleCalendar";

/**
 * Periodic calendar maintenance, invoked by Vercel Cron (see
 * `apps/app/vercel.json`).
 *
 * Push notifications do the fast work; this exists because they can't be the
 * whole story:
 *
 * - **Channels expire.** Google caps a watch channel at about a week, so
 *   something has to renew it or pushes stop with no error anywhere.
 * - **Pings can be missed.** A deploy mid-notification, a 500, or an expired
 *   sync token all lose changes that a catch-up sync then recovers.
 * - **Push may be unavailable entirely** — no public HTTPS URL configured, or
 *   an account connected before channels existed. Then this is the only sync.
 *
 * The sync is incremental wherever a sync token is stored, so a run over an
 * unchanged calendar costs one small API call per account.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Without a secret this would be an open endpoint that anyone could use to
    // drive traffic at Google on our tokens.
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  }
  if (!authorized(request.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const accounts = await prisma.calendarAccount.findMany({
    where: { provider: "GOOGLE" },
    select: { id: true },
  });

  const results: { id: string; channel: string; sync: "ok" | "failed" }[] = [];

  for (const { id } of accounts) {
    let channel: string;
    try {
      const outcome = await ensureWatchChannel(prisma, id);
      channel = outcome.status === "unavailable" ? `unavailable: ${outcome.reason}` : outcome.status;
    } catch (error) {
      console.error(`Calendar watch renewal failed for account ${id}`, error);
      channel = "failed";
    }

    let sync: "ok" | "failed" = "ok";
    try {
      await syncGoogleCalendarAccount(prisma, id);
    } catch (error) {
      // One broken account (revoked grant, say) must not stop the rest.
      console.error(`Calendar cron sync failed for account ${id}`, error);
      sync = "failed";
      await prisma.calendarAccount
        .update({ where: { id }, data: { status: "error" } })
        .catch(() => undefined);
    }

    results.push({ id, channel, sync });
  }

  return NextResponse.json({ ok: true, accounts: results.length, results });
}

function authorized(header: string | null, secret: string): boolean {
  if (!header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);
  return received.length === expected.length && crypto.timingSafeEqual(received, expected);
}
