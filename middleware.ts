import { NextResponse, type NextRequest } from "next/server";

/** Passes the requested path to server components, so sign-in can return people where they were. */
export function middleware(req: NextRequest) {
  const headers = new Headers(req.headers);
  headers.set("x-pathname", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: ["/dashboard/:path*", "/new", "/drops/:path*", "/templates/:path*", "/settings/:path*"] };
