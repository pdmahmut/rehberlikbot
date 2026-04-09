import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { ApplicationStatus, ObservationPriority, ObservationType } from "@/types";
import { normalizeSourceType } from "@/lib/guidanceApplications";

export const runtime = "nodejs";

const VALID_TYPES: ObservationType[] = ["behavior", "academic", "social", "emotional"];
const VALID_PRIORITIES: ObservationPriority[] = ["low", "medium", "high"];
const VALID_STATUSES: ApplicationStatus[] = ["pending", "scheduled", "active_follow", "regular_meeting", "completed"];

function normalizeText(value?: string | null) {
  return value?.trim() || "";
}

function isValidType(value: unknown): value is ObservationType {
  return typeof value === "string" && VALID_TYPES.includes(value as ObservationType);
}

function isValidPriority(value: unknown): value is ObservationPriority {
  return typeof value === "string" && VALID_PRIORITIES.includes(value as ObservationPriority);
}

function isValidStatus(value: unknown): value is ApplicationStatus {
  return typeof value === "string" && VALID_STATUSES.includes(value as ApplicationStatus);
}

const isMissingColumnError = (error: { message?: string } | null | undefined, columnName: string) => {
  const message = error?.message || "";
  return message.toLowerCase().includes("column") && message.toLowerCase().includes(columnName.toLowerCase());
};

