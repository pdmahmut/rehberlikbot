import { NextRequest, NextResponse } from 'next/server';
import { writeToGoogleSheets } from '@/lib/sheets';
import { YonlendirilenOgrenci, ReferralRecord } from '@/types';
import { supabase } from '@/lib/supabase';
import { getTeachersData, validateTeacherClass, resolveKeyFromDisplay } from '@/lib/teachers';
import { groupGuidanceStudents, normalizeGuidanceStudent } from '@/lib/guidance';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { students }: { students: YonlendirilenOgrenci[] } = await request.json();

    if (!students || students.length === 0) {
      return NextResponse.json(
        { error: 'Öğrenci listesi boş' },
        { status: 400 }
      );
    }

    console.log(`📋 ${students.length} öğrenci için gönderim işlemi başlatılıyor...`);

    const { records } = getTeachersData();
    if (records.length > 0) {
      for (const s of students) {
        const keyCandidate = resolveKeyFromDisplay(s.sinifSube) || s.sinifSube;
        const res = validateTeacherClass(s.ogretmenAdi, keyCandidate, records);
        if (!res.valid) {
          return NextResponse.json({ success: false, message: res.message }, { status: 400 });
        }
      }
    }

    const normalizedStudents = groupGuidanceStudents(
      students.map((student) => normalizeGuidanceStudent(student))
    );

    let sheetsSuccess = false;
    const errors: string[] = [];

    // Google Sheets entegrasyonu
    try {
      sheetsSuccess = await writeToGoogleSheets(normalizedStudents);
      if (!sheetsSuccess) {
        errors.push('Google Sheets kaydı başarısız');
      }
    } catch (error) {
      console.error('Google Sheets entegrasyonu hatası:', error);
      errors.push('Google Sheets entegrasyonu hatası');
    }

    // Supabase referrals tablosuna kayıt
    try {
      if (supabase) {
        const payload: ReferralRecord[] = normalizedStudents.map((student) => ({
          teacher_name: student.ogretmenAdi,
          class_key: student.sinifSubeKey || resolveKeyFromDisplay(student.sinifSube) || '',
          class_display: student.sinifSube,
          student_name: student.ogrenciAdi,
          reason: student.yonlendirmeNedeni,
          note: student.not ?? null,
          source: 'web',
        }));

        const { error: supabaseError } = await supabase
          .from('referrals')
          .insert(payload);

        if (supabaseError) {
          console.error('Supabase referrals insert hatası:', supabaseError.message);
          errors.push('Supabase istatistik kaydı yapılamadı');
        }
      }
    } catch (error) {
      console.error('Supabase referrals entegrasyonu hatası:', error);
      errors.push('Supabase istatistik kaydı hatası');
    }

    const sentCount = normalizedStudents.length;

    if (sheetsSuccess) {
      return NextResponse.json({
        success: true,
        message: `${sentCount} öğrenci başarıyla Google Sheets'e gönderildi`,
        sentCount,
        sheets: sheetsSuccess
      });
    } else {
      return NextResponse.json({
        success: false,
        message: `Gönderim başarısız: ${errors.join(', ')}`,
        sheets: sheetsSuccess,
        errors: errors
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Send Guidance API Error:', error);
    return NextResponse.json(
      { error: 'Gönderim sırasında hata oluştu' },
      { status: 500 }
    );
  }
}
