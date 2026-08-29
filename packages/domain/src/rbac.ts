export type Role = "ADMIN" | "PARENT" | "CHILD" | "GUEST" | "READONLY";

export type Resource =
  | "household"
  | "familyMember"
  | "device"
  | "event"
  | "task"
  | "reward"
  | "rewardRedemption"
  | "list"
  | "listItem";

export type Action = "create" | "read" | "update" | "delete" | "complete" | "approve";

/**
 * Coarse-grained role -> resource -> allowed actions, per PRD §26.
 * This is the first gate. Some actions additionally require an ownership
 * check performed by the caller (e.g. a CHILD may only `complete` tasks
 * assigned to themselves) — see `requiresOwnershipCheck`.
 */
const CAPABILITIES: Record<Role, Partial<Record<Resource, Action[]>>> = {
  ADMIN: {
    household: ["create", "read", "update", "delete"],
    familyMember: ["create", "read", "update", "delete"],
    device: ["create", "read", "update", "delete"],
    event: ["create", "read", "update", "delete"],
    task: ["create", "read", "update", "delete", "approve", "complete"],
    reward: ["create", "read", "update", "delete"],
    rewardRedemption: ["create", "read", "approve"],
    list: ["create", "read", "update", "delete"],
    listItem: ["create", "read", "update", "delete"],
  },
  PARENT: {
    household: ["read"],
    familyMember: ["create", "read", "update"],
    device: ["read", "update"],
    event: ["create", "read", "update", "delete"],
    task: ["create", "read", "update", "delete", "approve", "complete"],
    reward: ["create", "read", "update", "delete"],
    rewardRedemption: ["create", "read", "approve"],
    list: ["create", "read", "update", "delete"],
    listItem: ["create", "read", "update", "delete"],
  },
  CHILD: {
    household: ["read"],
    familyMember: ["read"],
    event: ["read"],
    task: ["read", "complete"],
    reward: ["read"],
    rewardRedemption: ["create", "read"],
    list: ["read"],
    listItem: ["read", "update"],
  },
  GUEST: {
    household: ["read"],
    event: ["read"],
  },
  READONLY: {
    household: ["read"],
    event: ["read"],
    task: ["read"],
    list: ["read"],
  },
};

/**
 * Actions where the role table alone isn't enough — the caller must also
 * confirm the acting user owns/is the target of the record (e.g. a CHILD
 * completing a task must be the task's assignee; a CHILD updating a list
 * item may only toggle `checked`, not reassign it).
 */
export const OWNERSHIP_SCOPED: Partial<Record<Resource, Action[]>> = {
  task: ["complete"],
  rewardRedemption: ["create"],
};

export function can(role: Role, resource: Resource, action: Action): boolean {
  return CAPABILITIES[role]?.[resource]?.includes(action) ?? false;
}

export function requiresOwnershipCheck(resource: Resource, action: Action): boolean {
  return OWNERSHIP_SCOPED[resource]?.includes(action) ?? false;
}
