import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const blockedPaths = [
    "/dashboard",
    "/marketplace",
    "/orders",
    "/agent",
    "/activity",
    "/settings",
  ];

  // Check if the request path starts with any of the blocked paths
  const isBlocked = blockedPaths.some(
    (path) => pathname === path || pathname.startsWith(path + "/")
  );

  if (isBlocked) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.set("comingsoon", "true");
    return NextResponse.redirect(url);
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
