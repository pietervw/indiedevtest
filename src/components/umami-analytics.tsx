import Script from "next/script";
import { getUmamiPublicConfig } from "@/lib/umami";

/** Self-hosted Umami; both env vars required. Empty in local/dev to skip. */
export function UmamiAnalytics() {
  const config = getUmamiPublicConfig();
  if (!config) return null;

  return (
    <Script
      src={config.src}
      strategy="lazyOnload"
      data-website-id={config.websiteId}
    />
  );
}
