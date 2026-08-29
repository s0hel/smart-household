import { z } from "zod";
import { eventInputSchema, eventUpdateInputSchema } from "@household/domain";
import { router, capabilityProcedure } from "../trpc";
import { logAudit } from "../../audit";

const EVENT_INCLUDE = {
  assignees: { include: { user: true } },
  checklist: { orderBy: { order: "asc" as const } },
};

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
          ...rest,
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
        return tx.event.update({ where: { id }, data: rest, include: EVENT_INCLUDE });
      });

      await logAudit(ctx.prisma, {
        householdId: ctx.householdId,
        actorId: ctx.actor.id,
        action: "update",
        entityType: "event",
        entityId: event.id,
      });
      return event;
    }),

  delete: capabilityProcedure("event", "delete")
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.event.findFirstOrThrow({
        where: { id: input.id, householdId: ctx.householdId },
      });
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
