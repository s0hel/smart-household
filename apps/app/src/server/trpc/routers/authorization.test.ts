import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Role } from "@household/domain";
import { router } from "../trpc";
import type { Context } from "../context";
import { taskRouter } from "./task";
import { rewardRedemptionRouter } from "./rewardRedemption";

/**
 * Authorization tests for the two handlers that carry an ownership rule on top
 * of the capability table (`OWNERSHIP_SCOPED` in @household/domain): a CHILD
 * may only complete tasks assigned to them, and may only redeem rewards for
 * themselves. The capability gate alone lets both through, so these checks are
 * the only thing standing between a child and their sibling's chore points.
 *
 * These run the *real* middleware and the *real* handlers — nothing about the
 * authorization path is stubbed. Only Prisma is faked, which is what keeps
 * them fast and database-free. The routers import `@household/db` for types
 * only, so no client is ever constructed.
 */

const HOUSEHOLD = "household-1";
const CHILD_A = "child-a";
const CHILD_B = "child-b";
const PARENT = "parent-1";

const testRouter = router({ task: taskRouter, rewardRedemption: rewardRedemptionRouter });

interface FakeData {
  taskAssigneeId?: string | null;
  taskPoints?: number;
  rewardCost?: number;
  earnedPoints?: number;
}

/** Just enough Prisma for these two handlers, with spies on every write. */
function fakePrisma(data: FakeData = {}) {
  const {
    taskAssigneeId = CHILD_A,
    taskPoints = 5,
    rewardCost = 10,
    earnedPoints = 100,
  } = data;

  return {
    task: {
      findFirstOrThrow: vi.fn().mockResolvedValue({
        id: "task-1",
        householdId: HOUSEHOLD,
        assigneeId: taskAssigneeId,
        points: taskPoints,
      }),
    },
    choreCompletion: {
      upsert: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      groupBy: vi.fn().mockResolvedValue([{ completedById: CHILD_A, _sum: { pointsAwarded: earnedPoints } }]),
    },
    vocabReview: {
      groupBy: vi.fn().mockResolvedValue([]),
    },
    reward: {
      findFirstOrThrow: vi.fn().mockResolvedValue({
        id: "reward-1",
        householdId: HOUSEHOLD,
        costPoints: rewardCost,
        requiresApproval: true,
        active: true,
      }),
    },
    rewardRedemption: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: "redemption-1" }),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  };
}

function callerFor(role: Role, actorId: string, prisma = fakePrisma()) {
  const ctx = {
    prisma,
    session: null,
    householdId: HOUSEHOLD,
    actor: { id: actorId, role, householdId: HOUSEHOLD },
    timezone: "America/New_York",
  } as unknown as Context;
  return { caller: testRouter.createCaller(ctx), prisma };
}

/** Asserts the call was refused with the given tRPC code. */
async function expectRejection(promise: Promise<unknown>, code: TRPCError["code"]) {
  await expect(promise).rejects.toThrowError(TRPCError);
  await promise.catch((error: TRPCError) => expect(error.code).toBe(code));
}

describe("task.setCompletion — ownership", () => {
  let prisma: ReturnType<typeof fakePrisma>;
  beforeEach(() => {
    prisma = fakePrisma();
  });

  it("lets a child complete a task assigned to them", async () => {
    const { caller } = callerFor("CHILD", CHILD_A, prisma);
    await expect(caller.task.setCompletion({ taskId: "task-1", completed: true })).resolves.toEqual({
      taskId: "task-1",
      completed: true,
    });
    expect(prisma.choreCompletion.upsert).toHaveBeenCalledTimes(1);
  });

  it("refuses a child completing a task assigned to a sibling", async () => {
    const { caller } = callerFor("CHILD", CHILD_B, prisma);
    await expectRejection(caller.task.setCompletion({ taskId: "task-1", completed: true }), "FORBIDDEN");
  });

  // The check must fail *before* any write. A FORBIDDEN response that has
  // already banked the points is not a denial.
  it("writes nothing when it refuses", async () => {
    const { caller } = callerFor("CHILD", CHILD_B, prisma);
    await caller.task.setCompletion({ taskId: "task-1", completed: true }).catch(() => undefined);
    expect(prisma.choreCompletion.upsert).not.toHaveBeenCalled();
    expect(prisma.choreCompletion.deleteMany).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("refuses a child un-completing a sibling's task too", async () => {
    const { caller } = callerFor("CHILD", CHILD_B, prisma);
    await expectRejection(caller.task.setCompletion({ taskId: "task-1", completed: false }), "FORBIDDEN");
    expect(prisma.choreCompletion.deleteMany).not.toHaveBeenCalled();
  });

  it("refuses a child completing an unassigned task", async () => {
    const unassigned = fakePrisma({ taskAssigneeId: null });
    const { caller } = callerFor("CHILD", CHILD_A, unassigned);
    await expectRejection(caller.task.setCompletion({ taskId: "task-1", completed: true }), "FORBIDDEN");
  });

  it("lets a parent complete a child's task", async () => {
    const { caller } = callerFor("PARENT", PARENT, prisma);
    await expect(
      caller.task.setCompletion({ taskId: "task-1", completed: true }),
    ).resolves.toMatchObject({ completed: true });
  });

  // Regression: credit used to go to whoever clicked, so a parent ticking off
  // their child's chore earned the parent the points.
  it("credits the assignee, not whoever marked it done", async () => {
    const { caller } = callerFor("PARENT", PARENT, prisma);
    await caller.task.setCompletion({ taskId: "task-1", completed: true });
    expect(prisma.choreCompletion.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ completedById: CHILD_A }) }),
    );
  });

  it("falls back to the actor when nobody is assigned", async () => {
    const unassigned = fakePrisma({ taskAssigneeId: null });
    const { caller } = callerFor("PARENT", PARENT, unassigned);
    await caller.task.setCompletion({ taskId: "task-1", completed: true });
    expect(unassigned.choreCompletion.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ completedById: PARENT }) }),
    );
  });
});

