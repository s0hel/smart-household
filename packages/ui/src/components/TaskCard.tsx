import * as React from "react";
import { cn } from "../cn";
import { shadeColor, tintColor } from "../colorUtils";
import { taskEmoji } from "../taskEmoji";
import type { TaskView } from "../types";
import { PersonBadge } from "./PersonBadge";

const BURST_EMOJI = ["⭐", "🎉", "✨", "💫", "🌟"];
const BURST_PARTICLE_COUNT = 14;
const BURST_DURATION_MS = 700;

function makeBurstParticles() {
  return Array.from({ length: BURST_PARTICLE_COUNT }, (_, i) => {
    const angle = (i / BURST_PARTICLE_COUNT) * 360 + Math.random() * 20;
    const distance = 40 + Math.random() * 50;
    const radians = (angle * Math.PI) / 180;
    return {
      emoji: BURST_EMOJI[i % BURST_EMOJI.length],
      x: Math.cos(radians) * distance,
      y: Math.sin(radians) * distance,
      delay: Math.random() * 80,
    };
  });
}

/**
 * A big, whole-row tap target so kids can mark a chore done without hunting
 * for a tiny checkbox. Completing a task swaps the pastel background for a
 * solid fill of the assignee's color as a satisfying "done" signal.
 */
export function TaskCard({
  task,
  onToggleComplete,
  canComplete = true,
  showAssignee = true,
  className,
}: {
  task: TaskView;
  onToggleComplete?: (checked: boolean) => void;
  canComplete?: boolean;
  showAssignee?: boolean;
  className?: string;
}) {
  const completed = task.completedToday;
  const accent = task.assignee?.colorHex ?? "#7C859A";

  const [burstParticles, setBurstParticles] = React.useState<ReturnType<typeof makeBurstParticles> | null>(null);
  const burstTimeout = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  React.useEffect(() => () => clearTimeout(burstTimeout.current), []);

  function handleClick() {
    if (!completed) {
      setBurstParticles(makeBurstParticles());
      clearTimeout(burstTimeout.current);
      burstTimeout.current = setTimeout(() => setBurstParticles(null), BURST_DURATION_MS + 150);
    }
    onToggleComplete?.(!completed);
  }

  return (
    <button
      type="button"
      disabled={!canComplete}
      aria-pressed={completed}
      onClick={handleClick}
      className={cn(
        "relative flex w-full items-center gap-3 overflow-visible rounded-2xl p-3 text-left shadow-sm transition",
        canComplete ? "cursor-pointer active:scale-[0.98]" : "cursor-not-allowed opacity-70",
        className,
      )}
      style={{ backgroundColor: completed ? accent : tintColor(accent, 0.88) }}
    >
      {burstParticles && (
        <span className="pointer-events-none absolute inset-0 z-10 overflow-visible">
          {burstParticles.map((p, i) => (
            <span
              key={i}
              className="absolute left-1/2 top-1/2 animate-task-burst text-lg"
              style={
                {
                  "--burst-x": `${p.x}px`,
                  "--burst-y": `${p.y}px`,
                  animationDelay: `${p.delay}ms`,
                } as React.CSSProperties
              }
            >
              {p.emoji}
            </span>
          ))}
        </span>
      )}

      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface text-xl">
        {task.icon || taskEmoji(task)}
      </span>

      <span className="min-w-0 flex-1">
        <span
          className="block truncate text-sm font-semibold"
          style={{ color: completed ? "#FFFFFF" : shadeColor(accent) }}
        >
          {task.title}
        </span>
        {(task.dueAt || task.points > 0) && (
          <span
            className={cn("flex items-center gap-2 text-xs", completed && "text-white/85")}
            style={completed ? undefined : { color: shadeColor(accent, 0.2) }}
          >
            {task.dueAt && (
              <span>Due {task.dueAt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</span>
            )}
            {task.points > 0 && <span className="font-semibold">{task.points} ⭐</span>}
          </span>
        )}
      </span>

      {showAssignee && task.assignee && (
        <PersonBadge person={task.assignee} size="sm" showName={false} />
      )}

      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface">
        {completed && (
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke={accent}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 12l5 5L20 6" />
          </svg>
        )}
      </span>
    </button>
  );
}
