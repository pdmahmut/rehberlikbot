import { getClassOptions } from '@/lib/classes';
import { loadTeachersFromStore, saveTeachersToStore } from './teachersStore';

export interface TeacherRecord {
  teacherId: string; // derived if not present
  teacherName: string;
  teacherNameNormalized: string;
  sinifSubeKey?: string; // optional, no longer enforced
  sinifSubeDisplay?: string; // optional, no longer enforced
}

export function normalizeTr(value: string): string {
  return value
    .toLocaleLowerCase('tr-TR')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'i')
    .replace(/[^a-z0-9çğıöşü\s]/gi, ' ') // keep turkish chars
    .replace(/\s+/g, ' ') // collapse spaces
    .trim();
}

function classKeyFromDisplayPattern(display: string): string | null {
  const match = display.match(/(\d+)\.?\s*Sınıf\s*\/\s*([A-ZÇĞİÖŞÜ])/i);
  return match ? `${match[1]}${match[2].toLocaleUpperCase('tr-TR')}` : null;
}

/** "6. Sınıf / A Şubesi" görünen adından sınıf anahtarını bulur. */
export async function resolveKeyFromDisplay(display: string): Promise<string | null> {
  const target = display.trim().toLocaleLowerCase('tr-TR');

  try {
    const list = await getClassOptions();
    const byText = list.find(c => c.text.trim().toLocaleLowerCase('tr-TR') === target);
    if (byText) return byText.value;
  } catch {
    // sınıf listesi okunamazsa aşağıdaki desen çözümlemesine düşülür
  }

  return classKeyFromDisplayPattern(display);
}

export function buildTeacherIndex(records: TeacherRecord[]) {
  const byName = new Map<string, TeacherRecord>();
  const byKey = new Map<string, TeacherRecord>();
  for (const r of records) {
    byName.set(r.teacherNameNormalized, r);
    if (r.sinifSubeKey) {
      byKey.set(r.sinifSubeKey, r);
    }
  }
  return { byName, byKey };
}

export function matchTeacherByName(name: string, records: TeacherRecord[]): TeacherRecord | null {
  const norm = normalizeTr(name);
  const { byName } = buildTeacherIndex(records);
  return byName.get(norm) || null;
}

export function validateTeacherClass(teacherName: string, sinifSubeKey: string, records: TeacherRecord[]): { valid: boolean; message?: string; teacher?: TeacherRecord } {
  const teacher = matchTeacherByName(teacherName, records);
  if (!teacher) {
    return { valid: false, message: `Öğretmen bulunamadı: ${teacherName}` };
  }
  // No longer validate class matching - teachers can teach any class
  return { valid: true, teacher };
}

export function listTeachersForUI(records: TeacherRecord[]) {
  return records.map(r => ({ value: r.teacherName, label: r.teacherName }));
}

export async function getTeachersData() {
  const records = await loadTeachersFromStore();
  return { records, list: listTeachersForUI(records) };
}

export async function addTeacher(teacherName: string): Promise<{ success: boolean; teacher?: TeacherRecord; error?: string }> {
  const records = await loadTeachersFromStore();
  const norm = normalizeTr(teacherName.trim());
  if (records.find(r => r.teacherNameNormalized === norm)) {
    return { success: false, error: 'Bu öğretmen zaten kayıtlı' };
  }
  const newTeacher: TeacherRecord = {
    teacherId: 't' + Date.now(),
    teacherName: teacherName.trim(),
    teacherNameNormalized: norm,
  };
  records.push(newTeacher);
  await saveTeachersToStore(records);
  return { success: true, teacher: newTeacher };
}

export async function removeTeacher(teacherId: string): Promise<boolean> {
  const records = await loadTeachersFromStore();
  const filtered = records.filter(r => r.teacherId !== teacherId);
  if (filtered.length === records.length) return false;
  await saveTeachersToStore(filtered);
  return true;
}

function findTeacher(records: TeacherRecord[], teacherId?: string, teacherName?: string): TeacherRecord | null {
  if (teacherId) {
    const teacherById = records.find(r => r.teacherId === teacherId);
    if (teacherById) return teacherById;
  }

  if (teacherName) {
    const normalizedName = normalizeTr(teacherName);
    return records.find(r => r.teacherNameNormalized === normalizedName) || null;
  }

  return null;
}

export async function assignTeacherToClass(
  teacherId: string | undefined,
  sinifSubeKey: string,
  sinifSubeDisplay: string,
  teacherName?: string
): Promise<{ success: boolean; error?: string }> {
  const records = await loadTeachersFromStore();
  // First clear any teacher already assigned to this class.
  for (const r of records) {
    if (r.sinifSubeKey === sinifSubeKey) {
      delete r.sinifSubeKey;
      delete r.sinifSubeDisplay;
    }
  }
  const teacher = findTeacher(records, teacherId, teacherName);
  if (!teacher) return { success: false, error: 'Ogretmen bulunamadi' };
  teacher.sinifSubeKey = sinifSubeKey;
  teacher.sinifSubeDisplay = sinifSubeDisplay;
  await saveTeachersToStore(records);
  return { success: true };
}

export async function removeTeacherClassAssignment(teacherId?: string, teacherName?: string): Promise<boolean> {
  const records = await loadTeachersFromStore();
  const teacher = findTeacher(records, teacherId, teacherName);
  if (!teacher) return false;
  delete teacher.sinifSubeKey;
  delete teacher.sinifSubeDisplay;
  await saveTeachersToStore(records);
  return true;
}