describe("task.setCompletion — capability gate", () => {
  it.each(["READONLY", "GUEST"] as const)("refuses %s before the handler runs", async (role) => {
    const prisma = fakePrisma();
    const { caller } = callerFor(role, "viewer-1", prisma);
    await expectRejection(caller.task.setCompletion({ taskId: "task-1", completed: true }), "FORBIDDEN");
    // The middleware rejected it, so the handler never reached the database.
    expect(prisma.task.findFirstOrThrow).not.toHaveBeenCalled();
  });
});

describe("task.setCompletion — household scoping", () => {
  // Multi-tenancy is enforced by re-fetching the record scoped to the caller's
  // household, so a task id guessed from another household resolves to nothing.
  it("looks the task up scoped to the caller's household", async () => {
    const prisma = fakePrisma();
    const { caller } = callerFor("PARENT", PARENT, prisma);
    await caller.task.setCompletion({ taskId: "task-1", completed: true });
    expect(prisma.task.findFirstOrThrow).toHaveBeenCalledWith({
      where: { id: "task-1", householdId: HOUSEHOLD },
    });
  });
});

describe("rewardRedemption.create — ownership", () => {
  it("lets a child redeem for themselves", async () => {
    const prisma = fakePrisma();
    const { caller } = callerFor("CHILD", CHILD_A, prisma);
    await expect(caller.rewardRedemption.create({ rewardId: "reward-1" })).resolves.toBeDefined();
    expect(prisma.rewardRedemption.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: CHILD_A }) }),
    );
  });

  it("refuses a child redeeming on someone else's behalf", async () => {
    const prisma = fakePrisma();
    const { caller } = callerFor("CHILD", CHILD_A, prisma);
    await expectRejection(
      caller.rewardRedemption.create({ rewardId: "reward-1", userId: CHILD_B }),
      "FORBIDDEN",
    );
    expect(prisma.rewardRedemption.create).not.toHaveBeenCalled();
  });

  it("lets a parent redeem on a child's behalf", async () => {
    const prisma = fakePrisma();
    const { caller } = callerFor("PARENT", PARENT, prisma);
    await caller.rewardRedemption.create({ rewardId: "reward-1", userId: CHILD_A });
    expect(prisma.rewardRedemption.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: CHILD_A }) }),
    );
  });

  it("refuses a redemption the balance can't cover", async () => {
    const prisma = fakePrisma({ earnedPoints: 3, rewardCost: 50 });
    const { caller } = callerFor("CHILD", CHILD_A, prisma);
    await expectRejection(caller.rewardRedemption.create({ rewardId: "reward-1" }), "BAD_REQUEST");
    expect(prisma.rewardRedemption.create).not.toHaveBeenCalled();
  });

  it("counts vocabulary points toward the balance, not just chores", async () => {
    // Chores alone leave them short; the vocabulary points are what make the
    // redemption affordable. Guards the shared-wallet wiring in computeBalances.
    const prisma = fakePrisma({ earnedPoints: 6, rewardCost: 10 });
    prisma.vocabReview.groupBy.mockResolvedValue([{ userId: CHILD_A, _sum: { pointsAwarded: 8 } }]);
    const { caller } = callerFor("CHILD", CHILD_A, prisma);
    await expect(caller.rewardRedemption.create({ rewardId: "reward-1" })).resolves.toBeDefined();
  });
});

describe("rewardRedemption.create — capability gate", () => {
  it.each(["READONLY", "GUEST"] as const)("refuses %s before the handler runs", async (role) => {
    const prisma = fakePrisma();
    const { caller } = callerFor(role, "viewer-1", prisma);
    await expectRejection(caller.rewardRedemption.create({ rewardId: "reward-1" }), "FORBIDDEN");
    expect(prisma.reward.findFirstOrThrow).not.toHaveBeenCalled();
  });
});

describe("rewardRedemption.decide — approval gate", () => {
  it.each(["CHILD", "READONLY", "GUEST"] as const)("refuses %s", async (role) => {
    const prisma = fakePrisma();
    const { caller } = callerFor(role, "someone", prisma);
    await expectRejection(
      caller.rewardRedemption.decide({ id: "redemption-1", approve: true }),
      "FORBIDDEN",
    );
  });
});
