import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/apiAuth';
import { YonlendirilenOgrenci, ReferralRecord } from '@/types';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getTeachersData, validateTeacherClass, resolveKeyFromDisplay } from '@/lib/teachers';
import { groupGuidanceStudents, normalizeGuidanceStudent } from '@/lib/guidance';

export const runtime = 'nodejs';

// Öğretmenin gönderdiği yönlendirmeleri kaydeder.
//
// Önceden kayıtlar hem Supabase'e hem de bir Google E-Tablosuna yazılıyordu.
// Tablo kullanılmadığı için Sheets entegrasyonu kaldırıldı; tek kaynak
// referrals tablosu.

export async function POST(request: NextRequest) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;

  const supabase = getSupabaseAdmin();

  try {
    const { students }: { students: YonlendirilenOgrenci[] } = await request.json();

    if (!students || students.length === 0) {
      return NextResponse.json({ error: 'Öğrenci listesi boş' }, { status: 400 });
    }

    // Öğretmen adı doğrulaması. Sınıf kısıtı YOK: öğretmen kendi sınıfı
    // dışındaki derslerine girdiği sınıflardan da yönlendirme yapabilir.
    const { records } = await getTeachersData();
    if (records.length > 0) {
      for (const s of students) {
        const keyCandidate = (await resolveKeyFromDisplay(s.sinifSube)) || s.sinifSube;
        const res = validateTeacherClass(s.ogretmenAdi, keyCandidate, records);
        if (!res.valid) {
          return NextResponse.json({ success: false, message: res.message }, { status: 400 });
        }
      }
    }

    const normalizedStudents = groupGuidanceStudents(
      students.map((student) => normalizeGuidanceStudent(student))
    );

    const payload: ReferralRecord[] = await Promise.all(
      normalizedStudents.map(async (student) => ({
        teacher_name: student.ogretmenAdi,
        class_key: student.sinifSubeKey || (await resolveKeyFromDisplay(student.sinifSube)) || '',
        class_display: student.sinifSube,
        student_name: student.ogrenciAdi,
        reason: student.yonlendirmeNedeni,
        note: student.not ?? null,
        source: 'web',
      }))
    );

    const { error } = await supabase.from('referrals').insert(payload);

    if (error) {
      console.error('Yönlendirme kaydı hatası:', error.message);
      return NextResponse.json(
        { success: false, message: 'Yönlendirme kaydedilemedi' },
        { status: 500 }
      );
    }

    const sentCount = normalizedStudents.length;
    return NextResponse.json({
      success: true,
      message: `${sentCount} öğrenci rehberliğe iletildi`,
      sentCount,
    });
  } catch (err) {
    console.error('Yönlendirme gönderimi hatası:', err);
    return NextResponse.json(
      { success: false, message: 'Gönderim sırasında hata oluştu' },
      { status: 500 }
    );
  }
}
