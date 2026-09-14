import { generateObject } from "ai";
import {
  normalizeVocabSynonyms,
  vocabWordContentSchema,
  vocabWordWireSchema,
  VOCAB_LEVEL_DESCRIPTIONS,
  type VocabLevel,
  type VocabWordContent,
} from "@household/domain";
import { getModel } from "./model";

export interface VocabGenerationInput {
  level: VocabLevel;
  /** Words the household has already seen. Passed to the model as a
   * do-not-repeat list — a kid who gets "pioneer" twice in a week stops
   * trusting that the app has anything left to teach them. */
  exclude?: string[];
}

export interface VocabGenerationResult extends VocabWordContent {
  provider: string;
  model: string;
}

/**
 * Starting letters the generator draws from to force variety.
 *
 * Temperature alone does not deliver it: asked the same question three times,
 * the model returned "reluctant" three times — one of the calibration anchors,
 * despite the prompt saying not to pick from that list. Constraining the first
 * letter to a small random subset breaks that mode reliably, and it stays
 * useful once the exclude list is long (which only tells the model what NOT to
 * say, never where else to look). q/x/z are left out: too few words in either
 * band that a child could actually use.
 */
const STARTING_LETTERS = "abcdefghijklmnoprstuvw".split("");

function pickStartingLetters(count: number): string[] {
  const pool = [...STARTING_LETTERS];
  const picked: string[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    picked.push(...pool.splice(Math.floor(Math.random() * pool.length), 1));
  }
  return picked;
}

/**
 * Per-level calibration. The difficulty band is the whole product here, so it
 * is spelled out with anchor words rather than left to the model's idea of
 * "6th grade" — asked abstractly, models drift toward SAT words for the older
 * band and toward sight words ("cat", "run") for the younger one, and neither
 * is what was asked for.
 *
 * The anchors are illustrative targets, not a word bank: the prompt says so
 * explicitly, because a model handed five example words will otherwise return
 * one of those five more often than not.
 */
const LEVEL_GUIDANCE: Record<VocabLevel, string> = {
  ISEE: `Pick a word of the difficulty you would find in the vocabulary (synonym / sentence-completion) section of the ISEE Lower or Middle Level exam, taken by 5th-7th graders.

Calibration anchors — aim for this band, but do NOT pick from this list:
pioneer, abundant, reluctant, diligent, mimic, vivid, frugal, tranquil, meager, candid, novice, persist, summit, adapt, dismal.

Too easy (reject): happy, big, run, fast, house.
Too hard (reject): obfuscate, ubiquitous, ephemeral, recalcitrant, perfunctory.

The word should be one a curious 11-year-old could actually use in writing or conversation, not a technical or archaic term.`,

  JUNIOR: `Pick a word a 1st grader (6-7 years old) is ready to grow into: a step beyond the sight words they already read fluently, but still concrete and picturable.

Calibration anchors — aim for this band, but do NOT pick from this list:
gentle, brave, gather, wobble, enormous, curious, sturdy, whisper, scurry, damp, tidy, chilly, gigantic, soggy, grumpy.

Too easy (reject): cat, dog, red, run, big, sit.
Too hard (reject): pioneer, abundant, reluctant, diligent, tranquil.

Prefer words for things a child can see, touch, hear, or feel. Avoid abstract nouns.`,
};

