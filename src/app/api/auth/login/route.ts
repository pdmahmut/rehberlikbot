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
    const { role, password } = await request.json();

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

      const enteredPassword = String(password || '').trim();
      if (!enteredPassword) {
        return NextResponse.json({ error: 'Şifre gerekli' }, { status: 400 });
      }
      if (enteredPassword.length < 4) {
        return NextResponse.json({ error: 'Şifre en az 4 karakter olmalı' }, { status: 400 });
      }

      const normalizedPassword = enteredPassword.toLocaleLowerCase('tr-TR');

      const { data: teacher, error } = await supabase
        .from('teacher_users')
        .select('id, username, teacher_name, class_key, class_display, password_hash')
        .not('password_hash', 'is', null)
        .eq('password_hash', enteredPassword)
        .maybeSingle();

      if (error) {
        return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
      }

      if (!teacher) {
        const { data: maybeTeacher } = await supabase
          .from('teacher_users')
          .select('id, username, teacher_name, class_key, class_display, password_hash')
          .not('password_hash', 'is', null)
          .filter('password_hash', 'ilike', enteredPassword)
          .maybeSingle();
        if (!maybeTeacher) {
          return NextResponse.json({ error: 'Şifre hatalı' }, { status: 401 });
        }
        const token = encodeSession({
          role: 'teacher',
          teacherId: maybeTeacher.id,
          username: maybeTeacher.username,
          teacherName: maybeTeacher.teacher_name,
          classKey: maybeTeacher.class_key || null,
          classDisplay: maybeTeacher.class_display || null,
          isHomeroom: !!(maybeTeacher.class_key),
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

      if ((teacher.password_hash || '').toLocaleLowerCase('tr-TR') !== normalizedPassword) {
        return NextResponse.json({ error: 'Şifre hatalı' }, { status: 401 });
      }

      const token = encodeSession({
        role: 'teacher',
        teacherId: teacher.id,
        username: teacher.username,
        teacherName: teacher.teacher_name,
        classKey: teacher.class_key || null,
        classDisplay: teacher.class_display || null,
        isHomeroom: !!(teacher.class_key),
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
