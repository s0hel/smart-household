import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PROTECTED_PREFIXES, isProtectedPath } from "./routeProtection";

/** Top-level route segments of a route group, e.g. "dashboard", "rewards". */
function routeSegmentsIn(group: string): string[] {
  const dir = fileURLToPath(new URL(`./app/${group}`, import.meta.url));
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    // Route groups and dynamic/private segments aren't real URL prefixes.
    .filter((name) => !name.startsWith("(") && !name.startsWith("_") && !name.startsWith("["));
}

describe("route protection coverage", () => {
  // The list in routeProtection.ts is maintained by hand, and /rewards shipped
  // without an entry. Reading the real route directories means the next page
  // added to (web) fails this test until it is either protected or knowingly
  // listed as public below.
  const PUBLIC_BY_DESIGN = new Set<string>([]);

  it.each(routeSegmentsIn("(web)"))("/%s is behind the auth gate", (segment) => {
    if (PUBLIC_BY_DESIGN.has(segment)) return;
    expect(isProtectedPath(`/${segment}`)).toBe(true);
  });

  it("covers the mobile and kiosk surfaces", () => {
    expect(isProtectedPath("/m")).toBe(true);
    expect(isProtectedPath("/m/tasks")).toBe(true);
    expect(isProtectedPath("/display")).toBe(true);
  });

  it("leaves the auth pages public", () => {
    for (const segment of routeSegmentsIn("(auth)")) {
      expect(isProtectedPath(`/${segment}`)).toBe(false);
    }
    expect(isProtectedPath("/")).toBe(false);
  });
});

describe("isProtectedPath — prefix boundaries", () => {
  // Regression: matching with a bare `startsWith` meant the "/m" entry also
  // matched every path beginning with those characters. /meal-plan was
  // protected by accident rather than intent, and /mystery — which is not a
  // route at all — redirected to sign-in instead of returning 404.
  it("does not let a short prefix swallow unrelated paths", () => {
    expect(isProtectedPath("/mystery")).toBe(false);
    expect(isProtectedPath("/marketing")).toBe(false);
  });

  it("protects /meal-plan on its own entry, not as a side effect of /m", () => {
    expect(PROTECTED_PREFIXES).toContain("/meal-plan");
    expect(isProtectedPath("/meal-plan")).toBe(true);
    expect(isProtectedPath("/meal-plan/anything")).toBe(true);
  });

  it("protects /rewards, which previously had no entry at all", () => {
    expect(PROTECTED_PREFIXES).toContain("/rewards");
    expect(isProtectedPath("/rewards")).toBe(true);
  });

  it("matches a prefix exactly or at a path boundary", () => {
    expect(isProtectedPath("/tasks")).toBe(true);
    expect(isProtectedPath("/tasks/123")).toBe(true);
    expect(isProtectedPath("/tasksomething")).toBe(false);
  });

  it("treats the query string as outside its concern", () => {
    // The proxy passes `nextUrl.pathname`, which never includes a query.
    expect(isProtectedPath("/dashboard")).toBe(true);
  });
});
