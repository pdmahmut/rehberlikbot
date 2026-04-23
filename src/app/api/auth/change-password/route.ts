import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const COOKIE_NAME = 'rehberlik_session';

function getSession(request: NextRequest) {
  try {
    const token = request.cookies.get(COOKIE_NAME)?.value;
    if (!token) return null;
    const payload = JSON.parse(Buffer.from(token, 'base64url').toString());
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const session = getSession(request);
  if (!session || session.role !== 'teacher') {
    return NextResponse.json({ error: 'Oturum bulunamadı' }, { status: 401 });
  }
  if (!session.teacherId && !session.username) {
    return NextResponse.json({ error: 'Geçersiz oturum' }, { status: 401 });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Sunucu yapılandırma hatası' }, { status: 500 });
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { oldPassword, newPassword } = await request.json();

  if (!oldPassword?.trim() || !newPassword?.trim()) {
    return NextResponse.json({ error: 'Tüm alanlar zorunlu' }, { status: 400 });
  }
  if (newPassword.trim().length < 4) {
    return NextResponse.json({ error: 'Yeni şifre en az 4 karakter olmalı' }, { status: 400 });
  }

  const normalizedOld = oldPassword.trim().toLocaleLowerCase('tr-TR');
  const normalizedNew = newPassword.trim().toLocaleLowerCase('tr-TR');

  // Öğretmeni bul
  const teacherLookup = session.teacherId
    ? supabase.from('teacher_users').select('*').eq('id', session.teacherId).single()
    : supabase.from('teacher_users').select('*').eq('username', session.username).single();
  const { data: teacher, error } = await teacherLookup;

  if (error || !teacher) {
    return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 });
  }

  // Mevcut şifreyi doğrula:
  // 1) password_hash doluysa onu kontrol et
  // 2) Boşsa ilk adı kontrol et (varsayılan şifre)
  const firstName = (teacher.teacher_name ?? '').split(' ')[0].toLocaleLowerCase('tr-TR');
  const storedHash = teacher.password_hash?.trim();

  const isValid = storedHash
    ? storedHash.toLocaleLowerCase('tr-TR') === normalizedOld
    : firstName === normalizedOld;

  if (!isValid) {
    return NextResponse.json({ error: 'Mevcut şifre yanlış' }, { status: 401 });
  }

  if (normalizedOld === normalizedNew) {
    return NextResponse.json({ error: 'Yeni şifre mevcut şifreyle aynı olamaz' }, { status: 400 });
  }

  const { data: sameOnAnotherUser } = await supabase
    .from('teacher_users')
    .select('id,password_hash')
    .not('password_hash', 'is', null)
    .eq('password_hash', newPassword.trim())
    .neq('id', teacher.id)
    .maybeSingle();

  if (sameOnAnotherUser) {
    return NextResponse.json({ error: 'Bu şifre başka bir öğretmende kullanılıyor' }, { status: 409 });
  }

  const { data: existsInHistory } = await supabase
    .from('teacher_password_history')
    .select('id')
    .eq('normalized_password', normalizedNew)
    .maybeSingle();

  if (existsInHistory) {
    return NextResponse.json({ error: 'Bu şifre daha önce kullanılmış. Farklı bir şifre seçin.' }, { status: 409 });
  }

  // Yeni şifreyi kaydet
  const { error: updateErr } = await supabase
    .from('teacher_users')
    .update({ password_hash: newPassword.trim() })
    .eq('id', session.teacherId);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  await supabase.from('teacher_password_history').insert({
    teacher_user_id: teacher.id,
    normalized_password: normalizedNew,
  });

  return NextResponse.json({ success: true });
}
