import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_NAME, verifySession } from '@/lib/session';
import { getSupabaseAdmin, hasSupabaseAdmin } from '@/lib/supabaseAdmin';
import {
  decryptPassword,
  encryptPassword,
  normalizePassword,
  passwordLookup,
  safeEqual,
  validatePasswordStrength,
} from '@/lib/password';

export const runtime = 'nodejs';

// Imzali oturum token'ini dogrular (bkz. src/lib/session.ts)
async function getSession(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session || session.role !== 'teacher') {
    return NextResponse.json({ error: 'Oturum bulunamadı' }, { status: 401 });
  }
  if (!session.teacherId && !session.username) {
    return NextResponse.json({ error: 'Geçersiz oturum' }, { status: 401 });
  }

  if (!hasSupabaseAdmin()) {
    return NextResponse.json({ error: 'Sunucu yapılandırma hatası' }, { status: 500 });
  }
  const supabase = getSupabaseAdmin();

  const { oldPassword, newPassword } = await request.json();
  const trimmedOld = String(oldPassword || '').trim();
  const trimmedNew = String(newPassword || '').trim();

  if (!trimmedOld || !trimmedNew) {
    return NextResponse.json({ error: 'Tüm alanlar zorunlu' }, { status: 400 });
  }

  const strength = validatePasswordStrength(trimmedNew);
  if (!strength.ok) {
    return NextResponse.json({ error: strength.error }, { status: 400 });
  }

  const teacherLookup = session.teacherId
    ? supabase.from('teacher_users').select('id, teacher_name, password_cipher').eq('id', session.teacherId).single()
    : supabase.from('teacher_users').select('id, teacher_name, password_cipher').eq('username', session.username).single();

  const { data: teacher, error } = await teacherLookup;
  if (error || !teacher) {
    return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 });
  }

  const storedPassword = decryptPassword(teacher.password_cipher);
  if (!storedPassword || !safeEqual(normalizePassword(trimmedOld), normalizePassword(storedPassword))) {
    return NextResponse.json({ error: 'Mevcut şifre yanlış' }, { status: 401 });
  }

  if (normalizePassword(trimmedOld) === normalizePassword(trimmedNew)) {
    return NextResponse.json({ error: 'Yeni şifre mevcut şifreyle aynı olamaz' }, { status: 400 });
  }

  // Sadece-sifre girisi oldugu icin sifre sistem genelinde benzersiz olmali.
  const nextLookup = passwordLookup(trimmedNew);

  const { data: sameOnAnotherUser } = await supabase
    .from('teacher_users')
    .select('id')
    .eq('password_lookup', nextLookup)
    .neq('id', teacher.id)
    .maybeSingle();

  if (sameOnAnotherUser) {
    return NextResponse.json({ error: 'Bu şifre başka bir öğretmende kullanılıyor' }, { status: 409 });
  }

  const { data: existsInHistory } = await supabase
    .from('teacher_password_history')
    .select('id')
    .eq('password_lookup', nextLookup)
    .maybeSingle();

  if (existsInHistory) {
    return NextResponse.json({ error: 'Bu şifre daha önce kullanılmış. Farklı bir şifre seçin.' }, { status: 409 });
  }

  const { error: updateErr } = await supabase
    .from('teacher_users')
    .update({
      password_lookup: nextLookup,
      password_cipher: encryptPassword(trimmedNew),
    })
    .eq('id', teacher.id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  await supabase.from('teacher_password_history').insert({
    teacher_user_id: teacher.id,
    password_lookup: nextLookup,
  });

  return NextResponse.json({ success: true });
}
