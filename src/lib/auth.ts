import { cookies } from 'next/headers';
import { getTeachersData, matchTeacherByName } from '@/lib/teachers';

export type UserRole = 'admin' | 'teacher';

export interface SessionUser {
  role: UserRole;
  teacherId?: string;
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

function resolveTeacherAssignment(teacherName?: string | null) {
  if (!teacherName) return null;

  const { records } = getTeachersData();
  const teacher = matchTeacherByName(teacherName, records);
  if (!teacher) return null;

  return {
    classKey: teacher.sinifSubeKey || null,
    classDisplay: teacher.sinifSubeDisplay || null,
    isHomeroom: Boolean(teacher.sinifSubeKey),
  };
}

export function buildTeacherSessionUser(user: {
  teacherId: string;
  username: string;
  teacherName: string;
  classKey?: string | null;
  classDisplay?: string | null;
}): SessionUser {
  const currentAssignment = resolveTeacherAssignment(user.teacherName);

  return {
    role: 'teacher',
    teacherId: user.teacherId,
    username: user.username,
    teacherName: user.teacherName,
    classKey: currentAssignment ? currentAssignment.classKey : user.classKey || null,
    classDisplay: currentAssignment ? currentAssignment.classDisplay : user.classDisplay || null,
    isHomeroom: currentAssignment ? currentAssignment.isHomeroom : Boolean(user.classKey),
  };
}

export function reconcileSessionUser(session: SessionUser): SessionUser {
  if (session.role !== 'teacher') {
    return session;
  }

  return buildTeacherSessionUser({
    teacherId: session.teacherId || '',
    username: session.username || '',
    teacherName: session.teacherName || '',
    classKey: session.classKey || null,
    classDisplay: session.classDisplay || null,
  });
}

export function verifyAdminPassword(password: string): boolean {
  return password === ADMIN_PASSWORD;
}

export function createSessionToken(user: SessionUser): string {
  return encodeSession(user);
}

export function getRawSessionFromToken(token: string): SessionUser | null {
  return decodeSession(token);
}

export function getSessionFromToken(token: string): SessionUser | null {
  const session = decodeSession(token);
  if (!session) return null;
  return reconcileSessionUser(session);
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return getSessionFromToken(token);
}

export { COOKIE_NAME, ADMIN_PASSWORD };
