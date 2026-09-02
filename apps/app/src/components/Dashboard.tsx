"use client";

import { addDays, differenceInMinutes, endOfDay, format, isToday, isTomorrow, startOfDay } from "date-fns";
import Link from "next/link";
import { Card, cn, EventCard, PersonBadge, TaskCard, shadeColor, type EventView } from "@household/ui";
import { trpc } from "@/lib/trpc";
import { toEventView, toTaskView } from "@/lib/viewModels";

const MEAL_TYPES = ["BREAKFAST", "LUNCH", "DINNER", "SNACK"] as const;
const MEAL_LABELS: Record<(typeof MEAL_TYPES)[number], string> = {
  BREAKFAST: "Breakfast",
  LUNCH: "Lunch",
  DINNER: "Dinner",
  SNACK: "Snack",
};

function formatEventTimeRange(event: EventView) {
  if (event.allDay) return "All day";
  return `${format(event.startAt, "h:mm a")} – ${format(event.endAt, "h:mm a")}`;
}

/** What to show in the "up next" hero: a live countdown while today's event
 * is still ahead, "Happening now" while inside it, and a day label once the
 * next thing on the calendar has rolled past tomorrow. */
function describeNextEvent(event: EventView, now: Date): { eyebrow: string; big: string; small: string } {
  if (event.startAt <= now && now < event.endAt) {
    return { eyebrow: "Happening now", big: "Now", small: "In progress" };
  }
  if (isToday(event.startAt)) {
    const minutes = Math.max(1, differenceInMinutes(event.startAt, now));
    if (minutes < 60) {
      return { eyebrow: "Up next", big: String(minutes), small: minutes === 1 ? "minute away" : "minutes away" };
    }
    const hours = Math.round(minutes / 60);
    return { eyebrow: "Up next", big: String(hours), small: hours === 1 ? "hour away" : "hours away" };
  }
  if (isTomorrow(event.startAt)) {
    return { eyebrow: "Up next, tomorrow", big: "Tomorrow", small: format(event.startAt, "h:mm a") };
  }
  return { eyebrow: "Up next", big: format(event.startAt, "EEE"), small: format(event.startAt, "MMM d, h:mm a") };
}

