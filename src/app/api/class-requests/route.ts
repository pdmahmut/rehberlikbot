import { NextRequest, NextResponse } from "next/server";
import { type SupabaseClient } from "@supabase/supabase-js";
import { getSession, type SessionUser } from "@/lib/auth";
import { getSupabaseAdmin, hasSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  cleanClassRequestText,
  getClassRequestDisplayCategory,
  normalizeClassRequestCategory,
} from "@/lib/classRequests";

export const dynamic = "force-dynamic";

const getActorTeacherName = (session: SessionUser | null) =>
  session?.teacherName || session?.username || null;

// Onceden anon anahtar + "x-app-role" gibi HTTP basliklari kullaniliyordu ve
// yetki karari veritabanindaki RLS politikalarina birakilmisti. Anon anahtar
// tarayicida gorunur oldugu icin bu basliklar taklit edilebiliyordu; yani RLS
// gercek bir sinir degildi. Artik service_role kullaniliyor ve ogretmen
// kisitlari asagida KOD ICINDE uygulaniyor.
const createRequestScopedSupabase = (): SupabaseClient | null => {
  return hasSupabaseAdmin() ? getSupabaseAdmin() : null;
};

/** Ogretmen yalnizca kendi sinifi icin actigi talepleri gorebilir/degistirebilir. */
const assertOwnedByTeacher = (
  session: SessionUser,
  row: { teacher_name?: string | null; class_key?: string | null }
): boolean => {
  if (session.role !== "teacher") return true;
  const actor = getActorTeacherName(session);
  if (!actor || row.teacher_name !== actor) return false;
  if (session.classKey && row.class_key && row.class_key !== session.classKey) return false;
  return true;
};

