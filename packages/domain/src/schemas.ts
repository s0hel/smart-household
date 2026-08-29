import { z } from "zod";

export const roleSchema = z.enum(["ADMIN", "PARENT", "CHILD", "GUEST", "READONLY"]);
export const taskTypeSchema = z.enum(["ONE_TIME", "RECURRING", "CHORE", "ROUTINE"]);
export const listTypeSchema = z.enum(["GROCERY", "CUSTOM"]);

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

export const eventInputSchema = z
  .object({
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
  })
  .refine((data) => data.endAt >= data.startAt, {
    message: "endAt must be after startAt",
    path: ["endAt"],
  });

export const taskInputSchema = z.object({
  title: z.string().min(1).max(140),
  type: taskTypeSchema,
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

export type FamilyMemberInput = z.infer<typeof familyMemberInputSchema>;
export type EventInput = z.infer<typeof eventInputSchema>;
export type TaskInput = z.infer<typeof taskInputSchema>;
export type ListInput = z.infer<typeof listInputSchema>;
export type ListItemInput = z.infer<typeof listItemInputSchema>;
export type RewardInput = z.infer<typeof rewardInputSchema>;
