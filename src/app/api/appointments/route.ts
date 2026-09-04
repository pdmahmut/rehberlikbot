import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { normalizeLessonSlot } from "@/lib/lessonSlots";
import {
  getSourceTable,
  getStatusCandidatesForSource,
  normalizeSourceTypeOrNull,
} from "@/lib/guidanceApplications";

import { requireSession } from '@/lib/apiAuth';
const isMissingColumnError = (error: { message?: string } | null | undefined, columnName: string) => {
  const message = error?.message || "";
  return message.toLowerCase().includes("column") && message.toLowerCase().includes(columnName.toLowerCase());
};

const isUnsupportedValueError = (error: { message?: string } | null | undefined) => {
  const message = (error?.message || "").toLowerCase();
  return (
    message.includes("check constraint") ||
    message.includes("violates check constraint") ||
    message.includes("invalid input value")
  );
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
  if (!sourceApplicationId || !status) return;
  const supabase = getSupabaseAdmin();

  try {
    const normalizedType = normalizeSourceTypeOrNull(sourceApplicationType);

    if (!normalizedType) return;

    const statusCandidates = getStatusCandidatesForSource(normalizedType, status as Parameters<typeof getStatusCandidatesForSource>[1]);
    const tableName = getSourceTable(normalizedType);
    const basePayload: Record<string, unknown> = {};

    if (normalizedType === "observation") {
      basePayload.appointment_id = appointmentId || null;
      if (status === "scheduled") {
        basePayload.converted_at = new Date().toISOString();
      }
      if (status === "completed" || status === "active_follow") {
        basePayload.completed_at = new Date().toISOString();
      }
    }

    let lastError: { message?: string } | null = null;

    for (const candidateStatus of statusCandidates) {
      const updatePayload: Record<string, unknown> = {
        ...basePayload,
        status: candidateStatus,
      };

      let query = supabase.from(tableName).update(updatePayload);

      if (normalizedType === "observation") {
        query = query.or(
          `and(source_type.eq.${normalizedType},source_record_id.eq.${sourceApplicationId}),and(source_type.eq.${normalizedType},id.eq.${sourceApplicationId})`
        );
      } else {
        query = query.eq("id", sourceApplicationId);
      }

      const { error } = await query;

      if (!error) {
        return;
      }

      lastError = error;

      const canFallbackColumns =
        normalizedType === "observation" &&
        (isMissingColumnError(error, "appointment_id") ||
          isMissingColumnError(error, "converted_at") ||
          isMissingColumnError(error, "completed_at"));

      if (canFallbackColumns) {
        const fallbackPayload = { ...updatePayload };
        delete fallbackPayload.appointment_id;
        delete fallbackPayload.converted_at;
        delete fallbackPayload.completed_at;

        let fallbackQuery = supabase.from(tableName).update(fallbackPayload);

        fallbackQuery =
          normalizedType === "observation"
            ? fallbackQuery.or(
                `and(source_type.eq.${normalizedType},source_record_id.eq.${sourceApplicationId}),and(source_type.eq.${normalizedType},id.eq.${sourceApplicationId})`
              )
            : fallbackQuery.eq("id", sourceApplicationId);

        const fallbackResult = await fallbackQuery;
        if (!fallbackResult.error) {
          return;
        }

        lastError = fallbackResult.error;
      }

      if (!isUnsupportedValueError(error) && !canFallbackColumns) {
        break;
      }
    }

    if (lastError) {
      console.error("syncApplicationStatus error:", {
        sourceApplicationType,
        sourceApplicationId,
        status,
        normalizedType,
        message: lastError.message,
      });
    }
  } catch (error) {
    console.error("syncApplicationStatus exception:", error);
  }
};

// Ayni ogrencinin diger acik basvurulari.
//
// Bir ogrenci icin birden fazla kanaldan basvuru gelebilir (ornegin hem veli
// hem ogretmen). Rehber ogretmen bunlari tek gorusmede hallediyor; bu yuzden
// bir basvuru islendiginde ayni ogrencinin diger ACIK basvurulari da ayni
// duruma gecer. Islem yalnizca ekranda degil veritabaninda yapilir; boylece
// ogretmenin kendi ekrani, sayaclar ve donem sonu dokumleri de dogru olur.
//
// Iptalde geri alinirken, kendi randevusu olan basvuruya dokunulmaz: onu
// bagimsiz bir islem kapatmistir.

const SIBLING_SOURCES: Array<{
  type: "teacher_referral" | "parent_request" | "student_report" | "self_application" | "observation";
  table: string;
  nameColumn: string;
}> = [
  { type: "teacher_referral", table: "referrals", nameColumn: "student_name" },
  { type: "parent_request", table: "parent_meeting_requests", nameColumn: "student_name" },
  { type: "student_report", table: "student_incidents", nameColumn: "target_student_name" },
  { type: "self_application", table: "individual_requests", nameColumn: "student_name" },
  { type: "observation", table: "observation_pool", nameColumn: "student_name" },
];

