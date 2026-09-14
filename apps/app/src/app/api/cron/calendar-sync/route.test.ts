import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The cron endpoint is reachable by anyone who knows the URL — Vercel Cron
 * calls it with a bearer secret, and `proxy.ts` excludes `/api` from the
 * session gate. Left open it would let a stranger drive repeated Google API
 * traffic on this household's OAuth tokens, so the interesting cases are the
 * ones where it must do nothing at all.
 */

const findMany = vi.fn();
const update = vi.fn().mockResolvedValue({});
const syncGoogleCalendarAccount = vi.fn().mockResolvedValue(undefined);
const ensureWatchChannel = vi.fn().mockResolvedValue({ status: "current", expiresAt: new Date() });

vi.mock("@household/db", () => ({
  prisma: {
    calendarAccount: {
      findMany: (...args: unknown[]) => findMany(...args),
      update: (...args: unknown[]) => update(...args),
    },
  },
}));

vi.mock("@/server/integrations/syncGoogleCalendar", () => ({
  syncGoogleCalendarAccount: (...args: unknown[]) => syncGoogleCalendarAccount(...args),
}));

vi.mock("@/server/integrations/calendarWatch", () => ({
  ensureWatchChannel: (...args: unknown[]) => ensureWatchChannel(...args),
}));

const { GET } = await import("./route");

function run(headers: Record<string, string> = {}): Promise<Response> {
  return GET(new Request("https://household.example.com/api/cron/calendar-sync", { headers }));
}

beforeEach(() => {
  vi.clearAllMocks();
  findMany.mockResolvedValue([{ id: "account-1" }, { id: "account-2" }]);
  process.env.CRON_SECRET = "cron-secret";
});

afterEach(() => {
  delete process.env.CRON_SECRET;
});

describe("calendar sync cron", () => {
  it("renews the channel and syncs every Google account", async () => {
    const response = await run({ authorization: "Bearer cron-secret" });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, accounts: 2 });
    expect(ensureWatchChannel).toHaveBeenCalledTimes(2);
    expect(syncGoogleCalendarAccount).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["no authorization header", {}],
    ["a wrong secret", { authorization: "Bearer nope" }],
    ["the secret without the scheme", { authorization: "cron-secret" }],
  ])("refuses a request with %s", async (_label, headers) => {
    const response = await run(headers);

    expect(response.status).toBe(401);
    expect(findMany).not.toHaveBeenCalled();
    expect(syncGoogleCalendarAccount).not.toHaveBeenCalled();
  });

  // Refusing outright beats treating "no secret configured" as "no check
  // needed", which is how an endpoint like this ends up open in production.
  it("refuses everything when no secret is configured", async () => {
    delete process.env.CRON_SECRET;

    const response = await run({ authorization: "Bearer anything" });

    expect(response.status).toBe(503);
    expect(syncGoogleCalendarAccount).not.toHaveBeenCalled();
  });

  // One revoked grant shouldn't stop the other calendars in the household from
  // catching up.
  it("keeps going after one account fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    syncGoogleCalendarAccount.mockRejectedValueOnce(new Error("grant revoked"));

    const response = await run({ authorization: "Bearer cron-secret" });
    const body = (await response.json()) as { results: { id: string; sync: string }[] };

    expect(response.status).toBe(200);
    expect(syncGoogleCalendarAccount).toHaveBeenCalledTimes(2);
    expect(body.results).toEqual([
      expect.objectContaining({ id: "account-1", sync: "failed" }),
      expect.objectContaining({ id: "account-2", sync: "ok" }),
    ]);
    expect(update).toHaveBeenCalledWith({ where: { id: "account-1" }, data: { status: "error" } });
  });

  it("still syncs when channel renewal fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    ensureWatchChannel.mockRejectedValueOnce(new Error("Google said no"));

    const response = await run({ authorization: "Bearer cron-secret" });
    const body = (await response.json()) as { results: { channel: string }[] };

    expect(response.status).toBe(200);
    expect(body.results[0]).toMatchObject({ channel: "failed", sync: "ok" });
    expect(syncGoogleCalendarAccount).toHaveBeenCalledTimes(2);
  });
});
