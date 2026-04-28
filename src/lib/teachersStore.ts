import fs from 'fs';
import path from 'path';
import { TeacherRecord } from './teachers';

function getStorePath() {
  const dir = path.join(process.cwd(), 'var');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, 'teachers.json');
}

function normalizeTeacherName(value: string): string {
  return value
    .toLocaleLowerCase('tr-TR')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'i')
    .replace(/[^a-z0-9çğıöşü\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeTeacherRecord(record: unknown, index: number): TeacherRecord | null {
  if (!record || typeof record !== 'object') return null;

  const raw = record as Record<string, unknown>;
  const teacherName = String(raw.teacherName || '').trim();
  if (!teacherName) return null;

  const teacherId = String(raw.teacherId || raw.id || `legacy-t${index + 1}`).trim();
  const teacherNameNormalized =
    String(raw.teacherNameNormalized || '').trim() || normalizeTeacherName(teacherName);
  const sinifSubeKey = raw.sinifSubeKey ? String(raw.sinifSubeKey).trim() : undefined;
  const sinifSubeDisplay = raw.sinifSubeDisplay ? String(raw.sinifSubeDisplay).trim() : undefined;

  return {
    teacherId,
    teacherName,
    teacherNameNormalized,
    ...(sinifSubeKey ? { sinifSubeKey } : {}),
    ...(sinifSubeDisplay ? { sinifSubeDisplay } : {}),
  };
}

export function loadTeachersFromStore(): TeacherRecord[] {
  try {
    const file = getStorePath();
    if (!fs.existsSync(file)) return [];
    const raw = fs.readFileSync(file, 'utf8');
    const data = JSON.parse(raw);
    if (Array.isArray(data)) {
      const normalized = data
        .map((record, index) => normalizeTeacherRecord(record, index))
        .filter(Boolean) as TeacherRecord[];

      const changed =
        normalized.length !== data.length ||
        normalized.some((record, index) => JSON.stringify(record) !== JSON.stringify(data[index]));

      if (changed) {
        saveTeachersToStore(normalized);
      }

      return normalized;
    }
    return [];
  } catch {
    return [];
  }
}

export function saveTeachersToStore(records: TeacherRecord[]): void {
  const file = getStorePath();
  fs.writeFileSync(file, JSON.stringify(records, null, 2), 'utf8');
}
