import { describe, expect, it } from "vitest";
import { needsFullSync, syncWindow } from "./syncGoogleCalendar";

/**
 * Google bakes the originating request's `timeMin`/`timeMax` into the sync
 * token it returns, and forbids sending either alongside one. A token
 * therefore keeps answering against the window that created it for as long as
 * it is used, and something has to notice when that frozen horizon is running
 * out and re-baseline against a fresh window.
 *
 * The alternative — dropping `timeMax` so nothing is frozen — is what these
 * tests exist to stop anyone reintroducing. With `singleEvents=true` and no
 * upper bound, Google expands never-ending recurring events into instances
 * with nothing to stop at, and the page walk runs until the serverless
 * function is killed. That shipped, and hung the first real sync.
 */

const NOW = new Date("2026-06-01T12:00:00Z");
const DAY = 86_400_000;

describe("syncWindow", () => {
  it("is bounded at both ends", () => {
    const { timeMin, timeMax } = syncWindow(NOW);

    expect(timeMin.getTime()).toBeLessThan(NOW.getTime());
    expect(timeMax.getTime()).toBeGreaterThan(NOW.getTime());
    expect(Number.isFinite(timeMax.getTime())).toBe(true);
  });

  it("reaches 30 days back and 180 days forward", () => {
    const { timeMin, timeMax } = syncWindow(NOW);

    expect((NOW.getTime() - timeMin.getTime()) / DAY).toBe(30);
    expect((timeMax.getTime() - NOW.getTime()) / DAY).toBe(180);
  });

  it("slides with the clock", () => {
    const later = new Date(NOW.getTime() + 10 * DAY);

    expect(syncWindow(later).timeMax.getTime() - syncWindow(NOW).timeMax.getTime()).toBe(10 * DAY);
  });
});

describe("needsFullSync", () => {
  it("requires one when there is no sync token yet", () => {
    expect(needsFullSync({ syncCursor: null, syncWindowEnd: null }, NOW)).toBe(true);
  });

  // Tokens stored before the horizon was tracked — re-baseline once so the
  // window they carry stops being a mystery.
  it("requires one for a token with no recorded horizon", () => {
    expect(needsFullSync({ syncCursor: "token", syncWindowEnd: null }, NOW)).toBe(true);
  });

  it("uses the token while its horizon is comfortably ahead", () => {
    const horizon = new Date(NOW.getTime() + 180 * DAY);

    expect(needsFullSync({ syncCursor: "token", syncWindowEnd: horizon }, NOW)).toBe(false);
  });

  it("re-baselines once the horizon is within 60 days", () => {
    const horizon = new Date(NOW.getTime() + 59 * DAY);

    expect(needsFullSync({ syncCursor: "token", syncWindowEnd: horizon }, NOW)).toBe(true);
  });

  it("re-baselines a horizon already in the past", () => {
    const horizon = new Date(NOW.getTime() - DAY);

    expect(needsFullSync({ syncCursor: "token", syncWindowEnd: horizon }, NOW)).toBe(true);
  });

  // The whole point of the mechanism: a token left alone long enough must not
  // quietly keep reporting against a window that has drifted into the past.
  it("eventually re-baselines a window it was happy with earlier", () => {
    const { timeMax } = syncWindow(NOW);
    const account = { syncCursor: "token", syncWindowEnd: timeMax };

    expect(needsFullSync(account, NOW)).toBe(false);
    expect(needsFullSync(account, new Date(NOW.getTime() + 130 * DAY))).toBe(true);
  });
});
