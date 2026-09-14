import type { PrismaClient } from "@household/db";
import { decryptToken, encryptToken } from "./tokenCrypto";
import { refreshAccessToken, SyncTokenExpiredError } from "./googleCalendar";

/** The parts of a CalendarAccount needed to talk to Google as that account. */
export interface GoogleTokenBearer {
  id: string;
  accessToken: string | null;
  refreshToken: string | null;
}

/**
 * Runs `fn` with a usable access token, refreshing once and retrying if the
 * stored one has expired.
 *
 * Google's access tokens last an hour, so every path that calls the API —
 * pulling changes, writing an event back, opening a push channel — hits the
 * same expiry and needs the same retry. Keeping one copy means a refreshed
 * token is always written back to the row, whichever path earned it.
 */
export async function withGoogleAccessToken<T>(
  prisma: PrismaClient,
  account: GoogleTokenBearer,
  fn: (accessToken: string) => Promise<T>,
): Promise<T> {
  if (!account.accessToken || !account.refreshToken) {
    throw new Error("Calendar account has no stored tokens");
  }

  try {
    return await fn(decryptToken(account.accessToken));
  } catch (error) {
    // A stale sync token is a request-level problem, not an auth one —
    // refreshing and retrying would just earn a second 410.
    if (error instanceof SyncTokenExpiredError) throw error;

    const refreshed = await refreshAccessToken(decryptToken(account.refreshToken));
    await prisma.calendarAccount.update({
      where: { id: account.id },
      data: { accessToken: encryptToken(refreshed.access_token) },
    });
    return fn(refreshed.access_token);
  }
}
