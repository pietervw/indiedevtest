import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/dashboard",
        "/settings",
        "/onboarding",
        "/sign-in",
        "/sign-up",
        "/apps/new",
      ],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
