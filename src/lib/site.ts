const DEFAULT_SITE_URL = "https://indiedevtest.com";

/** Prefer apex host (no www). Empty/invalid env falls back to production URL. */
function resolveSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim() || DEFAULT_SITE_URL;
  try {
    const url = new URL(raw);
    url.hostname = url.hostname.replace(/^www\./i, "");
    return url.origin;
  } catch {
    return DEFAULT_SITE_URL;
  }
}

export const siteConfig = {
  name: "IndieDevTest",
  legalName: "IndieDevTest",
  tagline: "Find 12 testers. Launch your app.",
  description:
    "Indie devs help each other launch. Reciprocal testing for Android and iOS — no more begging friends or family.",
  url: resolveSiteUrl(),
  locale: "en_US",
  keywords: [
    "indie app testers",
    "Google Play 12 testers",
    "Android closed testing",
    "TestFlight testers",
    "reciprocal app testing",
    "indie developer community",
    "mobile app launch",
    "find app testers",
  ],
  twitterHandle: "@SlouchyPete",
  creator: "IndieDevTest",
  themeColor: "#d2e36b",
  brandInk: "#2a3812",
  ink: "#0a0a0a",
  backgroundColor: "#ffffff",
} as const;

export const socialLinks = [
  { label: "X", href: "https://x.com/SlouchyPete" },
  { label: "GitHub", href: "https://github.com/pietervw" },
] as const;

export const howItWorksSteps = [
  {
    n: "01",
    title: "Post your app",
    body: "Drop your Play Store or TestFlight link in under 2 minutes.",
  },
  {
    n: "02",
    title: "Test other apps",
    body: "Help fellow indie builders — real installs, real feedback.",
  },
  {
    n: "03",
    title: "Get to 12/14",
    body: "Reciprocity fills your tester slots so you can ship.",
  },
] as const;

export const siteFaqs = [
  {
    question: "What is IndieDevTest?",
    answer:
      "IndieDevTest is a free reciprocal testing community where indie developers help each other reach Google Play's 12-tester / 14-day requirement and TestFlight coverage.",
  },
  {
    question: "How does reciprocal testing work?",
    answer:
      "You post your app, test other indie apps, and the community tests yours. The more you help, the faster you reach your tester slots.",
  },
  {
    question: "Is IndieDevTest free?",
    answer:
      "Yes. IndieDevTest is free forever — no credit card, no premium tiers, and no bait-and-switch.",
  },
  {
    question: "Why not just post on Reddit or Twitter?",
    answer:
      "Reddit can take weeks and Twitter is hit-or-miss. IndieDevTest is built only for indie developers who need real, reciprocal testing.",
  },
] as const;

/** Canonical indexable routes — single source for sitemap + llms.txt */
export const siteRoutes = [
  {
    path: "/",
    title: "Home",
    description:
      "Reciprocal testing community for indie Android and iOS developers.",
    changeFrequency: "weekly" as const,
    priority: 1,
  },
  {
    path: "/contact",
    title: "Contact",
    description:
      "Questions, feedback, or ideas? Get in touch with the IndieDevTest team.",
    changeFrequency: "monthly" as const,
    priority: 0.6,
  },
] as const;

export function absoluteUrl(path = "/"): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${siteConfig.url}${normalized === "/" ? "" : normalized}`;
}

/** Shared canonical + OG URL metadata for indexable pages. */
export function canonicalMetadata(path: string) {
  const url = absoluteUrl(path);
  return {
    alternates: { canonical: url },
    openGraph: { url },
  };
}
