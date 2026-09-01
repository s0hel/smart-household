"use client";

import * as React from "react";
import { Button, Input, Label, PersonBadge, TASK_ICON_OPTIONS, cn, taskEmoji } from "@household/ui";
import { trpc } from "@/lib/trpc";
import { toTaskView } from "@/lib/viewModels";

const TASK_TYPES = ["CHORE", "ROUTINE", "ONE_TIME", "RECURRING"] as const;
const TASK_TYPE_LABELS: Record<(typeof TASK_TYPES)[number], string> = {
  CHORE: "Chore",
  ROUTINE: "Routine",
  ONE_TIME: "One-time",
  RECURRING: "Recurring",
};

/** Task create/delete lives behind this dialog, off the kid-facing checklist screen. */
export function TaskFormDialog({ onClose }: { onClose: () => void }) {
  const utils = trpc.useUtils();
  const tasksQuery = trpc.task.list.useQuery();
  const { data: members } = trpc.familyMember.list.useQuery();
  const createTask = trpc.task.create.useMutation({ onSuccess: () => utils.task.list.invalidate() });
  const updateTask = trpc.task.update.useMutation({ onSuccess: () => utils.task.list.invalidate() });
  const deleteTask = trpc.task.delete.useMutation({ onSuccess: () => utils.task.list.invalidate() });

  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [title, setTitle] = React.useState("");
  const [assigneeId, setAssigneeId] = React.useState("");
  const [points, setPoints] = React.useState(0);
  const [type, setType] = React.useState<(typeof TASK_TYPES)[number]>("CHORE");
  const [icon, setIcon] = React.useState<string>(TASK_ICON_OPTIONS[0] ?? "✅");

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setAssigneeId("");
    setPoints(0);
    setType("CHORE");
    setIcon(TASK_ICON_OPTIONS[0] ?? "✅");
  }

  function startEdit(task: ReturnType<typeof toTaskView>) {
    setEditingId(task.id);
    setTitle(task.title);
    setAssigneeId(task.assignee?.id ?? "");
    setPoints(task.points);
    setType(task.type);
    setIcon(task.icon || taskEmoji(task));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editingId) {
      await updateTask.mutateAsync({ id: editingId, title, type, icon, assigneeId: assigneeId || null, points });
    } else {
      await createTask.mutateAsync({ title, type, icon, assigneeId: assigneeId || null, points });
    }
    resetForm();
  }

  function onDelete(id: string) {
    if (editingId === id) resetForm();
    deleteTask.mutate({ id });
  }

  const tasks = (tasksQuery.data ?? []).map(toTaskView);

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 p-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border-t-4 border-gold-400 bg-white shadow-xl">
        <div className="flex items-center justify-between p-6 pb-4">
          <h2 className="font-display text-lg italic text-sapphire-800">Manage tasks</h2>
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Done
          </Button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 pb-6">
          <form onSubmit={onSubmit} className="space-y-3 rounded-xl border border-ink-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">
              {editingId ? "Edit task" : "New task"}
            </p>
            <div>
              <Label htmlFor="task-title">Title</Label>
              <Input id="task-title" required value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <Label>Icon</Label>
              <div className="flex flex-wrap gap-1.5 rounded-lg border border-ink-200 p-2">
                {TASK_ICON_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setIcon(option)}
                    aria-pressed={icon === option}
                    aria-label={`Use icon ${option}`}
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-lg text-lg transition",
                      icon === option ? "bg-sapphire-600 ring-2 ring-sapphire-300" : "hover:bg-ink-100",
                    )}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="task-type">Type</Label>
                <select
                  id="task-type"
                  className="h-10 w-full rounded-lg border border-ink-300 px-2 text-sm"
                  value={type}
                  onChange={(e) => setType(e.target.value as (typeof TASK_TYPES)[number])}
                >
                  {TASK_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {TASK_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="task-points">Points</Label>
                <Input
                  id="task-points"
                  type="number"
                  min={0}
                  value={points}
                  onChange={(e) => setPoints(Number(e.target.value))}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="task-assignee">Assignee</Label>
              <select
                id="task-assignee"
                className="h-10 w-full rounded-lg border border-ink-300 px-2 text-sm"
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
            <div className="flex gap-2">
              {editingId && (
                <Button type="button" variant="secondary" size="sm" onClick={resetForm} className="w-full">
                  Cancel
                </Button>
              )}
              <Button type="submit" size="sm" className="w-full">
                {editingId ? "Save changes" : "Add task"}
              </Button>
            </div>
          </form>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">Existing tasks</p>
            <div className="space-y-1">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => startEdit(task)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") startEdit(task);
                  }}
                  className={cn(
                    "flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-ink-50",
                    editingId === task.id && "bg-sapphire-50",
                  )}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="text-base">{task.icon || taskEmoji(task)}</span>
                    <span className="truncate text-sm text-ink-900">{task.title}</span>
                    {task.assignee && <PersonBadge person={task.assignee} size="sm" showName={false} />}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(task.id);
                    }}
                    className="shrink-0 rounded-lg bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700"
                  >
                    Delete
                  </button>
                </div>
              ))}
              {tasks.length === 0 && <p className="text-sm text-ink-400">No tasks yet.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
