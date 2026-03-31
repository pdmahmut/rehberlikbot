import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const runtime = 'nodejs';

// Belirli bir öğrencinin yönlendirme geçmişini getir
export async function GET(request: NextRequest) {
  if (!supabase) {
    return NextResponse.json(
      { error: 'Supabase yapılandırması eksik' },
      { status: 500 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const studentName = searchParams.get('studentName');
    const classDisplay = searchParams.get('classDisplay');

    if (!studentName) {
      return NextResponse.json(
        { error: 'studentName parametresi gerekli' },
        { status: 400 }
      );
    }

    // Öğrencinin tüm yönlendirmelerini getir
    let query = supabase
      .from('referrals')
      .select('*')
      .ilike('student_name', `%${studentName}%`)
      .order('created_at', { ascending: false });

    // Eğer sınıf da belirtilmişse filtrele
    if (classDisplay) {
      query = query.eq('class_display', classDisplay);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Student history query error:', error);
      return NextResponse.json(
        { error: 'Öğrenci geçmişi alınamadı' },
        { status: 500 }
      );
    }

    // İstatistikleri hesapla
    const referrals = data || [];
    const reasonCounts: Record<string, number> = {};
    const teacherCounts: Record<string, number> = {};

    for (const r of referrals) {
      const reason = r.reason || 'Belirtilmemiş';
      const teacher = r.teacher_name || 'Bilinmiyor';
      
      reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
      teacherCounts[teacher] = (teacherCounts[teacher] || 0) + 1;
    }

    // En sık neden
    let topReason: { name: string; count: number } | null = null;
    for (const [name, count] of Object.entries(reasonCounts)) {
      if (!topReason || count > topReason.count) {
        topReason = { name, count };
      }
    }

    return NextResponse.json({
      studentName,
      classDisplay,
      totalReferrals: referrals.length,
      referrals: referrals.map(r => ({
        id: r.id,
        studentName: r.student_name || studentName,
        reason: r.reason || 'Belirtilmemiş',
        teacherName: r.teacher_name || 'Bilinmiyor',
        classDisplay: r.class_display,
        date: r.created_at,
        notes: r.notes || null,
      })),
      stats: {
        byReason: reasonCounts,
        byTeacher: teacherCounts,
        topReason,
      }
    });
  } catch (error) {
    console.error('Student history API error:', error);
    return NextResponse.json(
      { error: 'Beklenmeyen hata oluştu' },
      { status: 500 }
    );
  }
}

// Yönlendirme kaydını sil
export async function DELETE(request: NextRequest) {
  if (!supabase) {
    return NextResponse.json(
      { error: 'Supabase yapılandırması eksik' },
      { status: 500 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Kayıt ID\'si gerekli' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('referrals')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Supabase referral delete error:', error);
      return NextResponse.json(
        { error: 'Yönlendirme kaydı silinemedi: ' + error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Yönlendirme kaydı başarıyla silindi'
    });

  } catch (error) {
    console.error('Student history DELETE API error:', error);
    return NextResponse.json(
      { error: 'Yönlendirme kaydı silinirken hata oluştu' },
      { status: 500 }
    );
  }
}
