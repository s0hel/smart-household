import type { Prisma, PrismaClient } from "@household/db";

export function logAudit(
  prisma: PrismaClient,
  params: {
    householdId: string;
    actorId: string | null;
    action: string;
    entityType: string;
    entityId: string;
    metadata?: Prisma.InputJsonValue;
  },
) {
  return prisma.auditLog.create({
    data: {
      householdId: params.householdId,
      actorId: params.actorId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      metadata: params.metadata ?? {},
    },
  });
}
