import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@household/db";
import { can, type Role } from "@household/domain";
import { auth } from "@/server/auth";
import { encryptToken } from "@/server/integrations/tokenCrypto";
import { exchangeCodeForTokens } from "@/server/integrations/googleCalendar";
import { syncGoogleCalendarAccount } from "@/server/integrations/syncGoogleCalendar";
import { logAudit } from "@/server/audit";

const STATE_COOKIE = "google_calendar_oauth_state";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;

  function redirectTo(status: "connected" | "error", message?: string) {
    const target = new URL("/family", url.origin);
    target.searchParams.set("calendar", status);
    if (message) target.searchParams.set("calendarError", message);
    const response = NextResponse.redirect(target);
    response.cookies.delete(STATE_COOKIE);
    return response;
  }

  const oauthError = url.searchParams.get("error");
  if (oauthError) return redirectTo("error", oauthError);

  const session = await auth();
  if (!session?.user) return NextResponse.redirect(new URL("/sign-in", url));

  const actor = await prisma.user.findUnique({ where: { id: session.user.activeProfileId } });
  if (!actor || actor.householdId !== session.user.householdId || !can(actor.role as Role, "calendarAccount", "create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = request.cookies.get(STATE_COOKIE)?.value;
  if (!code || !state || !cookieState || state !== cookieState) {
    return redirectTo("error", "invalid_state");
  }

  const redirectUri = new URL("/api/calendar/google/callback", url).toString();

  let tokens;
  try {
    tokens = await exchangeCodeForTokens(code, redirectUri);
  } catch {
    return redirectTo("error", "token_exchange_failed");
  }

  if (!tokens.refresh_token) {
    // Google only issues a refresh_token on first consent — prompt=consent
    // (set in buildGoogleAuthUrl) should always trigger that, so this
    // signals something unexpected with the Google app config.
    return redirectTo("error", "missing_refresh_token");
  }

  let account;
  try {
    account = await prisma.calendarAccount.upsert({
      where: {
        householdId_ownerId_provider: { householdId: actor.householdId, ownerId: actor.id, provider: "GOOGLE" },
      },
      create: {
        householdId: actor.householdId,
        ownerId: actor.id,
        provider: "GOOGLE",
        accessToken: encryptToken(tokens.access_token),
        refreshToken: encryptToken(tokens.refresh_token),
        status: "connected",
      },
      update: {
        accessToken: encryptToken(tokens.access_token),
        refreshToken: encryptToken(tokens.refresh_token),
        status: "connected",
      },
    });
  } catch {
    return redirectTo("error", "storage_failed");
  }

  await logAudit(prisma, {
    householdId: actor.householdId,
    actorId: actor.id,
    action: "create",
    entityType: "calendarAccount",
    entityId: account.id,
  });

  try {
    await syncGoogleCalendarAccount(prisma, account.id);
  } catch {
    // Initial sync failing shouldn't block the connect flow itself — the
    // account is saved and a manual "Sync now" is available in the UI.
  }

  return redirectTo("connected");
}
