import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function GET() {
  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Veritabanı bağlantısı yok' }, { status: 500 });
    }
    const { data, error } = await supabase
      .from('lesson_hours')
      .select('*')
      .order('period_number', { ascending: true });

    if (error) throw error;
    return NextResponse.json({ hours: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Ders saatleri yüklenemedi' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Veritabanı bağlantısı yok' }, { status: 500 });
    }
    const body = await request.json();
    const { hours } = body;

    if (!Array.isArray(hours)) {
      return NextResponse.json({ error: 'hours array gerekli' }, { status: 400 });
    }

    for (const h of hours) {
      if (!h.period_number || !h.start_time || !h.end_time) {
        return NextResponse.json({ error: 'Her ders için period_number, start_time ve end_time gerekli' }, { status: 400 });
      }

      const { error } = await supabase
        .from('lesson_hours')
        .upsert({
          period_number: h.period_number,
          start_time: h.start_time,
          end_time: h.end_time,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'period_number' });

      if (error) throw error;
    }

    const { data } = await supabase
      .from('lesson_hours')
      .select('*')
      .order('period_number', { ascending: true });

    return NextResponse.json({ hours: data || [], message: 'Ders saatleri güncellendi' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Ders saatleri güncellenemedi' }, { status: 500 });
  }
}
