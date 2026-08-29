"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { Button, Input, Label, TaskCard } from "@household/ui";
import { can, type Role } from "@household/domain";
import { trpc } from "@/lib/trpc";
import { toTaskView } from "@/lib/viewModels";

export function TasksPage() {
  const { data: session } = useSession();
  const utils = trpc.useUtils();
  const tasksQuery = trpc.task.list.useQuery();
  const { data: members } = trpc.familyMember.list.useQuery();
  const createTask = trpc.task.create.useMutation({ onSuccess: () => utils.task.list.invalidate() });
  const deleteTask = trpc.task.delete.useMutation({ onSuccess: () => utils.task.list.invalidate() });
  const setCompletion = trpc.task.setCompletion.useMutation({ onSuccess: () => utils.task.list.invalidate() });

  const [title, setTitle] = React.useState("");
  const [assigneeId, setAssigneeId] = React.useState("");
  const [points, setPoints] = React.useState(0);
  const [type, setType] = React.useState<"ONE_TIME" | "RECURRING" | "CHORE" | "ROUTINE">("CHORE");

  const activeRole = (members?.find((m) => m.id === session?.user.activeProfileId)?.role ?? "READONLY") as Role;
  const canManage = can(activeRole, "task", "create");

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    await createTask.mutateAsync({ title, type, assigneeId: assigneeId || null, points });
    setTitle("");
    setPoints(0);
  }

  const tasks = (tasksQuery.data ?? []).map(toTaskView);

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Tasks & Chores</h1>

      {canManage && (
        <form onSubmit={onCreate} className="flex flex-wrap items-end gap-3 rounded-2xl border border-gray-200 bg-white p-4">
          <div className="flex-1">
            <Label htmlFor="task-title">Title</Label>
            <Input id="task-title" required value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="task-type">Type</Label>
            <select
              id="task-type"
              className="h-10 rounded-lg border border-gray-300 px-2 text-sm"
              value={type}
              onChange={(e) => setType(e.target.value as typeof type)}
            >
              <option value="CHORE">Chore</option>
              <option value="ROUTINE">Routine</option>
              <option value="ONE_TIME">One-time</option>
              <option value="RECURRING">Recurring</option>
            </select>
          </div>
          <div>
            <Label htmlFor="task-assignee">Assignee</Label>
            <select
              id="task-assignee"
              className="h-10 rounded-lg border border-gray-300 px-2 text-sm"
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
            >
              <option value="">Unassigned</option>
              {(members ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div className="w-24">
            <Label htmlFor="task-points">Points</Label>
            <Input
              id="task-points"
              type="number"
              min={0}
              value={points}
              onChange={(e) => setPoints(Number(e.target.value))}
            />
          </div>
          <Button type="submit">Add</Button>
        </form>
      )}

      <div className="space-y-2">
        {tasks.map((task) => (
          <div key={task.id} className="group relative">
            <TaskCard
              task={task}
              canComplete={activeRole !== "CHILD" || task.assignee?.id === session?.user.activeProfileId}
              onToggleComplete={(completed) => setCompletion.mutate({ taskId: task.id, completed })}
            />
            {canManage && (
              <button
                onClick={() => deleteTask.mutate({ id: task.id })}
                className="absolute right-2 top-1/2 hidden -translate-y-1/2 text-xs text-red-500 group-hover:block"
              >
                Remove
              </button>
            )}
          </div>
        ))}
        {tasks.length === 0 && <p className="text-sm text-gray-400">No tasks yet.</p>}
      </div>
    </div>
  );
}
