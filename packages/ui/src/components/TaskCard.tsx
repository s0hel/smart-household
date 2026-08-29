import * as React from "react";
import { cn } from "../cn";
import type { TaskView } from "../types";
import { PersonBadge } from "./PersonBadge";
import { Checkbox } from "./Checkbox";

export function TaskCard({
  task,
  onToggleComplete,
  canComplete = true,
  className,
}: {
  task: TaskView;
  onToggleComplete?: (checked: boolean) => void;
  canComplete?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3 rounded-xl border border-ink-200 bg-white p-3", className)}>
      <Checkbox
        checked={task.completedToday}
        disabled={!canComplete}
        onChange={(e) => onToggleComplete?.(e.target.checked)}
      />
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-sm font-medium text-ink-900", task.completedToday && "text-ink-400 line-through")}>
          {task.title}
        </p>
        {task.dueAt && (
          <p className="text-xs text-ink-500">
            Due {task.dueAt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
          </p>
        )}
      </div>
      {task.points > 0 && (
        <span className="whitespace-nowrap text-xs font-semibold text-gold-600">{task.points} ⭐</span>
      )}
      {task.assignee && <PersonBadge person={task.assignee} size="sm" showName={false} />}
    </div>
  );
}
