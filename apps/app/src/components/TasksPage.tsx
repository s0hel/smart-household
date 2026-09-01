"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { Button, Card, CardContent, CardHeader, CardTitle, PersonBadge, TaskCard, cn, shadeColor, tintColor } from "@household/ui";
import { can, type Role } from "@household/domain";
import { trpc } from "@/lib/trpc";
import { toTaskView } from "@/lib/viewModels";
import { TaskFormDialog } from "./TaskFormDialog";

export function TasksPage({ variant = "web" }: { variant?: "web" | "mobile" } = {}) {
  const { data: session } = useSession();
  const utils = trpc.useUtils();
  const tasksQuery = trpc.task.list.useQuery();
  const { data: members } = trpc.familyMember.list.useQuery();
  const setCompletion = trpc.task.setCompletion.useMutation({ onSuccess: () => utils.task.list.invalidate() });

  const [manageOpen, setManageOpen] = React.useState(false);

  const activeRole = (members?.find((m) => m.id === session?.user.activeProfileId)?.role ?? "READONLY") as Role;
  const canManage = can(activeRole, "task", "create");

  const tasks = (tasksQuery.data ?? []).map(toTaskView);

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
  const groups = (members ?? [])
    .filter((m) => tasksByAssignee.has(m.id))
    .map((person) => ({ person, tasks: tasksByAssignee.get(person.id)! }));

  return (
    <div className={cn("space-y-6", variant === "mobile" ? "max-w-2xl" : "max-w-5xl")}>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl italic text-sapphire-800">Tasks &amp; Chores</h1>
        {canManage && variant !== "mobile" && (
          <Button size="sm" onClick={() => setManageOpen(true)}>
            + Manage tasks
          </Button>
        )}
      </div>

      <div
        className={cn(
          "gap-4",
          variant === "mobile" ? "flex flex-col" : "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3",
        )}
      >
        {groups.map(({ person, tasks: personTasks }) => {
          const completedCount = personTasks.filter((t) => t.completedToday).length;
          const totalPoints = personTasks.reduce((sum, t) => sum + t.points, 0);
          return (
            <Card key={person.id} style={{ borderColor: tintColor(person.colorHex, 0.6) }}>
              <CardHeader className="items-center justify-start gap-3 pb-3">
                <PersonBadge person={person} size="md" showName={false} />
                <div>
                  <p className="font-display text-lg italic" style={{ color: shadeColor(person.colorHex) }}>
                    {person.name}
                  </p>
                  <p className="text-xs text-ink-500">
                    ✓ {completedCount}/{personTasks.length}
                    {totalPoints > 0 && <> &middot; {totalPoints} ⭐</>}
                  </p>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 pt-1">
                {personTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    showAssignee={false}
                    canComplete={activeRole !== "CHILD" || task.assignee?.id === session?.user.activeProfileId}
                    onToggleComplete={(completed) => setCompletion.mutate({ taskId: task.id, completed })}
                  />
                ))}
              </CardContent>
            </Card>
          );
        })}

        {unassignedTasks.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Unassigned</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-1">
              {unassignedTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  showAssignee={false}
                  canComplete={activeRole !== "CHILD"}
                  onToggleComplete={(completed) => setCompletion.mutate({ taskId: task.id, completed })}
                />
              ))}
            </CardContent>
          </Card>
        )}

        {tasks.length === 0 && <p className="text-sm text-ink-400">No tasks yet.</p>}
      </div>

      {canManage && variant === "mobile" && (
        <div className="fixed inset-x-0 bottom-24 z-10 mx-auto flex max-w-md justify-end px-4">
          <button
            type="button"
            onClick={() => setManageOpen(true)}
            aria-label="Manage tasks"
            className="flex h-14 w-14 items-center justify-center rounded-full bg-sapphire-600 text-2xl leading-none text-white shadow-lg transition active:scale-95"
          >
            +
          </button>
        </div>
      )}

      {manageOpen && canManage && <TaskFormDialog onClose={() => setManageOpen(false)} />}
    </div>
  );
}
