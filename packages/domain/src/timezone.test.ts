import { describe, expect, it } from "vitest";
import { addDaysInTimezone, startOfDayInTimezone } from "./timezone";

const NY = "America/New_York";
const LONDON = "Europe/London";
const KOLKATA = "Asia/Kolkata"; // UTC+5:30, no DST — catches half-hour offset bugs
const PHOENIX = "America/Phoenix"; // no DST at all

/** The calendar date an instant falls on, as read in `timeZone`. */
function localDate(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** The wall-clock time an instant shows in `timeZone`. */
function localTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** Local midnight of a given calendar date, the way the app computes it. */
function midnightOn(isoDate: string, timeZone: string): Date {
  return startOfDayInTimezone(new Date(`${isoDate}T12:00:00Z`), timeZone);
}

describe("startOfDayInTimezone", () => {
  it("resolves to midnight as the target zone reads it", () => {
    const start = midnightOn("2026-06-15", NY);
    expect(localDate(start, NY)).toBe("2026-06-15");
    expect(localTime(start, NY)).toBe("00:00");
  });

  it("is stable across every instant within the same local day", () => {
    const zone = NY;
    const morning = startOfDayInTimezone(new Date("2026-06-15T13:00:00.123Z"), zone);
    const evening = startOfDayInTimezone(new Date("2026-06-16T03:45:59.987Z"), zone);
    expect(morning.getTime()).toBe(evening.getTime());
  });

  // Regression: an earlier implementation leaked the input's own milliseconds
  // into the result, so every call produced a slightly different "midnight"
  // and broke the unique-per-day database keys built from it.
  it("never carries sub-second precision through", () => {
    const start = startOfDayInTimezone(new Date("2026-06-15T13:00:00.457Z"), NY);
    expect(start.getMilliseconds()).toBe(0);
    expect(start.getSeconds()).toBe(0);
  });

  // Regression: this originally resolved the UTC offset at the *input*
  // instant and reused it to convert midnight back, but on a transition day
  // the two differ by an hour. Spring-forward was the damaging case — the
  // result landed at 23:00 on the previous calendar day, so anything keyed on
  // "the start of today" (chore occurrenceDate, "due today", review
  // scheduling) silently moved by a day, twice a year.
  describe("on a DST transition day", () => {
    it("returns true local midnight when the clocks go forward", () => {
      // 2026-03-08: clocks jump 02:00 -> 03:00, so the local day is 23h long.
      const start = midnightOn("2026-03-08", NY);
      expect(localDate(start, NY)).toBe("2026-03-08");
      expect(localTime(start, NY)).toBe("00:00");
    });

    it("returns true local midnight when the clocks go back", () => {
      // 2026-11-01: clocks fall 02:00 -> 01:00, so the local day is 25h long.
      const start = midnightOn("2026-11-01", NY);
      expect(localDate(start, NY)).toBe("2026-11-01");
      expect(localTime(start, NY)).toBe("00:00");
    });

    it("stays stable for instants either side of the transition itself", () => {
      // Both of these are on 2026-11-01 locally, one before the 02:00 fall
      // back and one after; they must agree on where the day started.
      const beforeChange = startOfDayInTimezone(new Date("2026-11-01T05:00:00Z"), NY);
      const afterChange = startOfDayInTimezone(new Date("2026-11-01T08:00:00Z"), NY);
      expect(beforeChange.getTime()).toBe(afterChange.getTime());
      expect(localTime(beforeChange, NY)).toBe("00:00");
    });

    it("holds for every local midnight across a full year in several zones", () => {
      for (const zone of [NY, LONDON, KOLKATA, PHOENIX]) {
        for (let day = 0; day < 365; day++) {
          const noonish = new Date(Date.UTC(2026, 0, 1, 12) + day * 24 * 60 * 60 * 1000);
          const start = startOfDayInTimezone(noonish, zone);
          expect(localTime(start, zone)).toBe("00:00");
          expect(localDate(start, zone)).toBe(localDate(noonish, zone));
        }
      }
    });
  });

  it("handles a half-hour offset zone", () => {
    const start = midnightOn("2026-06-15", KOLKATA);
    expect(localDate(start, KOLKATA)).toBe("2026-06-15");
    expect(localTime(start, KOLKATA)).toBe("00:00");
  });
});

describe("addDaysInTimezone", () => {
  it("lands on local midnight of the target calendar day", () => {
    const start = midnightOn("2026-06-15", NY);
    const later = addDaysInTimezone(start, 6, NY);
    expect(localDate(later, NY)).toBe("2026-06-21");
    expect(localTime(later, NY)).toBe("00:00");
  });

  it("returns the same day for a zero-day step", () => {
    const start = midnightOn("2026-06-15", NY);
    expect(addDaysInTimezone(start, 0, NY).getTime()).toBe(start.getTime());
  });

  it("crosses month and year boundaries", () => {
    expect(localDate(addDaysInTimezone(midnightOn("2026-01-28", NY), 6, NY), NY)).toBe("2026-02-03");
    expect(localDate(addDaysInTimezone(midnightOn("2026-12-28", NY), 10, NY), NY)).toBe("2027-01-07");
  });

  // The bug this function exists for. US DST ends Sunday 2026-11-01, making
  // that local day 25 hours long. Adding a flat 86_400_000 ms to local
  // midnight of Nov 1 lands at 23:00 on Nov 1 — an hour *short* of the next
  // day — which then resolves back to Nov 1 and makes the review come due a
  // day early, silently and only twice a year.
  describe("across a DST transition", () => {
    it("does not fall short of the next day when the clocks go back", () => {
      const nov1 = midnightOn("2026-11-01", NY);
      const next = addDaysInTimezone(nov1, 1, NY);

      expect(localDate(next, NY)).toBe("2026-11-02");
      expect(localTime(next, NY)).toBe("00:00");

      // Demonstrates what a flat 86_400_000 ms step would have produced: the
      // 25-hour local day leaves it an hour short, back on 1 November.
      const naive = new Date(nov1.getTime() + 24 * 60 * 60 * 1000);
      expect(localDate(naive, NY)).toBe("2026-11-01");
      expect(localTime(naive, NY)).toBe("23:00");
    });

    it("does not overshoot when the clocks go forward", () => {
      // US DST begins Sunday 2026-03-08; that local day is only 23 hours long.
      const mar7 = midnightOn("2026-03-07", NY);
      const next = addDaysInTimezone(mar7, 1, NY);
      expect(localDate(next, NY)).toBe("2026-03-08");
      expect(localTime(next, NY)).toBe("00:00");
    });

    it("keeps multi-day intervals exact when they span a transition", () => {
      // A six-day gap — SM-2's second step — straddling the autumn change.
      const start = midnightOn("2026-10-29", NY);
      const later = addDaysInTimezone(start, 6, NY);
      expect(localDate(later, NY)).toBe("2026-11-04");
      expect(localTime(later, NY)).toBe("00:00");
    });

    it("holds for a long interval spanning both transitions", () => {
      // 180 days is the scheduler's cap; this window covers spring and autumn.
      const start = midnightOn("2026-02-20", NY);
      const later = addDaysInTimezone(start, 180, NY);
      expect(localDate(later, NY)).toBe("2026-08-19");
      expect(localTime(later, NY)).toBe("00:00");
    });

    it("holds in a southern-hemisphere-style zone with different transition dates", () => {
      // Europe/London shifts on different dates than the US, so a US-tuned
      // fix that happened to work by coincidence would fail here.
      const start = midnightOn("2026-10-24", LONDON);
      const later = addDaysInTimezone(start, 2, LONDON);
      expect(localDate(later, LONDON)).toBe("2026-10-26");
      expect(localTime(later, LONDON)).toBe("00:00");
    });

    it("is unaffected in a zone that never observes DST", () => {
      const start = midnightOn("2026-11-01", PHOENIX);
      const later = addDaysInTimezone(start, 1, PHOENIX);
      expect(localDate(later, PHOENIX)).toBe("2026-11-02");
      expect(localTime(later, PHOENIX)).toBe("00:00");
    });
  });

  it("stays on local midnight for every step across a full year", () => {
    // Catches any transition in any supported zone, not just the ones named
    // above — every one of the 365 results must be exactly local midnight.
    for (const zone of [NY, LONDON, KOLKATA, PHOENIX]) {
      let cursor = midnightOn("2026-01-01", zone);
      for (let day = 0; day < 365; day++) {
        cursor = addDaysInTimezone(cursor, 1, zone);
        expect(localTime(cursor, zone)).toBe("00:00");
      }
      expect(localDate(cursor, zone)).toBe("2027-01-01");
    }
  });
});
