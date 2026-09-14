import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { isProtectedPath } from "./routeProtection";

export default auth((req) => {
  if (isProtectedPath(req.nextUrl.pathname) && !req.auth) {
    return NextResponse.redirect(new URL("/sign-in", req.nextUrl.origin));
  }
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
