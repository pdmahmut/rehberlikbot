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

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes
  if (pathname.startsWith('/login') || pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  // API routes - sadece auth gerektiren panel'e ait değil
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Panel koruması
  if (pathname.startsWith('/panel')) {
    const token = request.cookies.get(COOKIE_NAME)?.value;
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    const session = getSessionFromToken(token);
    if (!session) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // Öğretmen sadece belirli sayfalara erişebilir
    const teacherAllowed = ['/panel/ogrenci-yonlendirmesi', '/panel/yonlendirme-gecmisi', '/panel/sinifim'];
    if (session.role === 'teacher' && !teacherAllowed.some(p => pathname.startsWith(p))) {
      return NextResponse.redirect(new URL('/panel/ogrenci-yonlendirmesi', request.url));
    }

    return NextResponse.next();
  }

  // Ana sayfa → her zaman login ekranına yönlendir
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/panel/:path*', '/login', '/api/auth/:path*']
};
