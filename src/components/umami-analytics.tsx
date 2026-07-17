import Script from "next/script";

/** Self-hosted Umami; both env vars required. Empty in local/dev to skip. */
export function UmamiAnalytics() {
  const src = process.env.NEXT_PUBLIC_UMAMI_SRC?.trim();
  const websiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID?.trim();

  if (!src || !websiteId) {
    return null;
  }

  return (
    <Script
      src={src}
      strategy="lazyOnload"
      data-website-id={websiteId}
    />
  );
}