function buildSystemPrompt(level: VocabLevel): string {
  return `You write vocabulary cards for a family household app. Children read these cards themselves, so every word you write is read by a kid.

DIFFICULTY BAND
${LEVEL_GUIDANCE[level]}

WHAT TO RETURN
- word: the vocabulary word itself, lowercase unless it is a proper noun.
- partOfSpeech: "noun", "verb", "adjective", "adverb". If the word is commonly more than one, pick the most useful single one and write the rest of the card for that one only.
- kidDefinition: the meaning, written so a 10-YEAR-OLD understands it. One or two sentences. Plain words. You may use a short comparison ("like a...") if it helps. Never use the word itself, or a word built from the same root, inside its own definition.
- simpleDefinition: the SAME meaning, written so a 6-YEAR-OLD understands it. This must be MEASURABLY SIMPLER than kidDefinition, not a reworded version of it: one short sentence, under 12 words, everyday words only, no semicolons, no commas splitting clauses, no word a 6-year-old wouldn't say out loud.
  For "gentle" — kidDefinition: "Soft and careful, not rough. A gentle touch is light and kind." simpleDefinition: "Soft and nice, not rough." (SHORTER and EASIER, every time.)
  Before you answer, check: is simpleDefinition shorter and easier than kidDefinition? If not, rewrite it.
- synonyms: a JSON ARRAY of 2 to 4 real synonyms, e.g. ["soft", "kind", "tender"]. Never a single comma-separated string. NEVER include the word itself, or a word built from the same root — "reluctant" is not a synonym for "reluctant", and listing it teaches nothing. Each one must be no harder than the word itself, so the synonym actually explains something. Do not pad the list with near-misses; three good ones beat four with a dud.
- exampleSentence: one natural sentence using the word, about something in a child's world (school, family, playground, pets, weather, food). The sentence must make the meaning guessable from context even if the reader skipped the definition.

THE COMPREHENSION CHECK
- quizQuestion: one question testing whether the reader grasped the MEANING — not spelling, not part of speech. Good shapes: "Which one shows someone being ___?", "Which sentence uses ___ correctly?". The question itself must be readable by a child at this level.
- quizChoices: exactly 4 options. Exactly one is correct. The three wrong ones must be plausible-but-clearly-wrong to someone who understood the definition — never absurd or joke answers, and never obviously-wrong-by-length. Keep all four roughly the same length.
- quizAnswerIndex: the 0-based index of the correct option in quizChoices. VARY this across cards; do not default to 0.

RULES
- Age-appropriate throughout. No violence, death, romance, religion, politics, or anything frightening.
- Return the fields exactly as specified. Do not add commentary, headers, or markdown.`;
}

/**
 * Generates one vocabulary card at the requested level.
 *
 * Provider-agnostic in the same way the morning digest is: whatever
 * getModel() resolves to (Ollama locally, Anthropic/OpenAI in prod) is
 * driven through the same structured-output call, validated against the
 * shared zod schema before it can reach the database.
 */
export async function generateVocabWord(input: VocabGenerationInput): Promise<VocabGenerationResult> {
  const model = getModel();

  const exclude = (input.exclude ?? []).slice(0, 60);
  const excludeClause =
    exclude.length > 0
      ? `\n\nThis household has already seen these words. Do NOT return any of them, or a close variant (same root, or just a different ending):\n${exclude.join(", ")}`
      : "";

  const letters = pickStartingLetters(4);

  const { object } = await generateObject({
    model,
    // Generated against the tolerant wire schema, then normalized and
    // re-validated below — see vocabWordWireSchema for why.
    schema: vocabWordWireSchema,
    system: buildSystemPrompt(input.level),
    prompt:
      `Write one ${VOCAB_LEVEL_DESCRIPTIONS[input.level].toLowerCase()} vocabulary card.\n\n` +
      `The word must start with one of these letters: ${letters.join(", ")}. ` +
      `Pick whichever of those gives you the best word for the difficulty band.` +
      excludeClause,
    // Warmer than the digest on purpose: the same prompt runs many times for
    // one household, and a near-deterministic model hands back the same
    // handful of words every day.
    temperature: 0.9,
  });

  // A word is not a synonym for itself. The prompt says so, and the model
  // still does it — so it is enforced here rather than trusted.
  const word = object.word.trim();
  const synonyms = normalizeVocabSynonyms(object.synonyms).filter(
    (synonym) => synonym.toLowerCase() !== word.toLowerCase(),
  );

  const content = vocabWordContentSchema.parse({ ...object, word, synonyms });

  return {
    ...content,
    provider: process.env.AI_PROVIDER ?? "ollama",
    model: process.env.AI_MODEL ?? "default",
  };
}