export async function GET(request: NextRequest) {
  if (!supabase) {
    return NextResponse.json({ error: "Supabase yapılandırması eksik" }, { status: 500 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status");
    const sourceType = searchParams.get("sourceType");
    const classKey = searchParams.get("classKey");
    const studentName = searchParams.get("studentName");
    const q = searchParams.get("q");

    let query = supabase
      .from("observation_pool")
      .select("*")
      .order("created_at", { ascending: false });

    if (status && status !== "all" && isValidStatus(status)) {
      if (status === "scheduled") {
        query = query.in("status", ["scheduled"]);
      } else {
        query = query.eq("status", status);
      }
    }

    if (sourceType && sourceType !== "all") {
      query = query.eq("source_type", normalizeSourceType(sourceType));
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
      scheduledCount: observations.filter((item) => item.status === "scheduled" || item.status === "scheduled").length,
      activeFollowCount: observations.filter((item) => item.status === "active_follow").length,
      regularMeetingCount: observations.filter((item) => item.status === "regular_meeting").length,
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
    const source_type = normalizeSourceType(body.source_type);
    const source_record_id = normalizeText(body.source_record_id);
    const source_record_table = normalizeText(body.source_record_table);
    const status = isValidStatus(body.status) ? body.status : "pending";

    if (!student_name) {
      return NextResponse.json({ error: "Öğrenci adı gerekli" }, { status: 400 });
    }

    if (!isValidType(observation_type)) {
      return NextResponse.json({ error: "Geçerli bir gözlem türü seçin" }, { status: 400 });
    }

    if (!isValidPriority(priority)) {
      return NextResponse.json({ error: "Geçerli bir öncelik seçin" }, { status: 400 });
    }

    const observedAt = body.observed_at || new Date().toISOString().slice(0, 10);
    const insertPayload = {
      student_name,
      student_number: normalizeText(body.student_number) || null,
      class_key: normalizeText(body.class_key) || null,
      class_display: normalizeText(body.class_display) || null,
      observation_type,
      priority,
      note,
      observed_at: observedAt,
      status,
      source_type,
      source_record_id: source_record_id || null,
      source_record_table: source_record_table || null
    };

    let existingRecord: { id: string } | null = null;
    try {
      let resultQuery = supabase
        .from("observation_pool")
        .select("id");

      if (source_record_id) {
        resultQuery = resultQuery.eq("source_type", source_type).eq("source_record_id", source_record_id);
      } else {
        resultQuery = resultQuery
          .eq("student_name", student_name)
          .eq("observed_at", observedAt)
          .eq("source_type", source_type);
      }

      const { data, error } = await resultQuery.limit(1).maybeSingle();
      if (error) {
        throw error;
      }

      existingRecord = data || null;
    } catch (lookupError) {
      if (!isMissingColumnError(lookupError as { message?: string } | null | undefined, "source_type")) {
        throw lookupError;
      }

      const fallbackQuery = supabase
        .from("observation_pool")
        .select("id")
        .eq("student_name", student_name)
        .eq("observed_at", observedAt);

      const { data, error } = await fallbackQuery.limit(1).maybeSingle();
      if (error) {
        throw error;
      }

      existingRecord = data || null;
    }

    let { data, error } = existingRecord
      ? await supabase
          .from("observation_pool")
          .update(insertPayload)
          .eq("id", existingRecord.id)
          .select("*")
          .single()
      : await supabase
          .from("observation_pool")
          .insert(insertPayload)
          .select("*")
          .single();

    if (error) {
      if (
        isMissingColumnError(error, "source_type") ||
        isMissingColumnError(error, "source_record_id") ||
        isMissingColumnError(error, "source_record_table")
      ) {
        const fallbackInsertPayload = {
          student_name,
          student_number: normalizeText(body.student_number) || null,
          class_key: normalizeText(body.class_key) || null,
          class_display: normalizeText(body.class_display) || null,
          observation_type,
          priority,
          note,
          observed_at: observedAt,
          status
        };

        const fallbackResult = existingRecord
          ? await supabase
              .from("observation_pool")
              .update(fallbackInsertPayload)
              .eq("id", existingRecord.id)
              .select("*")
              .single()
          : await supabase
              .from("observation_pool")
              .insert(fallbackInsertPayload)
              .select("*")
              .single();

        if (!fallbackResult.error) {
          data = fallbackResult.data;
          // For observation type, set source_record_id to id
          if (source_type === "observation" && data && !data.source_record_id) {
            await supabase
              .from("observation_pool")
              .update({ source_record_id: data.id })
              .eq("id", data.id);
          }
          return NextResponse.json({ observation: data, message: "Gözlem kaydı oluşturuldu" });
        }

        error = fallbackResult.error;
      }

      console.error("Observation pool insert error:", error);
      return NextResponse.json(
        { error: "Gözlem kaydı oluşturulamadı", details: error.message },
        { status: 500 }
      );
    }

    // For observation type, set source_record_id to id
    if (source_type === "observation" && data && !data.source_record_id) {
      await supabase
        .from("observation_pool")
        .update({ source_record_id: data.id })
        .eq("id", data.id);
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

      const updatePayload = {
        status: "completed",
        appointment_id: body.appointment_id || null,
        converted_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from("observation_pool")
        .update(updatePayload)
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
      const status = isValidStatus(body.status) ? body.status : undefined;
      if (targetIds.length === 0) {
        return NextResponse.json({ error: "Güncellenecek kayıt bulunamadı" }, { status: 400 });
      }
      if (!isValidStatus(status)) {
        return NextResponse.json({ error: "Geçerli bir durum seçin" }, { status: 400 });
      }

      const updatePayload: Record<string, unknown> = {
        status,
        completed_at: status === "completed" ? new Date().toISOString() : null,
        converted_at: status === "scheduled" ? new Date().toISOString() : null,
        appointment_id: status === "scheduled" ? (body.appointment_id || null) : null
      };

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
    if (typeof body.source_type === "string") updatePayload.source_type = normalizeSourceType(body.source_type);
    if (typeof body.source_record_id === "string") updatePayload.source_record_id = normalizeText(body.source_record_id) || null;
    if (typeof body.source_record_table === "string") updatePayload.source_record_table = normalizeText(body.source_record_table) || null;

    if (body.status === "completed") {
      updatePayload.completed_at = new Date().toISOString();
    }
    if (body.status === "scheduled" || body.status === "scheduled") {
      updatePayload.converted_at = new Date().toISOString();
      updatePayload.appointment_id = body.appointment_id || null;
    }

    let { data, error } = await supabase
      .from("observation_pool")
      .update(updatePayload)
      .eq("id", id)
      .select("*")
      .single();

    if (
      error &&
      (isMissingColumnError(error, "source_type") ||
        isMissingColumnError(error, "source_record_id") ||
        isMissingColumnError(error, "source_record_table"))
    ) {
      const {
        source_type: _ignoredSourceType,
        source_record_id: _ignoredSourceRecordId,
        source_record_table: _ignoredSourceRecordTable,
        ...fallbackUpdatePayload
      } = updatePayload;

      const fallbackResult = await supabase
        .from("observation_pool")
        .update(fallbackUpdatePayload)
        .eq("id", id)
        .select("*")
        .single();

      data = fallbackResult.data;
      error = fallbackResult.error;
    }

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

    let observation: { id: string; appointment_id?: string | null; source_type?: string | null; source_record_id?: string | null } | null = null;
    let lookupError = null;
    let hasFallbackSchema = false;

    const { data: observationResult, error: initialLookupError } = await supabase
      .from("observation_pool")
      .select("id, appointment_id, source_type, source_record_id")
      .eq("id", id)
      .maybeSingle();

    if (initialLookupError) {
      if (
        isMissingColumnError(initialLookupError, "source_type") ||
        isMissingColumnError(initialLookupError, "source_record_id")
      ) {
        hasFallbackSchema = true;
        const { data: fallbackObservation, error: fallbackLookupError } = await supabase
          .from("observation_pool")
          .select("id, appointment_id")
          .eq("id", id)
          .maybeSingle();

        observation = fallbackObservation || null;
        lookupError = fallbackLookupError;
      } else {
        lookupError = initialLookupError;
      }
    } else {
      observation = observationResult || null;
    }

    if (lookupError) {
      console.error("Observation pool delete lookup error:", lookupError);
      return NextResponse.json(
        { error: "Gözlem kaydı sorgulanırken hata oluştu", details: lookupError.message },
        { status: 500 }
      );
    }

    if (!observation) {
      const { error: appointmentDeleteError } = await supabase
        .from("appointments")
        .delete()
        .eq("source_application_type", "observation")
        .eq("source_application_id", id);

      if (appointmentDeleteError) {
        if (
          isMissingColumnError(appointmentDeleteError, "source_application_type") ||
          isMissingColumnError(appointmentDeleteError, "source_application_id")
        ) {
          console.warn(
            "Observation pool cleanup skipped because appointments table is missing source application columns:",
            appointmentDeleteError
          );
          return NextResponse.json(
            { message: "Gözlem kaydı zaten silinmiş; eski şema nedeniyle bağlı randevu temizlemesi atlandı" },
            { status: 200 }
          );
        }

        console.error("Observation pool cleanup delete error:", appointmentDeleteError);
        return NextResponse.json(
          { error: "Eksik gözlem kaydıyla bağlantılı randevular silinirken hata oluştu", details: appointmentDeleteError.message },
          { status: 500 }
        );
      }

      return NextResponse.json(
        { message: "Gözlem kaydı zaten silinmiş, bağlı randevular temizlendi" },
        { status: 200 }
      );
    }

    const appointmentIds = new Set<string>();
    if (observation.appointment_id) appointmentIds.add(observation.appointment_id);

    if (appointmentIds.size === 0) {
      const appointmentQuery = supabase.from("appointments").select("id");

      if (!hasFallbackSchema && observation.source_type && observation.source_record_id) {
        appointmentQuery
          .eq("source_application_type", observation.source_type)
          .eq("source_application_id", observation.source_record_id);
      } else {
        appointmentQuery
          .eq("source_application_type", "observation")
          .eq("source_application_id", observation.id);
      }

      const { data: linkedAppointments, error: linkedAppointmentError } = await appointmentQuery;
      if (linkedAppointmentError) {
        if (
          isMissingColumnError(linkedAppointmentError, "source_application_type") ||
          isMissingColumnError(linkedAppointmentError, "source_application_id")
        ) {
          console.warn(
            "Observation pool linked appointment lookup skipped because appointments table is missing source application columns:",
            linkedAppointmentError
          );
        } else {
          console.error("Observation pool linked appointment lookup error:", linkedAppointmentError);
          return NextResponse.json(
            { error: "Bağlı randevular sorgulanırken hata oluştu", details: linkedAppointmentError.message },
            { status: 500 }
          );
        }
      }

      (linkedAppointments || []).forEach((item) => {
        if (item?.id) appointmentIds.add(item.id);
      });
    }

    if (appointmentIds.size > 0) {
      const ids = Array.from(appointmentIds);
      await supabase.from("appointment_tasks").delete().in("appointment_id", ids);
      const { error: appointmentDeleteError } = await supabase.from("appointments").delete().in("id", ids);
      if (appointmentDeleteError) {
        console.error("Appointment delete error:", appointmentDeleteError);
        return NextResponse.json(
          { error: "Bağlı randevu silinemedi", details: appointmentDeleteError.message },
          { status: 500 }
        );
      }
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

    return NextResponse.json({ message: "Gözlem kaydı silindi" });
  } catch (error) {
    console.error("Observation pool DELETE unexpected error:", error);
    return NextResponse.json({ error: "Beklenmeyen hata oluştu" }, { status: 500 });
  }
}
