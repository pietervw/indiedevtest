"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";

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

function turnstileAvailable(): boolean {
  return typeof window !== "undefined" && Boolean(window.turnstile);
}

export function TurnstileWidget({
  action = "contact",
  resetKey = 0,
}: {
  action?: string;
  resetKey?: number;
}) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const [scriptReady, setScriptReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  useEffect(() => {
    if (!scriptReady || !siteKey || widgetId.current) return;
    if (!window.turnstile || !containerRef.current) return;
    widgetId.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      action,
    });
  }, [scriptReady, siteKey, action]);

  useEffect(() => {
    if (!resetKey || !widgetId.current || !window.turnstile) return;
    window.turnstile.reset(widgetId.current);
  }, [resetKey]);

  if (!siteKey) return null;

  return (
    <div>
      <div ref={containerRef} />
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="afterInteractive"
        onLoad={() => {
          if (turnstileAvailable()) setScriptReady(true);
        }}
        onReady={() => {
          if (turnstileAvailable()) setScriptReady(true);
        }}
      />
    </div>
  );
}
