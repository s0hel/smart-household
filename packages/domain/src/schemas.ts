import { z } from "zod";

export const roleSchema = z.enum(["ADMIN", "PARENT", "CHILD", "GUEST", "READONLY"]);
export const taskTypeSchema = z.enum(["ONE_TIME", "RECURRING", "CHORE", "ROUTINE"]);
export const listTypeSchema = z.enum(["GROCERY", "CUSTOM"]);
export const mealTypeSchema = z.enum(["BREAKFAST", "LUNCH", "DINNER", "SNACK"]);
export const vocabLevelSchema = z.enum(["JUNIOR", "ISEE"]);

export const familyMemberInputSchema = z.object({
  name: z.string().min(1).max(60),
  role: roleSchema,
  colorHex: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .default("#3B82F6"),
  avatarUrl: z.string().url().optional().nullable(),
  email: z.string().email().optional().nullable(),
  birthdate: z.coerce.date().optional().nullable(),
  password: z.string().min(8).optional(),
  pin: z
    .string()
    .regex(/^\d{4}$/)
    .optional(),
});

export const eventChecklistItemInputSchema = z.object({
  label: z.string().min(1).max(140),
  checked: z.boolean().default(false),
});

// The bare object schema (pre-refine) so both `create` (full, validated) and
// `update` (partial) inputs can be derived from the same field definitions —
// `ZodEffects` from `.refine()` doesn't support `.partial()`.
export const eventFieldsSchema = z.object({
  title: z.string().min(1).max(140),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  allDay: z.boolean().default(false),
  location: z.string().max(240).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  colorHex: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .default("#3B82F6"),
  recurrenceRule: z.string().optional().nullable(),
  travelTimeMinutes: z.number().int().min(0).optional().nullable(),
  assigneeIds: z.array(z.string()).default([]),
  checklist: z.array(eventChecklistItemInputSchema).default([]),
});

export const eventInputSchema = eventFieldsSchema.refine((data) => data.endAt >= data.startAt, {
  message: "endAt must be after startAt",
  path: ["endAt"],
});

export const eventUpdateInputSchema = eventFieldsSchema.partial().extend({ id: z.string() });

export const taskInputSchema = z.object({
  title: z.string().min(1).max(140),
  type: taskTypeSchema,
  icon: z.string().max(8).optional().nullable(),
  assigneeId: z.string().optional().nullable(),
  frequency: z.string().optional().nullable(),
  dueAt: z.coerce.date().optional().nullable(),
  points: z.number().int().min(0).default(0),
  rewardId: z.string().optional().nullable(),
});

export const taskCompleteInputSchema = z.object({
  taskId: z.string(),
  occurrenceDate: z.coerce.date(),
});

export const listInputSchema = z.object({
  name: z.string().min(1).max(80),
  type: listTypeSchema.default("CUSTOM"),
});

export const listItemInputSchema = z.object({
  label: z.string().min(1).max(140),
  quantity: z.string().max(40).optional().nullable(),
  category: z.string().max(60).optional().nullable(),
  assigneeId: z.string().optional().nullable(),
  dueDate: z.coerce.date().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export const rewardInputSchema = z.object({
  name: z.string().min(1).max(80),
  costPoints: z.number().int().min(1),
  description: z.string().max(500).optional().nullable(),
  requiresApproval: z.boolean().default(true),
});

export const recipeIngredientInputSchema = z.object({
  name: z.string().min(1).max(140),
  quantity: z.string().max(60).optional().nullable(),
  category: z.string().max(60).optional().nullable(),
});

export const recipeInputSchema = z.object({
  name: z.string().min(1).max(140),
  description: z.string().max(1000).optional().nullable(),
  instructions: z.string().max(5000).optional().nullable(),
  servings: z.number().int().min(1).max(50).optional().nullable(),
  prepMinutes: z.number().int().min(0).optional().nullable(),
  cookMinutes: z.number().int().min(0).optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  ingredients: z.array(recipeIngredientInputSchema).default([]),
});

export const mealPlanEntryInputSchema = z.object({
  date: z.coerce.date(),
  mealType: mealTypeSchema,
  recipeId: z.string().optional().nullable(),
  customTitle: z.string().max(140).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  assigneeId: z.string().optional().nullable(),
});

export const groceryListGenerateInputSchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
  listName: z.string().max(80).optional(),
});

const vocabWordFields = {
  word: z.string().min(1).max(40),
  partOfSpeech: z.string().min(1).max(24),
  kidDefinition: z.string().min(1).max(400),
  simpleDefinition: z.string().min(1).max(400),
  exampleSentence: z.string().min(1).max(300),
  quizQuestion: z.string().min(1).max(200),
  quizChoices: z.array(z.string().min(1).max(160)).length(4),
  quizAnswerIndex: z.number().int().min(0).max(3),
};

/**
 * The generated word as it is persisted and rendered: `synonyms` is a real
 * array here, and every field is required, so a model that drops the example
 * sentence fails loudly instead of writing a half-empty card to the
 * household's dashboard.
 */
export const vocabWordContentSchema = z.object({
  ...vocabWordFields,
  synonyms: z.array(z.string().min(1).max(40)).min(1).max(5),
});

/**
 * What the model is actually allowed to hand back.
 *
 * Identical to the schema above except that `synonyms` may arrive as one
 * comma-separated string — observed from Claude Haiku on this exact prompt,
 * and much more common from the small local models this app is meant to run
 * against by default. Rejecting that outright means a blank card on the
 * dashboard over a formatting quirk, when the content was perfectly good, so
 * the generator normalizes the wire shape and then re-validates against
 * `vocabWordContentSchema` before anything is stored.
 */
export const vocabWordWireSchema = z.object({
  ...vocabWordFields,
  synonyms: z.union([z.array(z.string().min(1).max(40)).min(1).max(5), z.string().min(1).max(200)]),
});

/** Splits the comma/semicolon-separated fallback form into the real array. */
export function normalizeVocabSynonyms(synonyms: string[] | string): string[] {
  const list = Array.isArray(synonyms) ? synonyms : synonyms.split(/[,;]/);
  return list.map((s) => s.trim()).filter(Boolean).slice(0, 5);
}

export const vocabQuizAnswerInputSchema = z.object({
  wordId: z.string(),
  choiceIndex: z.number().int().min(0).max(3),
});

/** A scheduled-review answer names the word the reader picked, not an index —
 * the review question is "which of these words means this?", so the answer is
 * a word id and the server never has to ship a position for the client to
 * match against. */
export const vocabReviewAnswerInputSchema = z.object({
  reviewId: z.string(),
  chosenWordId: z.string(),
});

export type FamilyMemberInput = z.infer<typeof familyMemberInputSchema>;
export type VocabWordContent = z.infer<typeof vocabWordContentSchema>;
export type VocabWordWire = z.infer<typeof vocabWordWireSchema>;
export type VocabQuizAnswerInput = z.infer<typeof vocabQuizAnswerInputSchema>;
export type VocabReviewAnswerInput = z.infer<typeof vocabReviewAnswerInputSchema>;
export type EventInput = z.infer<typeof eventInputSchema>;
export type TaskInput = z.infer<typeof taskInputSchema>;
export type ListInput = z.infer<typeof listInputSchema>;
export type ListItemInput = z.infer<typeof listItemInputSchema>;
export type RewardInput = z.infer<typeof rewardInputSchema>;
export type RecipeInput = z.infer<typeof recipeInputSchema>;
export type MealPlanEntryInput = z.infer<typeof mealPlanEntryInputSchema>;
export type GroceryListGenerateInput = z.infer<typeof groceryListGenerateInputSchema>;
