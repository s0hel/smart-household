import type { TaskView } from "./types";

const KEYWORD_EMOJI: [RegExp, string][] = [
  [/tooth|teeth|brush/i, "🪥"],
  [/shower|bath/i, "🛁"],
  [/face/i, "🧼"],
  [/cloth|dress|pajama|pyjama/i, "👕"],
  [/teddy|toy/i, "🧸"],
  [/homework|read|study/i, "📚"],
  [/library/i, "📖"],
  [/bed|room|tidy/i, "🛏️"],
  [/dish|kitchen/i, "🍽️"],
  [/trash|garbage|bin/i, "🗑️"],
  [/bathroom|toilet/i, "🚽"],
  [/car/i, "🚗"],
  [/garden|yard|lawn|rake/i, "🌱"],
  [/vacuum|sweep|mop|clean/i, "🧹"],
  [/pet|dog|cat|feed/i, "🐾"],
  [/laundry/i, "🧺"],
];

const TYPE_EMOJI: Record<TaskView["type"], string> = {
  CHORE: "🧹",
  ROUTINE: "⏰",
  ONE_TIME: "✅",
  RECURRING: "🔁",
};

/** Picks a friendly emoji for a task from keywords in its title, falling back to its type. */
export function taskEmoji(task: Pick<TaskView, "title" | "type">): string {
  for (const [pattern, emoji] of KEYWORD_EMOJI) {
    if (pattern.test(task.title)) return emoji;
  }
  return TYPE_EMOJI[task.type];
}
