import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { requiresOwnershipCheck } from "@household/domain";
import { router, capabilityProcedure } from "../trpc";
import { logAudit } from "../../audit";
import type { Context } from "../context";

/** Points earned (from completed chores) minus points spent (on approved redemptions), per user. */
async function computeBalances(prisma: Context["prisma"], householdId: string): Promise<Map<string, number>> {
  const earned = await prisma.choreCompletion.groupBy({
    by: ["completedById"],
    where: { task: { householdId } },
    _sum: { pointsAwarded: true },
  });
  const approvedRedemptions = await prisma.rewardRedemption.findMany({
    where: { status: "APPROVED", reward: { householdId } },
    select: { userId: true, reward: { select: { costPoints: true } } },
  });

  const balances = new Map<string, number>();
  for (const row of earned) {
    balances.set(row.completedById, row._sum.pointsAwarded ?? 0);
  }
  for (const redemption of approvedRedemptions) {
    balances.set(redemption.userId, (balances.get(redemption.userId) ?? 0) - redemption.reward.costPoints);
  }
  return balances;
}

export const rewardRedemptionRouter = router({
  list: capabilityProcedure("rewardRedemption", "read").query(({ ctx }) =>
    ctx.prisma.rewardRedemption.findMany({
      where: { reward: { householdId: ctx.householdId } },
      include: { reward: true, user: true },
      orderBy: { requestedAt: "desc" },
    }),
  ),

  /** Current points balance for every household member (earned minus spent on approved redemptions). */
  balances: capabilityProcedure("reward", "read").query(async ({ ctx }) => {
    const balances = await computeBalances(ctx.prisma, ctx.householdId);
    return Array.from(balances.entries()).map(([userId, balance]) => ({ userId, balance }));
  }),

  create: capabilityProcedure("rewardRedemption", "create")
    .input(z.object({ rewardId: z.string(), userId: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      // A CHILD can only redeem for themselves; ADMIN/PARENT may redeem on
      // behalf of a household member (e.g. a child too young to use the app).
      const targetUserId = input.userId ?? ctx.actor.id;
      if (requiresOwnershipCheck("rewardRedemption", "create") && ctx.actor.role === "CHILD" && targetUserId !== ctx.actor.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only redeem rewards for yourself" });
      }

      const reward = await ctx.prisma.reward.findFirstOrThrow({
        where: { id: input.rewardId, householdId: ctx.householdId, active: true },
      });

      const balances = await computeBalances(ctx.prisma, ctx.householdId);
      const balance = balances.get(targetUserId) ?? 0;
      if (balance < reward.costPoints) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Not enough points: have ${balance}, need ${reward.costPoints}`,
        });
      }

      const redemption = await ctx.prisma.rewardRedemption.create({
        data: {
          rewardId: reward.id,
          userId: targetUserId,
          status: reward.requiresApproval ? "PENDING" : "APPROVED",
          decidedAt: reward.requiresApproval ? null : new Date(),
          decidedById: reward.requiresApproval ? null : ctx.actor.id,
        },
        include: { reward: true, user: true },
      });
      await logAudit(ctx.prisma, {
        householdId: ctx.householdId,
        actorId: ctx.actor.id,
        action: "create",
        entityType: "rewardRedemption",
        entityId: redemption.id,
      });
      return redemption;
    }),

  /** ADMIN/PARENT approves or denies a pending redemption request. */
  decide: capabilityProcedure("rewardRedemption", "approve")
    .input(z.object({ id: z.string(), approve: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.rewardRedemption.findFirstOrThrow({
        where: { id: input.id, reward: { householdId: ctx.householdId } },
      });
      if (existing.status !== "PENDING") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This request has already been decided" });
      }

      const redemption = await ctx.prisma.rewardRedemption.update({
        where: { id: existing.id },
        data: {
          status: input.approve ? "APPROVED" : "DENIED",
          decidedAt: new Date(),
          decidedById: ctx.actor.id,
        },
        include: { reward: true, user: true },
      });
      await logAudit(ctx.prisma, {
        householdId: ctx.householdId,
        actorId: ctx.actor.id,
        action: input.approve ? "approve" : "deny",
        entityType: "rewardRedemption",
        entityId: redemption.id,
      });
      return redemption;
    }),
});
