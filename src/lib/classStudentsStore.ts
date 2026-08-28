import type { StudentStatus } from '@/app/panel/types';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

// Sinif ogrenci kayitlari.
//
// Onceden var/class-students-local.json dosyasindaydi. Supabase'deki
// class_students tablosunda `status` kolonu eksik oldugu icin veritabanina
// yazma sessizce basarisiz oluyor, kayitlar dosyaya dusuyordu; Vercel'de de
// dosya kalici olmadigi icin eklenen ogrenciler kayboluyordu.
// Migration 028 kolonlari tamamladi; artik tek kaynak veritabani.

const TABLE = 'class_students';

export interface LocalClassStudentRecord {
  id: string;
  class_key: string;
  class_display: string;
  student_name: string;
  student_number: string | null;
  status: StudentStatus;
  created_at: string;
  updated_at: string | null;
}

function formatStudentName(value: string) {
  return String(value || '').trim().toLocaleUpperCase('tr-TR');
}

export async function listLocalClassStudents(classKey?: string): Promise<LocalClassStudentRecord[]> {
  let query = getSupabaseAdmin().from(TABLE).select('*').order('student_name');
  if (classKey) query = query.eq('class_key', classKey);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as LocalClassStudentRecord[];
}

export async function getLocalClassStudent(id: string): Promise<LocalClassStudentRecord | null> {
  const { data, error } = await getSupabaseAdmin()
    .from(TABLE)
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return (data as LocalClassStudentRecord) || null;
}

export async function createLocalClassStudent(input: {
  class_key: string;
  class_display: string;
  student_name: string;
  student_number?: string | null;
  status?: StudentStatus;
}): Promise<{ record: LocalClassStudentRecord; created: boolean }> {
  const supabase = getSupabaseAdmin();
  const studentName = formatStudentName(input.student_name);

  // Ayni sinifta ayni isim varsa yenisini olusturma
  const { data: existing, error: existingError } = await supabase
    .from(TABLE)
    .select('*')
    .eq('class_key', input.class_key)
    .ilike('student_name', studentName)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) return { record: existing as LocalClassStudentRecord, created: false };

  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      class_key: input.class_key,
      class_display: input.class_display,
      student_name: studentName,
      student_number: input.student_number?.trim() || null,
      status: input.status || 'tumu',
    })
    .select('*')
    .single();

  if (error) throw error;
  return { record: data as LocalClassStudentRecord, created: true };
}

export async function updateLocalClassStudent(
  id: string,
  updates: Partial<
    Pick<
      LocalClassStudentRecord,
      'class_key' | 'class_display' | 'student_name' | 'student_number' | 'status'
    >
  >
): Promise<LocalClassStudentRecord | null> {
  const payload: Record<string, unknown> = { ...updates, updated_at: new Date().toISOString() };

  if (typeof updates.student_name === 'string') {
    payload.student_name = formatStudentName(updates.student_name);
  }
  if (typeof updates.student_number === 'string') {
    payload.student_number = updates.student_number.trim() || null;
  }

  const { data, error } = await getSupabaseAdmin()
    .from(TABLE)
    .update(payload)
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error) throw error;
  return (data as LocalClassStudentRecord) || null;
}

export async function deleteLocalClassStudent(id: string): Promise<boolean> {
  const { data, error } = await getSupabaseAdmin()
    .from(TABLE)
    .delete()
    .eq('id', id)
    .select('id');

  if (error) throw error;
  return (data || []).length > 0;
}
