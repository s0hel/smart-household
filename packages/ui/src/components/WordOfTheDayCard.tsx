"use client";

import * as React from "react";
import { cn } from "../cn";
import type { VocabQuizFeedback, VocabReviewView, VocabWordView } from "../types";

const LEVEL_TABS: { level: VocabWordView["level"]; label: string; hint: string }[] = [
  { level: "JUNIOR", label: "Junior", hint: "Around 1st grade" },
  { level: "ISEE", label: "ISEE", hint: "Around 6th grade" },
];

/**
 * Wraps the word (and its common inflections) in the example sentence so a
 * kid's eye lands on it. Matching the bare word alone misses the usual case —
 * the sentence almost always uses "pioneers" or "pioneered", not "pioneer" —
 * which would leave the highlight silently absent on most cards.
 */
function highlightWord(sentence: string, word: string): React.ReactNode[] {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`\\b(${escaped}(?:s|es|ed|d|ing|ly|er|est)?)\\b`, "gi");
  const out: React.ReactNode[] = [];
  let cursor = 0;

  for (const match of sentence.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > cursor) out.push(sentence.slice(cursor, start));
    out.push(
      <strong key={`${start}-${match[0]}`} className="font-bold text-sapphire-700 underline decoration-gold-400 decoration-2 underline-offset-2">
        {match[0]}
      </strong>,
    );
    cursor = start + match[0].length;
  }
  if (cursor < sentence.length) out.push(sentence.slice(cursor));
  return out;
}

