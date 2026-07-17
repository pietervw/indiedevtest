"use server";

import { sendWaitlistSignupNotification } from "@/lib/pushover";
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
  const email = normalizeEmail(String(formData.get("email") ?? ""));

  if (!isValidEmail(email)) {
    return { ok: false, message: "Enter a valid email." };
  }

  try {
    const { alreadyExists } = await addToWaitlist(email);
    if (!alreadyExists) {
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
