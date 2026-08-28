import { cookies } from 'next/headers';
import { getTeachersData, matchTeacherByName } from '@/lib/teachers';
import {
  COOKIE_NAME,
  SESSION_TTL_MS,
  signSession,
  verifySession,
  type SessionPayload,
} from '@/lib/session';

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

async function resolveTeacherAssignment(teacherName?: string | null) {
  if (!teacherName) return null;

  const { records } = await getTeachersData();
  const teacher = matchTeacherByName(teacherName, records);
  if (!teacher) return null;

  return {
    classKey: teacher.sinifSubeKey || null,
    classDisplay: teacher.sinifSubeDisplay || null,
    isHomeroom: Boolean(teacher.sinifSubeKey),
  };
}

export async function buildTeacherSessionUser(user: {
  teacherId: string;
  username: string;
  teacherName: string;
  classKey?: string | null;
  classDisplay?: string | null;
}): Promise<SessionUser> {
  const currentAssignment = await resolveTeacherAssignment(user.teacherName);

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

export async function reconcileSessionUser(session: SessionUser): Promise<SessionUser> {
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

function toSessionUser(payload: SessionPayload): SessionUser {
  // exp yalnizca token dogrulamasinda kullanilir, oturum nesnesine tasinmaz.
  const user = { ...payload } as Partial<SessionPayload>;
  delete user.exp;
  return user as SessionUser;
}

/** Imzali oturum token'i uretir. */
export async function createSessionToken(user: SessionUser): Promise<string> {
  return signSession({ ...user, exp: Date.now() + SESSION_TTL_MS } as SessionPayload);
}

/** Token'i dogrular; ogretmen atamasini tazelemeden ham haliyle dondurur. */
export async function getRawSessionFromToken(token: string): Promise<SessionUser | null> {
  const payload = await verifySession(token);
  return payload ? toSessionUser(payload) : null;
}

/** Token'i dogrular ve ogretmenin guncel sinif atamasiyla tazeler. */
export async function getSessionFromToken(token: string): Promise<SessionUser | null> {
  const session = await getRawSessionFromToken(token);
  if (!session) return null;
  return reconcileSessionUser(session);
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return getSessionFromToken(token);
}

/** Login response'unda kullanilacak standart cookie ayarlari. */
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: SESSION_TTL_MS / 1000,
};

export { COOKIE_NAME };
