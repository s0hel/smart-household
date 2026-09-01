"use client";

import { endOfDay, format, isToday, isTomorrow, startOfDay } from "date-fns";
import Link from "next/link";
import { cn, EventCard, PersonBadge, TaskCard, shadeColor } from "@household/ui";
import { trpc } from "@/lib/trpc";
import { toEventView, toTaskView } from "@/lib/viewModels";

const MEAL_TYPES = ["BREAKFAST", "LUNCH", "DINNER", "SNACK"] as const;
const MEAL_LABELS: Record<(typeof MEAL_TYPES)[number], string> = {
  BREAKFAST: "Breakfast",
  LUNCH: "Lunch",
  DINNER: "Dinner",
  SNACK: "Snack",
};

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
