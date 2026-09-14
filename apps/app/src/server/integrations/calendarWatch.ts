import crypto from "node:crypto";
import type { CalendarAccount, PrismaClient } from "@household/db";
import { stopWatchChannel, watchPrimaryCalendar } from "./googleCalendar";
import { withGoogleAccessToken } from "./googleAccessToken";

/** Path Google POSTs its change notifications to. */
export const WEBHOOK_PATH = "/api/calendar/google/notifications";

/**
 * Requested channel lifetime. Google caps this itself (a week is the usual
 * ceiling for Calendar) and reports the real expiry back, which is what we
 * store — never this number.
 */
const CHANNEL_TTL_SECONDS = 7 * 24 * 60 * 60;

/**
 * Renew once a channel has less than this left. The renewal cron runs daily,
 * so this leaves three chances to renew before a channel lapses and pushes
 * stop arriving silently.
 */
const RENEW_WHEN_REMAINING_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * The public HTTPS URL Google should call, or null when there isn't one.
 *
 * Google will only deliver to a publicly reachable HTTPS endpoint with a valid
 * certificate, so localhost and plain HTTP can't receive pushes at all — on a
 * dev machine this returns null and the whole feature degrades to the
 * periodic/manual sync path instead of failing.
 *
 * It has to be pinned explicitly rather than derived from the incoming
 * request: a channel outlives the deployment that opened it, and a per-deploy
 * preview URL would stop resolving while Google was still calling it.
 */
export function resolveWebhookUrl(): string | null {
  const explicit = process.env.GOOGLE_CALENDAR_WEBHOOK_URL?.trim();
  const base =
    explicit ||
    process.env.AUTH_URL?.trim() ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "");
  if (!base) return null;

  let url: URL;
  try {
    url = new URL(base);
  } catch {
    return null;
  }

  if (url.protocol !== "https:") return null;
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname.endsWith(".local")) return null;

  // An explicit value may already name the endpoint itself; anything else is
  // treated as an origin to hang the webhook path off.
  if (url.pathname !== WEBHOOK_PATH) {
    url = new URL(WEBHOOK_PATH, url.origin);
  }
  return url.toString();
}

export type EnsureChannelResult =
  | { status: "unavailable"; reason: string }
  | { status: "current"; expiresAt: Date }
  | { status: "registered"; expiresAt: Date };

function channelIsHealthy(account: CalendarAccount): boolean {
  return Boolean(
    account.channelId &&
      account.channelResourceId &&
      account.channelExpiresAt &&
      account.channelExpiresAt.getTime() - Date.now() > RENEW_WHEN_REMAINING_MS,
  );
}

/**
 * Makes sure this account has a live push channel, opening or renewing one as
 * needed. Safe to call repeatedly — it's a no-op while the current channel has
 * comfortable life left in it.
 *
 * Renewal means opening a *new* channel and then stopping the old one, so
 * there is never a gap where changes go unnoticed; a brief overlap just costs
 * a duplicate ping, and an incremental sync of no changes is nearly free.
 */
export async function ensureWatchChannel(
  prisma: PrismaClient,
  calendarAccountId: string,
  options: { force?: boolean } = {},
): Promise<EnsureChannelResult> {
  const account = await prisma.calendarAccount.findUniqueOrThrow({ where: { id: calendarAccountId } });
  if (account.provider !== "GOOGLE") {
    return { status: "unavailable", reason: "not a Google account" };
  }

  const address = resolveWebhookUrl();
  if (!address) {
    return {
      status: "unavailable",
      reason: "no public HTTPS webhook URL configured (set GOOGLE_CALENDAR_WEBHOOK_URL)",
    };
  }

  if (!options.force && channelIsHealthy(account)) {
    return { status: "current", expiresAt: account.channelExpiresAt as Date };
  }

  const previous =
    account.channelId && account.channelResourceId
      ? { id: account.channelId, resourceId: account.channelResourceId }
      : null;

  const channelId = crypto.randomUUID();
  const token = crypto.randomBytes(24).toString("hex");

  const channel = await withGoogleAccessToken(prisma, account, (accessToken) =>
    watchPrimaryCalendar(accessToken, { channelId, address, token, ttlSeconds: CHANNEL_TTL_SECONDS }),
  );

  await prisma.calendarAccount.update({
    where: { id: account.id },
    data: {
      channelId,
      channelResourceId: channel.resourceId,
      channelToken: token,
      channelExpiresAt: channel.expiration,
    },
  });

  if (previous) {
    // Best effort: the new channel is already live, and a stale one lapses on
    // its own. Its pings no longer match a stored channelId, so they're
    // rejected rather than acted on.
    try {
      const refreshed = await prisma.calendarAccount.findUniqueOrThrow({ where: { id: account.id } });
      await withGoogleAccessToken(prisma, refreshed, (accessToken) =>
        stopWatchChannel(accessToken, previous.id, previous.resourceId),
      );
    } catch {
      // Ignored on purpose — see above.
    }
  }

  return { status: "registered", expiresAt: channel.expiration };
}

/**
 * Closes this account's push channel and forgets it. Called when a calendar is
 * disconnected, so Google stops notifying us about a calendar we no longer
 * hold tokens for.
 */
export async function stopWatchChannelForAccount(prisma: PrismaClient, account: CalendarAccount): Promise<void> {
  if (!account.channelId || !account.channelResourceId) return;
  const { channelId, channelResourceId } = account;

  try {
    await withGoogleAccessToken(prisma, account, (accessToken) =>
      stopWatchChannel(accessToken, channelId, channelResourceId),
    );
  } catch {
    // The channel expires on its own within the week; a failure here must not
    // block the disconnect the user asked for.
  }
}
