"use server";

import { sendWaitlistEmails } from "@/lib/email";
import { sendWaitlistSignupNotification } from "@/lib/pushover";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { addToWaitlist } from "@/lib/waitlist-store";
import { isValidEmail, normalizeEmail } from "@/lib/validation";

export type WaitlistState = {
  ok: boolean;
  message: string;
};

export async function joinWaitlist(
  _prev: WaitlistState,
  formData: FormData
): Promise<WaitlistState> {
  // Honeypot: real users never see/fill this; bots often do.
  if (String(formData.get("company") ?? "").trim()) {
    return {
      ok: true,
      message: "You're on the list. We'll ping you at launch.",
    };
  }

  const email = normalizeEmail(String(formData.get("email") ?? ""));

  if (!isValidEmail(email)) {
    return { ok: false, message: "Enter a valid email." };
  }

  const turnstileToken = String(
    formData.get("cf-turnstile-response") ?? ""
  ).trim();
  if (!(await verifyTurnstileToken(turnstileToken))) {
    return {
      ok: false,
      message: "Bot check failed — please refresh the page and try again.",
    };
  }

  try {
    const { alreadyExists } = await addToWaitlist(email);
    if (!alreadyExists) {
      // Store is the durable outcome; mail/Pushover are best-effort off the
      // request path so a slow SendGrid call cannot delay signup success.
      void sendWaitlistEmails(email).catch((err) => {
        console.error("[waitlist] email notify failed", err);
      });
      void sendWaitlistSignupNotification(email);
    }
    return {
      ok: true,
      message: alreadyExists
        ? "You're already on the list."
        : "You're on the list. We'll ping you at launch.",
    };
  } catch (err) {
    console.error("[waitlist] failed to save signup", err);
    return {
      ok: false,
      message: "Could not save your email. Try again in a moment.",
    };
  }
}
