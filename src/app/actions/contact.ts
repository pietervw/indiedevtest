"use server";

import { sendContactEmail } from "@/lib/email";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { isValidEmail, normalizeEmail } from "@/lib/validation";

export type ContactState = {
  ok: boolean;
  message: string;
};

function fail(message: string): ContactState {
  return { ok: false, message };
}

export async function sendContactMessage(
  _prev: ContactState,
  formData: FormData
): Promise<ContactState> {
  // Honeypot: real users never see/fill this; bots often do.
  if (String(formData.get("company") ?? "").trim()) {
    return {
      ok: true,
      message: "Thanks! Your message has been sent — we'll get back to you soon.",
    };
  }

  const name = String(formData.get("name") ?? "").trim();
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const message = String(formData.get("message") ?? "").trim();

  if (!name || name.length > 100) {
    return fail("Please enter your name.");
  }
  if (!isValidEmail(email)) {
    return fail("Please enter a valid email address.");
  }
  if (!message || message.length < 10) {
    return fail("Please enter a message (at least 10 characters).");
  }
  if (message.length > 5000) {
    return fail("That message is too long (5,000 characters max).");
  }

  const turnstileToken = String(
    formData.get("cf-turnstile-response") ?? ""
  ).trim();
  if (!(await verifyTurnstileToken(turnstileToken))) {
    return fail("Bot check failed — please refresh the page and try again.");
  }

  try {
    await sendContactEmail({ name, email, message });
    return {
      ok: true,
      message: "Thanks! Your message has been sent — we'll get back to you soon.",
    };
  } catch (err) {
    console.error("[contact] failed to send message", err);
    return fail(
      "Sorry, we couldn't send your message right now. Please try again later."
    );
  }
}
