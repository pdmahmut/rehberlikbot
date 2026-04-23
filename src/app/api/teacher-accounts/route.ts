import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase yapılandırması eksik");
  return createClient(url, key);
}

const normalizeTeacherPassword = (value: string) =>
  String(value || "").trim().toLocaleLowerCase("tr-TR");

const generateSystemUsername = (teacherName: string) => {
  const base = teacherName
    .toLocaleLowerCase("tr-TR")
    .trim()
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9.]/g, "")
    .slice(0, 24) || "ogretmen";
  return `${base}.${Date.now()}`;
};

export async function GET() {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("teacher_users")
      .select("id, username, teacher_name, class_key, class_display, password_hash, created_at")
      .order("teacher_name");

    if (error) throw error;
    return NextResponse.json({ users: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password, teacher_name } = body;

    if (!password || !teacher_name) {
      return NextResponse.json(
        { error: "Öğretmen adı ve şifre zorunludur" },
        { status: 400 }
      );
    }
    if (String(password).trim().length < 4) {
      return NextResponse.json({ error: "Şifre en az 4 karakter olmalı" }, { status: 400 });
    }

    const supabase = getSupabase();
    const normalizedPassword = normalizeTeacherPassword(password);

    const { data: existingUserByPassword } = await supabase
      .from("teacher_users")
      .select("id,password_hash")
      .not("password_hash", "is", null)
      .eq("password_hash", String(password).trim())
      .maybeSingle();

    if (existingUserByPassword) {
      return NextResponse.json({ error: "Bu şifre başka bir öğretmende kullanılıyor" }, { status: 409 });
    }

    const { data: existingInHistory } = await supabase
      .from("teacher_password_history")
      .select("id")
      .eq("normalized_password", normalizedPassword)
      .maybeSingle();

    if (existingInHistory) {
      return NextResponse.json({ error: "Bu şifre daha önce kullanılmış. Farklı bir şifre girin." }, { status: 409 });
    }

    const generatedUsername = generateSystemUsername(String(teacher_name));
    const { data, error } = await supabase
      .from("teacher_users")
      .insert({
        username: generatedUsername,
        password_hash: String(password).trim(),
        teacher_name: String(teacher_name).trim(),
      })
      .select("id, teacher_name, class_key, class_display, password_hash, created_at")
      .single();

    if (error) throw error;

    await supabase.from("teacher_password_history").insert({
      teacher_user_id: data.id,
      normalized_password: normalizedPassword,
    });

    return NextResponse.json({ success: true, user: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, password, action, class_key, class_display } = body;

    if (!id) return NextResponse.json({ error: "ID zorunludur" }, { status: 400 });

    const supabase = getSupabase();

    if (action === "assign_class") {
      const { error } = await supabase
        .from("teacher_users")
        .update({ class_key: class_key || null, class_display: class_display || null })
        .eq("id", id);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (!password) return NextResponse.json({ error: "Yeni şifre zorunludur" }, { status: 400 });
    if (String(password).trim().length < 4) {
      return NextResponse.json({ error: "Şifre en az 4 karakter olmalı" }, { status: 400 });
    }

    const nextPassword = String(password).trim();
    const normalizedNextPassword = normalizeTeacherPassword(nextPassword);

    const { data: existingById } = await supabase
      .from("teacher_users")
      .select("id,password_hash")
      .eq("id", id)
      .maybeSingle();
    if (!existingById) return NextResponse.json({ error: "Öğretmen hesabı bulunamadı" }, { status: 404 });

    if ((existingById.password_hash || "").toLocaleLowerCase("tr-TR") === normalizedNextPassword) {
      return NextResponse.json({ error: "Yeni şifre mevcut şifreyle aynı olamaz" }, { status: 400 });
    }

    const { data: samePasswordOnAnotherUser } = await supabase
      .from("teacher_users")
      .select("id,password_hash")
      .not("password_hash", "is", null)
      .eq("password_hash", nextPassword)
      .neq("id", id)
      .maybeSingle();

    if (samePasswordOnAnotherUser) {
      return NextResponse.json({ error: "Bu şifre başka bir öğretmende kullanılıyor" }, { status: 409 });
    }

    const { data: existsInHistory } = await supabase
      .from("teacher_password_history")
      .select("id")
      .eq("normalized_password", normalizedNextPassword)
      .maybeSingle();

    if (existsInHistory) {
      return NextResponse.json({ error: "Bu şifre daha önce kullanılmış. Farklı bir şifre girin." }, { status: 409 });
    }

    const { error } = await supabase
      .from("teacher_users")
      .update({ password_hash: nextPassword })
      .eq("id", id);
    if (error) throw error;

    await supabase.from("teacher_password_history").insert({
      teacher_user_id: id,
      normalized_password: normalizedNextPassword,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "ID zorunludur" }, { status: 400 });
    }

    const supabase = getSupabase();
    const { error } = await supabase.from("teacher_users").delete().eq("id", id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
