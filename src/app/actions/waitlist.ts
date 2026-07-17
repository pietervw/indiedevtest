"use server";

import { addToWaitlist } from "@/lib/waitlist-store";

export type WaitlistState = {
  ok: boolean;
  message: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email: string): boolean {
  return email.length <= 254 && EMAIL_RE.test(email);
}

export async function joinWaitlist(
  _prev: WaitlistState,
  formData: FormData
): Promise<WaitlistState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!email || !isValidEmail(email)) {
    return { ok: false, message: "Enter a valid email." };
  }

  try {
    const { alreadyExists } = await addToWaitlist(email);

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
