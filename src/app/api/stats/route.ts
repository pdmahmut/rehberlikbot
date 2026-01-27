import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  if (!supabase) {
    return NextResponse.json(
      { error: 'Supabase configuration missing' },
      { status: 500 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const teacher = searchParams.get('teacher');
    const classKey = searchParams.get('class');

    // Basit: eğer tarih aralığı verilmemişse tüm kayıtları al
    let query = supabase.from('referrals').select('*', { count: 'exact', head: false });

    if (from) {
      query = query.gte('created_at', `${from}T00:00:00`);
    }
    if (to) {
      query = query.lte('created_at', `${to}T23:59:59`);
    }

    if (teacher) {
      query = query.eq('teacher_name', teacher);
    }

    if (classKey) {
      // class_display ile filtreliyoruz (classKey seçilen sınıfın display text'i)
      query = query.eq('class_display', classKey);
    }

    // Tarihe göre sırala (en yeniden eskiye)
    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error('Supabase stats query error:', error.message);
      return NextResponse.json(
        { error: 'İstatistikler alınırken hata oluştu' },
        { status: 500 }
      );
    }

    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + 1); // Pazartesi başlangıç varsayımı
    const weekStr = startOfWeek.toISOString().slice(0, 10);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthStr = startOfMonth.toISOString().slice(0, 10);

    let todayCount = 0;
    let weekCount = 0;
    let monthCount = 0;

    const byTeacher: Record<string, number> = {};
    const byClass: Record<string, number> = {};
    const byReason: Record<string, number> = {};
    const byReasonToday: Record<string, number> = {};
    const byReasonWeek: Record<string, number> = {};
    const byReasonMonth: Record<string, number> = {};
    const todayStudents: { student_name: string; class_display: string; reason?: string; teacher_name?: string; created_at?: string }[] = [];
    const allStudents: { student_name: string; class_display: string; reason?: string; date: string; teacher_name?: string; created_at?: string }[] = [];

    for (const row of data ?? []) {
      const created = row.created_at as string;
      const day = created.slice(0, 10);
      const reason = (row.reason as string) || 'Belirtilmemiş';

      // Tüm öğrencileri kaydet
      allStudents.push({
        student_name: (row.student_name as string) ?? '',
        class_display: (row.class_display as string) ?? '',
        reason: reason,
        date: day,
        teacher_name: (row.teacher_name as string) ?? '',
        created_at: created,
      });

      // Tüm zamanlar için neden sayısı
      byReason[reason] = (byReason[reason] || 0) + 1;

      if (day === todayStr) {
        todayCount++;
        byReasonToday[reason] = (byReasonToday[reason] || 0) + 1;
        todayStudents.push({
          student_name: (row.student_name as string) ?? '',
          class_display: (row.class_display as string) ?? '',
          reason: reason,
          teacher_name: (row.teacher_name as string) ?? '',
          created_at: created,
        });
      }
      
      if (day >= weekStr && day <= todayStr) {
        weekCount++;
        byReasonWeek[reason] = (byReasonWeek[reason] || 0) + 1;
      }

      if (day >= monthStr && day <= todayStr) {
        monthCount++;
        byReasonMonth[reason] = (byReasonMonth[reason] || 0) + 1;
      }

      const teacherName = (row.teacher_name as string) || 'Bilinmiyor';
      byTeacher[teacherName] = (byTeacher[teacherName] || 0) + 1;

      const classDisplay = (row.class_display as string) || 'Bilinmiyor';
      byClass[classDisplay] = (byClass[classDisplay] || 0) + 1;
    }

    let topTeacher: { name: string; count: number } | null = null;
    for (const [name, count] of Object.entries(byTeacher)) {
      if (!topTeacher || count > topTeacher.count) {
        topTeacher = { name, count };
      }
    }

    let topClass: { name: string; count: number } | null = null;
    for (const [name, count] of Object.entries(byClass)) {
      if (!topClass || count > topClass.count) {
        topClass = { name, count };
      }
    }

    return NextResponse.json({
      serverTime: new Date().toISOString(),
      todayCount,
      weekCount,
      monthCount,
      totalCount: data?.length ?? 0,
      topTeacher,
      topClass,
      todayStudents,
      allStudents: allStudents.slice(0, 100), // Son 100 kayıt
      byTeacher,
      byClass,
      byReason,
      byReasonToday,
      byReasonWeek,
      byReasonMonth,
    });
  } catch (error) {
    console.error('Stats API error:', error);
    return NextResponse.json(
      { error: 'İstatistikler alınırken beklenmeyen hata oluştu' },
      { status: 500 }
    );
  }
}
