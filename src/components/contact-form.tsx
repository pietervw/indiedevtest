"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Script from "next/script";
import { sendContactMessage, type ContactState } from "@/app/actions/contact";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: { sitekey: string; action?: string }
      ) => string;
      reset: (widgetId?: string) => void;
    };
  }
}

const initialState: ContactState = { ok: false, message: "" };

const inputClass =
  "w-full rounded-xl border-2 border-ink bg-paper px-4 py-3 font-medium text-ink placeholder:text-ink-muted shadow-brutal outline-none transition-shadow focus:shadow-brutal-brand-lg disabled:opacity-50";

const labelClass = "mb-1.5 block text-sm font-semibold text-ink";

export function ContactForm({ className }: { className?: string }) {
  const [state, formAction, pending] = useActionState(
    sendContactMessage,
    initialState
  );

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const [scriptReady, setScriptReady] = useState(false);
  const turnstileRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  // Render the widget once the script + container are ready.
  useEffect(() => {
    if (!scriptReady || !siteKey || widgetId.current) return;
    if (!window.turnstile || !turnstileRef.current) return;
    widgetId.current = window.turnstile.render(turnstileRef.current, {
      sitekey: siteKey,
      action: "turnstile-spin-v2",
    });
  }, [scriptReady, siteKey]);

  // Script may already be loaded from a previous navigation.
  useEffect(() => {
    if (window.turnstile) setScriptReady(true);
  }, []);

  // After a failed submit, reset the widget so the user can retry.
  useEffect(() => {
    if (!state.ok && state.message && widgetId.current && window.turnstile) {
      window.turnstile.reset(widgetId.current);
    }
  }, [state]);

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
    <form action={formAction} className={cn("flex flex-col gap-4", className)}>
      {/* Honeypot — hidden from humans, bait for bots */}
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
            disabled={pending}
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
            disabled={pending}
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
          disabled={pending}
          className={cn(inputClass, "resize-y")}
        />
      </div>

      {siteKey ? (
        <div>
          <div ref={turnstileRef} />
          <Script
            src="https://challenges.cloudflare.com/turnstile/v0/api.js"
            strategy="afterInteractive"
            onLoad={() => setScriptReady(true)}
          />
        </div>
      ) : null}

      <div>
        <Button
          type="submit"
          size="lg"
          disabled={pending}
          className="w-full sm:w-auto"
        >
          {pending ? "Sending…" : "Send message"}
        </Button>
      </div>

      {state.message ? (
        <p className="text-sm font-semibold text-red-600" role="alert">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
