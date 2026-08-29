import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { listClasses } from '@/lib/classes';
import { getRequests } from '@/lib/classStudentRequests';

// Ogrenci arama / listeleme.
//
// Onceden ogrenciler uc kaynaktan birlestiriliyordu: data.json dosyasi,
// class_students tablosu ve "yerel" dosya deposu. Yerel depo da artik ayni
// tabloyu okudugu icin kayitlar iki kez geliyordu (yalnizca tekrar temizleme
// sayesinde fark edilmiyordu). data.json ise ogrenci TC kimlik numaralarini
// repoda tutuyordu ve guncellemek yeniden deploy gerektiriyordu.
//
// Artik tek kaynak var: class_students tablosu. Sinif adlari da classes
// tablosundan geliyor.

export const runtime = 'nodejs';

// Sinif listesinden cikarilan ogrenciler bu isaretle saklanir
const EXCLUDED_MARKER = '__SINIF_DISI__';

type StudentLookupOption = {
  value: string;
  text: string;
  class_key?: string;
  class_display?: string;
};

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/İ/g, 'i')
    .replace(/I/g, 'i')
    .replace(/ı/g, 'i')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ğ/g, 'g')
    .replace(/ş/g, 's')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .trim();
}

function parseStudentText(text: string): { number: string | null; name: string } {
  const trimmed = String(text || '').trim();
  const match = trimmed.match(/^(\d+)\s+(.+)$/);
  if (!match) return { number: null, name: trimmed };
  return { number: match[1], name: match[2].trim() };
}

function compareStudentOptions(a: StudentLookupOption, b: StudentLookupOption) {
  const pa = parseStudentText(a.text);
  const pb = parseStudentText(b.text);

  const nameCompare = pa.name.localeCompare(pb.name, 'tr', { sensitivity: 'base' });
  if (nameCompare !== 0) return nameCompare;

  if (pa.number && pb.number) {
    return pa.number.localeCompare(pb.number, 'tr', { numeric: true });
  }
  if (pa.number && !pb.number) return -1;
  if (!pa.number && pb.number) return 1;

  return a.text.localeCompare(b.text, 'tr', { sensitivity: 'base' });
}

/** Sinif anahtari -> gorunen ad esleme tablosu. */
async function buildClassDisplayMap(): Promise<Map<string, string>> {
  const classes = await listClasses();
  return new Map(classes.map((c) => [c.class_key, c.class_display]));
}

interface StudentRow {
  id: string;
  class_key: string;
  class_display: string | null;
  student_number: string | null;
  student_name: string;
}

function toOption(row: StudentRow, displays: Map<string, string>): StudentLookupOption {
  return {
    value: `supabase_${row.id}`,
    text: row.student_number ? `${row.student_number} ${row.student_name}` : row.student_name,
    class_key: row.class_key,
    class_display: row.class_display || displays.get(row.class_key) || row.class_key,
  };
}

const stripNumber = (text: string) => normalizeText(String(text || '').replace(/^\d+\s+/, ''));

export async function GET(request: NextRequest) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;

  try {
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const sinifSube = searchParams.get('sinifSube');
    const query = normalizeText(searchParams.get('query') || searchParams.get('q') || '');

    // --- Sinifa gore listeleme ---
    if (sinifSube) {
      const displays = await buildClassDisplayMap();

      const { data, error } = await supabase
        .from('class_students')
        .select('id, class_key, class_display, student_number, student_name')
        .eq('class_key', sinifSube)
        .neq('student_number', EXCLUDED_MARKER)
        .order('student_name', { ascending: true });

      if (error) throw error;

      let list = (data as StudentRow[] | null || []).map((row) => toOption(row, displays));

      // Onaylanmis silme / sinif degistirme talepleri listeye yansitilir
      try {
        const approved = await getRequests({ status: 'approved' });

        const removed = approved
          .filter(
            (r) =>
              r.class_key === sinifSube &&
              (r.request_type === 'delete' || r.request_type === 'class_change')
          )
          .map((r) => stripNumber(r.student_name || ''));

        if (removed.length > 0) {
          list = list.filter((student) => !removed.includes(stripNumber(student.text)));
        }

        const movedHere = approved.filter(
          (r) =>
            r.request_type === 'class_change' &&
            r.new_class_key === sinifSube &&
            r.class_key !== sinifSube
        );

        for (const req of movedHere) {
          const name = stripNumber(req.student_name || '');
          if (list.some((s) => stripNumber(s.text) === name)) continue;

          list.push({
            value: req.student_value || req.student_name,
            text: req.student_name,
            class_key: sinifSube,
            class_display: displays.get(sinifSube) || sinifSube,
          });
        }
      } catch {
        // talep katmani okunamazsa ogrenci listesi yine de donsun
      }

      return NextResponse.json(list.sort(compareStudentOptions));
    }

    // --- Genel arama ---
    if (query) {
      const displays = await buildClassDisplayMap();

      const { data, error } = await supabase
        .from('class_students')
        .select('id, class_key, class_display, student_number, student_name')
        .neq('student_number', EXCLUDED_MARKER)
        .order('student_name', { ascending: true });

      if (error) throw error;

      const results = (data as StudentRow[] | null || [])
        .map((row) => toOption(row, displays))
        .filter((option) => {
          const haystack = normalizeText(
            `${option.text} ${option.value} ${option.class_display || ''} ${option.class_key || ''}`
          );
          return haystack.includes(query);
        });

      return NextResponse.json(results.sort(compareStudentOptions));
    }

    return NextResponse.json([]);
  } catch (error) {
    console.error('Students API Error:', error);
    return NextResponse.json(
      { error: 'Öğrenci listesi alınamadı' },
      { status: 500 }
    );
  }
}
