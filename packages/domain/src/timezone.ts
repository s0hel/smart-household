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
  // in would leak back out of the offset subtraction below and produce a
  // different, non-midnight instant on every call instead of a stable value
  // for the calendar day.
  const seconds = Math.floor(date.getTime() / 1000) * 1000;
  const offsetMs = timezoneOffsetMs(seconds, timeZone);
  const shifted = new Date(seconds + offsetMs);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - offsetMs);
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
