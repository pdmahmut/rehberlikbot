import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      reporter_student_name,
      reporter_class_key,
      reporter_class_display,
      target_student_name,
      target_class_key,
      target_class_display,
      incident_date,
      description,
      wants_meeting
    } = body;

    // Validasyon
    if (!target_student_name || !target_student_name.trim()) {
      return NextResponse.json(
        { error: 'Hedef öğrenci adı gereklidir' },
        { status: 400 }
      );
    }

    if (!description || !description.trim()) {
      return NextResponse.json(
        { error: 'Açıklama gereklidir' },
        { status: 400 }
      );
    }

    // Veritabanına kaydet
    const { data, error } = await supabase
      .from('student_incidents')
      .insert({
        reporter_student_name: reporter_student_name?.trim() || null,
        reporter_class_key: reporter_class_key || null,
        reporter_class_display: reporter_class_display || null,
        target_student_name: target_student_name.trim(),
        target_class_key: target_class_key || null,
        target_class_display: target_class_display || null,
        incident_date: incident_date || new Date().toISOString().slice(0, 10),
        description: description.trim(),
        incident_type: 'conflict', // varsayılan değer
        severity: 'medium', // varsayılan değer
        status: 'new', // varsayılan değer
        reporter_type: reporter_student_name ? 'student' : 'anonymous'
      })
      .select()
      .single();

    if (error) {
      console.error('Student incident insert error:', error);
      return NextResponse.json(
        { error: 'Bildirim kaydedilemedi' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
      message: 'Bildirim başarıyla kaydedildi'
    });

  } catch (error) {
    console.error('Student incidents API error:', error);
    return NextResponse.json(
      { error: 'Sunucu hatası' },
      { status: 500 }
    );
  }
}
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'ID parametresi gereklidir' },
        { status: 400 }
      );
    }

    if (!supabase) {
      return NextResponse.json(
        { error: 'Veritabanı bağlantısı yok' },
        { status: 500 }
      );
    }

    const { error } = await supabase
      .from('student_incidents')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Student incident delete error:', error);
      return NextResponse.json(
        { error: 'Bildirim silinemedi: ' + error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Bildirim başarıyla silindi'
    });

  } catch (error) {
    console.error('Student incidents DELETE API error:', error);
    return NextResponse.json(
      { error: 'Sunucu hatası' },
      { status: 500 }
    );
  }
}
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const { data, error, count } = await supabase
      .from('student_incidents')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Student incidents fetch error:', error);
      return NextResponse.json(
        { error: 'Bildirimler yüklenemedi' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      total: count || 0
    });

  } catch (error) {
    console.error('Student incidents GET API error:', error);
    return NextResponse.json(
      { error: 'Sunucu hatası' },
      { status: 500 }
    );
  }
}