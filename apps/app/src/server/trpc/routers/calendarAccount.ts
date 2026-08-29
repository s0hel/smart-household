import { z } from "zod";
import { router, capabilityProcedure } from "../trpc";
import { syncGoogleCalendarAccount } from "../../integrations/syncGoogleCalendar";
import { logAudit } from "../../audit";

export const calendarAccountRouter = router({
  list: capabilityProcedure("calendarAccount", "read").query(({ ctx }) =>
    ctx.prisma.calendarAccount.findMany({
      where: { householdId: ctx.householdId },
      select: {
        id: true,
        provider: true,
        status: true,
        lastSyncedAt: true,
        ownerId: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
  ),

  disconnect: capabilityProcedure("calendarAccount", "delete")
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.calendarAccount.findFirstOrThrow({
        where: { id: input.id, householdId: ctx.householdId },
      });
      await ctx.prisma.calendarAccount.delete({ where: { id: existing.id } });
      await logAudit(ctx.prisma, {
        householdId: ctx.householdId,
        actorId: ctx.actor.id,
        action: "delete",
        entityType: "calendarAccount",
        entityId: existing.id,
      });
      return { id: existing.id };
    }),

  sync: capabilityProcedure("calendarAccount", "update")
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.calendarAccount.findFirstOrThrow({
        where: { id: input.id, householdId: ctx.householdId },
      });
      await syncGoogleCalendarAccount(ctx.prisma, existing.id);
      await logAudit(ctx.prisma, {
        householdId: ctx.householdId,
        actorId: ctx.actor.id,
        action: "update",
        entityType: "calendarAccount",
        entityId: existing.id,
      });
      return { id: existing.id };
    }),
});
