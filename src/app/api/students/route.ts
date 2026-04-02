import { NextRequest, NextResponse } from 'next/server';
import { getOgrenciListBySinif, getSinifSubeList, loadStudentData } from '@/lib/data';
import { supabase } from '@/lib/supabase';

type StudentLookupOption = {
  value: string;
  text: string;
  class_key?: string;
  class_display?: string;
};

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function getClassDisplayByKey(classKey: string) {
  const classList = getSinifSubeList();
  return classList.find((item) => item.value === classKey || item.value.startsWith(`${classKey}#`))?.text || classKey;
}

function buildJsonStudentOptions(): StudentLookupOption[] {
  const data = loadStudentData();
  const classList = getSinifSubeList();
  const options: StudentLookupOption[] = [];

  classList.forEach((classItem) => {
    const classText = classItem.text;
    const classKey = classItem.value;
    const dataKey = `Ogrenci_${classText.replace(' / ', ' _ ')}`;
    const studentList = data[dataKey];

    if (!Array.isArray(studentList)) return;

    studentList.forEach((student: any) => {
      const ad = student.Ad || student.ad || '';
      const soyad = student.Soyad || student.soyad || '';
      const okulNo = student['Okul No'] || student.okulNo || '';
      const fullName = `${ad} ${soyad}`.trim();

      if (!fullName) return;

      options.push({
        value: fullName,
        text: okulNo ? `${okulNo} ${fullName}` : fullName,
        class_key: classKey,
        class_display: classText
      });
    });
  });

  return options;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sinifSube = searchParams.get('sinifSube');
    const query = normalizeText(searchParams.get('query') || searchParams.get('q') || '');

    if (sinifSube) {
      const jsonOgrenciList = getOgrenciListBySinif(sinifSube).map((item) => ({
        ...item,
        class_key: sinifSube,
        class_display: getClassDisplayByKey(sinifSube),
      }));

      let supabaseOgrenciList: StudentLookupOption[] = [];

      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('class_students')
            .select('id, class_key, class_display, student_number, student_name')
            .eq('class_key', sinifSube)
            .order('student_name', { ascending: true });

          if (!error && data) {
            supabaseOgrenciList = data.map((s) => ({
              value: `supabase_${s.id}`,
              text: s.student_number ? `${s.student_number} ${s.student_name}` : s.student_name,
              class_key: s.class_key,
              class_display: s.class_display || getClassDisplayByKey(s.class_key),
            }));
          }
        } catch (err) {
          console.error('Supabase students fetch error:', err);
        }
      }

      const existingTexts = new Set(jsonOgrenciList.map((o) => o.text.toLowerCase()));
      const uniqueSupabaseList = supabaseOgrenciList.filter((s) => !existingTexts.has(s.text.toLowerCase()));

      return NextResponse.json([...jsonOgrenciList, ...uniqueSupabaseList]);
    }

    if (query) {
      const results = new Map<string, StudentLookupOption>();
      const matchesQuery = (candidate: StudentLookupOption) => {
        const haystack = normalizeText(
          `${candidate.text} ${candidate.value} ${candidate.class_display || ''} ${candidate.class_key || ''}`
        );
        return haystack.includes(query);
      };

      buildJsonStudentOptions()
        .filter(matchesQuery)
        .forEach((student) => {
          results.set(normalizeText(`${student.class_key || ''}|${student.text}`), student);
        });

      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('class_students')
            .select('id, class_key, class_display, student_number, student_name')
            .order('student_name', { ascending: true });

          if (!error && data) {
            data.forEach((student) => {
              const option: StudentLookupOption = {
                value: `supabase_${student.id}`,
                text: student.student_number ? `${student.student_number} ${student.student_name}` : student.student_name,
                class_key: student.class_key,
                class_display: student.class_display || getClassDisplayByKey(student.class_key),
              };

              if (matchesQuery(option)) {
                results.set(normalizeText(`${option.class_key || ''}|${option.text}`), option);
              }
            });
          }
        } catch (err) {
          console.error('Supabase global students fetch error:', err);
        }
      }

      return NextResponse.json(Array.from(results.values()));
    }

    return NextResponse.json([]);
  } catch (error) {
    console.error('Students API Error:', error);
    return NextResponse.json(
      { error: 'Öğrenci listesi yüklenirken hata oluştu' },
      { status: 500 }
    );
  }
}
