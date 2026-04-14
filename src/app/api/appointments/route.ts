import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { normalizeLessonSlot } from "@/lib/lessonSlots";
import { normalizeSourceType } from "@/lib/guidanceApplications";

const isMissingColumnError = (error: { message?: string } | null | undefined, columnName: string) => {
  const message = error?.message || "";
  return message.toLowerCase().includes("column") && message.toLowerCase().includes(columnName.toLowerCase());
};

const normalizeLocationValue = (value?: string | null) => {
  switch (value) {
    case "guidance_office":
    case "classroom":
    case "admin":
    case "phone":
    case "online":
    case "other":
      return value;
    case "PDR Odası":
    case "Rehberlik Servisi":
      return "guidance_office";
    case "Sınıf":
      return "classroom";
    case "İdare":
      return "admin";
    case "Telefon":
      return "phone";
    case "Online":
      return "online";
    case "Diğer":
      return "other";
    default:
      return "guidance_office";
  }
};

const syncApplicationStatus = async (
  sourceApplicationType?: string | null,
  sourceApplicationId?: string | null,
  status?: string,
  appointmentId?: string | null
) => {
  if (!supabase || !sourceApplicationType || !sourceApplicationId) return;

  try {
    const normalizedType = normalizeSourceType(sourceApplicationType);
    const effectiveStatus = status;
    const updatePayload: Record<string, unknown> = {
      status: effectiveStatus,
      appointment_id: appointmentId || null
    };

    if (status === "scheduled") {
      updatePayload.converted_at = new Date().toISOString();
    }

    if (effectiveStatus === "completed") {
      updatePayload.completed_at = new Date().toISOString();
    }

    let query = supabase
      .from("observation_pool")
      .update(updatePayload);

    if (normalizedType === "observation") {
      // For observation type, match by id if source_record_id is null
      query = query.or(`and(source_type.eq.${normalizedType},source_record_id.eq.${sourceApplicationId}),and(source_type.eq.${normalizedType},id.eq.${sourceApplicationId})`);
    } else {
      query = query.eq("source_type", normalizedType).eq("source_record_id", sourceApplicationId);
    }

    const { error } = await query;

    if (error) {
      console.error("syncApplicationStatus error:", error);
    }
  } catch (error) {
    console.error("syncApplicationStatus exception:", error);
  }
};

