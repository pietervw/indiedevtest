import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
  canonicalHttpsRedirectUrl,
  forwardedProtocol,
} from "@/lib/canonical-request";

export default clerkMiddleware(async (_auth, request) => {
  const hostname = request.headers.get("host") ?? request.nextUrl.hostname;
  const protocol = forwardedProtocol(
    request.headers.get("x-forwarded-proto"),
    request.nextUrl.protocol
  );
  const canonical = canonicalHttpsRedirectUrl({
    hostname,
    protocol,
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
  });

  if (!canonical) {
    return;
  }

  return NextResponse.redirect(canonical, 308);
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
