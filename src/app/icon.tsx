import { ImageResponse } from "next/og";
import { siteConfig } from "@/lib/site";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: siteConfig.themeColor,
          border: `2px solid ${siteConfig.ink}`,
          color: siteConfig.brandInk,
          fontSize: 18,
          fontWeight: 800,
          fontFamily: "sans-serif",
        }}
      >
        ID
      </div>
    ),
    { ...size }
  );
}
