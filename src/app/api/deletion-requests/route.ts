import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

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

// Listele
export async function GET(request: NextRequest) {
  if (!supabase) return NextResponse.json({ error: 'Supabase yok' }, { status: 500 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const classKey = searchParams.get('classKey');

  let query = supabase
    .from('deletion_requests')
    .select('*')
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);
  if (classKey) query = query.eq('class_key', classKey);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ requests: data ?? [] });
}

// Yeni silme isteği oluştur (öğretmen)
export async function POST(request: NextRequest) {
  if (!supabase) return NextResponse.json({ error: 'Supabase yok' }, { status: 500 });

  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Oturum bulunamadı' }, { status: 401 });

  const body = await request.json();
  const { class_key, class_display, student_name, student_number, student_value } = body;

  if (!class_key || !student_name || !student_value) {
    return NextResponse.json({ error: 'Eksik alan' }, { status: 400 });
  }

  // Zaten bekleyen istek var mı?
  const { data: existing } = await supabase
    .from('deletion_requests')
    .select('id')
    .eq('class_key', class_key)
    .eq('student_value', student_value)
    .eq('status', 'bekliyor')
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: 'Bu öğrenci için zaten bekleyen bir istek var' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('deletion_requests')
    .insert({
      class_key,
      class_display: class_display ?? class_key,
      student_name,
      student_number: student_number ?? null,
      student_value,
      teacher_name: session.teacherName ?? session.username,
      status: 'bekliyor',
    })
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ request: data }, { status: 201 });
}

// Onayla / Reddet (admin)
export async function PATCH(request: NextRequest) {
  if (!supabase) return NextResponse.json({ error: 'Supabase yok' }, { status: 500 });

  const session = getSession(request);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Yetki yok' }, { status: 403 });
  }

  const { id, action } = await request.json(); // action: 'onayla' | 'reddet'
  if (!id || !['onayla', 'reddet'].includes(action)) {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 });
  }

  // İsteği getir
  const { data: req, error: fetchErr } = await supabase
    .from('deletion_requests')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchErr || !req) return NextResponse.json({ error: 'İstek bulunamadı' }, { status: 404 });

  if (action === 'onayla') {
    const sv: string = req.student_value;
    if (sv.startsWith('supabase_')) {
      // Supabase kaydını sil
      const supabaseId = sv.replace('supabase_', '');
      await supabase.from('class_students').delete().eq('id', supabaseId);
    } else {
      // JSON öğrencisi: dışlama işareti ekle
      await supabase.from('class_students').insert({
        class_key: req.class_key,
        class_display: req.class_display,
        student_name: sv,
        student_number: '__SINIF_DISI__',
        status: 'tumu',
      });
    }
  }

  const newStatus = action === 'onayla' ? 'onaylandi' : 'reddedildi';
  const { error } = await supabase
    .from('deletion_requests')
    .update({ status: newStatus })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, status: newStatus });
}

// İptal et (öğretmen kendi isteğini geri çekebilir)
export async function DELETE(request: NextRequest) {
  if (!supabase) return NextResponse.json({ error: 'Supabase yok' }, { status: 500 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id gerekli' }, { status: 400 });

  const { error } = await supabase
    .from('deletion_requests')
    .delete()
    .eq('id', id)
    .eq('status', 'bekliyor'); // sadece bekleyen iptal edilebilir

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
