import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const APEX_HOST = "indiedevtest.com";
const WWW_HOST = `www.${APEX_HOST}`;

export function proxy(request: NextRequest) {
  const hostname = (request.headers.get("host") ?? "").toLowerCase().split(":")[0];
  if (hostname !== WWW_HOST) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.hostname = APEX_HOST;
  url.protocol = "https:";
  url.port = "";

  return NextResponse.redirect(url, 308);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
