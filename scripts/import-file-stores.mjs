// var/*.json dosyalarindaki veriyi Supabase'e tasir.
//
// Migration 027 calistirildiktan SONRA bir kez calistirilir:
//     node scripts/import-file-stores.mjs
//
// Idempotent: tekrar calistirilirsa mevcut kayitlari gunceller, kopya olusturmaz.

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const root = process.cwd();

// .env.local'i oku
const env = {};
const envPath = path.join(root, '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
}

const url = process.env.SUPABASE_URL || env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('SUPABASE_URL veya SUPABASE_SERVICE_ROLE_KEY eksik.');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

function readJson(relPath) {
  const file = path.join(root, relPath);
  if (!fs.existsSync(file)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function normalizeTr(value) {
  return String(value || '')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'i')
    .replace(/[^a-z0-9çğıöşü\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function upsert(table, rows, onConflict, label) {
  if (rows.length === 0) {
    console.log(`  ${label.padEnd(24)} atlandi (dosyada kayit yok)`);
    return;
  }
  const { error } = await supabase.from(table).upsert(rows, { onConflict });
  if (error) {
    console.log(`  ${label.padEnd(24)} HATA: ${error.message}`);
    process.exitCode = 1;
    return;
  }
  console.log(`  ${label.padEnd(24)} ${rows.length} kayit aktarildi`);
}

console.log('Dosyalardan veritabanina aktarim basliyor...\n');

// --- 1. Ogretmen kadrosu ---
const teachers = readJson('var/teachers.json').map((t, i) => ({
  teacher_id: String(t.teacherId || t.id || `legacy-t${i + 1}`).trim(),
  teacher_name: String(t.teacherName || '').trim(),
  teacher_name_normalized:
    String(t.teacherNameNormalized || '').trim() || normalizeTr(t.teacherName),
  sinif_sube_key: t.sinifSubeKey ? String(t.sinifSubeKey).trim() : null,
  sinif_sube_display: t.sinifSubeDisplay ? String(t.sinifSubeDisplay).trim() : null,
})).filter((t) => t.teacher_name);

await upsert('teachers', teachers, 'teacher_id', 'ogretmen kadrosu');

// --- 2. Yerel ogrenci kayitlari ---
const students = readJson('var/class-students-local.json').map((s) => ({
  class_key: s.class_key,
  class_display: s.class_display,
  student_name: s.student_name,
  student_number: s.student_number || null,
  status: s.status || 'tumu',
}));

if (students.length) {
  // class_students id'si uuid oldugu icin upsert yerine "varsa ekleme" mantigi
  const { data: existing } = await supabase
    .from('class_students')
    .select('class_key, student_name');
  const seen = new Set((existing || []).map((r) => `${r.class_key}|${normalizeTr(r.student_name)}`));
  const fresh = students.filter((s) => !seen.has(`${s.class_key}|${normalizeTr(s.student_name)}`));

  if (fresh.length) {
    const { error } = await supabase.from('class_students').insert(fresh);
    console.log(error
      ? `  ${'ogrenciler'.padEnd(24)} HATA: ${error.message}`
      : `  ${'ogrenciler'.padEnd(24)} ${fresh.length} kayit aktarildi`);
  } else {
    console.log(`  ${'ogrenciler'.padEnd(24)} zaten mevcut, atlandi`);
  }
} else {
  console.log(`  ${'ogrenciler'.padEnd(24)} atlandi (dosyada kayit yok)`);
}

// --- 3. Sinif ogrenci talepleri ---
const requests = readJson('var/class-student-requests.json').map((r) => ({
  id: String(r.id),
  teacher_name: r.teacher_name,
  class_key: r.class_key,
  class_display: r.class_display,
  student_name: r.student_name,
  student_value: r.student_value || null,
  request_type: r.request_type,
  new_class_key: r.new_class_key || null,
  new_class_display: r.new_class_display || null,
  status: r.status || 'pending',
  admin_note: r.admin_note || null,
  created_at: r.created_at,
  updated_at: r.updated_at || null,
}));

await upsert('class_student_requests', requests, 'id', 'sinif talepleri');

// --- 4. Bildirim okundu/goruldu durumlari ---
const states = readJson('var/admin-notification-states.json').map((s) => ({
  source_type: s.source_type,
  source_id: s.source_id,
  viewer_role: s.viewer_role || 'admin',
  read_at: s.read_at || null,
  popup_seen_at: s.popup_seen_at || null,
  deleted_at: s.deleted_at || null,
  created_at: s.created_at,
  updated_at: s.updated_at,
}));

await upsert(
  'admin_notification_states',
  states,
  'source_type,source_id,viewer_role',
  'bildirim durumlari'
);

console.log('\nAktarim tamamlandi.');
