import { TRPCError, initTRPC } from "@trpc/server";
import superjson from "superjson";
import { can, type Action, type Resource, type Role } from "@household/domain";
import type { Context } from "./context";

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

/** Any authenticated household member (any role). */
export const householdProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.actor || !ctx.householdId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      ...ctx,
      actor: ctx.actor,
      householdId: ctx.householdId,
    },
  });
});

/**
 * A household-scoped procedure additionally gated by the PRD §26 capability
 * table. Actions marked as ownership-scoped in `@household/domain` still
 * pass this gate (the role is allowed to attempt the action at all) — the
 * router handler is responsible for the per-record ownership check.
 */
export function capabilityProcedure(resource: Resource, action: Action) {
  return householdProcedure.use(({ ctx, next }) => {
    const role = ctx.actor.role as Role;
    if (!can(role, resource, action)) {
      throw new TRPCError({ code: "FORBIDDEN", message: `${role} cannot ${action} ${resource}` });
    }
    return next({ ctx });
  });
}
