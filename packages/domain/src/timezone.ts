/**
 * Midnight of `date`'s calendar day *as observed in `timeZone`*, returned as
 * the corresponding real UTC instant. Plain `date.setHours(0,0,0,0)` resolves
 * midnight in whatever timezone the Node process happens to run in, which
 * silently diverges from the household's actual local day once the server
 * isn't co-located with the household (e.g. deployed to a UTC host) — a task
 * completed in the evening can land on the wrong `occurrenceDate` and appear
 * pre-completed the next day.
 */
export function startOfDayInTimezone(date: Date, timeZone: string): Date {
  // Truncate to whole seconds first: `asUTC` below is second-precision (Intl
  // doesn't report fractional seconds), so leaving `date`'s own milliseconds
  // in would leak back out of the offset arithmetic and produce a different,
  // non-midnight instant on every call instead of a stable value for the
  // calendar day.
  const seconds = Math.floor(date.getTime() / 1000) * 1000;

  // Step 1: which local calendar day is `date` on? Read the wall clock in
  // `timeZone` and truncate it to midnight, still expressed as if it were UTC.
  const shifted = new Date(seconds + timezoneOffsetMs(seconds, timeZone));
  shifted.setUTCHours(0, 0, 0, 0);
  const localMidnightAsUTC = shifted.getTime();

  // Step 2: convert that wall-clock midnight back to a real instant.
  //
  // This must use the offset in effect *at midnight*, which is not always the
  // offset in effect at `date`. On a DST transition day the two differ by an
  // hour, and reusing the offset from `date` (as this function originally did)
  // returns an instant an hour off — which on a spring-forward day resolves to
  // 23:00 on the *previous* calendar day. Everything keyed on this value
  // (chore occurrenceDate, "due today", review scheduling) then silently
  // shifts by a day, twice a year. Resolving the offset at the candidate
  // instant and refining once converges for every real zone.
  const firstPass = localMidnightAsUTC - timezoneOffsetMs(localMidnightAsUTC, timeZone);
  return new Date(localMidnightAsUTC - timezoneOffsetMs(firstPass, timeZone));
}

/** "4:00 PM" as a wall clock in `timeZone` would read it — for display text
 * (prompts, narration), never for anything that gets stored or compared. */
export function formatTimeInTimezone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

/** "Wednesday, September 2" as the calendar date reads in `timeZone`. */
export function formatDateInTimezone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
}

function timezoneOffsetMs(epochMs: number, timeZone: string): number {
  const date = new Date(epochMs);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts: Record<string, string> = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== "literal") parts[part.type] = part.value;
  }
  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asUTC - epochMs;
}

/**
 * The local midnight `days` calendar days after `dayStart`, in `timeZone`.
 *
 * Not `dayStart + days * 86_400_000`: across a DST boundary that lands an
 * hour either side of midnight, and an hour early snaps back to the *previous*
 * calendar day — a review scheduled for "6 days from now" would quietly come
 * due on day 5. Stepping to midday of the target day first puts the instant
 * safely inside it whichever way the clocks moved, and re-resolving midnight
 * from there gives the real local start of that day.
 */
export function addDaysInTimezone(dayStart: Date, days: number, timeZone: string): Date {
  const midday = new Date(dayStart.getTime() + days * 24 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000);
  return startOfDayInTimezone(midday, timeZone);
}
