import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

// Ogretmenlerin ogrenci silme / sinif degistirme talepleri.
//
// Onceden var/class-student-requests.json dosyasindaydi; Vercel'de kalici
// olmadigi icin talepler kayboluyordu. Artik `class_student_requests` tablosunda.

const TABLE = 'class_student_requests';

export interface ClassStudentRequest {
  id: string;
  teacher_name: string;
  class_key: string;
  class_display: string;
  student_name: string;
  student_value: string | null;
  request_type: 'delete' | 'class_change';
  new_class_key: string | null;
  new_class_display: string | null;
  status: 'pending' | 'approved' | 'rejected';
  admin_note: string | null;
  created_at: string;
  updated_at: string | null;
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function getRequests(
  filters: { status?: string; classKey?: string } = {}
): Promise<ClassStudentRequest[]> {
  let query = getSupabaseAdmin()
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: false });

  if (filters.status) query = query.eq('status', filters.status);
  if (filters.classKey) query = query.eq('class_key', filters.classKey);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as ClassStudentRequest[];
}

export async function hasPendingRequest(
  classKey: string,
  studentName: string,
  requestType: string
): Promise<boolean> {
  const { data, error } = await getSupabaseAdmin()
    .from(TABLE)
    .select('id')
    .eq('class_key', classKey)
    .eq('student_name', studentName)
    .eq('request_type', requestType)
    .eq('status', 'pending')
    .limit(1);

  if (error) throw error;
  return (data || []).length > 0;
}

export async function createRequest(
  req: Omit<ClassStudentRequest, 'id' | 'created_at' | 'updated_at' | 'status' | 'admin_note'>
): Promise<ClassStudentRequest> {
  const row: ClassStudentRequest = {
    ...req,
    id: makeId(),
    status: 'pending',
    admin_note: null,
    created_at: new Date().toISOString(),
    updated_at: null,
  };

  const { data, error } = await getSupabaseAdmin()
    .from(TABLE)
    .insert(row)
    .select('*')
    .single();

  if (error) throw error;
  return data as ClassStudentRequest;
}

export async function updateRequest(
  id: string,
  updates: { status: 'approved' | 'rejected'; admin_note?: string }
): Promise<ClassStudentRequest | null> {
  const { data, error } = await getSupabaseAdmin()
    .from(TABLE)
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error) throw error;
  return (data as ClassStudentRequest) || null;
}

export async function getRequest(id: string): Promise<ClassStudentRequest | null> {
  const { data, error } = await getSupabaseAdmin()
    .from(TABLE)
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return (data as ClassStudentRequest) || null;
}
