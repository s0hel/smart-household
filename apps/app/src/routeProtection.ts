/**
 * Which URL prefixes require an authenticated session.
 *
 * Kept out of `proxy.ts` so it can be tested without pulling in Auth.js and
 * the Prisma client, which that module imports at runtime.
 *
 * This list has to be extended by hand every time a route group gains a page,
 * and twice it wasn't: `/rewards` and `/meal-plan` shipped unprotected and
 * served a page shell to logged-out visitors (harmless in itself — every tRPC
 * call behind it returns UNAUTHORIZED — but not the intent). The coverage test
 * in `routeProtection.test.ts` enumerates the real route directories and fails
 * if one is missing from here, so the next omission is caught before it ships.
 */
export const PROTECTED_PREFIXES = [
  "/dashboard",
  "/calendar",
  "/tasks",
  "/lists",
  "/meal-plan",
  "/rewards",
  "/family",
  "/word-of-the-day",
  "/m",
  "/display",
] as const;

/** True when `pathname` sits behind the authentication gate. */
export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
