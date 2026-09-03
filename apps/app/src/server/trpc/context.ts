import { prisma } from "@household/db";
import { auth } from "../auth";

export async function createContext() {
  const session = await auth();

  if (!session?.user) {
    return { prisma, session: null, householdId: null, actor: null, timezone: null };
  }

  // Look up the *active profile* fresh from the DB on every request: after a
  // PIN-based profile switch the acting role can differ from the originally
  // signed-in user, and we don't want a stale JWT-cached role driving RBAC.
  const actor = await prisma.user.findUnique({
    where: { id: session.user.activeProfileId },
    include: { household: true },
  });

  if (!actor || actor.householdId !== session.user.householdId) {
    return { prisma, session, householdId: null, actor: null, timezone: null };
  }

  return { prisma, session, householdId: actor.householdId, actor, timezone: actor.household.timezone };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
