import { z } from "zod";
import { rewardInputSchema } from "@household/domain";
import { router, capabilityProcedure } from "../trpc";
import { logAudit } from "../../audit";

export const rewardRouter = router({
  list: capabilityProcedure("reward", "read").query(({ ctx }) =>
    ctx.prisma.reward.findMany({
      where: { householdId: ctx.householdId, active: true },
      orderBy: { costPoints: "asc" },
    }),
  ),

  create: capabilityProcedure("reward", "create")
    .input(rewardInputSchema)
    .mutation(async ({ ctx, input }) => {
      const reward = await ctx.prisma.reward.create({ data: { ...input, householdId: ctx.householdId } });
      await logAudit(ctx.prisma, {
        householdId: ctx.householdId,
        actorId: ctx.actor.id,
        action: "create",
        entityType: "reward",
        entityId: reward.id,
      });
      return reward;
    }),

  update: capabilityProcedure("reward", "update")
    .input(rewardInputSchema.partial().extend({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input;
      await ctx.prisma.reward.findFirstOrThrow({ where: { id, householdId: ctx.householdId } });
      const reward = await ctx.prisma.reward.update({ where: { id }, data: rest });
      await logAudit(ctx.prisma, {
        householdId: ctx.householdId,
        actorId: ctx.actor.id,
        action: "update",
        entityType: "reward",
        entityId: reward.id,
      });
      return reward;
    }),

  delete: capabilityProcedure("reward", "delete")
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.reward.findFirstOrThrow({
        where: { id: input.id, householdId: ctx.householdId },
      });
      // Soft-delete: a hard delete would cascade-remove RewardRedemption
      // history, losing the audit trail of what a child already redeemed.
      await ctx.prisma.reward.update({ where: { id: existing.id }, data: { active: false } });
      await logAudit(ctx.prisma, {
        householdId: ctx.householdId,
        actorId: ctx.actor.id,
        action: "delete",
        entityType: "reward",
        entityId: existing.id,
      });
      return { id: existing.id };
    }),
});
