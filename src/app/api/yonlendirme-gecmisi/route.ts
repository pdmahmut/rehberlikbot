import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const COOKIE_NAME = 'rehberlik_session';

function getSession(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const payload = JSON.parse(Buffer.from(token, 'base64url').toString());
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase yapılandırması eksik');
  return createClient(url, key);
}

export async function GET(request: NextRequest) {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Oturum bulunamadı' }, { status: 401 });

  try {
    const supabase = getSupabase();
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');

    const query = supabase
      .from('referrals')
      .select('id, student_name, class_display, reason, note, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    // Sınıf rehberi ise kendi sınıfına ait tüm yönlendirmeler
    // Normal öğretmen ise kendi yaptığı yönlendirmeler
    if (session.role === 'teacher') {
      if (session.isHomeroom && session.classKey) {
        query.eq('class_key', session.classKey);
      } else {
        query.eq('teacher_name', session.teacherName);
      }
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ referrals: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
