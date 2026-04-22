import { cookies } from 'next/headers';

export type UserRole = 'admin' | 'teacher';

export interface SessionUser {
  role: UserRole;
  username?: string;
  teacherName?: string;
  classKey?: string | null;
  classDisplay?: string | null;
  isHomeroom?: boolean;
}

const COOKIE_NAME = 'rehberlik_session';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// Basit base64 token (edge middleware için)
function encodeSession(user: SessionUser): string {
  const payload = JSON.stringify({ ...user, exp: Date.now() + 8 * 60 * 60 * 1000 });
  return Buffer.from(payload).toString('base64url');
}

function decodeSession(token: string): SessionUser | null {
  try {
    const payload = JSON.parse(Buffer.from(token, 'base64url').toString());
    if (payload.exp < Date.now()) return null;
    return payload as SessionUser;
  } catch {
    return null;
  }
}

export function verifyAdminPassword(password: string): boolean {
  return password === ADMIN_PASSWORD;
}

export function createSessionToken(user: SessionUser): string {
  return encodeSession(user);
}

export function getSessionFromToken(token: string): SessionUser | null {
  return decodeSession(token);
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return getSessionFromToken(token);
}

export { COOKIE_NAME, ADMIN_PASSWORD };
