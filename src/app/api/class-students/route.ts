import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import type { StudentStatus } from '@/app/panel/types';

export const runtime = 'nodejs';

// Bu endpoint Supabase "class_students" tablosu üzerinden
// sınıf bazlı öğrenci listeleme, ekleme ve silme işlemlerini yönetir.

const VALID_STATUSES: StudentStatus[] = ["tumu", "aktif_takip", "duzenli_gorusme", "tamamlandi"];

function isValidStatus(value: unknown): value is StudentStatus {
  return typeof value === "string" && VALID_STATUSES.includes(value as StudentStatus);
}

export async function GET(request: NextRequest) {
  if (!supabase) {
    return NextResponse.json(
      { error: 'Supabase configuration missing' },
      { status: 500 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const classKey = searchParams.get('classKey');
    const status = searchParams.get('status');

    if (!classKey) {
      return NextResponse.json(
        { error: 'classKey parametresi gerekli' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('class_students')
      .select('*')
      .eq('class_key', classKey)
      .order('student_name', { ascending: true });

    if (error) {
      console.error('Supabase class_students GET error:', error.message);
      return NextResponse.json(
        { error: 'Öğrenciler alınırken hata oluştu' },
        { status: 500 }
      );
    }

    const normalizedStudents = (data ?? []).map((student) => ({
      ...student,
      status: isValidStatus(student.status) ? student.status : "tumu"
    }));

    const filtered = status && isValidStatus(status)
      ? normalizedStudents.filter((student) => student.status === status)
      : normalizedStudents;

    return NextResponse.json({ students: filtered });
  } catch (err) {
    console.error('Class students GET error:', err);
    return NextResponse.json(
      { error: 'Beklenmeyen hata oluştu' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!supabase) {
    return NextResponse.json(
      { error: 'Supabase configuration missing' },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { classKey, classDisplay, studentName, studentNumber } = body as {
      classKey?: string;
      classDisplay?: string;
      studentName?: string;
      studentNumber?: string;
    };

    if (!classKey || !studentName) {
      return NextResponse.json(
        { error: 'classKey ve studentName zorunludur' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('class_students')
      .insert({
        class_key: classKey,
        class_display: classDisplay ?? classKey,
        student_name: studentName,
        student_number: studentNumber ?? null,
        status: "tumu",
      })
      .select('*')
      .single();

    if (error) {
      console.error('Supabase class_students POST error:', error.message);
      return NextResponse.json(
        { error: 'Öğrenci eklenirken hata oluştu' },
        { status: 500 }
      );
    }

    return NextResponse.json({ student: data }, { status: 201 });
  } catch (err) {
    console.error('Class students POST error:', err);
    return NextResponse.json(
      { error: 'Beklenmeyen hata oluştu' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  if (!supabase) {
    return NextResponse.json(
      { error: 'Supabase configuration missing' },
      { status: 500 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'id parametresi gerekli' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('class_students')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Supabase class_students DELETE error:', error.message);
      return NextResponse.json(
        { error: 'Öğrenci silinirken hata oluştu' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Class students DELETE error:', err);
    return NextResponse.json(
      { error: 'Beklenmeyen hata oluştu' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  if (!supabase) {
    return NextResponse.json(
      { error: 'Supabase configuration missing' },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const id = body.id as string | undefined;
    const status = body.status as StudentStatus | undefined;

    if (!id) {
      return NextResponse.json(
        { error: 'id parametresi gerekli' },
        { status: 400 }
      );
    }

    if (!isValidStatus(status)) {
      return NextResponse.json(
        { error: 'Geçerli bir durum seçin' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('class_students')
      .update({ status })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      console.error('Supabase class_students PUT error:', error.message);
      return NextResponse.json(
        { error: 'Öğrenci durumu güncellenemedi' },
        { status: 500 }
      );
    }

    return NextResponse.json({ student: data });
  } catch (err) {
    console.error('Class students PUT error:', err);
    return NextResponse.json(
      { error: 'Beklenmeyen hata oluştu' },
      { status: 500 }
    );
  }
}
