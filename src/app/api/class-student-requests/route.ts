import { NextRequest, NextResponse } from 'next/server';
import {
  getRequests, createRequest, updateRequest, getRequest, hasPendingRequest,
} from '@/lib/classStudentRequests';
import { supabase } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || undefined;
  const classKey = searchParams.get('classKey') || undefined;
  return NextResponse.json({ requests: getRequests({ status, classKey }) });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { teacherName, classKey, classDisplay, studentName, studentValue, requestType, newClassKey, newClassDisplay } = body;

  if (!teacherName || !classKey || !studentName || !requestType) {
    return NextResponse.json({ error: 'Eksik parametre' }, { status: 400 });
  }

  if (hasPendingRequest(classKey, studentName, requestType)) {
    return NextResponse.json({ error: 'Bu öğrenci için zaten bekleyen bir talep var' }, { status: 409 });
  }

  const req = createRequest({
    teacher_name: teacherName,
    class_key: classKey,
    class_display: classDisplay || classKey,
    student_name: studentName,
    student_value: studentValue || null,
    request_type: requestType,
    new_class_key: newClassKey || null,
    new_class_display: newClassDisplay || null,
  });

  return NextResponse.json({ request: req }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { id, status, adminNote } = body;

  if (!id || !status) {
    return NextResponse.json({ error: 'id ve status gerekli' }, { status: 400 });
  }

  // Execute action for Supabase-backed students when approved
  if (status === 'approved' && supabase) {
    const req = getRequest(id);
    if (req?.student_value?.startsWith('supabase_')) {
      const studentId = req.student_value.replace('supabase_', '');
      if (req.request_type === 'delete') {
        await supabase.from('class_students').delete().eq('id', studentId);
      } else if (req.request_type === 'class_change' && req.new_class_key) {
        await supabase
          .from('class_students')
          .update({ class_key: req.new_class_key, class_display: req.new_class_display || req.new_class_key })
          .eq('id', studentId);
      }
    }
  }

  const updated = updateRequest(id, { status, admin_note: adminNote });
  if (!updated) return NextResponse.json({ error: 'Talep bulunamadı' }, { status: 404 });

  return NextResponse.json({ request: updated });
}
