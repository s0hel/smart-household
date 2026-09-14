import { afterEach, describe, expect, it } from "vitest";
import { resolveWebhookUrl, WEBHOOK_PATH } from "./calendarWatch";

/**
 * Google will only deliver push notifications to a publicly reachable HTTPS
 * endpoint, and a watch channel outlives the deployment that opened it. So the
 * address we hand Google has to be a stable, public, HTTPS URL — and where it
 * isn't, the right answer is null (push stays off and the cron path syncs)
 * rather than an address that quietly never receives anything.
 */

const ENV_KEYS = ["GOOGLE_CALENDAR_WEBHOOK_URL", "AUTH_URL", "VERCEL_PROJECT_PRODUCTION_URL"] as const;

afterEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
});

describe("resolveWebhookUrl", () => {
  it("returns null when nothing is configured", () => {
    expect(resolveWebhookUrl()).toBeNull();
  });

  it("hangs the webhook path off a configured origin", () => {
    process.env.GOOGLE_CALENDAR_WEBHOOK_URL = "https://household.vercel.app";
    expect(resolveWebhookUrl()).toBe(`https://household.vercel.app${WEBHOOK_PATH}`);
  });

  it("accepts a value that already names the endpoint", () => {
    process.env.GOOGLE_CALENDAR_WEBHOOK_URL = `https://household.vercel.app${WEBHOOK_PATH}`;
    expect(resolveWebhookUrl()).toBe(`https://household.vercel.app${WEBHOOK_PATH}`);
  });

  it("replaces some other path rather than nesting the webhook under it", () => {
    process.env.GOOGLE_CALENDAR_WEBHOOK_URL = "https://household.vercel.app/some/base";
    expect(resolveWebhookUrl()).toBe(`https://household.vercel.app${WEBHOOK_PATH}`);
  });

  it("falls back to AUTH_URL, then to Vercel's production URL", () => {
    process.env.AUTH_URL = "https://auth-host.example.com";
    expect(resolveWebhookUrl()).toBe(`https://auth-host.example.com${WEBHOOK_PATH}`);

    delete process.env.AUTH_URL;
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "household.vercel.app";
    expect(resolveWebhookUrl()).toBe(`https://household.vercel.app${WEBHOOK_PATH}`);
  });

  it("prefers the explicit variable over the fallbacks", () => {
    process.env.GOOGLE_CALENDAR_WEBHOOK_URL = "https://explicit.example.com";
    process.env.AUTH_URL = "https://auth-host.example.com";
    expect(resolveWebhookUrl()).toBe(`https://explicit.example.com${WEBHOOK_PATH}`);
  });

  // Each of these would register a channel Google can never deliver to — and
  // since a dead channel reports no error, the failure would look exactly like
  // "nobody changed anything" for a week.
  it.each([
    ["plain HTTP", "http://household.example.com"],
    ["localhost", "https://localhost:3000"],
    ["loopback IP", "https://127.0.0.1:3000"],
    [".local hostname", "https://macbook.local:3000"],
    ["a value that isn't a URL", "not a url"],
    ["an empty value", "   "],
  ])("refuses %s", (_label, value) => {
    process.env.GOOGLE_CALENDAR_WEBHOOK_URL = value;
    expect(resolveWebhookUrl()).toBeNull();
  });
});
