import { z } from "zod";
import { eventInputSchema, eventUpdateInputSchema } from "@household/domain";
import { router, capabilityProcedure } from "../trpc";
import { logAudit } from "../../audit";
import { pushEventToGoogle, retractEventFromGoogle } from "../../integrations/writebackGoogleCalendar";

// Two-way write-back to Google is best-effort: the in-app DB write is what
// actually matters to the user, so a Google API hiccup shouldn't fail their
// save. Log and move on.
async function writeBackSafely(fn: () => Promise<void>) {
  try {
    await fn();
  } catch (err) {
    console.error("Google Calendar write-back failed", err);
  }
}

const EVENT_INCLUDE = {
  assignees: { include: { user: true } },
  checklist: { orderBy: { order: "asc" as const } },
};

// All-day events represent a bare calendar date with no time component, so
// startAt/endAt must always be a timezone-independent UTC-midnight instant
// (see syncGoogleCalendar's toDate) — otherwise the same date renders as a
// different day depending on which timezone reads it back.
function normalizeAllDay<T extends { allDay?: boolean; startAt?: Date; endAt?: Date }>(input: T): T {
  if (!input.allDay) return input;
  const toUtcMidnight = (d: Date) => new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  return {
    ...input,
    startAt: input.startAt ? toUtcMidnight(input.startAt) : input.startAt,
    endAt: input.endAt ? toUtcMidnight(input.endAt) : input.endAt,
  };
}

export const eventRouter = router({
  list: capabilityProcedure("event", "read")
    .input(
      z
        .object({
          from: z.coerce.date().optional(),
          to: z.coerce.date().optional(),
        })
        .optional(),
    )
    .query(({ ctx, input }) => {
      const now = new Date();
      const from = input?.from ?? new Date(now.getTime() - 7 * 86_400_000);
      const to = input?.to ?? new Date(now.getTime() + 60 * 86_400_000);
      return ctx.prisma.event.findMany({
        where: { householdId: ctx.householdId, startAt: { gte: from, lte: to } },
        include: EVENT_INCLUDE,
        orderBy: { startAt: "asc" },
      });
    }),

  create: capabilityProcedure("event", "create")
    .input(eventInputSchema)
    .mutation(async ({ ctx, input }) => {
      const { assigneeIds, checklist, ...rest } = input;
      const event = await ctx.prisma.event.create({
        data: {
          ...normalizeAllDay(rest),
          householdId: ctx.householdId,
          assignees: { create: assigneeIds.map((userId) => ({ userId })) },
          checklist: { create: checklist.map((item, order) => ({ ...item, order })) },
        },
        include: EVENT_INCLUDE,
      });
      await logAudit(ctx.prisma, {
        householdId: ctx.householdId,
        actorId: ctx.actor.id,
        action: "create",
        entityType: "event",
        entityId: event.id,
      });
      await writeBackSafely(() => pushEventToGoogle(ctx.prisma, event.id));
      return event;
    }),

  update: capabilityProcedure("event", "update")
    .input(eventUpdateInputSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, assigneeIds, checklist, ...rest } = input;
      await ctx.prisma.event.findFirstOrThrow({ where: { id, householdId: ctx.householdId } });

      const event = await ctx.prisma.$transaction(async (tx) => {
        if (assigneeIds) {
          await tx.eventAssignee.deleteMany({ where: { eventId: id } });
          await tx.eventAssignee.createMany({ data: assigneeIds.map((userId) => ({ eventId: id, userId })) });
        }
        if (checklist) {
          await tx.eventChecklistItem.deleteMany({ where: { eventId: id } });
          await tx.eventChecklistItem.createMany({
            data: checklist.map((item, order) => ({ ...item, eventId: id, order })),
          });
        }
        return tx.event.update({ where: { id }, data: normalizeAllDay(rest), include: EVENT_INCLUDE });
      });

      await logAudit(ctx.prisma, {
        householdId: ctx.householdId,
        actorId: ctx.actor.id,
        action: "update",
        entityType: "event",
        entityId: event.id,
      });
      await writeBackSafely(() => pushEventToGoogle(ctx.prisma, event.id));
      return event;
    }),

  delete: capabilityProcedure("event", "delete")
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.event.findFirstOrThrow({
        where: { id: input.id, householdId: ctx.householdId },
      });
      await writeBackSafely(() => retractEventFromGoogle(ctx.prisma, existing.id));
      await ctx.prisma.event.delete({ where: { id: existing.id } });
      await logAudit(ctx.prisma, {
        householdId: ctx.householdId,
        actorId: ctx.actor.id,
        action: "delete",
        entityType: "event",
        entityId: existing.id,
      });
      return { id: existing.id };
    }),
});
