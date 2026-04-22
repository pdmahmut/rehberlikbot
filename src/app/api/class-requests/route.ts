import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!supabase) return NextResponse.json({ requests: [] });

  const { searchParams } = new URL(request.url);
  const teacherName = searchParams.get('teacherName');
  const classKey = searchParams.get('classKey');
  const status = searchParams.get('status');

  let query = supabase
    .from('class_requests')
    .select('*')
    .order('created_at', { ascending: false });

  if (teacherName) query = query.eq('teacher_name', teacherName);
  if (classKey) query = query.eq('class_key', classKey);
  if (status && status !== 'all') query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ requests: data || [] });
}

export async function POST(request: NextRequest) {
  if (!supabase) return NextResponse.json({ error: 'Supabase yapılandırılmamış' }, { status: 500 });

  const body = await request.json();
  const { teacherName, classKey, classDisplay, topic, description } = body;

  if (!teacherName || !classKey || !classDisplay || !topic) {
    return NextResponse.json({ error: 'Eksik parametre' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('class_requests')
    .insert({
      teacher_name: teacherName,
      class_key: classKey,
      class_display: classDisplay,
      topic,
      description: description || null,
      status: 'pending',
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ request: data }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  if (!supabase) return NextResponse.json({ error: 'Supabase yapılandırılmamış' }, { status: 500 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id gerekli' }, { status: 400 });

  const { error } = await supabase.from('class_requests').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function PATCH(request: NextRequest) {
  if (!supabase) return NextResponse.json({ error: 'Supabase yapılandırılmamış' }, { status: 500 });

  const body = await request.json();
  const { id, status, scheduledDate, lessonSlot, lessonTeacher, feedback } = body;

  if (!id) return NextResponse.json({ error: 'id gerekli' }, { status: 400 });

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (status !== undefined) updates.status = status;
  if (scheduledDate !== undefined) updates.scheduled_date = scheduledDate || null;
  if (lessonSlot !== undefined) updates.lesson_slot = lessonSlot || null;
  if (lessonTeacher !== undefined) updates.lesson_teacher = lessonTeacher || null;
  if (feedback !== undefined) updates.feedback = feedback;

  const { data, error } = await supabase
    .from('class_requests')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ request: data });
}
