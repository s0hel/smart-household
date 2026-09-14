import { TRPCError, initTRPC } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import { can, type Action, type Resource, type Role } from "@household/domain";
import type { Context } from "./context";

/**
 * Error codes our own handlers raise deliberately, with messages written to be
 * read by a household member ("Not enough points: have 12, need 50"). Anything
 * outside this set reached the client by accident — a Prisma failure, a null
 * dereference, a missing table — and its message is an internal detail.
 */
const USER_FACING_CODES = new Set([
  "BAD_REQUEST",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "PRECONDITION_FAILED",
  "TOO_MANY_REQUESTS",
]);

const GENERIC_ERROR_MESSAGE = "Something went wrong on our end. Please try again.";

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  /**
   * Stops internal failures from being rendered in the UI.
   *
   * tRPC passes the thrown error's own message through to the client by
   * default, so an unhandled Prisma error surfaces to whoever is looking at
   * the dashboard as e.g. "The table `public.VocabWord` does not exist in the
   * current database" — which is both meaningless to a family and a free
   * description of the schema to anyone else. Deliberate, human-written
   * errors still pass through untouched; everything else is replaced.
   *
   * Kept verbose in development, where the person reading it is the person
   * who can fix it. The real error is logged server-side either way (see the
   * route handler's onError).
   */
  errorFormatter({ shape, error }) {
    const deliberate = USER_FACING_CODES.has(shape.data.code) && !(error.cause instanceof ZodError);
    if (deliberate || process.env.NODE_ENV === "development") return shape;
    return { ...shape, message: GENERIC_ERROR_MESSAGE };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

/** Any authenticated household member (any role). */
export const householdProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.actor || !ctx.householdId || !ctx.timezone) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      ...ctx,
      actor: ctx.actor,
      householdId: ctx.householdId,
      timezone: ctx.timezone,
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
