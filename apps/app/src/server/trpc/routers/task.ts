import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { isTaskDueOn, taskInputSchema } from "@household/domain";
import { router, capabilityProcedure } from "../trpc";
import { logAudit } from "../../audit";

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export const taskRouter = router({
  list: capabilityProcedure("task", "read").query(async ({ ctx }) => {
    const today = startOfDay(new Date());
    const tasks = await ctx.prisma.task.findMany({
      where: { householdId: ctx.householdId, active: true },
      include: {
        assignee: true,
        completions: { where: { occurrenceDate: today } },
      },
      orderBy: { createdAt: "asc" },
    });
    return tasks.map((task) => ({
      ...task,
      dueToday: isTaskDueOn(task.frequency, task.dueAt ?? task.createdAt, today),
    }));
  }),

  create: capabilityProcedure("task", "create")
    .input(taskInputSchema)
    .mutation(async ({ ctx, input }) => {
      const task = await ctx.prisma.task.create({
        data: { ...input, householdId: ctx.householdId },
      });
      await logAudit(ctx.prisma, {
        householdId: ctx.householdId,
        actorId: ctx.actor.id,
        action: "create",
        entityType: "task",
        entityId: task.id,
      });
      return task;
    }),

  update: capabilityProcedure("task", "update")
    .input(taskInputSchema.partial().extend({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input;
      await ctx.prisma.task.findFirstOrThrow({ where: { id, householdId: ctx.householdId } });
      const task = await ctx.prisma.task.update({ where: { id }, data: rest });
      await logAudit(ctx.prisma, {
        householdId: ctx.householdId,
        actorId: ctx.actor.id,
        action: "update",
        entityType: "task",
        entityId: task.id,
      });
      return task;
    }),

  delete: capabilityProcedure("task", "delete")
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.task.findFirstOrThrow({
        where: { id: input.id, householdId: ctx.householdId },
      });
      await ctx.prisma.task.delete({ where: { id: existing.id } });
      await logAudit(ctx.prisma, {
        householdId: ctx.householdId,
        actorId: ctx.actor.id,
        action: "delete",
        entityType: "task",
        entityId: existing.id,
      });
      return { id: existing.id };
    }),

  /** Marks (or un-marks) today's occurrence of a task done. A CHILD may only complete their own tasks. */
  setCompletion: capabilityProcedure("task", "complete")
    .input(z.object({ taskId: z.string(), completed: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const task = await ctx.prisma.task.findFirstOrThrow({
        where: { id: input.taskId, householdId: ctx.householdId },
      });

      if (ctx.actor.role === "CHILD" && task.assigneeId !== ctx.actor.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only complete your own tasks" });
      }

      const occurrenceDate = startOfDay(new Date());

      if (input.completed) {
        await ctx.prisma.choreCompletion.upsert({
          where: { taskId_occurrenceDate: { taskId: task.id, occurrenceDate } },
          create: {
            taskId: task.id,
            occurrenceDate,
            completedById: ctx.actor.id,
            pointsAwarded: task.points,
          },
          update: {},
        });
        await logAudit(ctx.prisma, {
          householdId: ctx.householdId,
          actorId: ctx.actor.id,
          action: "complete",
          entityType: "task",
          entityId: task.id,
        });
      } else {
        await ctx.prisma.choreCompletion.deleteMany({
          where: { taskId: task.id, occurrenceDate },
        });
      }

      return { taskId: task.id, completed: input.completed };
    }),
});
