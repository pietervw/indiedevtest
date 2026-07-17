import {
  absoluteUrl,
  howItWorksSteps,
  siteConfig,
  siteFaqs,
  siteRoutes,
} from "@/lib/site";

function pagesMarkdown(): string {
  return siteRoutes
    .map(
      (route) =>
        `- [${route.title}](${absoluteUrl(route.path)}): ${route.description}`
    )
    .join("\n");
}

export function llmsTextResponse(body: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}

/** Curated index for LLM agents (https://llmstxt.org). */
export function buildLlmsTxt(): string {
  return [
    `# ${siteConfig.name}`,
    `> ${siteConfig.description}`,
    "",
    `${siteConfig.name} helps indie mobile developers find reciprocal testers so they can meet Google Play's 12-tester / 14-day requirement and ship on TestFlight without begging friends or family.`,
    "",
    "Important notes:",
    "- The product is free forever — no credit card and no premium tiers.",
    "- Testers are other indie developers building their own apps (not paid farms).",
    "- Primary audience: solo/indie Android and iOS builders preparing a store launch.",
    "",
    "## Pages",
    pagesMarkdown(),
    "",
    "## Key facts",
    `- Official site: ${siteConfig.url}`,
    `- Product: reciprocal indie app testing waitlist / community`,
    `- Platforms: Android (Google Play closed testing), iOS (TestFlight)`,
    `- Contact: ${absoluteUrl("/contact")}`,
    "",
    "## Optional",
    `- [Full site summary](${absoluteUrl("/llms-full.txt")}): Longer markdown overview for RAG / agent context`,
    `- [XML sitemap](${absoluteUrl("/sitemap.xml")}): Exhaustive crawl map for search engines`,
    `- [robots.txt](${absoluteUrl("/robots.txt")}): Crawl permissions for bots and AI user-agents`,
    "",
  ].join("\n");
}

/** Expanded markdown context for agents that want more than the index. */
export function buildLlmsFullTxt(): string {
  const steps = howItWorksSteps
    .map((step, i) => `${i + 1}. ${step.title} — ${step.body}`)
    .join("\n");

  const faqs = siteFaqs
    .map((faq) => `### ${faq.question}\n${faq.answer}`)
    .join("\n\n");

  return `# ${siteConfig.name} — full summary

> ${siteConfig.description}

## What it is

${siteConfig.name} is a free reciprocal testing community for indie mobile developers. Builders post their apps, test each other's apps, and fill Google Play / TestFlight tester requirements without relying on friends, family, or unreliable social posts.

Tagline: ${siteConfig.tagline}

## How it works

${steps}

## Why it exists

Google Play requires 12 testers for 14 days before many apps can launch. Finding those testers is painful for solo builders. Reddit is slow; Twitter is lottery. ${siteConfig.name} is built only for indie developers who need real, reciprocal testing.

## Pricing

Free forever. No credit card. No premium tiers. No bait-and-switch.

## FAQ

${faqs}

## Pages

${pagesMarkdown()}

## Machine-readable endpoints

- llms.txt: ${absoluteUrl("/llms.txt")}
- sitemap.xml: ${absoluteUrl("/sitemap.xml")}
- robots.txt: ${absoluteUrl("/robots.txt")}
- Open Graph image: ${absoluteUrl("/opengraph-image")}

## Contact

Reach the team at ${absoluteUrl("/contact")}.
`;
}
