import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const runtime = 'nodejs';

// Öğretmen yönlendirmelerini listele
export async function GET(request: NextRequest) {
  try {
    if (!supabase) return NextResponse.json({ referrals: [] });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    let query = supabase
      .from('referrals')
      .select('*')
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ referrals: data || [] });
  } catch (err) {
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
  }
}

// Öğretmen yönlendirmesi oluştur
export async function POST(request: NextRequest) {
  try {
    if (!supabase) return NextResponse.json({ error: 'Veritabanı bağlantısı yok' }, { status: 500 });

    const body = await request.json();
    const { student_name, class_key, class_display, teacher_name, note, reason } = body;

    if (!student_name || !teacher_name) {
      return NextResponse.json({ error: 'student_name ve teacher_name zorunludur' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('referrals')
      .insert({
        student_name,
        class_key: class_key || null,
        class_display: class_display || null,
        teacher_name,
        note: note || null,
        reason: reason || note || null,
        status: 'Bekliyor'
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ referral: data }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
  }
}

// Öğretmen yönlendirmesi güncelle
export async function PUT(request: NextRequest) {
  try {
    if (!supabase) return NextResponse.json({ error: 'Veritabanı bağlantısı yok' }, { status: 500 });

    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) return NextResponse.json({ error: 'id zorunludur' }, { status: 400 });

    const { data, error } = await supabase
      .from('referrals')
      .update({ ...updateData, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ referral: data });
  } catch (err) {
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
  }
}

// Öğretmen yönlendirmesi sil
export async function DELETE(request: NextRequest) {
  try {
    if (!supabase) return NextResponse.json({ error: 'Veritabanı bağlantısı yok' }, { status: 500 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'id zorunludur' }, { status: 400 });

    const { error } = await supabase.from('referrals').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
  }
}