function LevelTabs({
  level,
  onLevelChange,
  disabled,
}: {
  level: VocabWordView["level"];
  onLevelChange: (level: VocabWordView["level"]) => void;
  disabled?: boolean;
}) {
  return (
    <div role="tablist" aria-label="Difficulty" className="flex shrink-0 rounded-full bg-ink-100 p-0.5">
      {LEVEL_TABS.map((tab) => (
        <button
          key={tab.level}
          type="button"
          role="tab"
          aria-selected={level === tab.level}
          title={tab.hint}
          disabled={disabled}
          onClick={() => onLevelChange(tab.level)}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-semibold transition-colors disabled:opacity-50",
            level === tab.level ? "bg-sapphire-600 text-white shadow-sm" : "text-ink-500 hover:text-ink-700",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export interface WordOfTheDayCardProps {
  word: VocabWordView;
  review?: VocabReviewView | null;
  /** Omit `level`/`onLevelChange` to render without the difficulty switch —
   * e.g. inside a list where each item is already at a fixed level. */
  level?: VocabWordView["level"];
  onLevelChange?: (level: VocabWordView["level"]) => void;
  onMarkRead?: () => void;
  onAnswerQuiz?: (choiceIndex: number) => void;
  onAnotherWord?: () => void;
  /** Result of the most recent attempt, cleared by the caller when the word changes. */
  quizFeedback?: VocabQuizFeedback | null;
  readPoints: number;
  quizPoints: number;
  /** False for roles that may look but not earn (GUEST/READONLY). */
  canEarn?: boolean;
  isMarkingRead?: boolean;
  isAnsweringQuiz?: boolean;
  isGenerating?: boolean;
  /** Eyebrow label — "Word of the day" on the scheduled card, "Bonus word" otherwise. */
  eyebrow?: string;
  compact?: boolean;
  className?: string;
}

/**
 * The vocabulary card: one word, explained twice at two reading levels, with
 * an optional comprehension check that pays points.
 *
 * Purely presentational, like the rest of this package — every mutation is a
 * callback and every piece of state that outlives the card (what's been read,
 * what's been answered, points banked) is owned by the caller. The one bit of
 * state kept here is which radio option is currently pencilled in, which is
 * meaningless outside the card.
 */
export function WordOfTheDayCard({
  word,
  review,
  level,
  onLevelChange,
  onMarkRead,
  onAnswerQuiz,
  onAnotherWord,
  quizFeedback,
  readPoints,
  quizPoints,
  canEarn = true,
  isMarkingRead,
  isAnsweringQuiz,
  isGenerating,
  eyebrow = "Word of the day",
  compact = false,
  className,
}: WordOfTheDayCardProps) {
  const [selected, setSelected] = React.useState<number | null>(null);
  const [quizOpen, setQuizOpen] = React.useState(false);
  const [renderedWordId, setRenderedWordId] = React.useState(word.id);

  const hasRead = Boolean(review);
  const solved = Boolean(review?.quizCorrectAt);

  // A new word means a new question, so the pencilled-in choice has to go.
  // Adjusted during render rather than in an effect (the pattern React
  // documents for resetting state on a prop change): an effect would let one
  // frame paint the previous card's selection against the new card's options.
  if (renderedWordId !== word.id) {
    setRenderedWordId(word.id);
    setSelected(null);
    setQuizOpen(false);
  }

  // Once solved there is nothing left to hide, so the quiz is shown with its
  // answer — derived rather than pushed into state, which keeps `quizOpen`
  // meaning only "the reader opened it".
  const quizVisible = quizOpen || solved;

  const wrongAttempt = quizFeedback && !quizFeedback.correct;

  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border border-ink-200 bg-surface shadow-sm",
        className,
      )}
      aria-label={`Word of the day: ${word.word}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-200 bg-gradient-to-r from-sapphire-50 to-gold-50 px-4 py-2.5">
        <p className="text-xs font-bold uppercase tracking-wide text-sapphire-700">📖 {eyebrow}</p>
        {level && onLevelChange && (
          <LevelTabs level={level} onLevelChange={onLevelChange} disabled={isGenerating} />
        )}
      </div>

      <div className={cn("space-y-4", compact ? "p-4" : "p-5")}>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className={cn("font-display italic text-sapphire-800", compact ? "text-3xl" : "text-4xl")}>
            {word.word}
          </h2>
          <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs font-medium italic text-ink-500">
            {word.partOfSpeech}
          </span>
          {solved && (
            <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-bold text-white">
              ✓ Learned
            </span>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-ink-400">What it means</p>
            <p className={cn("text-ink-800", compact ? "text-sm leading-relaxed" : "text-base leading-relaxed")}>
              {word.kidDefinition}
            </p>
          </div>
          <div className="rounded-xl bg-gold-50 px-3 py-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-gold-700">🧸 Even simpler</p>
            <p className="text-sm leading-relaxed text-ink-700">{word.simpleDefinition}</p>
          </div>
        </div>

        {word.synonyms.length > 0 && (
          <div>
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-400">Means about the same</p>
            <div className="flex flex-wrap gap-1.5">
              {word.synonyms.map((synonym) => (
                <span
                  key={synonym}
                  className="rounded-full border border-sapphire-200 bg-sapphire-50 px-2.5 py-1 text-xs font-medium text-sapphire-700"
                >
                  {synonym}
                </span>
              ))}
            </div>
          </div>
        )}

        <blockquote className="border-l-4 border-gold-400 bg-paper py-2 pl-3 pr-2 text-sm italic leading-relaxed text-ink-700">
          {highlightWord(word.exampleSentence, word.word)}
        </blockquote>

        {canEarn && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={hasRead || isMarkingRead}
              onClick={onMarkRead}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold transition-colors",
                hasRead
                  ? "cursor-default bg-emerald-500/15 text-emerald-600"
                  : "bg-sapphire-600 text-white hover:bg-sapphire-700 disabled:opacity-60",
              )}
            >
              {hasRead ? "✓ Read" : isMarkingRead ? "Saving…" : `✓ I read this  +${readPoints}`}
            </button>

            {!solved && (
              <button
                type="button"
                onClick={() => setQuizOpen((open) => !open)}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-gold-100 px-3 text-sm font-semibold text-gold-800 transition-colors hover:bg-gold-200"
                aria-expanded={quizVisible}
              >
                🧠 {quizVisible ? "Hide the quiz" : `Take the quiz  +${quizPoints}`}
              </button>
            )}

            {onAnotherWord && (
              <button
                type="button"
                disabled={isGenerating}
                onClick={onAnotherWord}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-ink-100 px-3 text-sm font-semibold text-ink-700 transition-colors hover:bg-ink-200 disabled:opacity-60"
              >
                {isGenerating ? "Thinking…" : "✨ Another word"}
              </button>
            )}
          </div>
        )}

        {quizVisible && (
          <div className="rounded-xl border border-ink-200 bg-paper p-3">
            <p className="mb-2.5 text-sm font-semibold text-ink-800">{word.quizQuestion}</p>
            <div className="space-y-1.5" role="radiogroup" aria-label={word.quizQuestion}>
              {word.quizChoices.map((choice, index) => {
                const isRevealedAnswer = quizFeedback?.correctIndex === index;
                const isWrongPick = Boolean(wrongAttempt) && selected === index;
                return (
                  <button
                    key={index}
                    type="button"
                    role="radio"
                    aria-checked={selected === index}
                    disabled={solved || isAnsweringQuiz}
                    onClick={() => setSelected(index)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg border-2 px-3 py-2 text-left text-sm transition-colors",
                      isRevealedAnswer
                        ? "border-emerald-600 bg-emerald-500/10 text-ink-900"
                        : isWrongPick
                          ? "border-rose-500 bg-rose-500/10 text-ink-900"
                          : selected === index
                            ? "border-sapphire-500 bg-sapphire-500/10 text-ink-900"
                            : "border-ink-200 bg-surface text-ink-700 hover:border-ink-300",
                      (solved || isAnsweringQuiz) && "cursor-default",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-bold",
                        isRevealedAnswer
                          ? "border-emerald-600 bg-emerald-600 text-white"
                          : isWrongPick
                            ? "border-rose-500 bg-rose-500 text-white"
                            : selected === index
                              ? "border-sapphire-500 bg-sapphire-500 text-white"
                              : "border-ink-300 text-transparent",
                      )}
                    >
                      {isRevealedAnswer ? "✓" : isWrongPick ? "✕" : "•"}
                    </span>
                    <span className="min-w-0">{choice}</span>
                  </button>
                );
              })}
            </div>

            {!solved && (
              <button
                type="button"
                disabled={selected === null || isAnsweringQuiz}
                onClick={() => selected !== null && onAnswerQuiz?.(selected)}
                className="mt-3 inline-flex h-9 items-center rounded-xl bg-sapphire-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-sapphire-700 disabled:cursor-not-allowed disabled:bg-sapphire-300"
              >
                {isAnsweringQuiz ? "Checking…" : wrongAttempt ? "Try again" : "Check my answer"}
              </button>
            )}

            {quizFeedback && (
              <p
                className={cn(
                  "mt-2.5 text-sm font-semibold",
                  quizFeedback.correct ? "text-emerald-600" : "text-rose-500",
                )}
                role="status"
              >
                {quizFeedback.correct
                  ? quizFeedback.atDailyCap
                    ? "🎉 That's right! You've hit today's points cap — keep going for the streak."
                    : `🎉 That's right! +${quizFeedback.pointsAwarded} points`
                  : quizFeedback.correctIndex !== null
                    ? "Not quite — the right answer is highlighted above. Read it once more!"
                    : "Not quite — read the meaning again and give it another go."}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
