/**
 * Cloudflare Turnstile server-side verification.
 * Docs: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 */
export async function verifyTurnstileToken(
  token: string,
  remoteip?: string
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

  if (!token) return false;

  try {
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          secret,
          response: token,
          ...(remoteip ? { remoteip } : {}),
        }),
      }
    );
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (err) {
    console.error("[turnstile] siteverify failed", err);
    return false;
  }
}
