type UmamiEventProperties = Record<
  string,
  string | number | boolean | null | undefined
>;

export const AnalyticsEvents = {
  VISIT: "visit",
  SIGNUP_STARTED: "signup_started",
  SIGNUP_COMPLETED: "signup_completed",
  ACTIVATION_COMPLETED: "activation_completed",
  VALUE_DELIVERED: "testing_feedback_submitted",
} as const;

export function getUmamiPublicConfig(): {
  src: string;
  websiteId: string;
} | null {
  const src = process.env.NEXT_PUBLIC_UMAMI_SRC?.trim();
  const websiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID?.trim();
  if (!src || !websiteId) return null;
  return { src, websiteId };
}

declare global {
  interface Window {
    umami?: {
      track: (name: string, properties?: UmamiEventProperties) => void;
    };
  }
}

export function trackEvent(
  name: string,
  properties: UmamiEventProperties = {},
  retries = 12,
): void {
  if (typeof window === "undefined") return;
  if (!getUmamiPublicConfig()) return;
  if (window.umami) {
    window.umami.track(name, properties);
    return;
  }
  if (retries > 0) {
    window.setTimeout(() => trackEvent(name, properties, retries - 1), 250);
  }
}

export function trackActivationOnce(source: string): void {
  const key = "umami:activation-completed";
  try {
    if (window.localStorage.getItem(key)) return;
    window.localStorage.setItem(key, "1");
  } catch {
    // Storage may be unavailable; the event can still be sent.
  }
  trackEvent(AnalyticsEvents.ACTIVATION_COMPLETED, { source });
}

export function umamiEvent(
  name: string,
  properties: UmamiEventProperties = {},
): Record<string, string> {
  return Object.fromEntries(
    [
      ["data-umami-event", name],
      ...Object.entries(properties).map(([key, value]) => [
        `data-umami-event-${key}`,
        value == null ? "" : String(value),
      ]),
    ].filter(([, value]) => value !== ""),
  );
}
