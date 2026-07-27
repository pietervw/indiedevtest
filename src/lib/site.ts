const DEFAULT_SITE_URL = "https://indiedevtest.com";

/** Prefer apex host (no www). Empty/invalid env falls back to production URL. */
function resolveSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim() || DEFAULT_SITE_URL;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return DEFAULT_SITE_URL;
    }
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
    "Indie devs help each other meet Google Play's 12-tester requirement and launch — no more begging friends or family.",
  url: resolveSiteUrl(),
  locale: "en_US",
  keywords: [
    "indie app testers",
    "Google Play 12 testers",
    "Android closed testing",
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
    title: "List your app",
    body: "List your app with the basic details testers need.",
  },
  {
    n: "02",
    title: "Test apps for other devs",
    body: "Sign up to test other apps and unlock testing slots for your own app.",
  },
  {
    n: "03",
    title: "12+ users join your test track",
    body: "Testers join your closed-testing track for the required 14 days and provide useful feedback.",
  },
  {
    n: "04",
    title: "Production access",
    body: "After 14 days of continuous testing, you can apply for Google Play production access.",
  },
] as const;

export const siteFaqs = [
  {
    question: "What’s the quickest way to get my app into production?",
    answer:
      "Use a community of fellow developers to test your app and provide valuable feedback before you apply for production access.",
  },
  {
    question: "How long is the testing phase?",
    answer:
      "Google requires at least 12 testers to remain opted in to your closed test for 14 continuous days before you can apply for production access.",
  },
  {
    question: "Can’t I just use friends and family for testing?",
    answer:
      "Friends and family can be testers, but getting 12 people to opt in, use your app, and provide valuable feedback can be difficult. Fellow developers are better placed to find bugs and help you avoid launch delays.",
  },
  {
    question: "What if testers uninstall my app during the 14-day period?",
    answer:
      "Google counts testers who remain opted in to the closed test. Encourage testers to keep the app installed and actively test it throughout the 14 days so your test demonstrates genuine engagement.",
  },
] as const;

/** Canonical indexable routes — single source for sitemap + llms.txt */
export const siteRoutes = [
  {
    path: "/",
    title: "Home",
    description:
      "Reciprocal Google Play closed-testing community for indie Android developers.",
    changeFrequency: "weekly" as const,
    priority: 1,
  },
  {
    path: "/browse",
    title: "Browse",
    description:
      "Browse open Google Play testing listings from fellow indie Android developers.",
    changeFrequency: "hourly" as const,
    priority: 0.9,
  },
  {
    path: "/contact",
    title: "Contact",
    description:
      "Questions, feedback, or ideas? Get in touch with the IndieDevTest team.",
    changeFrequency: "monthly" as const,
    priority: 0.6,
  },
  {
    path: "/privacy",
    title: "Privacy",
    description:
      "How IndieDevTest handles account data, listings, emails, and analytics.",
    changeFrequency: "monthly" as const,
    priority: 0.4,
  },
  {
    path: "/terms",
    title: "Terms",
    description:
      "Plain-language terms for using IndieDevTest’s reciprocal testing community.",
    changeFrequency: "monthly" as const,
    priority: 0.4,
  },
] as const;

export type SiteRoutePath = (typeof siteRoutes)[number]["path"];

export function getSiteRouteOrThrow(path: SiteRoutePath) {
  const route = siteRoutes.find((entry) => entry.path === path);
  if (!route) {
    throw new Error(`Missing ${path} entry in siteRoutes`);
  }
  return route;
}

export function legalWebPageJsonLd(options: {
  path: SiteRoutePath;
  name: string;
  description: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": absoluteUrl(`${options.path}#webpage`),
    url: absoluteUrl(options.path),
    name: options.name,
    description: options.description,
    isPartOf: { "@id": absoluteUrl("/#website") },
    about: { "@id": absoluteUrl("/#organization") },
    inLanguage: "en-US",
  };
}

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
