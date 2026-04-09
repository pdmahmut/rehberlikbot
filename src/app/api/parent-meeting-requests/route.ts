import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    if (!supabase) return NextResponse.json({ requests: [] });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    let query = supabase
      .from('parent_meeting_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ requests: data || [] });
  } catch (err) {
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!supabase) return NextResponse.json({ error: 'Veritabanı bağlantısı yok' }, { status: 500 });

    const body = await request.json();
    const { student_name, class_key, class_display, parent_name, request_date, note, request_type, subject, detail, status } = body;

    if (!student_name || !request_date) {
      return NextResponse.json({ error: 'student_name ve request_date zorunludur' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('parent_meeting_requests')
      .insert({
        student_name,
        class_key: class_key || null,
        class_display: class_display || null,
        parent_name: parent_name || "",
        request_date,
        note: note || "",
        subject: subject || "Veli talebi",
        detail: detail || note || "",
        request_type: request_type || 'gorusme',
        status: status || 'new'
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ request: data }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    if (!supabase) return NextResponse.json({ error: 'Veritabanı bağlantısı yok' }, { status: 500 });

    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) return NextResponse.json({ error: 'id zorunludur' }, { status: 400 });

    const { data, error } = await supabase
      .from('parent_meeting_requests')
      .update({ ...updateData, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ request: data });
  } catch (err) {
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!supabase) return NextResponse.json({ error: 'Veritabanı bağlantısı yok' }, { status: 500 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'id zorunludur' }, { status: 400 });

    const { error } = await supabase.from('parent_meeting_requests').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
  }
}
