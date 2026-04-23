import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase yapılandırması eksik');
  return createClient(url, key);
}

function toUsername(name: string): string {
  return name
    .toLocaleLowerCase('tr-TR')
    .replace(/g/g, 'g').replace(/u/g, 'u').replace(/s/g, 's')
    .replace(/i/g, 'i').replace(/o/g, 'o').replace(/c/g, 'c')
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9.]/g, '');
}

export async function GET() {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('teacher_users')
      .select('id, username, teacher_name, class_key, class_display, password_hash, created_at')
      .order('teacher_name');

    if (error) throw error;
    return NextResponse.json({ users: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password, teacher_name } = body;

    if (!username || !password || !teacher_name) {
      return NextResponse.json({ error: 'Kullanıcı adı, şifre ve ad zorunludur' }, { status: 400 });
    }

    const supabase = getSupabase();

    const { data: existing } = await supabase
      .from('teacher_users')
      .select('id')
      .eq('username', username)
      .single();

    if (existing) {
      return NextResponse.json({ error: 'Bu kullanıcı adı zaten kullanımda' }, { status: 409 });
    }

    const { data, error } = await supabase
      .from('teacher_users')
      .insert({ username, password_hash: password, teacher_name })
      .select('id, username, teacher_name, created_at')
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, user: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, password, action, class_key, class_display } = body;

    if (!id) return NextResponse.json({ error: 'ID zorunludur' }, { status: 400 });

    const supabase = getSupabase();

    if (action === 'assign_class') {
      const { error } = await supabase
        .from('teacher_users')
        .update({ class_key: class_key || null, class_display: class_display || null })
        .eq('id', id);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (!password) return NextResponse.json({ error: 'Yeni şifre zorunludur' }, { status: 400 });
    const { error } = await supabase
      .from('teacher_users')
      .update({ password_hash: password })
      .eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'ID zorunludur' }, { status: 400 });
    }

    const supabase = getSupabase();
    const { error } = await supabase
      .from('teacher_users')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
