import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSession, type SessionUser } from "@/lib/auth";
import { normalizeClassRequestCategory } from "@/lib/classRequests";

export const dynamic = "force-dynamic";

const getActorTeacherName = (session: SessionUser | null) =>
  session?.teacherName || session?.username || null;

const createRequestScopedSupabase = (session: SessionUser): SupabaseClient | null => {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) return null;

  const actorTeacherName = getActorTeacherName(session);

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        "x-app-role": session.role,
        ...(actorTeacherName ? { "x-teacher-name": actorTeacherName } : {}),
        ...(session.classKey ? { "x-class-key": session.classKey } : {}),
      },
    },
  });
};

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum bulunamadı" }, { status: 401 });
  }

  if (session.role !== "admin") {
    return NextResponse.json({ error: "Bu alan sadece yönetici içindir" }, { status: 403 });
  }

  const supabase = createRequestScopedSupabase(session);
  if (!supabase) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("class_request_categories")
    .select("label")
    .order("label", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    categories: (data || []).map((item) => item.label).filter(Boolean),
  });
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum bulunamadı" }, { status: 401 });
  }

  if (session.role !== "admin") {
    return NextResponse.json({ error: "Bu alan sadece yönetici içindir" }, { status: 403 });
  }

  const supabase = createRequestScopedSupabase(session);
  if (!supabase) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const normalizedLabel = normalizeClassRequestCategory(body?.label);
  if (!normalizedLabel) {
    return NextResponse.json({ error: "Kategori adı gerekli" }, { status: 400 });
  }

  const { error } = await supabase
    .from("class_request_categories")
    .delete()
    .eq("normalized_label", normalizedLabel);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
