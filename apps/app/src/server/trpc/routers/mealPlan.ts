import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { groceryListGenerateInputSchema, mealPlanEntryInputSchema } from "@household/domain";
import { router, capabilityProcedure } from "../trpc";
import { logAudit } from "../../audit";

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

export const mealPlanRouter = router({
  list: capabilityProcedure("mealPlanEntry", "read")
    .input(z.object({ from: z.coerce.date(), to: z.coerce.date() }))
    .query(({ ctx, input }) =>
      ctx.prisma.mealPlanEntry.findMany({
        where: { householdId: ctx.householdId, date: { gte: input.from, lte: input.to } },
        include: {
          recipe: { select: { id: true, name: true, imageUrl: true } },
          assignee: { select: { id: true, name: true, colorHex: true } },
        },
        orderBy: { date: "asc" },
      }),
    ),

  upsert: capabilityProcedure("mealPlanEntry", "create")
    .input(mealPlanEntryInputSchema)
    .mutation(async ({ ctx, input }) => {
      let { recipeId, customTitle } = input;

      // A custom-titled meal (no linked recipe) is saved as a bare recipe so
      // it shows up in the "Pick a recipe" list next time instead of having
      // to be retyped. Matches an existing recipe by name first so repeat
      // entries of the same title don't create duplicates.
      if (!recipeId && customTitle?.trim()) {
        const name = customTitle.trim();
        const existing = await ctx.prisma.recipe.findFirst({
          where: { householdId: ctx.householdId, name: { equals: name, mode: "insensitive" } },
        });
        const recipe =
          existing ??
          (await ctx.prisma.recipe.create({
            data: { householdId: ctx.householdId, name },
          }));
        recipeId = recipe.id;
        customTitle = null;
      }

      // Prisma's compound-unique `where` can't match a NULL assigneeId (the
      // "whole family" slot), so upsert manually instead of via the
      // householdId_date_mealType_assigneeId compound key.
      const assigneeId = input.assigneeId ?? null;
      const data = { ...input, recipeId, customTitle, assigneeId };
      const existing = await ctx.prisma.mealPlanEntry.findFirst({
        where: { householdId: ctx.householdId, date: input.date, mealType: input.mealType, assigneeId },
      });
      const include = {
        recipe: { select: { id: true, name: true, imageUrl: true } },
        assignee: { select: { id: true, name: true, colorHex: true } },
      } as const;
      const entry = existing
        ? await ctx.prisma.mealPlanEntry.update({ where: { id: existing.id }, data, include })
        : await ctx.prisma.mealPlanEntry.create({ data: { ...data, householdId: ctx.householdId }, include });
      await logAudit(ctx.prisma, {
        householdId: ctx.householdId,
        actorId: ctx.actor.id,
        action: "upsert",
        entityType: "mealPlanEntry",
        entityId: entry.id,
      });
      return entry;
    }),

  delete: capabilityProcedure("mealPlanEntry", "delete")
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.mealPlanEntry.findFirstOrThrow({
        where: { id: input.id, householdId: ctx.householdId },
      });
      await ctx.prisma.mealPlanEntry.delete({ where: { id: existing.id } });
      return { id: existing.id };
    }),

  /**
   * Builds a GROCERY list from every recipe planned in a date range,
   * combining duplicate ingredients (matched by lowercased/trimmed name) into
   * one line item. No unit conversion — quantities from different recipes are
   * just concatenated ("2 cups + 1 tbsp") for the shopper to reconcile.
   */
  generateGroceryList: capabilityProcedure("list", "create")
    .input(groceryListGenerateInputSchema)
    .mutation(async ({ ctx, input }) => {
      const entries = await ctx.prisma.mealPlanEntry.findMany({
        where: {
          householdId: ctx.householdId,
          date: { gte: input.from, lte: input.to },
          recipeId: { not: null },
        },
        include: { recipe: { include: { ingredients: true } } },
      });

      const merged = new Map<string, { quantities: string[]; category: string | null }>();
      for (const entry of entries) {
        for (const ingredient of entry.recipe?.ingredients ?? []) {
          const key = ingredient.name.trim().toLowerCase();
          if (!key) continue;
          const existing = merged.get(key);
          if (existing) {
            if (ingredient.quantity) existing.quantities.push(ingredient.quantity);
          } else {
            merged.set(key, {
              quantities: ingredient.quantity ? [ingredient.quantity] : [],
              category: ingredient.category ?? null,
            });
          }
        }
      }

      if (merged.size === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No recipes with ingredients are planned in that date range",
        });
      }

      const list = await ctx.prisma.list.create({
        data: {
          householdId: ctx.householdId,
          name:
            input.listName ??
            `Groceries ${input.from.toLocaleDateString()} - ${input.to.toLocaleDateString()}`,
          type: "GROCERY",
          items: {
            create: Array.from(merged.entries()).map(([key, value], order) => ({
              label: titleCase(key),
              quantity: value.quantities.length > 0 ? value.quantities.join(" + ") : null,
              category: value.category,
              order,
            })),
          },
        },
        include: { items: { orderBy: { order: "asc" } } },
      });

      await logAudit(ctx.prisma, {
        householdId: ctx.householdId,
        actorId: ctx.actor.id,
        action: "create",
        entityType: "list",
        entityId: list.id,
        metadata: { generatedFrom: "mealPlan", from: input.from.toISOString(), to: input.to.toISOString() },
      });

      return list;
    }),
});
