"use client";

import { format, isToday, isTomorrow } from "date-fns";
import { EventCard, TaskCard } from "@household/ui";
import { trpc } from "@/lib/trpc";
import { toEventView, toTaskView } from "@/lib/viewModels";

export function Dashboard({ variant = "web" }: { variant?: "web" | "mobile" | "kiosk" }) {
  // `household.me` resolves the *active profile* (post PIN-switch), not
  // necessarily the originally authenticated account — greeting the wrong
  // person on a shared kiosk/mobile session would defeat the point of
  // profile switching.
  const meQuery = trpc.household.me.useQuery();
  const eventsQuery = trpc.event.list.useQuery();
  const tasksQuery = trpc.task.list.useQuery();
  const utils = trpc.useUtils();
  const setCompletion = trpc.task.setCompletion.useMutation({
    onSuccess: () => utils.task.list.invalidate(),
  });

  const events = (eventsQuery.data ?? []).map(toEventView);
  const tasks = (tasksQuery.data ?? []).map(toTaskView).filter((task) => task.dueToday);

  const todayEvents = events.filter((e) => isToday(e.startAt));
  const tomorrowEvents = events.filter((e) => isTomorrow(e.startAt));

  const isKiosk = variant === "kiosk";

  return (
    <div className={isKiosk ? "mx-auto max-w-5xl space-y-8 p-4" : "space-y-8"}>
      <header>
        <h1 className={isKiosk ? "text-4xl font-bold text-gray-900" : "text-2xl font-bold text-gray-900"}>
          {format(new Date(), "EEEE, MMMM d")}
        </h1>
        {meQuery.data && <p className="text-sm text-gray-500">Hi {meQuery.data.name.split(" ")[0]} 👋</p>}
      </header>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-400">Today</h2>
        <div className="space-y-2">
          {todayEvents.length === 0 && <p className="text-sm text-gray-400">Nothing scheduled today.</p>}
          {todayEvents.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-400">To Do</h2>
        <div className="space-y-2">
          {tasks.length === 0 && <p className="text-sm text-gray-400">No open tasks or chores.</p>}
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              canComplete={meQuery.data?.role !== "CHILD" || task.assignee?.id === meQuery.data?.id}
              onToggleComplete={(completed) => setCompletion.mutate({ taskId: task.id, completed })}
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-400">Tomorrow</h2>
        <div className="space-y-2">
          {tomorrowEvents.length === 0 && <p className="text-sm text-gray-400">Nothing scheduled tomorrow.</p>}
          {tomorrowEvents.map((event) => (
            <EventCard key={event.id} event={event} compact />
          ))}
        </div>
      </section>
    </div>
  );
}
