import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { hashPassword } from "@household/domain";
import { router, householdProcedure, publicProcedure } from "../trpc";

export const householdRouter = router({
  current: householdProcedure.query(async ({ ctx }) => {
    const household = await ctx.prisma.household.findUniqueOrThrow({
      where: { id: ctx.householdId },
      include: { users: { orderBy: { createdAt: "asc" } } },
    });
    return household;
  }),

  me: householdProcedure.query(({ ctx }) => ctx.actor),

  /** Creates a brand-new household with the signer as its first ADMIN. */
  signUp: publicProcedure
    .input(
      z.object({
        householdName: z.string().min(1).max(80),
        name: z.string().min(1).max(60),
        email: z.string().email(),
        password: z.string().min(8),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.user.findUnique({ where: { email: input.email } });
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "An account with that email already exists" });
      }

      const passwordHash = await hashPassword(input.password);
      const household = await ctx.prisma.household.create({
        data: {
          name: input.householdName,
          users: {
            create: {
              name: input.name,
              email: input.email,
              role: "ADMIN",
              passwordHash,
            },
          },
        },
      });
      return { householdId: household.id };
    }),
});
