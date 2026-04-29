import { NextRequest, NextResponse } from 'next/server';
import { getOgrenciListBySinif, getSinifSubeList, loadStudentData } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import { listLocalClassStudents } from '@/lib/classStudentsStore';

type StudentLookupOption = {
  value: string;
  text: string;
  class_key?: string;
  class_display?: string;
};

type ParsedStudentText = {
  number: string | null;
  name: string;
};

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/İ/g, 'i')
    .replace(/I/g, 'i')
    .replace(/\u0131/g, 'i')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ğ/g, 'g')
    .replace(/ş/g, 's')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .trim();
}

function getClassDisplayByKey(classKey: string) {
  const classList = getSinifSubeList();
  return (
    classList.find((item) => item.value === classKey || item.value.startsWith(`${classKey}#`))
      ?.text || classKey
  );
}

function parseStudentText(text: string): ParsedStudentText {
  const trimmed = String(text || '').trim();
  const match = trimmed.match(/^(\d+)\s+(.+)$/);
  if (!match) {
    return { number: null, name: trimmed };
  }

  return {
    number: match[1],
    name: match[2].trim(),
  };
}

function compareStudentOptions(a: StudentLookupOption, b: StudentLookupOption) {
  const parsedA = parseStudentText(a.text);
  const parsedB = parseStudentText(b.text);

  const nameCompare = parsedA.name.localeCompare(parsedB.name, 'tr', {
    sensitivity: 'base',
  });
  if (nameCompare !== 0) return nameCompare;

  if (parsedA.number && parsedB.number) {
    return parsedA.number.localeCompare(parsedB.number, 'tr', { numeric: true });
  }

  if (parsedA.number && !parsedB.number) return -1;
  if (!parsedA.number && parsedB.number) return 1;

  return a.text.localeCompare(b.text, 'tr', { sensitivity: 'base' });
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
        class_display: classText,
      });
    });
  });

  return options;
}

function buildLocalStudentOptions(classKey?: string): StudentLookupOption[] {
  return listLocalClassStudents(classKey)
    .filter((student) => student.student_number !== '__SINIF_DISI__')
    .map((student) => ({
      value: `local_${student.id}`,
      text: student.student_number
        ? `${student.student_number} ${student.student_name}`
        : student.student_name,
      class_key: student.class_key,
      class_display: student.class_display || getClassDisplayByKey(student.class_key),
    }));
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
      const localOgrenciList = buildLocalStudentOptions(sinifSube);

      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('class_students')
            .select('id, class_key, class_display, student_number, student_name')
            .eq('class_key', sinifSube)
            .order('student_name', { ascending: true });

          if (!error && data) {
            supabaseOgrenciList = data
              .filter((student) => student.student_number !== '__SINIF_DISI__')
              .map((student) => ({
                value: `supabase_${student.id}`,
                text: student.student_number
                  ? `${student.student_number} ${student.student_name}`
                  : student.student_name,
                class_key: student.class_key,
                class_display: student.class_display || getClassDisplayByKey(student.class_key),
              }));
          }
        } catch (err) {
          console.error('Supabase students fetch error:', err);
        }
      }

      const deduped = new Map<string, StudentLookupOption>();
      [...jsonOgrenciList, ...supabaseOgrenciList, ...localOgrenciList].forEach((student) => {
        const key = normalizeText(`${student.class_key || ''}|${student.text}`);
        if (!deduped.has(key)) deduped.set(key, student);
      });

      let combinedList = Array.from(deduped.values());
      try {
        const { getRequests } = require('@/lib/classStudentRequests');
        const allApproved = getRequests({ status: 'approved' });

        const removedFromThis = allApproved
          .filter(
            (r: any) =>
              r.class_key === sinifSube &&
              (r.request_type === 'delete' || r.request_type === 'class_change')
          )
          .map((r: any) => normalizeText((r.student_name || '').replace(/^\d+\s+/, '')));

        if (removedFromThis.length > 0) {
          combinedList = combinedList.filter((student) => {
            const name = normalizeText(student.text.replace(/^\d+\s+/, ''));
            return !removedFromThis.some((removed: string) => removed === name);
          });
        }

        const movedToThis = allApproved.filter(
          (r: any) =>
            r.request_type === 'class_change' &&
            r.new_class_key === sinifSube &&
            r.class_key !== sinifSube
        );

        movedToThis.forEach((request: any) => {
          const name = normalizeText((request.student_name || '').replace(/^\d+\s+/, ''));
          const alreadyExists = combinedList.some(
            (student) => normalizeText(student.text.replace(/^\d+\s+/, '')) === name
          );

          if (!alreadyExists) {
            combinedList.push({
              value: request.student_value || request.student_name,
              text: request.student_name,
              class_key: sinifSube,
              class_display: getClassDisplayByKey(sinifSube),
            });
          }
        });
      } catch {
        // ignore local request overlays
      }

      return NextResponse.json(combinedList.sort(compareStudentOptions));
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

      buildLocalStudentOptions().forEach((student) => {
        if (matchesQuery(student)) {
          results.set(normalizeText(`${student.class_key || ''}|${student.text}`), student);
        }
      });

      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('class_students')
            .select('id, class_key, class_display, student_number, student_name')
            .order('student_name', { ascending: true });

          if (!error && data) {
            data
              .filter((student) => student.student_number !== '__SINIF_DISI__')
              .forEach((student) => {
                const option: StudentLookupOption = {
                  value: `supabase_${student.id}`,
                  text: student.student_number
                    ? `${student.student_number} ${student.student_name}`
                    : student.student_name,
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

      return NextResponse.json(Array.from(results.values()).sort(compareStudentOptions));
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
