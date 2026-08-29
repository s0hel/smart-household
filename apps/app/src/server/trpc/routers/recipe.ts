import { z } from "zod";
import { recipeInputSchema } from "@household/domain";
import { router, capabilityProcedure } from "../trpc";
import { logAudit } from "../../audit";

const RECIPE_INCLUDE = { ingredients: { orderBy: { order: "asc" as const } } };

export const recipeRouter = router({
  list: capabilityProcedure("recipe", "read").query(({ ctx }) =>
    ctx.prisma.recipe.findMany({
      where: { householdId: ctx.householdId },
      include: RECIPE_INCLUDE,
      orderBy: { name: "asc" },
    }),
  ),

  create: capabilityProcedure("recipe", "create")
    .input(recipeInputSchema)
    .mutation(async ({ ctx, input }) => {
      const { ingredients, ...rest } = input;
      const recipe = await ctx.prisma.recipe.create({
        data: {
          ...rest,
          householdId: ctx.householdId,
          ingredients: { create: ingredients.map((ing, order) => ({ ...ing, order })) },
        },
        include: RECIPE_INCLUDE,
      });
      await logAudit(ctx.prisma, {
        householdId: ctx.householdId,
        actorId: ctx.actor.id,
        action: "create",
        entityType: "recipe",
        entityId: recipe.id,
      });
      return recipe;
    }),

  update: capabilityProcedure("recipe", "update")
    .input(recipeInputSchema.partial().extend({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ingredients, ...rest } = input;
      await ctx.prisma.recipe.findFirstOrThrow({ where: { id, householdId: ctx.householdId } });

      const recipe = await ctx.prisma.$transaction(async (tx) => {
        if (ingredients) {
          await tx.recipeIngredient.deleteMany({ where: { recipeId: id } });
          await tx.recipeIngredient.createMany({
            data: ingredients.map((ing, order) => ({ ...ing, recipeId: id, order })),
          });
        }
        return tx.recipe.update({ where: { id }, data: rest, include: RECIPE_INCLUDE });
      });

      await logAudit(ctx.prisma, {
        householdId: ctx.householdId,
        actorId: ctx.actor.id,
        action: "update",
        entityType: "recipe",
        entityId: recipe.id,
      });
      return recipe;
    }),

  delete: capabilityProcedure("recipe", "delete")
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.recipe.findFirstOrThrow({
        where: { id: input.id, householdId: ctx.householdId },
      });
      await ctx.prisma.recipe.delete({ where: { id: existing.id } });
      await logAudit(ctx.prisma, {
        householdId: ctx.householdId,
        actorId: ctx.actor.id,
        action: "delete",
        entityType: "recipe",
        entityId: existing.id,
      });
      return { id: existing.id };
    }),
});
