import fs from 'fs';
import path from 'path';
import { getSinifSubeList } from '@/lib/data';
import { loadTeachersFromStore, saveTeachersToStore } from './teachersStore';

// Type definitions
interface TeacherData {
  [key: string]: unknown;
}

// Lazy import xlsx only if available to avoid build crashes when missing
/* eslint-disable @typescript-eslint/no-require-imports */
let XLSX: {
  readFile: (path: string) => { SheetNames: string[], Sheets: Record<string, unknown> };
  utils: {
    sheet_to_json: (sheet: unknown, opts?: Record<string, unknown>) => TeacherData[];
  };
} | null = null;
try {
  XLSX = require('xlsx');
} catch {
  XLSX = null;
}

export interface TeacherRecord {
  teacherId: string; // derived if not present
  teacherName: string;
  teacherNameNormalized: string;
  sinifSubeKey?: string; // optional, no longer enforced
  sinifSubeDisplay?: string; // optional, no longer enforced
}

function normalizeTr(value: string): string {
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

export function resolveKeyFromDisplay(display: string): string | null {
  // Prefer exact match with data.json's Sinif_Sube
  try {
    const list = getSinifSubeList();
    const byText = list.find(s => s.text.trim().toLocaleLowerCase('tr-TR') === display.trim().toLocaleLowerCase('tr-TR'));
    if (byText) return byText.value;
  } catch {}
  // Fallback regex (rarely used, may not match data.json ids)
  const match = display.match(/(\d+)\.?\s*Sınıf\s*\/\s*([A-ZÇĞİÖŞÜ])/i);
  if (match) {
    return `${match[1]}#${match[2].toUpperCase()}`;
  }
  return null;
}

export function loadTeachersFromExcel(): TeacherRecord[] {
  const filePath = path.join(process.cwd(), 'teachers.xlsx');
  if (!fs.existsSync(filePath)) {
    return [];
  }

  if (!XLSX) {
    console.warn('xlsx paketi bulunamadı, teachers.xlsx okunamayacak.');
    return [];
  }

  let rows: TeacherData[] = [];
  try {
    const wb = XLSX.readFile(filePath);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  } catch (err) {
    console.warn(`teachers.xlsx okunamadı: ${String(err)}`);
    return [];
  }

  // Tahmini kolon adları: "Sınıf/Şube" veya benzeri, "Öğretmen"
  // Kullanıcı teachers.xlsx formatını koruyacağını söyledi; en yaygın adlara bakıyoruz.
  return rows
    .map((r, idx): TeacherRecord | null => {
      const teacherName = String(r.Öğretmen || r.Ogretmen || r['Öğretmen Adı'] || r['Öğretmen Adı Soyadı'] || r.teacher || r.name || '').trim();
      const sinifDisplay = String(r['Sınıf/Şube'] || r['Sinif/Sube'] || r['Sınıf'] || r['Sinif'] || '').trim();
      const sinifSubeDisplay = sinifDisplay || String(r['Sınıf Adı'] || r['Sınıf - Şube'] || '').trim();
      if (!teacherName || !sinifSubeDisplay) return null;
      const teacherId = `t${idx + 1}`;
      const key = resolveKeyFromDisplay(sinifSubeDisplay) || sinifSubeDisplay;
      return {
        teacherId,
        teacherName,
        teacherNameNormalized: normalizeTr(teacherName),
        sinifSubeKey: key,
        sinifSubeDisplay,
      };
    })
    .filter(Boolean) as TeacherRecord[];
}

export function buildTeacherIndex(records: TeacherRecord[]) {
  const byName = new Map<string, TeacherRecord>();
  const byKey = new Map<string, TeacherRecord>();
  for (const r of records) {
    byName.set(r.teacherNameNormalized, r);
    byKey.set(r.sinifSubeKey, r);
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
  return records.map(r => ({ value: r.teacherName, label: r.teacherName, sinifSubeKey: r.sinifSubeKey, sinifSubeDisplay: r.sinifSubeDisplay }));
}

export function getTeachersData() {
  // Prefer cached store for speed
  let records = loadTeachersFromStore();
  if (!records || records.length === 0) {
    // Try to import from Excel
    records = loadTeachersFromExcel();
    if (records.length > 0) {
      try { saveTeachersToStore(records); } catch {}
    }
  }
  return { records, list: listTeachersForUI(records) };
}

export function importTeachersFromExcelToStore() {
  const records = loadTeachersFromExcel();
  if (records.length > 0) saveTeachersToStore(records);
  return records.length;
}
