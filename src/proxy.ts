import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const APEX_HOST = "indiedevtest.com";
const WWW_HOST = `www.${APEX_HOST}`;

export default clerkMiddleware(async (_auth, request) => {
  const hostname = (request.headers.get("host") ?? "")
    .toLowerCase()
    .split(":")[0];

  if (hostname !== WWW_HOST) {
    return;
  }

  const url = request.nextUrl.clone();
  url.hostname = APEX_HOST;
  url.protocol = "https:";
  url.port = "";

  return NextResponse.redirect(url, 308);
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
