import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete('rehberlik_session');
  return response;
}

export async function GET() {
  const response = NextResponse.redirect('http://localhost:3000/login');
  response.cookies.delete('rehberlik_session');
  return response;
}
