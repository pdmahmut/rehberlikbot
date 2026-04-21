import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'rehberlik_session';

function getSessionFromToken(token: string) {
  try {
    const payload = JSON.parse(Buffer.from(token, 'base64url').toString());
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: 'Oturum yok' }, { status: 401 });
  const session = getSessionFromToken(token);
  if (!session) return NextResponse.json({ error: 'Geçersiz oturum' }, { status: 401 });
  return NextResponse.json(session);
}