import { z } from "zod";
import { listInputSchema, listItemInputSchema } from "@household/domain";
import { router, capabilityProcedure } from "../trpc";
import { logAudit } from "../../audit";

export const listRouter = router({
  list: capabilityProcedure("list", "read").query(({ ctx }) =>
    ctx.prisma.list.findMany({
      where: { householdId: ctx.householdId },
      include: { items: { orderBy: { order: "asc" } } },
      orderBy: { createdAt: "asc" },
    }),
  ),

  create: capabilityProcedure("list", "create")
    .input(listInputSchema)
    .mutation(async ({ ctx, input }) => {
      const list = await ctx.prisma.list.create({ data: { ...input, householdId: ctx.householdId } });
      await logAudit(ctx.prisma, {
        householdId: ctx.householdId,
        actorId: ctx.actor.id,
        action: "create",
        entityType: "list",
        entityId: list.id,
      });
      return list;
    }),

  delete: capabilityProcedure("list", "delete")
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.list.findFirstOrThrow({ where: { id: input.id, householdId: ctx.householdId } });
      await ctx.prisma.list.delete({ where: { id: input.id } });
      return { id: input.id };
    }),

  addItem: capabilityProcedure("listItem", "create")
    .input(listItemInputSchema.extend({ listId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { listId, ...rest } = input;
      await ctx.prisma.list.findFirstOrThrow({ where: { id: listId, householdId: ctx.householdId } });
      const count = await ctx.prisma.listItem.count({ where: { listId } });
      return ctx.prisma.listItem.create({ data: { ...rest, listId, order: count } });
    }),

  toggleItem: capabilityProcedure("listItem", "update")
    .input(z.object({ id: z.string(), checked: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.prisma.listItem.findFirstOrThrow({
        where: { id: input.id, list: { householdId: ctx.householdId } },
      });
      return ctx.prisma.listItem.update({ where: { id: item.id }, data: { checked: input.checked } });
    }),

  deleteItem: capabilityProcedure("listItem", "delete")
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.prisma.listItem.findFirstOrThrow({
        where: { id: input.id, list: { householdId: ctx.householdId } },
      });
      await ctx.prisma.listItem.delete({ where: { id: item.id } });
      return { id: item.id };
    }),
});
