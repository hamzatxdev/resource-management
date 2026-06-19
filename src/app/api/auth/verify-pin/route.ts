import { timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  getLockPin,
  isAuthConfigured,
  SESSION_COOKIE,
  verifySessionToken,
} from "@/lib/auth";

function verifyPin(input: string, expected: string): boolean {
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  if (!isAuthConfigured()) {
    return NextResponse.json({ ok: true });
  }

  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || !(await verifySessionToken(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let pin = "";
  try {
    const body = (await req.json()) as { pin?: string };
    pin = body.pin ?? "";
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const expected = getLockPin();
  if (!pin || !verifyPin(pin, expected)) {
    return NextResponse.json({ error: "Incorrect PIN" }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
