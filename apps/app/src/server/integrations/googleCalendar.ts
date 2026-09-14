const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const GOOGLE_CALENDAR_WATCH_URL = `${GOOGLE_CALENDAR_EVENTS_URL}/watch`;
const GOOGLE_CHANNELS_STOP_URL = "https://www.googleapis.com/calendar/v3/channels/stop";

// Read + write on the Events resource only (not full calendar settings) —
// needed for two-way write-back (see writebackGoogleCalendar.ts). Accounts
// connected before this scope changed are still on the old readonly grant
// until they reconnect ("Connect Google Calendar" again re-triggers consent).
const SCOPE = "https://www.googleapis.com/auth/calendar.events";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export function buildGoogleAuthUrl(state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: requireEnv("GOOGLE_CLIENT_ID"),
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    // Force the consent screen every time so Google always reissues a
    // refresh_token — without this, reconnecting an already-authorized
    // account silently omits it.
    prompt: "consent",
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

export async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<GoogleTokenResponse> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: requireEnv("GOOGLE_CLIENT_ID"),
      client_secret: requireEnv("GOOGLE_CLIENT_SECRET"),
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<GoogleTokenResponse>;
}

export async function refreshAccessToken(refreshToken: string): Promise<GoogleTokenResponse> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: requireEnv("GOOGLE_CLIENT_ID"),
      client_secret: requireEnv("GOOGLE_CLIENT_SECRET"),
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google token refresh failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<GoogleTokenResponse>;
}

export interface GoogleCalendarEvent {
  id: string;
  status?: string;
  summary?: string;
  location?: string;
  description?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
  // Stable across every attendee's own copy of the same event — unlike `id`,
  // which is per-account. This is what lets sync dedup the same real-world
  // event arriving via two different connected calendars.
  iCalUID?: string;
}

export interface GoogleCalendarEventInput {
  summary: string;
  location?: string | null;
  description?: string | null;
  start: { date?: string; dateTime?: string };
  end: { date?: string; dateTime?: string };
}

/**
 * Thrown when Google rejects a stored `syncToken` (HTTP 410). The token has
 * aged out and the caller must discard local sync state and do a full sync.
 */
export class SyncTokenExpiredError extends Error {
  constructor() {
    super("Google Calendar sync token expired");
    this.name = "SyncTokenExpiredError";
  }
}

export interface ListEventsResult {
  events: GoogleCalendarEvent[];
  /** Feed this back as `syncToken` on the next call to get only what changed. */
  nextSyncToken: string | null;
}

/**
 * Lists the primary calendar, either as a full sync from `timeMin` onward or —
 * when `syncToken` is given — as an incremental sync returning only what has
 * changed since that token was issued.
 *
 * `timeMin`/`timeMax` and `syncToken` are mutually exclusive by Google's rules:
 * the events.list reference forbids sending either (also q, orderBy,
 * updatedMin, …) alongside a syncToken, because the token already carries the
 * restrictions of the request that produced it. Callers therefore have to
 * re-baseline the window periodically — see `needsFullSync` in
 * syncGoogleCalendar.ts.
 *
 * `maxPages` is a backstop, not tuning. With `singleEvents=true` an unbounded
 * request expands never-ending recurring events into instances indefinitely,
 * and the resulting page walk will happily run until the serverless function
 * is killed — which reads as a hang, with nothing in the log to explain it.
 */