/** "24 AZİZ ÇELENK" ile "AZİZ ÇELENK" ayni ogrenci sayilir. */
const siblingNameKey = (value: unknown) =>
  String(value || "")
    .replace(/^\d+\s+/, "")
    .trim()
    .toLocaleUpperCase("tr-TR")
    .replace(/\s+/g, " ");

const OPEN_STATUSES = new Set(["pending", "new", "bekliyor", "reviewing"]);

const syncSiblingApplications = async (
  studentName: string | null | undefined,
  status: "scheduled" | "completed" | "active_follow" | "pending",
  actedType: string | null | undefined,
  actedId: string | null | undefined
) => {
  const key = siblingNameKey(studentName);
  if (!key) return;

  const supabase = getSupabaseAdmin();
  const normalizedActedType = normalizeSourceTypeOrNull(actedType);

  try {
    for (const source of SIBLING_SOURCES) {
      // Sutun adi kaynaga gore degistigi icin tum satir cekilir; tablolar
      // kucuk (bir donemlik basvuru sayisi) oldugu icin maliyeti onemsiz.
      const { data, error } = await supabase.from(source.table).select("*");

      if (error) continue;

      for (const row of ((data || []) as unknown[]) as Array<Record<string, unknown>>) {
        const rowId = String(row.id || "");
        if (!rowId) continue;

        // Islemi tetikleyen basvuru zaten ayrica guncelleniyor.
        if (source.type === normalizedActedType && rowId === actedId) continue;
        if (siblingNameKey(row[source.nameColumn]) !== key) continue;

        const current = String(row.status || "").toLocaleLowerCase("tr-TR");

        if (status === "pending") {
          // Geri alma: zaten acik olan bir seyi geri almaya gerek yok.
          if (OPEN_STATUSES.has(current)) continue;

          // Kendi randevusu olan basvuru baska bir islemin sonucudur;
          // bu iptal onu ilgilendirmez.
          const { data: own } = await supabase
            .from("appointments")
            .select("id")
            .eq("source_application_id", rowId)
            .neq("status", "cancelled")
            .limit(1);
          if ((own || []).length > 0) continue;
        } else if (!OPEN_STATUSES.has(current)) {
          // Ileri yonde yalnizca acik basvurular kapatilir; kapanmis bir
          // kaydin durumu degistirilmez.
          continue;
        }

        await syncApplicationStatus(source.type, rowId, status, null);
      }
    }
  } catch (error) {
    console.error("syncSiblingApplications exception:", error);
  }
};

