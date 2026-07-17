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
  size = "sm",
  className,
}: {
  name: string;
  logoUrl?: string | null;
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
      {name.charAt(0).toUpperCase()}
    </div>
  );
}
