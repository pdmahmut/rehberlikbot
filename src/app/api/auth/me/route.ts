import { NextRequest, NextResponse } from 'next/server';
import {
  COOKIE_NAME,
  createSessionToken,
  getRawSessionFromToken,
  reconcileSessionUser,
  type SessionUser,
} from '@/lib/auth';

function didSessionChange(previous: SessionUser, next: SessionUser) {
  return (
    previous.teacherId !== next.teacherId ||
    previous.username !== next.username ||
    previous.teacherName !== next.teacherName ||
    previous.classKey !== next.classKey ||
    previous.classDisplay !== next.classDisplay ||
    previous.isHomeroom !== next.isHomeroom
  );
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: 'Oturum yok' }, { status: 401 });

  const storedSession = getRawSessionFromToken(token);
  if (!storedSession) return NextResponse.json({ error: 'Geçersiz oturum' }, { status: 401 });

  const freshSession = reconcileSessionUser(storedSession);
  const response = NextResponse.json(freshSession);

  if (didSessionChange(storedSession, freshSession)) {
    response.cookies.set(COOKIE_NAME, createSessionToken(freshSession), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 8 * 60 * 60,
    });
  }

  return response;
}
