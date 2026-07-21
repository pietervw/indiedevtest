"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const sizes = {
  xs: "size-7 rounded-lg text-sm",
  sm: "size-10 rounded-xl text-lg",
  md: "size-16 rounded-2xl text-2xl",
  lg: "size-24 rounded-2xl text-4xl shadow-brutal",
} as const;

export function AppLogo({
  name,
  logoUrl,
  platform,
  size = "sm",
  className,
}: {
  name: string;
  logoUrl?: string | null;
  platform?: string | null;
  size?: keyof typeof sizes;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(logoUrl) && !failed;

  if (showImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl!}
        alt={`${name} logo`}
        referrerPolicy="no-referrer"
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className={cn(
          "shrink-0 border-2 border-ink bg-paper object-cover",
          sizes[size],
          className
        )}
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center border-2 border-ink bg-ink font-display font-bold text-brand",
        sizes[size],
        className
      )}
    >
      <PlatformFallbackIcon platform={platform} fallback={name.charAt(0).toUpperCase()} />
    </div>
  );
}

function PlatformFallbackIcon({
  platform,
  fallback,
}: {
  platform?: string | null;
  fallback: string;
}) {
  const normalized = platform?.toLowerCase();
  if (normalized === "android") {
    return (
      <svg className="size-[0.9em]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-label="Android app">
        <path d="M7 10h10v8H7zM9 6l-2-2M15 6l2-2M9 13v2M15 13v2M9 19v2M15 19v2" />
        <path d="M7 10a5 5 0 0 1 10 0" />
      </svg>
    );
  }
  if (normalized === "ios") {
    return (
      <svg className="size-[0.9em]" viewBox="0 0 24 24" fill="currentColor" aria-label="iOS app">
        <path d="M16.7 12.7c0-2.1 1.7-3.1 1.8-3.2-1-1.4-2.5-1.6-3-1.6-1.3-.1-2.5.8-3.1.8-.6 0-1.6-.8-2.7-.8-1.4 0-2.7.8-3.4 2.1-1.5 2.6-.4 6.5 1 8.5.7 1 1.5 2 2.6 1.9 1-.1 1.4-.7 2.6-.7s1.5.7 2.6.7c1.1 0 1.8-1 2.5-2 .8-1.1 1.1-2.2 1.1-2.3-.1 0-2.1-.8-2.1-3.4ZM14.7 6.6c.6-.7 1-1.7.9-2.6-.9 0-2 .6-2.6 1.3-.6.6-1.1 1.6-1 2.5 1 .1 2-.5 2.7-1.2Z" />
      </svg>
    );
  }
  return <>{fallback}</>;
}
