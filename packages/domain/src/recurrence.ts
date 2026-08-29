import { RRule } from "rrule";

/**
 * Whether a recurring task is due on `date`, given its RRULE-ish `frequency`
 * string (e.g. "FREQ=DAILY", "FREQ=WEEKLY") anchored at `anchor` (the task's
 * dueAt, or createdAt as a fallback for tasks created without one — dueAt's
 * weekday/time is what pins WEEKLY/MONTHLY rules to a specific day).
 *
 * Tasks with no frequency (one-time tasks) are always due until completed
 * or deleted, so this returns true for them.
 */
export function isTaskDueOn(frequency: string | null | undefined, anchor: Date, date: Date): boolean {
  if (!frequency) return true;

  let rule: RRule;
  try {
    rule = new RRule({ ...RRule.parseString(frequency), dtstart: anchor });
  } catch {
    // Malformed frequency string: fail open rather than silently hide a chore.
    return true;
  }

  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  return rule.between(dayStart, dayEnd, true).length > 0;
}
