import { getUmamiPublicConfig } from "@/lib/umami";
import { siteConfig } from "@/lib/site";

type EventData = Record<string, string | number | boolean>;

export async function trackServerEvent(
  name: string,
  data?: EventData
): Promise<void> {
  const config = getUmamiPublicConfig();
  if (!config) return;

  try {
    await fetch(new URL("/api/send", config.src), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "event",
        payload: {
          website: config.websiteId,
          hostname: new URL(siteConfig.url).hostname,
          url: "/server/user",
          name,
          data,
        },
      }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Analytics must never interrupt account creation.
  }
}
