import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  if (!host.toLowerCase().startsWith("www.")) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.hostname = host.replace(/^www\./i, "");
  url.protocol = "https:";
  url.port = "";

  return NextResponse.redirect(url, 308);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
