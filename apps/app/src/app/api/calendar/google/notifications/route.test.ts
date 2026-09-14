import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The Google push webhook is the one route in the app that runs real work for
 * an unauthenticated caller — Google POSTs it, not a signed-in browser, and
 * `proxy.ts` excludes `/api` from its session gate. The only thing separating a
 * stranger's POST from a sync run against a household's calendar is the
 * `X-Goog-Channel-Token` secret, so these tests are mostly about proving that
 * every path which fails that check does no work at all.
 *
 * Prisma is faked and the sync function is stubbed, so this needs no database
 * and never talks to Google.
 */

const findUnique = vi.fn();
const update = vi.fn().mockResolvedValue({});
const syncGoogleCalendarAccount = vi.fn().mockResolvedValue(undefined);

vi.mock("@household/db", () => ({
  prisma: { calendarAccount: { findUnique: (...args: unknown[]) => findUnique(...args), update: (...args: unknown[]) => update(...args) } },
}));

vi.mock("@/server/integrations/syncGoogleCalendar", () => ({
  syncGoogleCalendarAccount: (...args: unknown[]) => syncGoogleCalendarAccount(...args),
}));

const { POST } = await import("./route");

const ACCOUNT = { id: "account-1", channelId: "channel-1", channelToken: "s3cret-token" };

function notify(headers: Record<string, string>): Promise<Response> {
  return POST(new Request("https://household.example.com/api/calendar/google/notifications", {
    method: "POST",
    headers,
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  findUnique.mockResolvedValue(ACCOUNT);
});

describe("Google Calendar push webhook", () => {
  it("syncs the account a valid notification belongs to", async () => {
    const response = await notify({
      "x-goog-channel-id": "channel-1",
      "x-goog-channel-token": "s3cret-token",
      "x-goog-resource-state": "exists",
    });

    expect(response.status).toBe(200);
    expect(syncGoogleCalendarAccount).toHaveBeenCalledOnce();
    expect(syncGoogleCalendarAccount).toHaveBeenCalledWith(expect.anything(), "account-1");
  });

  it("rejects a wrong token without syncing", async () => {
    const response = await notify({
      "x-goog-channel-id": "channel-1",
      "x-goog-channel-token": "wrong-token!!",
      "x-goog-resource-state": "exists",
    });

    expect(response.status).toBe(403);
    expect(syncGoogleCalendarAccount).not.toHaveBeenCalled();
  });

  // timingSafeEqual throws outright on a length mismatch, so a token of the
  // wrong length has to be handled before the comparison, not by it.
  it.each([
    ["a shorter token", "short"],
    ["a longer token", "s3cret-token-with-more"],
    ["an empty token", ""],
  ])("rejects %s without syncing", async (_label, token) => {
    const response = await notify({
      "x-goog-channel-id": "channel-1",
      "x-goog-channel-token": token,
      "x-goog-resource-state": "exists",
    });

    expect(response.status).toBe(403);
    expect(syncGoogleCalendarAccount).not.toHaveBeenCalled();
  });

  it("rejects a notification carrying no token at all", async () => {
    const response = await notify({ "x-goog-channel-id": "channel-1", "x-goog-resource-state": "exists" });

    expect(response.status).toBe(403);
    expect(syncGoogleCalendarAccount).not.toHaveBeenCalled();
  });

  it("refuses a request with no channel id", async () => {
    const response = await notify({ "x-goog-resource-state": "exists" });

    expect(response.status).toBe(400);
    expect(findUnique).not.toHaveBeenCalled();
    expect(syncGoogleCalendarAccount).not.toHaveBeenCalled();
  });

  // A channel we replaced during renewal, or one whose account was
  // disconnected. Answering 2xx lets it lapse instead of putting Google into a
  // retry loop over something we'll never act on.
  it("acknowledges an unknown channel without syncing", async () => {
    findUnique.mockResolvedValue(null);

    const response = await notify({
      "x-goog-channel-id": "stale-channel",
      "x-goog-channel-token": "s3cret-token",
      "x-goog-resource-state": "exists",
    });

    expect(response.status).toBe(200);
    expect(syncGoogleCalendarAccount).not.toHaveBeenCalled();
  });

  it("ignores the handshake ping Google sends when a channel opens", async () => {
    const response = await notify({
      "x-goog-channel-id": "channel-1",
      "x-goog-channel-token": "s3cret-token",
      "x-goog-resource-state": "sync",
    });

    expect(response.status).toBe(200);
    expect(syncGoogleCalendarAccount).not.toHaveBeenCalled();
  });

  // 5xx asks Google to retry with backoff, which is what a transient failure
  // deserves — and the account is flagged so the UI can say sync is broken.
  it("reports a failed sync as retryable and marks the account", async () => {
    syncGoogleCalendarAccount.mockRejectedValueOnce(new Error("Google is down"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await notify({
      "x-goog-channel-id": "channel-1",
      "x-goog-channel-token": "s3cret-token",
      "x-goog-resource-state": "exists",
    });

    expect(response.status).toBe(500);
    expect(update).toHaveBeenCalledWith({ where: { id: "account-1" }, data: { status: "error" } });
  });
});
