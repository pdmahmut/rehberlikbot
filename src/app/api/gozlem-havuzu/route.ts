import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { ObservationPriority, ObservationStatus, ObservationType } from "@/types";

export const runtime = "nodejs";

const VALID_TYPES: ObservationType[] = ["behavior", "academic", "social", "emotional"];
const VALID_PRIORITIES: ObservationPriority[] = ["low", "medium", "high"];
const VALID_STATUSES: ObservationStatus[] = ["pending", "completed", "converted"];

function normalizeText(value?: string | null) {
  return value?.trim() || "";
}

function isValidType(value: unknown): value is ObservationType {
  return typeof value === "string" && VALID_TYPES.includes(value as ObservationType);
}

function isValidPriority(value: unknown): value is ObservationPriority {
  return typeof value === "string" && VALID_PRIORITIES.includes(value as ObservationPriority);
}

function isValidStatus(value: unknown): value is ObservationStatus {
  return typeof value === "string" && VALID_STATUSES.includes(value as ObservationStatus);
}

export async function GET(request: NextRequest) {
  if (!supabase) {
    return NextResponse.json({ error: "Supabase yapılandırması eksik" }, { status: 500 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status");
    const classKey = searchParams.get("classKey");
    const studentName = searchParams.get("studentName");
    const q = searchParams.get("q");

    let query = supabase
      .from("observation_pool")
      .select("*")
      .order("created_at", { ascending: false });

    if (status && status !== "all" && isValidStatus(status)) {
      query = query.eq("status", status);
    }

    if (classKey) {
      query = query.eq("class_key", classKey);
    }

    if (studentName) {
      query = query.ilike("student_name", `%${studentName}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Observation pool GET error:", error);
      return NextResponse.json(
        { error: "Gözlem kayıtları alınamadı", details: error.message },
        { status: 500 }
      );
    }

    let observations = data || [];

    if (q) {
      const queryText = q.toLowerCase();
      observations = observations.filter((item) => {
        const fields = [
          item.student_name,
          item.student_number,
          item.class_display,
          item.class_key,
          item.note,
          item.observation_type,
          item.priority,
          item.status
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return fields.includes(queryText);
      });
    }

    const stats = {
      totalCount: observations.length,
      pendingCount: observations.filter((item) => item.status === "pending").length,
      completedCount: observations.filter((item) => item.status === "completed").length,
      convertedCount: observations.filter((item) => item.status === "converted").length,
      uniqueStudentCount: new Set(
        observations.map((item) => `${item.class_key || ""}|${item.student_name || ""}|${item.student_number || ""}`)
      ).size
    };

    return NextResponse.json({ observations, stats });
  } catch (error) {
    console.error("Observation pool GET unexpected error:", error);
    return NextResponse.json({ error: "Beklenmeyen hata oluştu" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!supabase) {
    return NextResponse.json({ error: "Supabase yapılandırması eksik" }, { status: 500 });
  }

  try {
    const body = await request.json();
    const student_name = normalizeText(body.student_name);
    const note = normalizeText(body.note);
    const observation_type = body.observation_type;
    const priority = body.priority;

    if (!student_name) {
      return NextResponse.json({ error: "Öğrenci adı gerekli" }, { status: 400 });
    }

    if (!isValidType(observation_type)) {
      return NextResponse.json({ error: "Geçerli bir gözlem türü seçin" }, { status: 400 });
    }

    if (!isValidPriority(priority)) {
      return NextResponse.json({ error: "Geçerli bir öncelik seçin" }, { status: 400 });
    }

    const insertPayload = {
      student_name,
      student_number: normalizeText(body.student_number) || null,
      class_key: normalizeText(body.class_key) || null,
      class_display: normalizeText(body.class_display) || null,
      observation_type,
      priority,
      note,
      observed_at: body.observed_at || new Date().toISOString().slice(0, 10),
      status: "pending"
    };

    const { data, error } = await supabase
      .from("observation_pool")
      .insert(insertPayload)
      .select("*")
      .single();

    if (error) {
      console.error("Observation pool insert error:", error);
      return NextResponse.json(
        { error: "Gözlem kaydı oluşturulamadı", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ observation: data, message: "Gözlem kaydı oluşturuldu" });
  } catch (error) {
    console.error("Observation pool POST unexpected error:", error);
    return NextResponse.json({ error: "Beklenmeyen hata oluştu" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  if (!supabase) {
    return NextResponse.json({ error: "Supabase yapılandırması eksik" }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { id, ids, action } = body as {
      id?: string;
      ids?: string[];
      action?: "update" | "status" | "convert";
    };

    if (action === "convert") {
      const targetIds = Array.isArray(ids) ? ids.filter(Boolean) : id ? [id] : [];
      if (targetIds.length === 0) {
        return NextResponse.json({ error: "Dönüştürülecek kayıt bulunamadı" }, { status: 400 });
      }

      const { data, error } = await supabase
        .from("observation_pool")
        .update({
          status: "converted",
          appointment_id: body.appointment_id || null,
          converted_at: new Date().toISOString()
        })
        .in("id", targetIds)
        .select("*");

      if (error) {
        console.error("Observation pool convert error:", error);
        return NextResponse.json(
          { error: "Gözlem kayıtları dönüştürülemedi", details: error.message },
          { status: 500 }
        );
      }

      return NextResponse.json({ observations: data || [], message: "Gözlem kayıtları dönüştürüldü" });
    }

    if (action === "status") {
      const targetIds = Array.isArray(ids) ? ids.filter(Boolean) : id ? [id] : [];
      const status = body.status as ObservationStatus | undefined;
      if (targetIds.length === 0) {
        return NextResponse.json({ error: "Güncellenecek kayıt bulunamadı" }, { status: 400 });
      }
      if (!isValidStatus(status)) {
        return NextResponse.json({ error: "Geçerli bir durum seçin" }, { status: 400 });
      }

      const updatePayload: Record<string, unknown> = {
        status,
        completed_at: status === "completed" ? new Date().toISOString() : null,
        converted_at: status === "converted" ? new Date().toISOString() : null,
        appointment_id: status === "converted" ? (body.appointment_id || null) : null
      };

      if (status !== "completed") {
        updatePayload.completed_at = body.completed_at ?? null;
      }
      if (status !== "converted") {
        updatePayload.converted_at = body.converted_at ?? null;
      }

      const { data, error } = await supabase
        .from("observation_pool")
        .update(updatePayload)
        .in("id", targetIds)
        .select("*");

      if (error) {
        console.error("Observation pool status update error:", error);
        return NextResponse.json(
          { error: "Gözlem durumu güncellenemedi", details: error.message },
          { status: 500 }
        );
      }

      return NextResponse.json({ observations: data || [], message: "Gözlem durumu güncellendi" });
    }

    if (!id) {
      return NextResponse.json({ error: "Kayıt ID'si gerekli" }, { status: 400 });
    }

    const updatePayload: Record<string, unknown> = {};

    if (typeof body.student_name === "string") updatePayload.student_name = normalizeText(body.student_name);
    if (typeof body.student_number === "string") updatePayload.student_number = normalizeText(body.student_number) || null;
    if (typeof body.class_key === "string") updatePayload.class_key = normalizeText(body.class_key) || null;
    if (typeof body.class_display === "string") updatePayload.class_display = normalizeText(body.class_display) || null;
    if (isValidType(body.observation_type)) updatePayload.observation_type = body.observation_type;
    if (isValidPriority(body.priority)) updatePayload.priority = body.priority;
    if (typeof body.note === "string") updatePayload.note = normalizeText(body.note);
    if (typeof body.observed_at === "string" && body.observed_at.trim()) updatePayload.observed_at = body.observed_at.trim();
    if (isValidStatus(body.status)) updatePayload.status = body.status;

    if (body.status === "completed") {
      updatePayload.completed_at = new Date().toISOString();
    }
    if (body.status === "converted") {
      updatePayload.converted_at = new Date().toISOString();
      updatePayload.appointment_id = body.appointment_id || null;
    }

    const { data, error } = await supabase
      .from("observation_pool")
      .update(updatePayload)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      console.error("Observation pool update error:", error);
      return NextResponse.json(
        { error: "Gözlem kaydı güncellenemedi", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ observation: data, message: "Gözlem kaydı güncellendi" });
  } catch (error) {
    console.error("Observation pool PUT unexpected error:", error);
    return NextResponse.json({ error: "Beklenmeyen hata oluştu" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!supabase) {
    return NextResponse.json({ error: "Supabase yapılandırması eksik" }, { status: 500 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Kayıt ID'si gerekli" }, { status: 400 });
    }

    const { error } = await supabase
      .from("observation_pool")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Observation pool delete error:", error);
      return NextResponse.json(
        { error: "Gözlem kaydı silinemedi", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: "Gözlem kaydı silindi" });
  } catch (error) {
    console.error("Observation pool DELETE unexpected error:", error);
    return NextResponse.json({ error: "Beklenmeyen hata oluştu" }, { status: 500 });
  }
}
