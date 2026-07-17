/**
 * Cloudflare Turnstile server-side verification.
 * Docs: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 */

const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const SITEVERIFY_TIMEOUT_MS = 5_000;

export async function verifyTurnstileToken(
  token: string,
  options?: {
    remoteip?: string;
    expectedAction?: string;
  }
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  // Dev convenience: if no secret is configured, skip verification locally so
  // the form works without keys. Production MUST set TURNSTILE_SECRET_KEY.
  if (!secret) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[turnstile] TURNSTILE_SECRET_KEY not set — skipping verification (dev only)"
      );
      return true;
    }
    return false;
  }

  if (!token) {
    console.warn("[turnstile] missing cf-turnstile-response token");
    return false;
  }

  try {
    const res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret,
        response: token,
        ...(options?.remoteip ? { remoteip: options.remoteip } : {}),
      }),
      signal: AbortSignal.timeout(SITEVERIFY_TIMEOUT_MS),
    });
    const data = (await res.json()) as {
      success?: boolean;
      action?: string;
      hostname?: string;
      "error-codes"?: string[];
    };
    if (data.success !== true) {
      console.error("[turnstile] siteverify rejected", {
        errorCodes: data["error-codes"] ?? [],
      });
      return false;
    }

    if (
      options?.expectedAction &&
      data.action !== options.expectedAction
    ) {
      console.error("[turnstile] action mismatch", {
        expected: options.expectedAction,
        actual: data.action ?? null,
      });
      return false;
    }

    return true;
  } catch (err) {
    console.error("[turnstile] siteverify failed", err);
    return false;
  }
}
