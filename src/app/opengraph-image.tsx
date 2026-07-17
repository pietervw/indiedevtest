import { ImageResponse } from "next/og";
import { siteConfig } from "@/lib/site";

export const alt = `${siteConfig.name} — ${siteConfig.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const host = new URL(siteConfig.url).host;

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: siteConfig.backgroundColor,
          border: `16px solid ${siteConfig.ink}`,
          padding: "64px",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            fontSize: 42,
            fontWeight: 800,
            color: siteConfig.ink,
          }}
        >
          <span>IndieDev</span>
          <span
            style={{
              display: "flex",
              marginLeft: 12,
              background: siteConfig.themeColor,
              color: siteConfig.brandInk,
              border: `3px solid ${siteConfig.ink}`,
              borderRadius: 10,
              padding: "4px 14px",
            }}
          >
            Test
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: 72,
              fontWeight: 800,
              lineHeight: 1.05,
              color: siteConfig.ink,
              letterSpacing: "-0.02em",
            }}
          >
            <span>Find 12 testers.</span>
            <span>Launch your app.</span>
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 20,
              fontSize: 28,
              color: "#525252",
              maxWidth: 780,
            }}
          >
            Reciprocal testing for indie Android & iOS builders.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 22,
            color: siteConfig.ink,
            fontWeight: 600,
          }}
        >
          <span>Free forever</span>
          <span
            style={{
              display: "flex",
              background: siteConfig.themeColor,
              border: `3px solid ${siteConfig.ink}`,
              borderRadius: 12,
              padding: "10px 20px",
            }}
          >
            {host}
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
}
