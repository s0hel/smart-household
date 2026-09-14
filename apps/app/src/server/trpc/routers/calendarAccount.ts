import { z } from "zod";
import { router, capabilityProcedure } from "../trpc";
import { syncGoogleCalendarAccount } from "../../integrations/syncGoogleCalendar";
import { ensureWatchChannel, stopWatchChannelForAccount } from "../../integrations/calendarWatch";
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
        // Whether Google is pushing changes to us, and until when. The
        // channel *token* is deliberately never selected — it authenticates
        // inbound notifications and has no business reaching a browser.
        channelExpiresAt: true,
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
      // Close the channel first — once the row is gone so are the tokens
      // needed to stop it, and Google would keep pinging a webhook that can no
      // longer attribute the notification to anything.
      await stopWatchChannelForAccount(ctx.prisma, existing);
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
      // "Sync now" is also how a user fixes push that never got established
      // (connected before channels existed, or connected while the webhook URL
      // was unset). A healthy channel makes this a no-op.
      try {
        await ensureWatchChannel(ctx.prisma, existing.id);
      } catch (error) {
        console.error(`Failed to ensure Google Calendar push channel for account ${existing.id}`, error);
      }
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
