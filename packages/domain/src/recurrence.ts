import { RRule } from "rrule";
import { startOfDayInTimezone } from "./timezone";

/**
 * Whether a recurring task is due on `date`, given its RRULE-ish `frequency`
 * string (e.g. "FREQ=DAILY", "FREQ=WEEKLY") anchored at `anchor` (the task's
 * dueAt, or createdAt as a fallback for tasks created without one — dueAt's
 * weekday/time is what pins WEEKLY/MONTHLY rules to a specific day).
 *
 * Tasks with no frequency (one-time tasks) are always due until completed
 * or deleted, so this returns true for them.
 *
 * `date`'s calendar day is resolved in `timeZone` (the household's), not the
 * server process's local timezone — otherwise a server not co-located with
 * the household drifts the day boundary away from the household's actual
 * midnight.
 */
export function isTaskDueOn(
  frequency: string | null | undefined,
  anchor: Date,
  date: Date,
  timeZone: string,
): boolean {
  if (!frequency) return true;

  let rule: RRule;
  try {
    rule = new RRule({ ...RRule.parseString(frequency), dtstart: anchor });
  } catch {
    // Malformed frequency string: fail open rather than silently hide a chore.
    return true;
  }

  const dayStart = startOfDayInTimezone(date, timeZone);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000 - 1);

  return rule.between(dayStart, dayEnd, true).length > 0;
}
