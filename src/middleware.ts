import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_NAME, verifySession } from '@/lib/session';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes
  if (pathname.startsWith('/login') || pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  // API rotalari kendi guard'larini calistirir (bkz. src/lib/apiAuth.ts)
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Panel korumasi
  if (pathname.startsWith('/panel')) {
    const token = request.cookies.get(COOKIE_NAME)?.value;
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    const session = await verifySession(token);
    if (!session) {
      const response = NextResponse.redirect(new URL('/login', request.url));
      response.cookies.delete(COOKIE_NAME);
      return response;
    }

    // Ogretmen sadece belirli sayfalara erisebilir
    const teacherAllowed = [
      '/panel/ogrenci-yonlendirmesi',
      '/panel/yonlendirmeler',
      '/panel/sinifim',
      '/panel/hesabim',
    ];
    if (session.role === 'teacher' && !teacherAllowed.some(p => pathname.startsWith(p))) {
      return NextResponse.redirect(new URL('/panel/ogrenci-yonlendirmesi', request.url));
    }

    return NextResponse.next();
  }

  // Ana sayfa -> login'e yonlendir
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/panel/:path*', '/login', '/api/auth/:path*']
};
