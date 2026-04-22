import { NextRequest, NextResponse } from 'next/server';
import {
  getTeachersData,
  matchTeacherByName,
  importTeachersFromExcelToStore,
  addTeacher,
  removeTeacher,
  assignTeacherToClass,
  removeTeacherClassAssignment,
} from '@/lib/teachers';
import { loadTeachersFromStore } from '@/lib/teachersStore';
import { seedTeachers } from '@/lib/seedTeachers';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q');
    const all = searchParams.get('all');

    if (all === '1') {
      const records = loadTeachersFromStore();
      return NextResponse.json({ teachers: records });
    }

    const { records, list } = getTeachersData();

    if (q) {
      const m = matchTeacherByName(q, records);
      if (!m) return NextResponse.json({ found: false });
      return NextResponse.json({ found: true, teacher: m });
    }

    return NextResponse.json({ teachers: list });
  } catch (error) {
    console.error('Teachers API Error:', error);
    return NextResponse.json({ error: 'Öğretmen verileri yüklenemedi' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === 'add') {
      const { teacherName } = body;
      if (!teacherName?.trim()) {
        return NextResponse.json({ error: 'Öğretmen adı gerekli' }, { status: 400 });
      }
      const result = addTeacher(teacherName);
      if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });
      return NextResponse.json({ success: true, teacher: result.teacher });
    }

    if (action === 'remove') {
      const { teacherId } = body;
      if (!teacherId) return NextResponse.json({ error: 'teacherId gerekli' }, { status: 400 });
      const ok = removeTeacher(teacherId);
      if (!ok) return NextResponse.json({ error: 'Öğretmen bulunamadı' }, { status: 404 });
      return NextResponse.json({ success: true });
    }

    if (action === 'assign_class') {
      const { teacherId, sinifSubeKey, sinifSubeDisplay } = body;
      if (!teacherId || !sinifSubeKey || !sinifSubeDisplay) {
        return NextResponse.json({ error: 'Eksik parametre' }, { status: 400 });
      }
      const result = assignTeacherToClass(teacherId, sinifSubeKey, sinifSubeDisplay);
      if (!result.success) return NextResponse.json({ error: result.error }, { status: 404 });
      return NextResponse.json({ success: true });
    }

    if (action === 'remove_class') {
      const { teacherId } = body;
      if (!teacherId) return NextResponse.json({ error: 'teacherId gerekli' }, { status: 400 });
      removeTeacherClassAssignment(teacherId);
      return NextResponse.json({ success: true });
    }

    if (action === 'import') {
      const count = importTeachersFromExcelToStore();
      return NextResponse.json({ imported: count });
    }

    if (action === 'seed') {
      const count = seedTeachers();
      return NextResponse.json({ seeded: count, message: `${count} öğretmen verisi yazıldı` });
    }

    return NextResponse.json({ error: 'Geçersiz action' }, { status: 400 });
  } catch (error) {
    console.error('Teachers API POST Error:', error);
    return NextResponse.json({ error: 'İşlem başarısız' }, { status: 500 });
  }
}