// GET - Randevuları listele
export async function GET(request: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json(
        { error: "Veritabanı bağlantısı yapılandırılmamış" },
        { status: 500 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get("date");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const status = searchParams.get("status");
    const participantType = searchParams.get("participantType");
    const priority = searchParams.get("priority");
    const search = searchParams.get("search");

    let query = supabase
      .from("appointments")
      .select("*")
      .order("appointment_date", { ascending: true })
      .order("start_time", { ascending: true });

    if (date) {
      query = query.eq("appointment_date", date);
    }

    if (from && to) {
      query = query.gte("appointment_date", from).lte("appointment_date", to);
    } else if (from) {
      query = query.gte("appointment_date", from);
    } else if (to) {
      query = query.lte("appointment_date", to);
    }

    if (status) {
      query = query.eq("status", status);
    }

    if (participantType) {
      query = query.eq("participant_type", participantType);
    }

    if (priority) {
      query = query.eq("priority", priority);
    }

    if (search) {
      query = query.ilike("participant_name", `%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json(
        { error: "Randevular alınamadı", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ appointments: data || [] });
  } catch (error) {
    console.error("Appointments GET error:", error);
    return NextResponse.json(
      { error: "Sunucu hatası" },
      { status: 500 }
    );
  }
}

// POST - Yeni randevu oluştur
export async function POST(request: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json(
        { error: "Veritabanı bağlantısı yapılandırılmamış" },
        { status: 500 }
      );
    }

    const body = await request.json();

    const {
      appointment_date,
      start_time,
      participant_type,
      participant_name,
      participant_class,
      participant_phone,
      topic_tags = [],
      location = "guidance_office",
      purpose,
      preparation_note,
      priority = "normal",
      template_type,
      source_individual_request_id,
      source_application_id,
      source_application_type
    } = body;
    const resolvedSourceApplicationId = source_application_id || source_individual_request_id || null;
    const resolvedSourceApplicationType = source_application_type || (source_individual_request_id ? "self_application" : null);

    if (!appointment_date || !start_time || !participant_type || !participant_name) {
      return NextResponse.json(
        { error: "Tarih, ders, katılımcı türü ve isim zorunludur" },
        { status: 400 }
      );
    }

    const normalizedSlot = normalizeLessonSlot(start_time);
    if (!normalizedSlot) {
      return NextResponse.json(
        { error: "Geçerli bir ders saati seçin" },
        { status: 400 }
      );
    }

    const [appointmentConflicts, guidanceConflictsResult, activityConflictsResult] = await Promise.all([
      supabase
        .from("appointments")
        .select("id, participant_name, participant_type, start_time")
        .eq("appointment_date", appointment_date)
        .eq("status", "planned"),
      supabase
        .from("guidance_plans")
        .select("id, class_display, lesson_period")
        .eq("plan_date", appointment_date)
        .eq("status", "planned"),
      supabase
        .from("class_activities")
        .select("id, class_display, activity_time")
        .eq("activity_date", appointment_date)
    ]);

    if (appointmentConflicts.error) {
      console.error("Randevu çakışma kontrolü hatası:", appointmentConflicts.error);
      return NextResponse.json(
        { error: "Çakışma kontrolü yapılamadı", details: appointmentConflicts.error.message },
        { status: 500 }
      );
    }

    const guidanceConflicts = guidanceConflictsResult.error
      ? []
      : (guidanceConflictsResult.data || []);
    const activityConflicts = activityConflictsResult.error
      ? []
      : (activityConflictsResult.data || []);

    if (guidanceConflictsResult.error) {
      console.warn("Sınıf rehberliği çakışma kontrolü atlandı:", guidanceConflictsResult.error);
    }
    if (activityConflictsResult.error) {
      console.warn("Sınıf etkinliği çakışma kontrolü atlandı:", activityConflictsResult.error);
    }

    const busyAppointments = (appointmentConflicts.data || []).filter((item) => normalizeLessonSlot(item.start_time) === normalizedSlot);
    if (busyAppointments.length > 0) {
      const appointment = busyAppointments[0];
      return NextResponse.json(
        { error: `Bu tarih ve ders saatinde zaten bir randevu var: ${appointment.participant_name} (${appointment.participant_type})` },
        { status: 400 }
      );
    }

    const busyGuidancePlans = guidanceConflicts.filter((item) => normalizeLessonSlot(item.lesson_period) === normalizedSlot);
    if (busyGuidancePlans.length > 0) {
      const plan = busyGuidancePlans[0];
      return NextResponse.json(
        { error: `Bu tarih ve ders saatinde zaten bir sınıf rehberliği planı var: ${plan.class_display}` },
        { status: 400 }
      );
    }

    const busyActivities = activityConflicts.filter((item) => normalizeLessonSlot(item.activity_time) === normalizedSlot);
    if (busyActivities.length > 0) {
      const activity = busyActivities[0];
      return NextResponse.json(
        { error: `Bu tarih ve ders saatinde zaten bir sınıf etkinliği var: ${activity.class_display}` },
        { status: 400 }
      );
    }

    const insertPayload = {
      appointment_date,
      start_time,
      participant_type,
      participant_name,
      participant_class,
      participant_phone,
      topic_tags,
      location: normalizeLocationValue(location),
      purpose,
      preparation_note,
      priority,
      status: "planned",
      template_type,
      source_individual_request_id: source_individual_request_id || null,
      source_application_id: resolvedSourceApplicationId,
      source_application_type: resolvedSourceApplicationType
    };

    let { data, error } = await supabase
      .from("appointments")
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      const {
        source_individual_request_id: _ignoredRequestId,
        source_application_id: _ignoredApplicationId,
        source_application_type: _ignoredApplicationType,
        ...fallbackPayload
      } = insertPayload;
      const fallbackResult = await supabase
        .from("appointments")
        .insert(fallbackPayload)
        .select()
        .single();
      data = fallbackResult.data;
      error = fallbackResult.error;
    }

    if (error) {
      console.error("Supabase insert error:", error);
      return NextResponse.json(
        { error: "Randevu oluşturulamadı", details: error.message },
        { status: 500 }
      );
    }

    await syncApplicationStatus(resolvedSourceApplicationType, resolvedSourceApplicationId, "scheduled", data?.id || null);

    return NextResponse.json({ appointment: data, message: "Randevu oluşturuldu" });
  } catch (error) {
    console.error("Appointments POST error:", error);
    return NextResponse.json(
      { error: "Sunucu hatası" },
      { status: 500 }
    );
  }
}

// PUT - Randevu güncelle
export async function PUT(request: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json(
        { error: "Veritabanı bağlantısı yapılandırılmamış" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const {
      id,
      source_application_status,
      source_application_id,
      source_application_type,
      source_individual_request_id,
      ...updateData
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Randevu ID zorunludur" },
        { status: 400 }
      );
    }

    const needsConflictCheck = Boolean(updateData.appointment_date || updateData.start_time);
    const currentAppointment = needsConflictCheck
      ? await supabase
          .from("appointments")
          .select("id, appointment_date, start_time, status")
          .eq("id", id)
          .maybeSingle()
      : { data: null, error: null };

    if (needsConflictCheck && (currentAppointment.error || !currentAppointment.data)) {
      console.error("Mevcut randevu alınamadı:", currentAppointment.error);
      return NextResponse.json(
        { error: "Randevu bulunamadı", details: currentAppointment.error?.message },
        { status: 404 }
      );
    }

    const currentAppointmentData = currentAppointment.data;
    const nextAppointmentDate = updateData.appointment_date || currentAppointmentData?.appointment_date;
    const nextStartTime = updateData.start_time || currentAppointmentData?.start_time;
    const normalizedSlot = normalizeLessonSlot(nextStartTime);

    if (normalizedSlot && needsConflictCheck) {
      const [appointmentConflicts, guidanceConflictsResult, activityConflictsResult] = await Promise.all([
        supabase
          .from("appointments")
          .select("id, participant_name, participant_type, start_time")
          .eq("appointment_date", nextAppointmentDate)
          .neq("status", "cancelled")
          .neq("id", id),
        supabase
          .from("guidance_plans")
          .select("id, class_display, lesson_period")
          .eq("plan_date", nextAppointmentDate)
          .eq("status", "planned"),
        supabase
          .from("class_activities")
          .select("id, class_display, activity_time")
          .eq("activity_date", nextAppointmentDate)
      ]);

      if (appointmentConflicts.error) {
        console.error("Güncelleme randevu çakışma kontrolü hatası:", appointmentConflicts.error);
        return NextResponse.json(
          { error: "Çakışma kontrolü yapılamadı", details: appointmentConflicts.error.message },
          { status: 500 }
        );
      }

      const guidanceConflicts = guidanceConflictsResult.error
        ? []
        : (guidanceConflictsResult.data || []);
      const activityConflicts = activityConflictsResult.error
        ? []
        : (activityConflictsResult.data || []);

      if (guidanceConflictsResult.error) {
        console.warn("Güncelleme sınıf rehberliği çakışma kontrolü atlandı:", guidanceConflictsResult.error);
      }
      if (activityConflictsResult.error) {
        console.warn("Güncelleme sınıf etkinliği çakışma kontrolü atlandı:", activityConflictsResult.error);
      }

      const busyAppointments = (appointmentConflicts.data || []).filter((item) => normalizeLessonSlot(item.start_time) === normalizedSlot);
      if (busyAppointments.length > 0) {
        const appointment = busyAppointments[0];
        return NextResponse.json(
          { error: `Bu tarih ve ders saatinde zaten bir randevu var: ${appointment.participant_name} (${appointment.participant_type})` },
          { status: 400 }
        );
      }

      const busyGuidancePlans = guidanceConflicts.filter((item) => normalizeLessonSlot(item.lesson_period) === normalizedSlot);
      if (busyGuidancePlans.length > 0) {
        const plan = busyGuidancePlans[0];
        return NextResponse.json(
          { error: `Bu tarih ve ders saatinde zaten bir sınıf rehberliği planı var: ${plan.class_display}` },
          { status: 400 }
        );
      }

      const busyActivities = activityConflicts.filter((item) => normalizeLessonSlot(item.activity_time) === normalizedSlot);
      if (busyActivities.length > 0) {
        const activity = busyActivities[0];
        return NextResponse.json(
          { error: `Bu tarih ve ders saatinde zaten bir sınıf etkinliği var: ${activity.class_display}` },
          { status: 400 }
        );
      }
    }

    const normalizedUpdateData = {
      ...updateData,
      ...(Object.prototype.hasOwnProperty.call(updateData, "location")
        ? { location: normalizeLocationValue(updateData.location as string | null | undefined) }
        : {})
    };

    let { data, error } = await supabase
      .from("appointments")
      .update(normalizedUpdateData)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      const {
        source_individual_request_id: _ignoredRequestId,
        source_application_id: _ignoredApplicationId,
        source_application_type: _ignoredApplicationType,
        ...fallbackUpdate
      } = normalizedUpdateData as Record<string, unknown>;
      const fallbackResult = await supabase
        .from("appointments")
        .update(fallbackUpdate)
        .eq("id", id)
        .select()
        .single();
      data = fallbackResult.data;
      error = fallbackResult.error;
    }

    if (error) {
      console.error("Supabase update error:", error);
      return NextResponse.json(
        { error: "Randevu güncellenemedi", details: error.message },
        { status: 500 }
      );
    }

    const resolvedSourceApplicationId =
      source_application_id ||
      source_individual_request_id ||
      data?.source_application_id ||
      data?.source_individual_request_id ||
      null;
    const resolvedSourceApplicationType =
      source_application_type ||
      data?.source_application_type ||
      (source_individual_request_id ? "self_application" : null);

    if (source_application_status) {
      await syncApplicationStatus(
        resolvedSourceApplicationType,
        resolvedSourceApplicationId,
        source_application_status,
        id
      );
    }

    return NextResponse.json({ appointment: data, message: "Randevu güncellendi" });
  } catch (error) {
    console.error("Appointments PUT error:", error);
    return NextResponse.json(
      { error: "Sunucu hatası" },
      { status: 500 }
    );
  }
}

// DELETE - Randevu sil
export async function DELETE(request: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json(
        { error: "Veritabanı bağlantısı yapılandırılmamış" },
        { status: 500 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get("id");
    const sourceApplicationId = searchParams.get("source_application_id");
    const sourceApplicationType = searchParams.get("source_application_type");

    if (!id && !sourceApplicationId) {
      return NextResponse.json(
        { error: "Randevu ID zorunludur" },
        { status: 400 }
      );
    }

    const appointmentIds: string[] = [];

    if (id) {
      appointmentIds.push(id);
    } else {
      const { data: appointmentRecords, error: appointmentLookupError } = await supabase
        .from("appointments")
        .select("id")
        .eq("source_application_id", sourceApplicationId)
        .eq("source_application_type", sourceApplicationType || "observation");

      if (appointmentLookupError) {
        console.error("Appointments lookup error before delete:", appointmentLookupError);
        return NextResponse.json(
          { error: "Randevular sorgulanırken hata oluştu", details: appointmentLookupError.message },
          { status: 500 }
        );
      }

      (appointmentRecords || []).forEach((appointment) => {
        if (appointment?.id) appointmentIds.push(appointment.id);
      });
    }

    if (appointmentIds.length > 0) {
      const { error: taskDeleteError } = await supabase
        .from("appointment_tasks")
        .delete()
        .in("appointment_id", appointmentIds);

      if (taskDeleteError) {
        console.error("Appointment tasks delete error:", taskDeleteError);
        return NextResponse.json(
          { error: "Randevu görevleri silinirken hata oluştu", details: taskDeleteError.message },
          { status: 500 }
        );
      }
    }

    let query = supabase.from("appointments").delete();

    if (id) {
      query = query.eq("id", id);
    } else {
      query = query
        .eq("source_application_id", sourceApplicationId)
        .eq("source_application_type", sourceApplicationType || "observation");
    }

    const { error } = await query;

    if (error) {
      console.error("Supabase delete error:", error);
      return NextResponse.json(
        { error: "Randevu silinemedi", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Randevu silindi" });
  } catch (error) {
    console.error("Appointments DELETE error:", error);
    return NextResponse.json(
      { error: "Sunucu hatası" },
      { status: 500 }
    );
  }
}
