import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getTeachersData } from '@/lib/teachers';

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase yapılandırması eksik');
  return createClient(url, key);
}

// Öğretmen adından kullanıcı adı üret: "Gülbahar Öztürk" → "gulbahar.ozturk"
function toUsername(name: string): string {
  return name
    .toLocaleLowerCase('tr-TR')
    .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
    .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9.]/g, '');
}

// Tüm öğretmen kullanıcılarını listele
export async function GET() {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('teacher_users')
      .select('id, username, teacher_name, class_key, class_display, created_at')
      .order('teacher_name');

    if (error) throw error;
    return NextResponse.json({ users: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Yeni öğretmen kullanıcısı ekle veya toplu içe aktarım
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Toplu içe aktarım
    if (body.action === 'import') {
      const { records } = getTeachersData();
      if (!records || records.length === 0) {
        return NextResponse.json({ error: 'Sistemde öğretmen verisi bulunamadı' }, { status: 404 });
      }

      const supabase = getSupabase();

      // Mevcut kullanıcıları çek (tekrar eklememek için)
      const { data: existing } = await supabase.from('teacher_users').select('username');
      const existingUsernames = new Set((existing || []).map((u: any) => u.username));

      const toInsert = records
        .filter(r => r.teacherName)
        .map(r => {
          const username = toUsername(r.teacherName);
          return { username, password_hash: username, teacher_name: r.teacherName };
        })
        .filter(u => !existingUsernames.has(u.username));

      if (toInsert.length === 0) {
        return NextResponse.json({ success: true, added: 0, message: 'Tüm öğretmenler zaten tanımlı' });
      }

      const { error } = await supabase.from('teacher_users').insert(toInsert);
      if (error) throw error;

      return NextResponse.json({
        success: true,
        added: toInsert.length,
        users: toInsert.map(u => ({ username: u.username, teacher_name: u.teacher_name }))
      });
    }

    const { username, password, teacher_name } = body;

    if (!username || !password || !teacher_name) {
      return NextResponse.json({ error: 'Kullanıcı adı, şifre ve ad zorunludur' }, { status: 400 });
    }

    const supabase = getSupabase();

    // Kullanıcı adı benzersizlik kontrolü
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

// Şifre güncelle veya sınıf ata
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, password, action, class_key, class_display } = body;

    if (!id) return NextResponse.json({ error: 'ID zorunludur' }, { status: 400 });

    const supabase = getSupabase();

    // Sınıf atama / kaldırma
    if (action === 'assign_class') {
      const { error } = await supabase
        .from('teacher_users')
        .update({ class_key: class_key || null, class_display: class_display || null })
        .eq('id', id);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    // Şifre güncelleme
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
