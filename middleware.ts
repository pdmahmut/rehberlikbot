import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'rehberlik_session';

function getSessionFromToken(token: string): { role: string } | null {
  try {
    const payload = JSON.parse(Buffer.from(token, 'base64url').toString());
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/login') || pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/panel')) {
    const token = request.cookies.get(COOKIE_NAME)?.value;
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    const session = getSessionFromToken(token);
    if (!session) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    if (session.role === 'teacher' && !pathname.startsWith('/panel/ogretmen')) {
      return NextResponse.redirect(new URL('/panel/ogretmen', request.url));
    }
    return NextResponse.next();
  }

  if (pathname === '/') {
    const token = request.cookies.get(COOKIE_NAME)?.value;
    if (token) {
      const session = getSessionFromToken(token);
      if (session?.role === 'teacher') return NextResponse.redirect(new URL('/panel/ogretmen', request.url));
      if (session?.role === 'admin') return NextResponse.redirect(new URL('/panel', request.url));
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/panel/:path*', '/login', '/api/auth/:path*']
};