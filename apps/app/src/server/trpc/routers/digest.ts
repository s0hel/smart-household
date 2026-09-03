import { generateMorningDigest, type MorningDigestResult } from "@household/ai";
import { isTaskDueOn, startOfDayInTimezone } from "@household/domain";
import { router, householdProcedure } from "../trpc";

interface CacheEntry {
  result: MorningDigestResult;
  expiresAt: number;
}

// Ollama/Claude/GPT calls take seconds and cost tokens once a paid provider
// is wired up — regenerating on every dashboard poll/kiosk refresh would be
// wasteful for text that's only meaningful to refresh a few times a day.
// A process-local cache is a fine stand-in until durable caching (Redis,
// per the technical design) lands alongside the rest of the AI pipeline.
const CACHE_TTL_MS = 30 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

export const digestRouter = router({
  morning: householdProcedure.query(async ({ ctx }) => {
    const today = new Date();
    const cacheKey = `${ctx.householdId}:${today.toDateString()}`;
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.result;
    }

    const from = startOfDayInTimezone(today, ctx.timezone);
    const to = new Date(from.getTime() + 24 * 60 * 60 * 1000 - 1);

    const [events, tasks, meals] = await Promise.all([
      ctx.prisma.event.findMany({
        where: { householdId: ctx.householdId, startAt: { gte: from, lte: to } },
        include: { assignees: { include: { user: true } } },
        orderBy: { startAt: "asc" },
      }),
      ctx.prisma.task.findMany({
        where: { householdId: ctx.householdId, active: true },
        include: { assignee: true, completions: { where: { occurrenceDate: from } } },
      }),
      ctx.prisma.mealPlanEntry.findMany({
        where: { householdId: ctx.householdId, date: { gte: from, lte: to } },
        include: { recipe: true },
      }),
    ]);

    // Same "due today" rule the dashboard/task list use: a task with no
    // frequency is always due, a recurring one is due only on days its
    // RRULE resolves to — a raw dueAt range filter would miss/misfire on
    // recurring chores anchored in the past.
    const tasksDueToday = tasks.filter(
      (t) => t.completions.length === 0 && isTaskDueOn(t.frequency, t.dueAt ?? t.createdAt, today, ctx.timezone),
    );

    const result = await generateMorningDigest({
      today,
      events: events.map((e) => ({
        title: e.title,
        startAt: e.startAt,
        endAt: e.endAt,
        allDay: e.allDay,
        location: e.location,
        assigneeNames: e.assignees.map((a) => a.user.name),
      })),
      tasks: tasksDueToday.map((t) => ({ title: t.title, assigneeName: t.assignee?.name })),
      meals: meals.map((m) => ({ mealType: m.mealType, title: m.recipe?.name ?? m.customTitle ?? "Meal" })),
    });

    cache.set(cacheKey, { result, expiresAt: Date.now() + CACHE_TTL_MS });
    return result;
  }),
});
