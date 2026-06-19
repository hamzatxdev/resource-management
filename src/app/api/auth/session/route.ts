import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isAuthConfigured, SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

export async function GET() {
  const configured = isAuthConfigured();
  if (!configured) {
    return NextResponse.json({
      authRequired: true,
      configured: false,
      authenticated: false,
    });
  }

  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const authenticated = token ? await verifySessionToken(token) : false;

  return NextResponse.json({
    authRequired: true,
    configured: true,
    authenticated,
  });
}
