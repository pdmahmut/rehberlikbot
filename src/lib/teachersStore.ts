import { TeacherRecord } from './teachers';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

// Ogretmen kadrosu deposu.
//
// Onceden var/teachers.json dosyasinda tutuluyordu; Vercel'in gecici dosya
// sisteminde kalici olmadigi icin canlida yapilan degisiklikler her deploy'da
// kayboluyordu. Artik Supabase `teachers` tablosunda.

const TABLE = 'teachers';
const COLUMNS = 'teacher_id, teacher_name, teacher_name_normalized, sinif_sube_key, sinif_sube_display';

interface TeacherRow {
  teacher_id: string;
  teacher_name: string;
  teacher_name_normalized: string;
  sinif_sube_key: string | null;
  sinif_sube_display: string | null;
}

function toRecord(row: TeacherRow): TeacherRecord {
  return {
    teacherId: row.teacher_id,
    teacherName: row.teacher_name,
    teacherNameNormalized: row.teacher_name_normalized,
    ...(row.sinif_sube_key ? { sinifSubeKey: row.sinif_sube_key } : {}),
    ...(row.sinif_sube_display ? { sinifSubeDisplay: row.sinif_sube_display } : {}),
  };
}

function toRow(record: TeacherRecord): TeacherRow {
  return {
    teacher_id: record.teacherId,
    teacher_name: record.teacherName,
    teacher_name_normalized: record.teacherNameNormalized,
    sinif_sube_key: record.sinifSubeKey || null,
    sinif_sube_display: record.sinifSubeDisplay || null,
  };
}

export async function loadTeachersFromStore(): Promise<TeacherRecord[]> {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from(TABLE)
      .select(COLUMNS)
      .order('teacher_name');

    if (error) throw error;
    return (data as TeacherRow[] | null || []).map(toRecord);
  } catch {
    return [];
  }
}

/**
 * Kadronun tamamini verilen listeyle degistirir.
 *
 * Cagiran kod "yukle -> dizide degistir -> kaydet" seklinde calistigi icin
 * tam degistirme (replace-all) semantigi korunuyor: listede olmayan
 * ogretmenler silinir, olanlar eklenir/guncellenir.
 */
export async function saveTeachersToStore(records: TeacherRecord[]): Promise<void> {
  const supabase = getSupabaseAdmin();
  const rows = records.map(toRow);
  const keepIds = rows.map((r) => r.teacher_id);

  // 1) Listede olmayanlari sil
  if (keepIds.length > 0) {
    const inList = `(${keepIds.map((id) => `"${id.replace(/"/g, '')}"`).join(',')})`;
    const { error } = await supabase.from(TABLE).delete().not('teacher_id', 'in', inList);
    if (error) throw error;
  } else {
    const { error } = await supabase.from(TABLE).delete().neq('teacher_id', '__none__');
    if (error) throw error;
  }

  if (rows.length === 0) return;

  // 2) Sinif atamalarini once temizle.
  //    Sinif bir ogretmenden digerine devredilirken tek upsert icinde
  //    gecici cakisma olusmasin diye iki asamada yaziliyor.
  const { error: clearError } = await supabase
    .from(TABLE)
    .upsert(
      rows.map((r) => ({ ...r, sinif_sube_key: null, sinif_sube_display: null })),
      { onConflict: 'teacher_id' }
    );
  if (clearError) throw clearError;

  // 3) Atamasi olanlari yaz
  const assigned = rows.filter((r) => r.sinif_sube_key);
  for (const row of assigned) {
    const { error } = await supabase
      .from(TABLE)
      .update({
        sinif_sube_key: row.sinif_sube_key,
        sinif_sube_display: row.sinif_sube_display,
        updated_at: new Date().toISOString(),
      })
      .eq('teacher_id', row.teacher_id);
    if (error) throw error;
  }
}
