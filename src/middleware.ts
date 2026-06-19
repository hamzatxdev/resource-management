import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  isAuthConfigured,
  SESSION_COOKIE,
  verifySessionToken,
} from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname === "/login" ||
    pathname.startsWith("/api/auth/login") ||
    pathname.startsWith("/api/auth/session")
  ) {
    return NextResponse.next();
  }

  if (!isAuthConfigured()) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        {
          error:
            "Authentication is not configured. Set AUTH_PASSWORD and AUTH_SECRET in the environment.",
        },
        { status: 503 }
      );
    }
    const login = new URL("/login", request.url);
    login.searchParams.set("error", "config");
    return NextResponse.redirect(login);
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const valid = token ? await verifySessionToken(token) : false;

  if (!valid) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const login = new URL("/login", request.url);
    if (pathname !== "/") {
      login.searchParams.set("from", pathname);
    }
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
