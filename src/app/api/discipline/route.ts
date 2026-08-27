import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { DisiplinRecord } from '@/types';

export const runtime = 'nodejs';

// Disiplin kaydı oluştur
export async function POST(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const supabase = getSupabaseAdmin();

  try {
    const data: DisiplinRecord = await request.json();
    
    if (!data.student_id || !data.student_name || !data.penalty_type) {
      return NextResponse.json(
        { error: 'Zorunlu alanlar eksik: student_id, student_name, penalty_type' },
        { status: 400 }
      );
    }

    if (!supabase) {
      // Supabase yoksa sadece başarılı döndür (geliştirme amaçlı)
      console.log('Disiplin kaydı (Supabase yok):', data);
      return NextResponse.json({
        success: true,
        message: 'Disiplin kaydı oluşturuldu (offline mod)',
        data: { ...data, id: `offline-${Date.now()}` }
      });
    }

    // Supabase'e kaydet
    const { data: insertedData, error } = await supabase
      .from('discipline_records')
      .insert({
        student_id: data.student_id,
        student_name: data.student_name,
        class_key: data.class_key || '',
        class_display: data.class_display || '',
        event_date: data.event_date,
        reason: data.reason,
        penalty_type: data.penalty_type,
        notes: data.notes || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase discipline insert error:', error);
      return NextResponse.json(
        { error: 'Disiplin kaydı oluşturulamadı: ' + error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Disiplin kaydı başarıyla oluşturuldu',
      data: insertedData
    });

  } catch (error) {
    console.error('Discipline API Error:', error);
    return NextResponse.json(
      { error: 'Disiplin kaydı oluşturulurken hata oluştu' },
      { status: 500 }
    );
  }
}

// Öğrencinin disiplin geçmişini getir
export async function GET(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const supabase = getSupabaseAdmin();

  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');
    const studentName = searchParams.get('studentName');

    if (!supabase) {
      return NextResponse.json({
        records: [],
        totalCount: 0,
        message: 'Supabase bağlantısı yok'
      });
    }

    let query = supabase
      .from('discipline_records')
      .select('*')
      .order('created_at', { ascending: false });

    if (studentId) {
      query = query.eq('student_id', studentId);
    } else if (studentName) {
      query = query.ilike('student_name', `%${studentName}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Supabase discipline fetch error:', error);
      return NextResponse.json(
        { error: 'Disiplin kayıtları getirilemedi: ' + error.message },
        { status: 500 }
      );
    }

    // İstatistikleri hesapla
    const stats = {
      totalCount: data?.length || 0,
      byPenaltyType: {} as Record<string, number>,
      byReason: {} as Record<string, number>,
    };

    data?.forEach(record => {
      // Ceza türüne göre
      stats.byPenaltyType[record.penalty_type] = (stats.byPenaltyType[record.penalty_type] || 0) + 1;
      // Nedene göre
      if (record.reason) {
        stats.byReason[record.reason] = (stats.byReason[record.reason] || 0) + 1;
      }
    });

    return NextResponse.json({
      records: data || [],
      stats
    });

  } catch (error) {
    console.error('Discipline GET API Error:', error);
    return NextResponse.json(
      { error: 'Disiplin kayıtları getirilirken hata oluştu' },
      { status: 500 }
    );
  }
}

// Disiplin kaydı sil
export async function DELETE(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const supabase = getSupabaseAdmin();

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Kayıt ID\'si gerekli' },
        { status: 400 }
      );
    }

    if (!supabase) {
      return NextResponse.json({
        success: true,
        message: 'Disiplin kaydı silindi (offline mod)'
      });
    }

    const { error } = await supabase
      .from('discipline_records')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Supabase discipline delete error:', error);
      return NextResponse.json(
        { error: 'Disiplin kaydı silinemedi: ' + error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Disiplin kaydı başarıyla silindi'
    });

  } catch (error) {
    console.error('Discipline DELETE API Error:', error);
    return NextResponse.json(
      { error: 'Disiplin kaydı silinirken hata oluştu' },
      { status: 500 }
    );
  }
}
