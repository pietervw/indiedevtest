/**
 * Optional Pushover ops alerts. Missing config / API errors never throw.
 * Env: PUSHOVER_API_TOKEN + PUSHOVER_USER_KEY (both required to enable).
 */

import { siteConfig } from "@/lib/site";

const PUSHOVER_URL = "https://api.pushover.net/1/messages.json";
const TIMEOUT_MS = 5_000;

/** Mask email for push payloads: customer@example.com → c*******@example.com */
function sanitizeEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "****";
  const maskedLocal =
    local.length > 1
      ? local[0] + "*".repeat(Math.min(local.length - 1, 7))
      : "*";
  return `${maskedLocal}@${domain}`;
}

function perthTimestamp(): string {
  return new Date().toLocaleString("en-AU", { timeZone: "Australia/Perth" });
}

async function sendPushoverNotification(options: {
  title: string;
  message: string;
}): Promise<boolean> {
  try {
    const apiToken = process.env.PUSHOVER_API_TOKEN?.trim();
    const userKey = process.env.PUSHOVER_USER_KEY?.trim();

    if (!apiToken || !userKey) {
      console.warn(
        "[pushover] skipped — set PUSHOVER_API_TOKEN and PUSHOVER_USER_KEY to enable"
      );
      return false;
    }

    const payload = new URLSearchParams({
      token: apiToken,
      user: userKey,
      title: options.title,
      message: options.message,
      priority: "0",
      sound: "incoming",
    });

    const response = await fetch(PUSHOVER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: payload.toString(),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error("[pushover] API error", {
        status: response.status,
        error: errorText,
        title: options.title,
      });
      return false;
    }

    void response.body?.cancel();
    console.log("[pushover] sent", { title: options.title });
    return true;
  } catch (error) {
    console.error("[pushover] failed", {
      error: error instanceof Error ? error.message : "Unknown error",
      title: options.title,
    });
    return false;
  }
}

export async function sendWaitlistSignupNotification(
  email: string
): Promise<boolean> {
  const product = siteConfig.name;
  return sendPushoverNotification({
    title: `📥 ${product} waitlist`,
    message: [
      `New waitlist signup on ${product}.`,
      "",
      `Email: ${sanitizeEmail(email)}`,
      `Time: ${perthTimestamp()}`,
    ].join("\n"),
  });
}

export async function sendContactNotification(input: {
  name: string;
  email: string;
  message: string;
}): Promise<boolean> {
  const product = siteConfig.name;
  const preview = input.message.trim().slice(0, 200);
  return sendPushoverNotification({
    title: `✉️ ${product} contact`,
    message: [
      `New contact form on ${product}.`,
      "",
      `Name: ${input.name}`,
      `Email: ${sanitizeEmail(input.email)}`,
      `Message: ${preview}`,
      `Time: ${perthTimestamp()}`,
    ].join("\n"),
  });
}

/** Alert the admin once when a Clerk user first receives a local profile. */
export async function sendFirstUserSignupNotification(input: {
  displayName: string;
  profileHandle: string;
}): Promise<boolean> {
  const product = siteConfig.name;
  return sendPushoverNotification({
    title: `🎉 ${product} new user`,
    message: [
      `A new user joined ${product}.`,
      "",
      `Name: ${input.displayName}`,
      `Profile: @${input.profileHandle}`,
      `Time: ${perthTimestamp()}`,
    ].join("\n"),
  });
}

/** Alert the admin about a newly filed listing report without exposing email. */
export async function sendListingReportNotification(input: {
  appName: string;
  reason: string;
  listingUrl: string;
}): Promise<boolean> {
  return sendPushoverNotification({
    title: `🚩 ${siteConfig.name} listing report`,
    message: [
      `A listing was reported: ${input.appName}`,
      `Reason: ${input.reason}`,
      `Review: ${input.listingUrl}`,
      `Time: ${perthTimestamp()}`,
    ].join("\n"),
  });
}

/** Alert the admin when a tester submits a request for an app. */
export async function sendTesterRequestNotification(input: {
  appName: string;
  testerName: string;
  listingUrl: string;
}): Promise<boolean> {
  return sendPushoverNotification({
    title: `🧪 ${siteConfig.name} tester request`,
    message: [
      `${input.testerName} requested to test ${input.appName}.`,
      `Listing: ${input.listingUrl}`,
      `Time: ${perthTimestamp()}`,
    ].join("\n"),
  });
}
