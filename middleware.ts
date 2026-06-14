import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const isComingSoon = process.env.NEXT_PUBLIC_IS_COMING_SOON === "true" || process.env.IS_COMING_SOON === "true";

  if (isComingSoon) {
    const { pathname } = request.nextUrl;
    const blockedPaths = [
      "/dashboard",
      "/marketplace",
      "/orders",
      "/agent",
      "/activity",
      "/settings",
    ];

    const isBlocked = blockedPaths.some(
      (path) => pathname === path || pathname.startsWith(path + "/")
    );

    if (isBlocked) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      url.searchParams.set("comingsoon", "true");
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/marketplace/:path*",
    "/orders/:path*",
    "/agent/:path*",
    "/activity/:path*",
    "/settings/:path*",
  ],
};
