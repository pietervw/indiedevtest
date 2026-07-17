"use client";

import { useActionState, useState } from "react";
import { sendContactMessage, type ContactState } from "@/app/actions/contact";
import { SubmitButton } from "@/components/submit-button";
import { TurnstileWidget } from "@/components/turnstile-widget";
import { cn } from "@/lib/utils";

const initialState: ContactState = { ok: false, message: "" };

const inputClass =
  "w-full rounded-xl border-2 border-ink bg-paper px-4 py-3 font-medium text-ink placeholder:text-ink-muted shadow-brutal outline-none transition-shadow focus:shadow-brutal-brand-lg disabled:opacity-50";

const labelClass = "mb-1.5 block text-sm font-semibold text-ink";

export function ContactForm({ className }: { className?: string }) {
  const [turnstileReset, setTurnstileReset] = useState(0);
  const [state, formAction] = useActionState(
    async (prev: ContactState, formData: FormData) => {
      const next = await sendContactMessage(prev, formData);
      if (!next.ok) {
        setTurnstileReset((n) => n + 1);
      }
      return next;
    },
    initialState
  );

  if (state.ok) {
    return (
      <p
        className={cn("font-display text-lg font-bold text-ink", className)}
        role="status"
      >
        {state.message}
      </p>
    );
  }

  return (
    <form
      action={formAction}
      className={cn("flex flex-col gap-4", className)}
    >
      <div className="hidden" aria-hidden="true">
        <label htmlFor="company">Company</label>
        <input
          id="company"
          name="company"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="flex-1">
          <label htmlFor="contact-name" className={labelClass}>
            Name
          </label>
          <input
            id="contact-name"
            name="name"
            type="text"
            required
            maxLength={100}
            autoComplete="name"
            placeholder="Ada Lovelace"
            className={inputClass}
          />
        </div>
        <div className="flex-1">
          <label htmlFor="contact-email" className={labelClass}>
            Email
          </label>
          <input
            id="contact-email"
            name="email"
            type="email"
            required
            maxLength={254}
            autoComplete="email"
            placeholder="you@indie.dev"
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label htmlFor="contact-message" className={labelClass}>
          Message
        </label>
        <textarea
          id="contact-message"
          name="message"
          required
          minLength={10}
          maxLength={5000}
          rows={6}
          placeholder="How can we help?"
          className={cn(inputClass, "resize-y")}
        />
      </div>

      <TurnstileWidget resetKey={turnstileReset} />

      <div>
        <SubmitButton
          size="lg"
          pendingLabel="Sending…"
          className="w-full sm:w-auto"
        >
          Send message
        </SubmitButton>
      </div>

      {state.message ? (
        <p className="text-sm font-semibold text-red-600" role="alert">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
