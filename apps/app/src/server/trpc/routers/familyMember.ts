import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { familyMemberInputSchema, hashPassword, hashPin, verifyPin } from "@household/domain";
import { router, householdProcedure, capabilityProcedure } from "../trpc";
import { logAudit } from "../../audit";

export const familyMemberRouter = router({
  list: capabilityProcedure("familyMember", "read").query(({ ctx }) =>
    ctx.prisma.user.findMany({ where: { householdId: ctx.householdId }, orderBy: { createdAt: "asc" } }),
  ),

  create: capabilityProcedure("familyMember", "create")
    .input(familyMemberInputSchema)
    .mutation(async ({ ctx, input }) => {
      const member = await ctx.prisma.user.create({
        data: {
          householdId: ctx.householdId,
          name: input.name,
          role: input.role,
          colorHex: input.colorHex,
          avatarUrl: input.avatarUrl,
          email: input.email,
          birthdate: input.birthdate,
          passwordHash: input.password ? await hashPassword(input.password) : null,
          pinHash: input.pin ? await hashPin(input.pin) : null,
        },
      });
      await logAudit(ctx.prisma, {
        householdId: ctx.householdId,
        actorId: ctx.actor.id,
        action: "create",
        entityType: "familyMember",
        entityId: member.id,
      });
      return member;
    }),

  update: capabilityProcedure("familyMember", "update")
    .input(familyMemberInputSchema.partial().extend({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { id, password, pin, ...rest } = input;
      const existing = await ctx.prisma.user.findFirstOrThrow({ where: { id, householdId: ctx.householdId } });

      const member = await ctx.prisma.user.update({
        where: { id: existing.id },
        data: {
          ...rest,
          passwordHash: password ? await hashPassword(password) : undefined,
          pinHash: pin ? await hashPin(pin) : undefined,
        },
      });
      await logAudit(ctx.prisma, {
        householdId: ctx.householdId,
        actorId: ctx.actor.id,
        action: "update",
        entityType: "familyMember",
        entityId: member.id,
      });
      return member;
    }),

  delete: capabilityProcedure("familyMember", "delete")
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.user.findFirstOrThrow({
        where: { id: input.id, householdId: ctx.householdId },
      });
      await ctx.prisma.user.delete({ where: { id: existing.id } });
      await logAudit(ctx.prisma, {
        householdId: ctx.householdId,
        actorId: ctx.actor.id,
        action: "delete",
        entityType: "familyMember",
        entityId: existing.id,
      });
      return { id: existing.id };
    }),

  /**
   * Profile-switch on a shared device. Only ever targets a CHILD profile —
   * switching to a PARENT/ADMIN account requires signing out and back in
   * with their password, which is the intentionally stronger path.
   */
  verifyPin: householdProcedure
    .input(z.object({ userId: z.string(), pin: z.string().regex(/^\d{4}$/) }))
    .mutation(async ({ ctx, input }) => {
      const target = await ctx.prisma.user.findFirst({
        where: { id: input.userId, householdId: ctx.householdId, role: "CHILD" },
      });
      if (!target?.pinHash) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No child profile with that id" });
      }
      const valid = await verifyPin(input.pin, target.pinHash);
      if (!valid) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Incorrect PIN" });
      }
      return { id: target.id };
    }),
});
