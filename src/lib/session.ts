// HMAC-SHA256 ile imzalanmis oturum token'i.
// Web Crypto kullanir; hem Edge middleware'de hem Node API route'larinda calisir.
//
// Token formati:  base64url(payload) + "." + base64url(hmac)
// Imza olmadan payload degistirilirse dogrulama basarisiz olur.

export interface SessionPayload {
  role: "admin" | "teacher";
  teacherId?: string;
  username?: string;
  teacherName?: string;
  classKey?: string | null;
  classDisplay?: string | null;
  isHomeroom?: boolean;
  exp: number;
}

const encoder = new TextEncoder();

function getSecret(): string {
  const secret = process.env.SESSION_SECRET || process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET tanimli degil veya 32 karakterden kisa. Oturum token'lari imzalanamaz."
    );
  }
  return secret;
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(str: string): Uint8Array {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function getKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

/** Zamanlama saldirilarina karsi sabit sureli karsilastirma. */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function signSession(payload: SessionPayload): Promise<string> {
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const key = await getKey();
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  return `${body}.${toBase64Url(new Uint8Array(sig))}`;
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const dot = token.lastIndexOf(".");
    if (dot <= 0) return null;

    const body = token.slice(0, dot);
    const providedSig = fromBase64Url(token.slice(dot + 1));

    const key = await getKey();
    const expectedSig = new Uint8Array(
      await crypto.subtle.sign("HMAC", key, encoder.encode(body))
    );

    if (!timingSafeEqual(providedSig, expectedSig)) return null;

    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as SessionPayload;
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    if (payload.role !== "admin" && payload.role !== "teacher") return null;

    return payload;
  } catch {
    return null;
  }
}

export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
export const COOKIE_NAME = "rehberlik_session";