// GET - Randevuları listele
export async function GET(request: NextRequest) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  const supabase = getSupabaseAdmin();

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
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  const supabase = getSupabaseAdmin();

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
    const resolvedSourceApplicationType =
      normalizeSourceTypeOrNull(source_application_type) ||
      (source_individual_request_id ? "self_application" : null);

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
      // Cakisma kontrolu: iptal edilmis ve henuz olusturulmamis kayitlar
      // disindaki TUM randevular o ders saatini dolu sayar. Onceden yalnizca
      // "planned" olanlara bakiliyordu; gorusme tamamlanip "attended" olunca
      // saat bosalmis gibi gorunuyor ve ayni saate ikinci randevu
      // verilebiliyordu. Istemci tarafi zaten bu kurali uyguluyor.
      supabase
        .from("appointments")
        .select("id, participant_name, participant_type, start_time, status")
        .eq("appointment_date", appointment_date),
      supabase
        .from("guidance_plans")
        .select("id, class_display, lesson_period")
        .eq("plan_date", appointment_date)
        .in("status", ["planned", "completed"]),
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

    // Ogrenci gelmediyse o ders saati fiilen bostur; yeni randevuyu engellemez.
    const OCCUPYING_STATUSES_EXCLUDED = ["cancelled", "pending", "not_attended"];
    const busyAppointments = (appointmentConflicts.data || []).filter(
      (item) =>
        normalizeLessonSlot(item.start_time) === normalizedSlot &&
        !OCCUPYING_STATUSES_EXCLUDED.includes(String(item.status || ""))
    );
    if (busyAppointments.length > 0) {
      const appointment = busyAppointments[0];
      return NextResponse.json(
        { error: `Bu tarih ve ders saatinde zaten bir randevu var: ${appointment.participant_name} (${appointment.participant_type})`, conflict: true },
        { status: 409 }
      );
    }

    // Ayni ogrenciye ayni gun icinde ikinci randevu verilemez. Ders saati bos
    // olsa bile ogrenci o gun zaten programa alinmis demektir.
    const normalizeParticipant = (value: unknown) =>
      String(value || "")
        .replace(/^\d+\s+/, "")
        .trim()
        .toLocaleUpperCase("tr-TR")
        .replace(/\s+/g, " ");

    const sameStudentSameDay = (appointmentConflicts.data || []).filter(
      (item) =>
        !OCCUPYING_STATUSES_EXCLUDED.includes(String(item.status || "")) &&
        normalizeParticipant(item.participant_name) === normalizeParticipant(participant_name)
    );

    if (sameStudentSameDay.length > 0) {
      return NextResponse.json(
        {
          error: `${participant_name} için bu tarihte zaten bir randevu var (${sameStudentSameDay[0].start_time}. ders). Aynı öğrenciye aynı gün ikinci randevu verilemez.`,
          conflict: true,
        },
        { status: 409 }
      );
    }



    const busyGuidancePlans = guidanceConflicts.filter((item) => normalizeLessonSlot(item.lesson_period) === normalizedSlot);
    if (busyGuidancePlans.length > 0) {
      const plan = busyGuidancePlans[0];
      return NextResponse.json(
        { error: `Bu tarih ve ders saatinde zaten bir sınıf rehberliği planı var: ${plan.class_display}`, conflict: true },
        { status: 409 }
      );
    }

    const busyActivities = activityConflicts.filter((item) => normalizeLessonSlot(item.activity_time) === normalizedSlot);
    if (busyActivities.length > 0) {
      const activity = busyActivities[0];
      return NextResponse.json(
        { error: `Bu tarih ve ders saatinde zaten bir sınıf etkinliği var: ${activity.class_display}`, conflict: true },
        { status: 409 }
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
      const fallbackPayload: Record<string, unknown> = { ...insertPayload };
      delete fallbackPayload.source_individual_request_id;
      delete fallbackPayload.source_application_id;
      delete fallbackPayload.source_application_type;
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
    await syncSiblingApplications(participant_name, "scheduled", resolvedSourceApplicationType, resolvedSourceApplicationId);

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
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  const supabase = getSupabaseAdmin();

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
          .select("id, participant_name, participant_type, start_time, status")
          .eq("appointment_date", nextAppointmentDate)
          .neq("status", "cancelled")
          .neq("id", id),
        supabase
          .from("guidance_plans")
          .select("id, class_display, lesson_period")
          .eq("plan_date", nextAppointmentDate)
          .in("status", ["planned", "completed"]),
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

      // Ogrenci gelmediyse o ders saati fiilen bostur; yeni randevuyu engellemez.
    const OCCUPYING_STATUSES_EXCLUDED = ["cancelled", "pending", "not_attended"];
      const busyAppointments = (appointmentConflicts.data || []).filter(
        (item) =>
          normalizeLessonSlot(item.start_time) === normalizedSlot &&
          !OCCUPYING_STATUSES_EXCLUDED.includes(String(item.status || ""))
      );
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
      const fallbackUpdate: Record<string, unknown> = {
        ...(normalizedUpdateData as Record<string, unknown>)
      };
      delete fallbackUpdate.source_individual_request_id;
      delete fallbackUpdate.source_application_id;
      delete fallbackUpdate.source_application_type;
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
      normalizeSourceTypeOrNull(source_application_type) ||
      normalizeSourceTypeOrNull(data?.source_application_type) ||
      (source_individual_request_id ? "self_application" : null);

    if (source_application_status) {
      await syncApplicationStatus(
        resolvedSourceApplicationType,
        resolvedSourceApplicationId,
        source_application_status,
        id
      );
      await syncSiblingApplications(
        data?.participant_name,
        source_application_status as "scheduled" | "completed" | "active_follow" | "pending",
        resolvedSourceApplicationType,
        resolvedSourceApplicationId
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
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  const supabase = getSupabaseAdmin();

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

    // Silinen randevunun kaynak basvurusu tekrar "Bekliyor" durumuna
    // donmelidir; aksi halde ortada randevu yokken basvuru "Randevu verildi"
    // olarak kalir ve islem bekleyenler listesinden dusup gozden kacar.
    const affectedSources: Array<{ type: string | null; id: string | null }> = [];
    const affectedStudents: string[] = [];

    if (appointmentIds.length > 0) {
      const { data: sourceRows } = await supabase
        .from("appointments")
        .select("participant_name, source_application_type, source_application_id, source_individual_request_id")
        .in("id", appointmentIds);

      for (const row of sourceRows || []) {
        if (row.participant_name) affectedStudents.push(String(row.participant_name));
        const srcId = row.source_application_id || row.source_individual_request_id;
        if (srcId) {
          affectedSources.push({
            type: row.source_application_type || (row.source_individual_request_id ? "self_application" : null),
            id: srcId,
          });
        }
      }
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

    // Kaynak basvurulari tekrar bekleyen duruma cek
    for (const src of affectedSources) {
      if (!src.id) continue;
      await syncApplicationStatus(src.type, src.id, "pending", null);
    }

    // Randevu silinince, o randevu yuzunden kapanmis kardes basvurular da
    // tekrar bekleyen duruma doner.
    for (const name of affectedStudents) {
      const src = affectedSources[0];
      await syncSiblingApplications(name, "pending", src?.type, src?.id);
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
