import { describe, expect, it } from "vitest";
import {
  can,
  OWNERSHIP_SCOPED,
  requiresOwnershipCheck,
  type Action,
  type Resource,
  type Role,
} from "./rbac";

const ROLES: Role[] = ["ADMIN", "PARENT", "CHILD", "GUEST", "READONLY"];

const RESOURCES: Resource[] = [
  "household",
  "familyMember",
  "device",
  "calendarAccount",
  "event",
  "task",
  "reward",
  "rewardRedemption",
  "list",
  "listItem",
  "recipe",
  "mealPlanEntry",
  "vocabWord",
];

const ACTIONS: Action[] = ["create", "read", "update", "delete", "complete", "approve"];
const MUTATING: Action[] = ACTIONS.filter((a) => a !== "read");

/** Every (resource, action) pair a role is granted, as "resource:action". */
function grantsFor(role: Role): string[] {
  const out: string[] = [];
  for (const resource of RESOURCES) {
    for (const action of ACTIONS) {
      if (can(role, resource, action)) out.push(`${resource}:${action}`);
    }
  }
  return out.sort();
}

describe("can — read-only roles", () => {
  // The single property that makes GUEST and READONLY safe to hand out. A
  // regression here is a privilege escalation, not a cosmetic bug.
  it.each(["GUEST", "READONLY"] as const)("%s cannot mutate anything, anywhere", (role) => {
    for (const resource of RESOURCES) {
      for (const action of MUTATING) {
        expect({ role, resource, action, allowed: can(role, resource, action) }).toEqual({
          role,
          resource,
          action,
          allowed: false,
        });
      }
    }
  });

  it("GUEST sees strictly less than READONLY", () => {
    const guest = new Set(grantsFor("GUEST"));
    const readonly = new Set(grantsFor("READONLY"));
    for (const grant of guest) expect(readonly.has(grant)).toBe(true);
    expect(readonly.size).toBeGreaterThan(guest.size);
  });
});

describe("can — CHILD", () => {
  it("can never approve anything", () => {
    for (const resource of RESOURCES) {
      expect(can("CHILD", resource, "approve")).toBe(false);
    }
  });

  it("can never delete anything", () => {
    for (const resource of RESOURCES) {
      expect(can("CHILD", resource, "delete")).toBe(false);
    }
  });

  // Deliberately a change-detector. A child's write surface is exactly three
  // things, and widening it should be a conscious edit to this list rather
  // than a side effect of adding a row to the capability table.
  it("has exactly this write surface and no more", () => {
    const writes = grantsFor("CHILD").filter((grant) => !grant.endsWith(":read"));
    expect(writes).toEqual([
      "listItem:update",
      "rewardRedemption:create",
      "task:complete",
      "vocabWord:complete",
      "vocabWord:create",
    ]);
  });

  it("can do the things the product actually depends on", () => {
    expect(can("CHILD", "task", "complete")).toBe(true);
    expect(can("CHILD", "reward", "read")).toBe(true);
    expect(can("CHILD", "rewardRedemption", "create")).toBe(true);
    expect(can("CHILD", "vocabWord", "create")).toBe(true);
  });

  it("cannot manage the household or its members", () => {
    for (const action of MUTATING) {
      expect(can("CHILD", "household", action)).toBe(false);
      expect(can("CHILD", "familyMember", action)).toBe(false);
    }
  });

  it("cannot author or edit tasks, events, or rewards", () => {
    for (const resource of ["task", "event", "reward"] as const) {
      expect(can("CHILD", resource, "create")).toBe(false);
      expect(can("CHILD", resource, "update")).toBe(false);
    }
  });
});

describe("can — role hierarchy", () => {
  it("ADMIN can do everything PARENT can", () => {
    const admin = new Set(grantsFor("ADMIN"));
    for (const grant of grantsFor("PARENT")) {
      expect({ grant, adminHasIt: admin.has(grant) }).toEqual({ grant, adminHasIt: true });
    }
  });

  it("reserves household management for ADMIN alone", () => {
    // `complete`/`approve` are meaningless on a household and granted to
    // nobody, so the CRUD verbs are the whole of "management" here.
    for (const action of ["create", "update", "delete"] as const) {
      expect(can("ADMIN", "household", action)).toBe(true);
      for (const role of ROLES.filter((r) => r !== "ADMIN")) {
        expect(can(role, "household", action)).toBe(false);
      }
    }
  });

  it("grants no role a meaningless action on the household", () => {
    for (const role of ROLES) {
      expect(can(role, "household", "complete")).toBe(false);
      expect(can(role, "household", "approve")).toBe(false);
    }
  });

  it("lets only ADMIN and PARENT approve redemptions", () => {
    for (const role of ROLES) {
      expect(can(role, "rewardRedemption", "approve")).toBe(role === "ADMIN" || role === "PARENT");
    }
  });

  it("gives every role at least read access to its own household", () => {
    for (const role of ROLES) expect(can(role, "household", "read")).toBe(true);
  });
});

describe("can — unknown input", () => {
  // ctx.actor.role is a string from the database cast to Role, so a value
  // outside the union can reach here at runtime. It must deny, not throw.
  it("denies a role that isn't in the table", () => {
    expect(can("SUPERUSER" as Role, "household", "read")).toBe(false);
    expect(can("" as Role, "task", "complete")).toBe(false);
  });

  it("denies a resource that isn't in the table", () => {
    expect(can("ADMIN", "nuclearLaunch" as Resource, "create")).toBe(false);
  });

  it("denies an action that isn't granted", () => {
    expect(can("ADMIN", "rewardRedemption", "update" as Action)).toBe(false);
  });
});

describe("requiresOwnershipCheck", () => {
  it("flags exactly the pairs the routers are expected to guard", () => {
    const flagged: string[] = [];
    for (const resource of RESOURCES) {
      for (const action of ACTIONS) {
        if (requiresOwnershipCheck(resource, action)) flagged.push(`${resource}:${action}`);
      }
    }
    expect(flagged.sort()).toEqual(["rewardRedemption:create", "task:complete"]);
  });

  it("returns false for pairs that carry no ownership rule", () => {
    expect(requiresOwnershipCheck("task", "read")).toBe(false);
    expect(requiresOwnershipCheck("event", "delete")).toBe(false);
    expect(requiresOwnershipCheck("vocabWord", "complete")).toBe(false);
  });

  // An ownership check only runs after the capability gate lets the request
  // through. If a pair is ownership-scoped but no restricted role is granted
  // it, the check in the router is unreachable — the table and the guard have
  // drifted apart and one of them is lying.
  it("only scopes pairs that a restricted role can actually reach", () => {
    for (const [resource, actions] of Object.entries(OWNERSHIP_SCOPED)) {
      for (const action of actions ?? []) {
        expect({
          pair: `${resource}:${action}`,
          reachableByChild: can("CHILD", resource as Resource, action),
        }).toEqual({ pair: `${resource}:${action}`, reachableByChild: true });
      }
    }
  });
});
