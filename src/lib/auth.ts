/**
 * Session auth for the internal team directory.
 * Always required — set AUTH_PASSWORD and AUTH_SECRET in the environment.
 */

export const SESSION_COOKIE = "team_dir_session";
export const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7; // 7 days

export function isAuthEnabled(): boolean {
  return true;
}

export function isAuthConfigured(): boolean {
  return Boolean(
    process.env.AUTH_PASSWORD?.trim() && process.env.AUTH_SECRET?.trim()
  );
}

function getSecret(): string {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret) throw new Error("AUTH_SECRET is not configured");
  return secret;
}

export function getAuthPassword(): string {
  const password = process.env.AUTH_PASSWORD?.trim();
  if (!password) throw new Error("AUTH_PASSWORD is not configured");
  return password;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  const binary = atob(b64 + pad);
  const buf = new ArrayBuffer(binary.length);
  const out = new Uint8Array(buf);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function createSessionToken(): Promise<string> {
  const payload = JSON.stringify({
    v: 1,
    exp: Date.now() + SESSION_MAX_AGE_SEC * 1000,
  });
  const key = await importHmacKey(getSecret());
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload)
  );
  return `${toBase64Url(new TextEncoder().encode(payload))}.${toBase64Url(new Uint8Array(sig))}`;
}

export async function verifySessionToken(token: string): Promise<boolean> {
  if (!isAuthConfigured()) return false;
  try {
    const [payloadPart, sigPart] = token.split(".");
    if (!payloadPart || !sigPart) return false;

    const payloadBytes = fromBase64Url(payloadPart);
    const payload = JSON.parse(new TextDecoder().decode(payloadBytes)) as {
      v?: number;
      exp?: number;
    };
    if (payload.v !== 1 || typeof payload.exp !== "number") return false;
    if (payload.exp < Date.now()) return false;

    const key = await importHmacKey(getSecret());
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      fromBase64Url(sigPart),
      payloadBytes
    );
    return valid;
  } catch {
    return false;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_SEC,
  };
}