export async function fetchPrimaryCalendarEvents(
  accessToken: string,
  options: { timeMin?: Date; timeMax?: Date; syncToken?: string; maxPages?: number },
): Promise<ListEventsResult> {
  const events: GoogleCalendarEvent[] = [];
  const maxPages = options.maxPages ?? 40;
  let pages = 0;
  let pageToken: string | undefined;
  let nextSyncToken: string | null = null;

  do {
    const params = new URLSearchParams({ singleEvents: "true", maxResults: "250" });
    if (options.syncToken) {
      params.set("syncToken", options.syncToken);
    } else {
      if (options.timeMin) params.set("timeMin", options.timeMin.toISOString());
      if (options.timeMax) params.set("timeMax", options.timeMax.toISOString());
    }
    if (pageToken) params.set("pageToken", pageToken);

    const res = await fetch(`${GOOGLE_CALENDAR_EVENTS_URL}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.status === 410) throw new SyncTokenExpiredError();
    if (!res.ok) throw new Error(`Google Calendar list failed: ${res.status} ${await res.text()}`);

    const body = (await res.json()) as {
      items?: GoogleCalendarEvent[];
      nextPageToken?: string;
      nextSyncToken?: string;
    };
    events.push(...(body.items ?? []));
    pageToken = body.nextPageToken;
    // Only the final page carries a sync token.
    nextSyncToken = body.nextSyncToken ?? null;

    if (++pages >= maxPages && pageToken) {
      throw new Error(
        `Google Calendar list exceeded ${maxPages} pages (${events.length} events) — refusing to keep paginating`,
      );
    }
  } while (pageToken);

  return { events, nextSyncToken };
}

export interface WatchChannelResult {
  resourceId: string;
  /** Unix ms. Google caps the lifetime regardless of the TTL we ask for. */
  expiration: Date;
}

/**
 * Opens a push-notification channel on the primary calendar. Google then POSTs
 * a bodiless ping to `address` whenever anything on that calendar changes.
 *
 * `token` is echoed back in the `X-Goog-Channel-Token` header — it is the only
 * thing that authenticates the notification, since the endpoint itself has to
 * be publicly reachable for Google to call it.
 */
export async function watchPrimaryCalendar(
  accessToken: string,
  params: { channelId: string; address: string; token: string; ttlSeconds: number },
): Promise<WatchChannelResult> {
  const res = await fetch(GOOGLE_CALENDAR_WATCH_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      id: params.channelId,
      type: "web_hook",
      address: params.address,
      token: params.token,
      params: { ttl: String(params.ttlSeconds) },
    }),
  });
  if (!res.ok) throw new Error(`Google Calendar watch failed: ${res.status} ${await res.text()}`);

  const body = (await res.json()) as { resourceId?: string; expiration?: string };
  if (!body.resourceId) throw new Error("Google Calendar watch returned no resourceId");
  return {
    resourceId: body.resourceId,
    expiration: body.expiration
      ? new Date(Number(body.expiration))
      : new Date(Date.now() + params.ttlSeconds * 1000),
  };
}

/** Closes a push channel. 404/410 means Google already dropped it. */
export async function stopWatchChannel(
  accessToken: string,
  channelId: string,
  resourceId: string,
): Promise<void> {
  const res = await fetch(GOOGLE_CHANNELS_STOP_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ id: channelId, resourceId }),
  });
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`Google Calendar channel stop failed: ${res.status} ${await res.text()}`);
  }
}

export async function createGoogleCalendarEvent(
  accessToken: string,
  input: GoogleCalendarEventInput,
): Promise<GoogleCalendarEvent> {
  const res = await fetch(GOOGLE_CALENDAR_EVENTS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Google Calendar create failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<GoogleCalendarEvent>;
}

export async function updateGoogleCalendarEvent(
  accessToken: string,
  googleEventId: string,
  input: GoogleCalendarEventInput,
): Promise<GoogleCalendarEvent> {
  const res = await fetch(`${GOOGLE_CALENDAR_EVENTS_URL}/${encodeURIComponent(googleEventId)}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Google Calendar update failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<GoogleCalendarEvent>;
}

export async function deleteGoogleCalendarEvent(accessToken: string, googleEventId: string): Promise<void> {
  const res = await fetch(`${GOOGLE_CALENDAR_EVENTS_URL}/${encodeURIComponent(googleEventId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  // 404/410 means it's already gone on Google's side — fine, nothing to retract.
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`Google Calendar delete failed: ${res.status} ${await res.text()}`);
  }
}
