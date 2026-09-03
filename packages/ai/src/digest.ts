import { generateText } from "ai";
import { formatDateInTimezone, formatTimeInTimezone } from "@household/domain";
import { getModel } from "./model";

export interface DigestEvent {
  title: string;
  startAt: Date;
  endAt: Date;
  allDay: boolean;
  location?: string | null;
  assigneeNames: string[];
}

export interface DigestTask {
  title: string;
  assigneeName?: string | null;
}

export interface DigestMeal {
  mealType: string;
  title: string;
}

export interface MorningDigestInput {
  today: Date;
  /** IANA zone the reader is actually viewing from (the browser's), used to
   * render every date/time in the prompt — the server process's own local
   * time is never the right zone to narrate someone else's morning in. */
  timeZone: string;
  events: DigestEvent[];
  tasks: DigestTask[];
  meals: DigestMeal[];
}

export interface MorningDigestResult {
  text: string;
  provider: string;
  model: string;
}

function formatEvent(event: DigestEvent, timeZone: string): string {
  const time = event.allDay
    ? "all day"
    : `${formatTimeInTimezone(event.startAt, timeZone)}-${formatTimeInTimezone(event.endAt, timeZone)}`;
  const who = event.assigneeNames.length > 0 ? ` (${event.assigneeNames.join(", ")})` : "";
  const where = event.location ? ` at ${event.location}` : "";
  return `- ${event.title}${who}: ${time}${where}`;
}

function buildFacts(input: MorningDigestInput): string {
  const lines: string[] = [];

  lines.push(input.events.length > 0 ? "EVENTS TODAY:" : "EVENTS TODAY: none");
  for (const event of input.events) lines.push(formatEvent(event, input.timeZone));

  lines.push(input.tasks.length > 0 ? "OPEN TASKS/CHORES DUE TODAY:" : "OPEN TASKS/CHORES DUE TODAY: none");
  for (const task of input.tasks) {
    lines.push(`- ${task.title}${task.assigneeName ? ` (${task.assigneeName})` : ""}`);
  }

  lines.push(input.meals.length > 0 ? "MEALS PLANNED TODAY:" : "MEALS PLANNED TODAY: none");
  for (const meal of input.meals) lines.push(`- ${meal.mealType}: ${meal.title}`);

  return lines.join("\n");
}

const SYSTEM_PROMPT = `You write a short "good morning" briefing for a family household display, read at a glance by parents and kids.

Rules:
- Use ONLY the facts given below. Never invent a time, name, or event that isn't listed.
- 2-4 sentences, warm and conversational, no headers or bullet points in your reply.
- Call out the single most time-sensitive thing first (earliest event, or "nothing on the calendar" if events is empty).
- Mention open chores/tasks only if there are any; don't pad the reply if a section is empty.
- Do not add sign-offs, disclaimers, or mention that you are an AI.`;

/**
 * Turns today's structured events/tasks/meals into a natural-language
 * morning briefing. Provider-agnostic: whatever getModel() resolves to
 * (Ollama locally, Anthropic/OpenAI in prod) is used the same way.
 */
export async function generateMorningDigest(input: MorningDigestInput): Promise<MorningDigestResult> {
  const model = getModel();
  const facts = buildFacts(input);

  const { text } = await generateText({
    model,
    system: SYSTEM_PROMPT,
    prompt: `Today is ${formatDateInTimezone(input.today, input.timeZone)}.\n\n${facts}`,
    temperature: 0.4,
    maxOutputTokens: 200,
  });

  return {
    text: text.trim(),
    provider: process.env.AI_PROVIDER ?? "ollama",
    model: process.env.AI_MODEL ?? "default",
  };
}
