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
    .from('work_requests')
    .select('*')
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);
  if (classKey) query = query.eq('class_key', classKey);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ requests: data ?? [] });
}

// Yeni çalışma isteği oluştur (öğretmen)
export async function POST(request: NextRequest) {
  if (!supabase) return NextResponse.json({ error: 'Supabase yok' }, { status: 500 });

  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Oturum bulunamadı' }, { status: 401 });

  const body = await request.json();
  const { message } = body;

  if (!message?.trim()) {
    return NextResponse.json({ error: 'İstek açıklaması boş olamaz' }, { status: 400 });
  }

  if (!session.classKey) {
    return NextResponse.json({ error: 'Sınıf bilgisi bulunamadı' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('work_requests')
    .insert({
      class_key: session.classKey,
      class_display: session.classDisplay ?? session.classKey,
      teacher_name: session.teacherName ?? session.username,
      message: message.trim(),
      status: 'bekliyor',
    })
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ request: data }, { status: 201 });
}

// Planla / Durum güncelle (admin)
export async function PATCH(request: NextRequest) {
  if (!supabase) return NextResponse.json({ error: 'Supabase yok' }, { status: 500 });

  const session = getSession(request);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Yetki yok' }, { status: 403 });
  }

  const body = await request.json();
  const { id, action } = body;

  if (!id) return NextResponse.json({ error: 'id gerekli' }, { status: 400 });

  // Planlama: guidance_plan oluştur (topic_id=null → sınıf rehberliğinde çıkmaz) + work_request güncelle
  if (action === 'planla') {
    const { topic_title, plan_date, lesson_period, class_key, class_display, teacher_name } = body;
    if (!topic_title || !plan_date || !class_key) {
      return NextResponse.json({ error: 'Konu, tarih ve sınıf gerekli' }, { status: 400 });
    }

    // Takvimde ders saatinde görünmesi için guidance_plan oluştur (topic bağlamadan)
    const { data: plan, error: planErr } = await supabase
      .from('guidance_plans')
      .insert({
        topic_id: null,
        class_key,
        class_display: class_display || class_key,
        status: 'planned',
        plan_date,
        lesson_period: lesson_period || null,
        teacher_name: teacher_name || null,
      })
      .select('id')
      .single();

    if (planErr) return NextResponse.json({ error: planErr.message }, { status: 500 });

    // work_request güncelle
    const { error: wrErr } = await supabase
      .from('work_requests')
      .update({
        status: 'planlandı',
        plan_date,
        lesson_period: lesson_period || null,
        topic_title: topic_title.trim(),
        guidance_plan_id: plan.id,
      })
      .eq('id', id);

    if (wrErr) return NextResponse.json({ error: wrErr.message }, { status: 500 });
    return NextResponse.json({ success: true, plan_id: plan.id });
  }

  // Basit durum güncellemesi
  const { status } = body;
  if (!['okundu', 'tamamlandi'].includes(status)) {
    return NextResponse.json({ error: 'Geçersiz durum' }, { status: 400 });
  }

  const { error } = await supabase
    .from('work_requests')
    .update({ status })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// Sil (admin veya isteği gönderen öğretmen)
export async function DELETE(request: NextRequest) {
  if (!supabase) return NextResponse.json({ error: 'Supabase yok' }, { status: 500 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id gerekli' }, { status: 400 });

  const { error } = await supabase
    .from('work_requests')
    .delete()
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
