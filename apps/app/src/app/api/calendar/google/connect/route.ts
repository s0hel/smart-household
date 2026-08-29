import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@household/db";
import { can, type Role } from "@household/domain";
import { auth } from "@/server/auth";
import { buildGoogleAuthUrl } from "@/server/integrations/googleCalendar";

const STATE_COOKIE = "google_calendar_oauth_state";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  const actor = await prisma.user.findUnique({ where: { id: session.user.activeProfileId } });
  if (!actor || actor.householdId !== session.user.householdId || !can(actor.role as Role, "calendarAccount", "create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const state = crypto.randomBytes(16).toString("hex");
  const redirectUri = new URL("/api/calendar/google/callback", request.url).toString();

  let authUrl: string;
  try {
    authUrl = buildGoogleAuthUrl(state, redirectUri);
  } catch {
    return NextResponse.json(
      { error: "Google Calendar isn't configured (missing GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET)." },
      { status: 500 },
    );
  }

  const response = NextResponse.redirect(authUrl);
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/",
  });
  return response;
}
