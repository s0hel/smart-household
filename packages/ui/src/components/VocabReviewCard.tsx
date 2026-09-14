"use client";

import * as React from "react";
import { cn } from "../cn";
import type { VocabReviewFeedback, VocabReviewQuestionView } from "../types";

/** "comes back tomorrow" reads better than "comes back in 1 day", and for a
 * kid the unit matters more than the number once it gets large. */
function describeInterval(days: number): string {
  if (days <= 1) return "tomorrow";
  if (days < 14) return `in ${days} days`;
  if (days < 60) return `in ${Math.round(days / 7)} weeks`;
  return `in ${Math.round(days / 30)} months`;
}

export interface VocabReviewCardProps {
  question: VocabReviewQuestionView;
  /** 1-based position within this session, for the progress line. */
  position: number;
  total: number;
  feedback?: VocabReviewFeedback | null;
  onAnswer: (chosenWordId: string) => void;
  onNext: () => void;
  isSubmitting?: boolean;
  isLast?: boolean;
  className?: string;
}

/**
 * One spaced-repetition question.
 *
 * Runs the recall in the opposite direction from the word's original quiz —
 * the definition is given and the word has to be produced — because
 * recognising a definition you have already been shown is a much weaker test
 * than retrieving the word behind it.
 */
export function VocabReviewCard({
  question,
  position,
  total,
  feedback,
  onAnswer,
  onNext,
  isSubmitting,
  isLast,
  className,
}: VocabReviewCardProps) {
  const [selected, setSelected] = React.useState<string | null>(null);
  const [renderedId, setRenderedId] = React.useState(question.reviewId);

  // Reset the pencilled-in choice when the session moves to the next card.
  // Adjusted during render rather than in an effect so no frame paints the
  // previous question's selection against these options.
  if (renderedId !== question.reviewId) {
    setRenderedId(question.reviewId);
    setSelected(null);
  }

  // A Junior-band word is being reviewed by whoever is working at that band,
  // so it gets the definition written for that reader.
  const definition = question.level === "JUNIOR" ? question.simplePrompt : question.prompt;
  const answered = Boolean(feedback);

  return (
    <section
      className={cn("overflow-hidden rounded-2xl border border-ink-200 bg-surface shadow-sm", className)}
      aria-label="Vocabulary review"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-200 bg-gradient-to-r from-gold-50 to-sapphire-50 px-4 py-2.5">
        <p className="text-xs font-bold uppercase tracking-wide text-gold-700">🔁 Review</p>
        <p className="text-xs font-semibold tabular-nums text-ink-400">
          {position} of {total}
        </p>
      </div>

      <div className="space-y-4 p-5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-ink-400">Which word means…</p>
          <p className="mt-1 text-base leading-relaxed text-ink-800">{definition}</p>
        </div>

        <div className="space-y-1.5" role="radiogroup" aria-label="Which word means this?">
          {question.choices.map((choice) => {
            const isAnswer = answered && feedback!.correctWordId === choice.id;
            const isWrongPick = answered && !feedback!.correct && selected === choice.id;
            return (
              <button
                key={choice.id}
                type="button"
                role="radio"
                aria-checked={selected === choice.id}
                disabled={answered || isSubmitting}
                onClick={() => setSelected(choice.id)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg border-2 px-3 py-2 text-left transition-colors",
                  isAnswer
                    ? "border-emerald-600 bg-emerald-500/10"
                    : isWrongPick
                      ? "border-rose-500 bg-rose-500/10"
                      : selected === choice.id
                        ? "border-sapphire-500 bg-sapphire-500/10"
                        : "border-ink-200 bg-surface hover:border-ink-300",
                  (answered || isSubmitting) && "cursor-default",
                )}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-bold",
                    isAnswer
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : isWrongPick
                        ? "border-rose-500 bg-rose-500 text-white"
                        : selected === choice.id
                          ? "border-sapphire-500 bg-sapphire-500 text-white"
                          : "border-ink-300 text-transparent",
                  )}
                >
                  {isAnswer ? "✓" : isWrongPick ? "✕" : "•"}
                </span>
                <span className="font-display text-lg italic text-sapphire-800">{choice.word}</span>
              </button>
            );
          })}
        </div>

        {!answered ? (
          <button
            type="button"
            disabled={selected === null || isSubmitting}
            onClick={() => selected && onAnswer(selected)}
            className="inline-flex h-9 items-center rounded-xl bg-sapphire-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-sapphire-700 disabled:cursor-not-allowed disabled:bg-sapphire-300"
          >
            {isSubmitting ? "Checking…" : "Check my answer"}
          </button>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p
              className={cn("text-sm font-semibold", feedback!.correct ? "text-emerald-600" : "text-rose-500")}
              role="status"
            >
              {feedback!.correct
                ? feedback!.atDailyCap
                  ? `🎉 Still got it! You've hit today's points cap — back ${describeInterval(feedback!.intervalDays)}.`
                  : `🎉 Still got it! +${feedback!.pointsAwarded} · back ${describeInterval(feedback!.intervalDays)}`
                : `It was “${feedback!.correctWord}” — back ${describeInterval(feedback!.intervalDays)} so you can catch it next time.`}
            </p>
            <button
              type="button"
              onClick={onNext}
              className="inline-flex h-9 shrink-0 items-center rounded-xl bg-ink-100 px-4 text-sm font-semibold text-ink-700 transition-colors hover:bg-ink-200"
            >
              {isLast ? "Finish" : "Next word →"}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
