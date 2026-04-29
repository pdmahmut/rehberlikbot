import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { StudentStatus } from '@/app/panel/types';
import {
  createLocalClassStudent,
  deleteLocalClassStudent,
  getLocalClassStudent,
  listLocalClassStudents,
  updateLocalClassStudent,
} from '@/lib/classStudentsStore';

export const runtime = 'nodejs';

const VALID_STATUSES: StudentStatus[] = ['tumu', 'aktif_takip', 'tamamlandi'];

function normalizeStudentStatus(value: unknown): StudentStatus {
  if (value === 'duzenli_gorusme') return 'aktif_takip';
  return isValidStatus(value) ? value : 'tumu';
}

function isValidStatus(value: unknown): value is StudentStatus {
  return typeof value === 'string' && VALID_STATUSES.includes(value as StudentStatus);
}

function getClassStudentsWriteSupabase(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function normalizeVisibleStudents<T extends { student_number?: string | null; student_name?: string | null; status?: unknown }>(
  students: T[]
) {
  return students
    .filter((student) => student.student_number !== '__SINIF_DISI__')
    .map((student) => ({
      ...student,
      status: normalizeStudentStatus(student.status),
    }))
    .sort((a, b) =>
      String(a.student_name || '').localeCompare(String(b.student_name || ''), 'tr')
    );
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const classKey = searchParams.get('classKey');
    const status = searchParams.get('status');
    const sinifDisi = searchParams.get('sinifDisi') === 'true';

    if (!classKey) {
      return NextResponse.json({ error: 'classKey parametresi gerekli' }, { status: 400 });
    }

    const localStudents = listLocalClassStudents(classKey);
    let remoteStudents: any[] = [];

    if (supabase) {
      let query = supabase.from('class_students').select('*').eq('class_key', classKey);
      if (sinifDisi) {
        query = query.eq('student_number', '__SINIF_DISI__');
      } else {
        query = query.neq('student_number', '__SINIF_DISI__').order('student_name', { ascending: true });
      }

      const { data, error } = await query;
      if (error) {
        console.error('Supabase class_students GET error:', error.message);
      } else {
        remoteStudents = data ?? [];
      }
    }

    const merged = [...remoteStudents, ...localStudents];

    if (sinifDisi) {
      return NextResponse.json({
        excluded: merged.filter((student) => student.student_number === '__SINIF_DISI__'),
      });
    }

    const normalizedFilterStatus = normalizeStudentStatus(status);
    const visibleStudents = normalizeVisibleStudents(merged);
    const filtered =
      status && isValidStatus(normalizedFilterStatus)
        ? visibleStudents.filter((student) => student.status === normalizedFilterStatus)
        : visibleStudents;

    return NextResponse.json({ students: filtered });
  } catch (err) {
    console.error('Class students GET error:', err);
    return NextResponse.json({ error: 'Beklenmeyen hata oluştu' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { classKey, classDisplay, studentName, studentNumber } = body as {
      classKey?: string;
      classDisplay?: string;
      studentName?: string;
      studentNumber?: string;
    };

    if (!classKey || !studentName) {
      return NextResponse.json({ error: 'classKey ve studentName zorunludur' }, { status: 400 });
    }

    const trimmedStudentName = studentName.trim();
    const trimmedStudentNumber = studentNumber?.trim() || null;

    const localDuplicate = listLocalClassStudents(classKey).find(
      (student) =>
        student.student_name.trim().toLocaleLowerCase('tr-TR') ===
        trimmedStudentName.toLocaleLowerCase('tr-TR')
    );
    if (localDuplicate) {
      return NextResponse.json({ error: 'Bu öğrenci zaten sınıfta kayıtlı' }, { status: 409 });
    }

    const writeSupabase = getClassStudentsWriteSupabase();
    if (writeSupabase) {
      const { data: existingStudent, error: existingStudentError } = await writeSupabase
        .from('class_students')
        .select('id')
        .eq('class_key', classKey)
        .eq('student_name', trimmedStudentName)
        .maybeSingle();

      if (existingStudentError) {
        console.error('Supabase class_students duplicate check error:', existingStudentError.message);
      } else if (existingStudent) {
        return NextResponse.json({ error: 'Bu öğrenci zaten sınıfta kayıtlı' }, { status: 409 });
      }

      const { data, error } = await writeSupabase
        .from('class_students')
        .insert({
          class_key: classKey,
          class_display: classDisplay ?? classKey,
          student_name: trimmedStudentName,
          student_number: trimmedStudentNumber,
          status: 'tumu',
        })
        .select('*')
        .single();

      if (!error) {
        return NextResponse.json({ student: data }, { status: 201 });
      }

      console.error('Supabase class_students POST error:', error.message);
    }

    const localResult = createLocalClassStudent({
      class_key: classKey,
      class_display: classDisplay ?? classKey,
      student_name: trimmedStudentName,
      student_number: trimmedStudentNumber,
      status: 'tumu',
    });

    if (!localResult.created) {
      return NextResponse.json({ error: 'Bu öğrenci zaten sınıfta kayıtlı' }, { status: 409 });
    }

    return NextResponse.json({ student: localResult.record }, { status: 201 });
  } catch (err) {
    console.error('Class students POST error:', err);
    return NextResponse.json({ error: 'Beklenmeyen hata oluştu' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id parametresi gerekli' }, { status: 400 });
    }

    if (deleteLocalClassStudent(id)) {
      return NextResponse.json({ success: true });
    }

    const writeSupabase = getClassStudentsWriteSupabase();
    if (!writeSupabase) {
      return NextResponse.json({ error: 'Öğrenci bulunamadı' }, { status: 404 });
    }

    const { error } = await writeSupabase.from('class_students').delete().eq('id', id);
    if (error) {
      console.error('Supabase class_students DELETE error:', error.message);
      return NextResponse.json({ error: 'Öğrenci silinirken hata oluştu' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Class students DELETE error:', err);
    return NextResponse.json({ error: 'Beklenmeyen hata oluştu' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { id, class_key, class_display } = await request.json();
    if (!id || !class_key) {
      return NextResponse.json({ error: 'id ve class_key zorunludur' }, { status: 400 });
    }

    const localStudent = getLocalClassStudent(id);
    if (localStudent) {
      const updated = updateLocalClassStudent(id, {
        class_key,
        class_display: class_display || class_key,
      });
      return NextResponse.json({ student: updated });
    }

    const writeSupabase = getClassStudentsWriteSupabase();
    if (!writeSupabase) {
      return NextResponse.json({ error: 'Öğrenci bulunamadı' }, { status: 404 });
    }

    const { data, error } = await writeSupabase
      .from('class_students')
      .update({ class_key, class_display: class_display || class_key })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return NextResponse.json({ student: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const id = body.id as string | undefined;
    const status = normalizeStudentStatus(body.status);

    if (!id) {
      return NextResponse.json({ error: 'id parametresi gerekli' }, { status: 400 });
    }

    if (!isValidStatus(status)) {
      return NextResponse.json({ error: 'Geçerli bir durum seçin' }, { status: 400 });
    }

    const localStudent = getLocalClassStudent(id);
    if (localStudent) {
      const updated = updateLocalClassStudent(id, { status });
      return NextResponse.json({ student: updated });
    }

    const writeSupabase = getClassStudentsWriteSupabase();
    if (!writeSupabase) {
      return NextResponse.json({ error: 'Öğrenci bulunamadı' }, { status: 404 });
    }

    const { data, error } = await writeSupabase
      .from('class_students')
      .update({ status })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      console.error('Supabase class_students PUT error:', error.message);
      return NextResponse.json({ error: 'Öğrenci durumu güncellenemedi' }, { status: 500 });
    }

    return NextResponse.json({ student: data });
  } catch (err) {
    console.error('Class students PUT error:', err);
    return NextResponse.json({ error: 'Beklenmeyen hata oluştu' }, { status: 500 });
  }
}
