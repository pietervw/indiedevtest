import * as Sentry from "@sentry/nextjs";

const dsn =
  process.env.SENTRY_DSN?.trim() ||
  process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() ||
  undefined;

Sentry.init({
  dsn,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  enabled: Boolean(dsn),
  sendDefaultPii: false,
  beforeSend(event) {
    if (event.request) {
      event.request.data = undefined;
      event.request.cookies = undefined;
      event.request.headers = undefined;
    }
    event.user = undefined;
    return event;
  },
});
