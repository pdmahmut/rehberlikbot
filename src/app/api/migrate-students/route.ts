import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { loadStudentData, getSinifSubeList } from '@/lib/data';

export const runtime = 'nodejs';

// Tek seferlik çalıştırılacak migration endpoint'i.
// data.json içindeki mevcut öğrencileri Supabase class_students tablosuna taşır.

export async function POST(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return NextResponse.json(
      { error: 'Supabase configuration missing' },
      { status: 500 }
    );
  }

  try {
    const data = loadStudentData();
    const sinifSubeList = getSinifSubeList();

    const inserts: {
      class_key: string;
      class_display: string;
      student_name: string;
      student_number: string | null;
    }[] = [];

    for (const sinif of sinifSubeList) {
      const sinifKey = sinif.value; // Örn: "8A#1. Sınıf / A Şubesi"
      const sinifText = sinif.text; // Örn: "1. Sınıf / A Şubesi"

      // data.json'da öğrenci listesi key'i: Ogrenci_<sinifText.replace(" / ", " _ ")>
      const ogrenciKey = `Ogrenci_${sinifText.replace(' / ', ' _ ')}`;
      const ogrenciList: any[] = (data as any)[ogrenciKey] || [];

      for (const ogrenci of ogrenciList) {
        // data.json formatı: { value: "...", text: "11 EYLÜL SELEN YAVUZ" }
        // text içinde numara ve isim birlikte: ilk boşluktan öncesi numara, sonrası isim
        const rawText: string = ogrenci.text || '';
        if (!rawText.trim()) continue;

        const firstSpace = rawText.indexOf(' ');
        let studentNumber: string | null = null;
        let studentName: string = rawText.trim();

        if (firstSpace > 0) {
          const potentialNumber = rawText.substring(0, firstSpace);
          // Numara sadece rakamlardan oluşuyorsa ayır
          if (/^\d+$/.test(potentialNumber)) {
            studentNumber = potentialNumber;
            studentName = rawText.substring(firstSpace + 1).trim();
          }
        }

        if (!studentName) continue;

        inserts.push({
          class_key: sinifKey,
          class_display: sinifText,
          student_name: studentName,
          student_number: studentNumber,
        });
      }
    }

    if (inserts.length === 0) {
      return NextResponse.json({ message: 'Aktarılacak öğrenci bulunamadı', count: 0 });
    }

    // Büyük insertleri parça parça gönderelim (ör: 500lük batchler)
    const batchSize = 500;
    let insertedTotal = 0;

    for (let i = 0; i < inserts.length; i += batchSize) {
      const batch = inserts.slice(i, i + batchSize);
      const { error } = await supabase.from('class_students').insert(batch);
      if (error) {
        console.error('Supabase migration insert error:', error.message);
        return NextResponse.json(
          { error: 'Migration sırasında hata oluştu', inserted: insertedTotal },
          { status: 500 }
        );
      }
      insertedTotal += batch.length;
    }

    return NextResponse.json({ message: 'Migration tamamlandı', count: insertedTotal });
  } catch (err) {
    console.error('Migration error:', err);
    return NextResponse.json(
      { error: 'Beklenmeyen hata oluştu' },
      { status: 500 }
    );
  }
}
