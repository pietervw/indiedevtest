"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { AnalyticsEvents, trackEvent } from "@/lib/umami";

export function UmamiVisit() {
  const pathname = usePathname();
  const previousPath = useRef<string | null>(null);

  useEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    trackEvent(AnalyticsEvents.VISIT, { path: pathname });
    if (pathname.startsWith("/sign-up")) {
      trackEvent(AnalyticsEvents.SIGNUP_STARTED, { source: "sign_up_route" });
    }
  }, [pathname]);

  return null;
}
