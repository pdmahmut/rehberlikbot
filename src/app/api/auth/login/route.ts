import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const COOKIE_NAME = 'rehberlik_session';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

function encodeSession(user: object): string {
  const payload = JSON.stringify({ ...user, exp: Date.now() + 8 * 60 * 60 * 1000 });
  return Buffer.from(payload).toString('base64url');
}

export async function POST(request: NextRequest) {
  try {
    const { role, password, username } = await request.json();

    if (role === 'admin') {
      if (password !== ADMIN_PASSWORD) {
        return NextResponse.json({ error: 'Yanlış şifre' }, { status: 401 });
      }
      const token = encodeSession({ role: 'admin' });
      const response = NextResponse.json({ success: true, role: 'admin' });
      response.cookies.set(COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 8 * 60 * 60
      });
      return response;
    }

    if (role === 'teacher') {
      const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !supabaseKey) {
        return NextResponse.json({ error: 'Sunucu yapılandırma hatası' }, { status: 500 });
      }
      const supabase = createClient(supabaseUrl, supabaseKey);

      if (!username?.trim()) {
        return NextResponse.json({ error: 'Kullanıcı adı gerekli' }, { status: 400 });
      }

      const { data: teachers, error } = await supabase
        .from('teacher_users')
        .select('*')
        .ilike('teacher_name', `${username.trim()}%`);

      if (error) {
        return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
      }

      if (!teachers || teachers.length === 0) {
        return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 401 });
      }

      const enteredName = username.trim().toLocaleLowerCase('tr-TR');
      const data = teachers.find(t => {
        const firstName = (t.teacher_name ?? '').split(' ')[0].toLocaleLowerCase('tr-TR');
        return firstName === enteredName;
      }) ?? teachers[0];

      const entered = password.trim().toLocaleLowerCase('tr-TR');
      const storedHash = data.password_hash?.trim();
      const firstName = (data.teacher_name ?? '').split(' ')[0].toLocaleLowerCase('tr-TR');
      const isValid = storedHash
        ? storedHash.toLocaleLowerCase('tr-TR') === entered
        : firstName === entered;

      if (!isValid) {
        return NextResponse.json({ error: 'Yanlış şifre' }, { status: 401 });
      }

      const token = encodeSession({
        role: 'teacher',
        username: data.username,
        teacherName: data.teacher_name,
        classKey: data.class_key || null,
        classDisplay: data.class_display || null,
        isHomeroom: !!(data.class_key),
      });

      const response = NextResponse.json({ success: true, role: 'teacher' });
      response.cookies.set(COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 8 * 60 * 60
      });
      return response;
    }

    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
  }
}
