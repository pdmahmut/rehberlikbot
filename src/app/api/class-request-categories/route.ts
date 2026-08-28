import { NextResponse } from "next/server";
import { type SupabaseClient } from "@supabase/supabase-js";
import { getSession } from "@/lib/auth";
import { normalizeClassRequestCategory } from "@/lib/classRequests";
import { getSupabaseAdmin, hasSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// Yetki kontrolu handler icinde yapiliyor (yalnizca admin). Onceki surumde
// anon anahtar + HTTP basliklari ile RLS'e birakilmisti; basliklar taklit
// edilebildigi icin gercek bir sinir degildi.
const createRequestScopedSupabase = (): SupabaseClient | null => {
  return hasSupabaseAdmin() ? getSupabaseAdmin() : null;
};

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum bulunamadı" }, { status: 401 });
  }

  if (session.role !== "admin") {
    return NextResponse.json({ error: "Bu alan sadece yönetici içindir" }, { status: 403 });
  }

  const supabase = createRequestScopedSupabase();
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

  const supabase = createRequestScopedSupabase();
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
