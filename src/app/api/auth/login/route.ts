import { timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  createSessionToken,
  getAuthPassword,
  isAuthConfigured,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/auth";

function verifyPassword(input: string, expected: string): boolean {
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  if (!isAuthConfigured()) {
    return NextResponse.json(
      {
        error:
          "Authentication is not configured. Set AUTH_PASSWORD and AUTH_SECRET in the environment.",
      },
      { status: 503 }
    );
  }

  let password = "";
  try {
    const body = (await req.json()) as { password?: string };
    password = body.password ?? "";
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const expected = getAuthPassword();
  if (!password || !verifyPassword(password, expected)) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const token = await createSessionToken();
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, sessionCookieOptions());

  return NextResponse.json({ ok: true });
}
