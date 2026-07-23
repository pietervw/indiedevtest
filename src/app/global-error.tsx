"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({
  error,
  reset,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  reset?: () => void;
  unstable_retry?: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  const retry = unstable_retry ?? reset;

  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#fff", color: "#0a0a0a", fontFamily: "Arial, sans-serif" }}>
        <main style={{ display: "grid", minHeight: "100vh", placeItems: "center", padding: "24px" }}>
          <section style={{ maxWidth: "480px", border: "2px solid #0a0a0a", padding: "32px", textAlign: "center", boxShadow: "6px 6px 0 #0a0a0a" }}>
            <title>Something went wrong | IndieDevTest</title>
            <h1 style={{ margin: 0, fontSize: "28px" }}>Something went wrong</h1>
            <p style={{ lineHeight: 1.5 }}>We&apos;ve been notified. Please try again, or return home if the problem continues.</p>
            <div style={{ display: "flex", justifyContent: "center", gap: "12px", flexWrap: "wrap" }}>
              {retry ? <button type="button" onClick={retry} style={{ cursor: "pointer", border: "2px solid #0a0a0a", background: "#d2e36b", padding: "10px 16px", fontWeight: 700 }}>Try again</button> : null}
              <button type="button" onClick={() => window.location.assign("/")} style={{ cursor: "pointer", border: "2px solid #0a0a0a", background: "#fff", color: "#0a0a0a", padding: "10px 16px", fontWeight: 700 }}>Go home</button>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
