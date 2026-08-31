import { NextResponse } from "next/server";
import { auth } from "@/server/auth";

const PROTECTED_PREFIXES = ["/dashboard", "/calendar", "/tasks", "/lists", "/family", "/m", "/display"];

export default auth((req) => {
  const isProtected = PROTECTED_PREFIXES.some((prefix) => req.nextUrl.pathname.startsWith(prefix));
  if (isProtected && !req.auth) {
    return NextResponse.redirect(new URL("/sign-in", req.nextUrl.origin));
  }
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
