import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const runtime = 'nodejs';

// Bireysel başvuruları getir
export async function GET(request: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json({ requests: [] });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const status = searchParams.get('status');

    if (id) {
      // Tek kayıt getir
      const { data, error } = await supabase
        .from('individual_requests')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Supabase individual_requests fetch single error:', error);
        return NextResponse.json(
          { error: 'Başvuru bulunamadı: ' + error.message },
          { status: 404 }
        );
      }

      return NextResponse.json({ request: data });
    }

    // Tüm kayıtları getir
    let query = supabase
      .from('individual_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Supabase individual_requests fetch error:', error);
      return NextResponse.json(
        { error: 'Başvurular alınamadı: ' + error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ requests: data || [] });
  } catch (err) {
    console.error('Individual requests GET error:', err);
    return NextResponse.json(
      { error: 'Sunucu hatası' },
      { status: 500 }
    );
  }
}

// Yeni bireysel başvuru oluştur
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { student_name, class_key, class_display, request_date, note } = body;

    if (!student_name || !request_date) {
      return NextResponse.json(
        { error: 'Zorunlu alanlar eksik: student_name, request_date' },
        { status: 400 }
      );
    }

    if (!supabase) {
      return NextResponse.json({
        request: {
          id: `offline-${Date.now()}`,
          student_name,
          class_key,
          class_display,
          request_date,
          note,
          status: 'pending',
          created_at: new Date().toISOString()
        }
      });
    }

    const { data, error } = await supabase
      .from('individual_requests')
      .insert({
        student_name,
        class_key: class_key || null,
        class_display: class_display || null,
        request_date,
        note: note || null,
        status: 'pending'
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase individual_requests insert error:', error);
      return NextResponse.json(
        { error: 'Başvuru oluşturulamadı: ' + error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ request: data }, { status: 201 });
  } catch (err) {
    console.error('Individual requests POST error:', err);
    return NextResponse.json(
      { error: 'Sunucu hatası' },
      { status: 500 }
    );
  }
}

// Bireysel başvuruyu güncelle (durumu değiştir)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, student_name, class_key, class_display, request_date, note, status } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'id gerekli' },
        { status: 400 }
      );
    }

    if (!supabase) {
      return NextResponse.json({ request: { id, student_name, class_key, class_display, request_date, note, status } });
    }

    const updateData: any = { updated_at: new Date().toISOString() };
    if (student_name !== undefined) updateData.student_name = student_name;
    if (class_key !== undefined) updateData.class_key = class_key;
    if (class_display !== undefined) updateData.class_display = class_display;
    if (request_date !== undefined) updateData.request_date = request_date;
    if (note !== undefined) updateData.note = note;
    if (status !== undefined) updateData.status = status;

    const { data, error } = await supabase
      .from('individual_requests')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Supabase individual_requests update error:', error);
      return NextResponse.json(
        { error: 'Başvuru güncellenemedi: ' + error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ request: data });
  } catch (err) {
    console.error('Individual requests PUT error:', err);
    return NextResponse.json(
      { error: 'Sunucu hatası' },
      { status: 500 }
    );
  }
}

// Bireysel başvuruyu sil
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'id gerekli' },
        { status: 400 }
      );
    }

    if (!supabase) {
      return NextResponse.json({ success: true });
    }

    const { error } = await supabase
      .from('individual_requests')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Supabase individual_requests delete error:', error);
      return NextResponse.json(
        { error: 'Başvuru silinemedi: ' + error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Individual requests DELETE error:', err);
    return NextResponse.json(
      { error: 'Sunucu hatası' },
      { status: 500 }
    );
  }
}
