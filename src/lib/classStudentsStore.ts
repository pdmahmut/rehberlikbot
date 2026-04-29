import fs from 'fs';
import path from 'path';
import type { StudentStatus } from '@/app/panel/types';

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

const FILE_PATH = path.join(process.cwd(), 'var', 'class-students-local.json');

function ensureDir() {
  fs.mkdirSync(path.dirname(FILE_PATH), { recursive: true });
}

function load(): LocalClassStudentRecord[] {
  try {
    if (!fs.existsSync(FILE_PATH)) return [];
    const raw = fs.readFileSync(FILE_PATH, 'utf-8');
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];

    const normalized = data.map((item) => normalizeRecord(item as LocalClassStudentRecord));
    const changed =
      normalized.length !== data.length ||
      normalized.some((item, index) => JSON.stringify(item) !== JSON.stringify(data[index]));

    if (changed) {
      save(normalized);
    }

    return normalized;
  } catch {
    return [];
  }
}

function save(data: LocalClassStudentRecord[]) {
  ensureDir();
  fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeName(value: string) {
  return String(value || '').trim().toLocaleLowerCase('tr-TR');
}

function formatStudentName(value: string) {
  return String(value || '').trim().toLocaleUpperCase('tr-TR');
}

function normalizeRecord(record: LocalClassStudentRecord): LocalClassStudentRecord {
  return {
    ...record,
    student_name: formatStudentName(record.student_name),
    student_number: record.student_number?.trim() || null,
  };
}

export function listLocalClassStudents(classKey?: string) {
  const data = load();
  return classKey ? data.filter((item) => item.class_key === classKey) : data;
}

export function getLocalClassStudent(id: string) {
  return load().find((item) => item.id === id) || null;
}

export function createLocalClassStudent(input: {
  class_key: string;
  class_display: string;
  student_name: string;
  student_number?: string | null;
  status?: StudentStatus;
}) {
  const data = load();
  const formattedStudentName = formatStudentName(input.student_name);
  const normalizedName = normalizeName(formattedStudentName);
  const existing = data.find(
    (item) =>
      item.class_key === input.class_key &&
      normalizeName(item.student_name) === normalizedName
  );

  if (existing) {
    return { record: existing, created: false as const };
  }

  const record: LocalClassStudentRecord = {
    id: makeId(),
    class_key: input.class_key,
    class_display: input.class_display,
    student_name: formattedStudentName,
    student_number: input.student_number?.trim() || null,
    status: input.status || 'tumu',
    created_at: new Date().toISOString(),
    updated_at: null,
  };

  data.push(record);
  save(data);
  return { record, created: true as const };
}

export function updateLocalClassStudent(
  id: string,
  updates: Partial<Pick<LocalClassStudentRecord, 'class_key' | 'class_display' | 'student_name' | 'student_number' | 'status'>>
) {
  const data = load();
  const index = data.findIndex((item) => item.id === id);
  if (index === -1) return null;

  data[index] = {
    ...data[index],
    ...updates,
    ...(typeof updates.student_name === 'string'
      ? { student_name: formatStudentName(updates.student_name) }
      : {}),
    ...(typeof updates.student_number === 'string'
      ? { student_number: updates.student_number.trim() || null }
      : {}),
    updated_at: new Date().toISOString(),
  };
  save(data);
  return data[index];
}

export function deleteLocalClassStudent(id: string) {
  const data = load();
  const filtered = data.filter((item) => item.id !== id);
  if (filtered.length === data.length) return false;
  save(filtered);
  return true;
}