const resolveAdminCategoryValue = async (
  supabase: SupabaseClient,
  rawValue: unknown
): Promise<{ label: string; normalized: string } | null> => {
  const trimmedLabel = cleanClassRequestText(rawValue as string | null);
  const normalizedLabel = normalizeClassRequestCategory(trimmedLabel);

  if (!trimmedLabel || !normalizedLabel) return null;

  const { data: existingCategory, error: fetchError } = await supabase
    .from("class_request_categories")
    .select("label, normalized_label")
    .eq("normalized_label", normalizedLabel)
    .maybeSingle();

  if (fetchError) throw fetchError;

  if (existingCategory?.label) {
    return {
      label: existingCategory.label,
      normalized: existingCategory.normalized_label || normalizedLabel,
    };
  }

  const { data: insertedCategory, error: insertError } = await supabase
    .from("class_request_categories")
    .upsert(
      {
        label: trimmedLabel,
        normalized_label: normalizedLabel,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "normalized_label" }
    )
    .select("label, normalized_label")
    .single();

  if (insertError) throw insertError;

  return {
    label: insertedCategory.label,
    normalized: insertedCategory.normalized_label,
  };
};

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum bulunamadı" }, { status: 401 });
  }

  const supabase = createRequestScopedSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const teacherName = searchParams.get("teacherName");
  const classKey = searchParams.get("classKey");
  const status = searchParams.get("status");
  const scheduledDate = searchParams.get("scheduledDate");
  const scheduledFrom = searchParams.get("scheduledFrom");
  const scheduledTo = searchParams.get("scheduledTo");
  const excludeId = searchParams.get("excludeId");

  let query = supabase
    .from("class_requests")
    .select("*")
    .order("created_at", { ascending: false });

  if (id) query = query.eq("id", id);
  if (session.role === "admin") {
    if (teacherName) query = query.eq("teacher_name", teacherName);
    if (classKey) query = query.eq("class_key", classKey);
  } else {
    // Ogretmen yalnizca kendi taleplerini gorur. Bu kisit onceden RLS
    // tarafindan uygulaniyordu; RLS kaldirildigi icin burada zorunlu.
    const actorTeacherName = getActorTeacherName(session);
    query = query.eq("teacher_name", actorTeacherName || "__no_teacher__");
    if (session.classKey) query = query.eq("class_key", session.classKey);
  }
  if (status && status !== "all") query = query.eq("status", status);
  if (scheduledDate) query = query.eq("scheduled_date", scheduledDate);
  if (scheduledFrom) query = query.gte("scheduled_date", scheduledFrom);
  if (scheduledTo) query = query.lte("scheduled_date", scheduledTo);
  if (excludeId) query = query.neq("id", excludeId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ requests: data || [] });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum bulunamadı" }, { status: 401 });
  }

  const supabase = createRequestScopedSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 500 });
  }

  const body = await request.json();
  const { teacherName, classKey, classDisplay, teacherDescription, description } = body;

  const actorTeacherName = getActorTeacherName(session);
  const effectiveTeacherName = session.role === "teacher" ? actorTeacherName : teacherName;
  const effectiveClassKey = session.role === "teacher" ? session.classKey : classKey;
  const effectiveClassDisplay =
    session.role === "teacher" ? (session.classDisplay || session.classKey) : classDisplay;
  const trimmedTeacherDescription = cleanClassRequestText(
    teacherDescription ?? description ?? null
  );

  if (!effectiveTeacherName || !effectiveClassKey || !effectiveClassDisplay || !trimmedTeacherDescription) {
    return NextResponse.json({ error: "Eksik parametre" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("class_requests")
    .insert({
      teacher_name: effectiveTeacherName,
      class_key: effectiveClassKey,
      class_display: effectiveClassDisplay,
      teacher_description: trimmedTeacherDescription,
      description: trimmedTeacherDescription,
      status: "pending",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ request: data }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum bulunamadı" }, { status: 401 });
  }

  const supabase = createRequestScopedSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id gerekli" }, { status: 400 });

  const { data: existing, error: fetchError } = await supabase
    .from("class_requests")
    .select("id, status, teacher_name, class_key")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: "Talep bulunamadı" }, { status: 404 });
  if (!assertOwnedByTeacher(session, existing)) {
    return NextResponse.json({ error: "Bu talep üzerinde yetkiniz yok" }, { status: 403 });
  }
  if (session.role === "teacher" && existing.status !== "pending") {
    return NextResponse.json({ error: "Sadece bekleyen talepler iptal edilebilir" }, { status: 400 });
  }

  const { error } = await supabase.from("class_requests").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum bulunamadı" }, { status: 401 });
  }

  const supabase = createRequestScopedSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış" }, { status: 500 });
  }

  const body = await request.json();
  const {
    id,
    status,
    scheduledDate,
    lessonSlot,
    lessonTeacher,
    feedback,
    teacherDescription,
    adminCategory,
    topic,
    description,
  } = body;

  if (!id) return NextResponse.json({ error: "id gerekli" }, { status: 400 });

  const { data: existing, error: fetchError } = await supabase
    .from("class_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: "Talep bulunamadı" }, { status: 404 });
  if (!assertOwnedByTeacher(session, existing)) {
    return NextResponse.json({ error: "Bu talep üzerinde yetkiniz yok" }, { status: 403 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (session.role === "teacher") {
    const isEditingRequest =
      teacherDescription !== undefined || description !== undefined || topic !== undefined;
    const isSavingFeedback = feedback !== undefined;

    if (isEditingRequest) {
      if (existing.status !== "pending") {
        return NextResponse.json({ error: "Sadece bekleyen talepler düzenlenebilir" }, { status: 400 });
      }
      if (status !== undefined || scheduledDate !== undefined || lessonSlot !== undefined || lessonTeacher !== undefined) {
        return NextResponse.json({ error: "Planlama alanlarını güncelleme yetkiniz yok" }, { status: 403 });
      }

      const nextTeacherDescription = cleanClassRequestText(
        teacherDescription ?? description ?? topic ?? null
      );

      if (!nextTeacherDescription) {
        return NextResponse.json({ error: "Talep açıklaması boş bırakılamaz" }, { status: 400 });
      }

      updates.teacher_description = nextTeacherDescription;
      updates.description = nextTeacherDescription;
    }

    if (isSavingFeedback) {
      const trimmedFeedback = cleanClassRequestText(feedback);
      updates.feedback = trimmedFeedback || null;
    }

    if (!isEditingRequest && !isSavingFeedback) {
      return NextResponse.json({ error: "Güncellenecek alan bulunamadı" }, { status: 400 });
    }
  } else {
    const wantsScheduling =
      status === "scheduled" || scheduledDate !== undefined || lessonSlot !== undefined;

    if (status !== undefined) updates.status = status;
    if (scheduledDate !== undefined) updates.scheduled_date = scheduledDate || null;
    if (lessonSlot !== undefined) updates.lesson_slot = lessonSlot || null;
    if (lessonTeacher !== undefined) updates.lesson_teacher = cleanClassRequestText(lessonTeacher) || null;
    if (feedback !== undefined) {
      const trimmedFeedback = cleanClassRequestText(feedback);
      updates.feedback = trimmedFeedback || null;
    }

    if (adminCategory !== undefined || topic !== undefined) {
      const resolvedCategory = await resolveAdminCategoryValue(
        supabase,
        adminCategory ?? topic
      );

      if (!resolvedCategory) {
        return NextResponse.json({ error: "Teknik kategori boş bırakılamaz" }, { status: 400 });
      }

      updates.admin_category = resolvedCategory.label;
      updates.admin_category_normalized = resolvedCategory.normalized;
      updates.topic = resolvedCategory.label;
    }

    if (teacherDescription !== undefined || description !== undefined) {
      const nextTeacherDescription = cleanClassRequestText(
        teacherDescription ?? description ?? null
      );
      updates.teacher_description = nextTeacherDescription || null;
      updates.description = nextTeacherDescription || null;
    }

    const effectiveCategory = getClassRequestDisplayCategory({
      admin_category:
        (updates.admin_category as string | null | undefined) ?? existing.admin_category ?? null,
      topic: existing.topic ?? null,
    });

    if (wantsScheduling && !effectiveCategory) {
      return NextResponse.json(
        { error: "Planlama yapmadan önce teknik kategori belirlemelisiniz" },
        { status: 400 }
      );
    }
  }

  const { data, error } = await supabase
    .from("class_requests")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ request: data });
}
