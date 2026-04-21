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
  if (newPassword.trim().length < 3) {
    return NextResponse.json({ error: 'Yeni şifre en az 3 karakter olmalı' }, { status: 400 });
  }

  // Öğretmeni bul
  const { data: teacher, error } = await supabase
    .from('teacher_users')
    .select('*')
    .eq('username', session.username)
    .single();

  if (error || !teacher) {
    return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 });
  }

  // Mevcut şifreyi doğrula:
  // 1) password_hash doluysa onu kontrol et
  // 2) Boşsa ilk adı kontrol et (varsayılan şifre)
  const firstName = (teacher.teacher_name ?? '').split(' ')[0].toLocaleLowerCase('tr-TR');
  const storedHash = teacher.password_hash?.trim();
  const enteredOld = oldPassword.trim().toLocaleLowerCase('tr-TR');

  const isValid = storedHash
    ? storedHash.toLocaleLowerCase('tr-TR') === enteredOld
    : firstName === enteredOld;

  if (!isValid) {
    return NextResponse.json({ error: 'Mevcut şifre yanlış' }, { status: 401 });
  }

  // Yeni şifreyi kaydet
  const { error: updateErr } = await supabase
    .from('teacher_users')
    .update({ password_hash: newPassword.trim() })
    .eq('username', session.username);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