export function Dashboard({ variant = "web" }: { variant?: "web" | "mobile" | "kiosk" }) {
  // `household.me` resolves the *active profile* (post PIN-switch), not
  // necessarily the originally authenticated account — greeting the wrong
  // person on a shared kiosk/mobile session would defeat the point of
  // profile switching.
  const meQuery = trpc.household.me.useQuery();
  const eventsQuery = trpc.event.list.useQuery();
  const tasksQuery = trpc.task.list.useQuery();
  const { data: members } = trpc.familyMember.list.useQuery();
  const today = new Date();
  const mealPlanQuery = trpc.mealPlan.list.useQuery({ from: startOfDay(today), to: endOfDay(today) });
  const utils = trpc.useUtils();
  const setCompletion = trpc.task.setCompletion.useMutation({
    onSuccess: () => utils.task.list.invalidate(),
  });

  const events = (eventsQuery.data ?? []).map(toEventView);
  const tasks = (tasksQuery.data ?? []).map(toTaskView).filter((task) => task.dueToday);
  const meals = mealPlanQuery.data ?? [];

  const todayEvents = events.filter((e) => isToday(e.startAt));
  const tomorrowEvents = events.filter((e) => isTomorrow(e.startAt));

  const tasksByAssignee = new Map<string, typeof tasks>();
  const unassignedTasks: typeof tasks = [];
  for (const task of tasks) {
    if (task.assignee) {
      const list = tasksByAssignee.get(task.assignee.id) ?? [];
      list.push(task);
      tasksByAssignee.set(task.assignee.id, list);
    } else {
      unassignedTasks.push(task);
    }
  }
  const taskGroups = (members ?? [])
    .filter((m) => tasksByAssignee.has(m.id))
    .map((person) => ({ person, tasks: tasksByAssignee.get(person.id)! }));

  const isKiosk = variant === "kiosk";
  const mealPlanHref = variant === "mobile" ? "/m/meal-plan" : "/meal-plan";

  if (variant === "web") {
    const now = new Date();
    const heroEvent = events.filter((e) => e.endAt > now).sort((a, b) => a.startAt.getTime() - b.startAt.getTime())[0];
    const heroInfo = heroEvent ? describeNextEvent(heroEvent, now) : null;

    const weekAheadStart = addDays(startOfDay(today), 2);
    const weekAheadEnd = endOfDay(addDays(startOfDay(today), 6));
    const weekAheadByDay = new Map<string, typeof events>();
    for (const event of events) {
      if (event.startAt < weekAheadStart || event.startAt > weekAheadEnd) continue;
      const key = format(event.startAt, "yyyy-MM-dd");
      const list = weekAheadByDay.get(key) ?? [];
      list.push(event);
      weekAheadByDay.set(key, list);
    }
    const weekAheadDays = Array.from(weekAheadByDay.values())
      .map((dayEvents) => ({ date: dayEvents[0]!.startAt, events: dayEvents }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    return (
      <div className="space-y-6">
        <header>
          <h1 className="font-display text-2xl italic text-sapphire-800">{format(now, "EEEE, MMMM d")}</h1>
          {meQuery.data && <p className="text-sm text-ink-500">Hi {meQuery.data.name.split(" ")[0]}</p>}
        </header>

        {heroEvent && heroInfo && (
          <div className="flex flex-wrap items-center justify-between gap-6 rounded-2xl bg-gradient-to-br from-sapphire-700 to-sapphire-900 p-6 text-white shadow-sm">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wide text-gold-300">{heroInfo.eyebrow}</p>
              <h2 className="mt-1 truncate font-display text-2xl italic">{heroEvent.title}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-sapphire-100">
                <span>{formatEventTimeRange(heroEvent)}</span>
                {heroEvent.assignees.length > 0 && (
                  <span className="flex items-center gap-1.5">
                    {heroEvent.assignees.map((a) => (
                      <span
                        key={a.id}
                        className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold"
                        style={{ backgroundColor: a.colorHex }}
                      >
                        {a.name.charAt(0).toUpperCase()}
                      </span>
                    ))}
                    {heroEvent.assignees.map((a) => a.name).join(", ")}
                  </span>
                )}
                {heroEvent.location && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(heroEvent.location)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline-offset-2 hover:underline"
                  >
                    📍 {heroEvent.location}
                  </a>
                )}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-4xl font-extrabold tabular-nums">{heroInfo.big}</p>
              <p className="text-xs font-semibold uppercase tracking-wide text-sapphire-200">{heroInfo.small}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-400">Agenda</h2>
            <div className="space-y-2">
              {todayEvents.length === 0 && <p className="text-sm text-ink-400">Nothing scheduled today.</p>}
              {todayEvents.map((event) => (
                <EventCard key={event.id} event={event} compact />
              ))}
            </div>
            {tomorrowEvents.length > 0 && (
              <>
                <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-ink-400">Tomorrow</p>
                <div className="space-y-2">
                  {tomorrowEvents.map((event) => (
                    <EventCard key={event.id} event={event} compact />
                  ))}
                </div>
              </>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-400">To Do</h2>
            <div className="space-y-4">
              {tasks.length === 0 && <p className="text-sm text-ink-400">No open tasks or chores.</p>}
              {taskGroups.map(({ person, tasks: personTasks }) => (
                <div key={person.id}>
                  <div className="mb-1.5 flex items-center gap-2">
                    <PersonBadge person={person} size="sm" showName={false} />
                    <span className="text-xs font-semibold" style={{ color: shadeColor(person.colorHex) }}>
                      {person.name}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {personTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        showAssignee={false}
                        canComplete={meQuery.data?.role !== "CHILD" || task.assignee?.id === meQuery.data?.id}
                        onToggleComplete={(completed) => setCompletion.mutate({ taskId: task.id, completed })}
                      />
                    ))}
                  </div>
                </div>
              ))}
              {unassignedTasks.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-semibold text-ink-400">Unassigned</p>
                  <div className="space-y-2">
                    {unassignedTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        showAssignee={false}
                        canComplete={meQuery.data?.role !== "CHILD"}
                        onToggleComplete={(completed) => setCompletion.mutate({ taskId: task.id, completed })}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>

          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-400">Meals &amp; Ahead</h2>
              <Link href={mealPlanHref} className="text-xs font-medium text-sapphire-600 hover:underline">
                Plan meals →
              </Link>
            </div>
            <div className="space-y-2">
              {meals.length === 0 && <p className="text-sm text-ink-400">No meals planned today.</p>}
              {MEAL_TYPES.filter((mealType) => meals.some((m) => m.mealType === mealType)).map((mealType) => (
                <div key={mealType} className="rounded-xl border border-ink-200 bg-paper p-3">
                  <p className="mb-1 text-xs font-semibold uppercase text-ink-400">{MEAL_LABELS[mealType]}</p>
                  <div className="space-y-1">
                    {meals
                      .filter((m) => m.mealType === mealType)
                      .map((entry) => (
                        <div key={entry.id} className="text-sm text-sapphire-900">
                          {entry.assignee && (
                            <span
                              className="mr-1.5 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white"
                              style={{ backgroundColor: entry.assignee.colorHex }}
                            >
                              {entry.assignee.name}
                            </span>
                          )}
                          {entry.recipe?.name ?? entry.customTitle}
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
            {weekAheadDays.length > 0 && (
              <>
                <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-ink-400">This week</p>
                <div className="space-y-1.5">
                  {weekAheadDays.map((day) => {
                    const titles = day.events.map((e) => e.title);
                    const shown = titles.slice(0, 2).join(", ");
                    const extra = titles.length > 2 ? ` +${titles.length - 2} more` : "";
                    return (
                      <div key={day.date.toISOString()} className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="shrink-0 font-semibold text-sapphire-700">{format(day.date, "EEE")}</span>
                        <span className="truncate text-ink-600">
                          {shown}
                          {extra}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className={isKiosk ? "mx-auto max-w-5xl space-y-8 p-4" : "space-y-8"}>
      <header>
        <h1 className={cn("font-display italic text-sapphire-800", isKiosk ? "text-4xl" : "text-2xl")}>
          {format(new Date(), "EEEE, MMMM d")}
        </h1>
        {meQuery.data && <p className="text-sm text-ink-500">Hi {meQuery.data.name.split(" ")[0]}</p>}
      </header>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-400">Today</h2>
        <div className="space-y-2">
          {todayEvents.length === 0 && <p className="text-sm text-ink-400">Nothing scheduled today.</p>}
          {todayEvents.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-400">To Do</h2>
        <div className="space-y-4">
          {tasks.length === 0 && <p className="text-sm text-ink-400">No open tasks or chores.</p>}
          {taskGroups.map(({ person, tasks: personTasks }) => (
            <div key={person.id}>
              <div className="mb-1.5 flex items-center gap-2">
                <PersonBadge person={person} size="sm" showName={false} />
                <span className="text-xs font-semibold" style={{ color: shadeColor(person.colorHex) }}>
                  {person.name}
                </span>
              </div>
              <div className="space-y-2">
                {personTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    showAssignee={false}
                    canComplete={meQuery.data?.role !== "CHILD" || task.assignee?.id === meQuery.data?.id}
                    onToggleComplete={(completed) => setCompletion.mutate({ taskId: task.id, completed })}
                  />
                ))}
              </div>
            </div>
          ))}
          {unassignedTasks.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold text-ink-400">Unassigned</p>
              <div className="space-y-2">
                {unassignedTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    showAssignee={false}
                    canComplete={meQuery.data?.role !== "CHILD"}
                    onToggleComplete={(completed) => setCompletion.mutate({ taskId: task.id, completed })}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-400">Meals Today</h2>
          {!isKiosk && (
            <Link href={mealPlanHref} className="text-xs font-medium text-sapphire-600 hover:underline">
              Plan meals →
            </Link>
          )}
        </div>
        <div className="space-y-2">
          {meals.length === 0 && <p className="text-sm text-ink-400">No meals planned today.</p>}
          {MEAL_TYPES.filter((mealType) => meals.some((m) => m.mealType === mealType)).map((mealType) => (
            <div key={mealType} className="rounded-xl border border-ink-200 bg-surface p-3">
              <p className="mb-1 text-xs font-semibold uppercase text-ink-400">{MEAL_LABELS[mealType]}</p>
              <div className="space-y-1">
                {meals
                  .filter((m) => m.mealType === mealType)
                  .map((entry) => (
                    <div key={entry.id} className="text-sm text-sapphire-900">
                      {entry.assignee && (
                        <span
                          className="mr-1.5 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white"
                          style={{ backgroundColor: entry.assignee.colorHex }}
                        >
                          {entry.assignee.name}
                        </span>
                      )}
                      {entry.recipe?.name ?? entry.customTitle}
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-400">Tomorrow</h2>
        <div className="space-y-2">
          {tomorrowEvents.length === 0 && <p className="text-sm text-ink-400">Nothing scheduled tomorrow.</p>}
          {tomorrowEvents.map((event) => (
            <EventCard key={event.id} event={event} compact />
          ))}
        </div>
      </section>
    </div>
  );
}
