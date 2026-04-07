import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { normalizeLessonSlot } from "@/lib/lessonSlots";

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
      template_type
    } = body;

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
        .neq("status", "cancelled"),
      supabase
        .from("guidance_plans")
        .select("id, class_display, lesson_period")
        .eq("plan_date", appointment_date)
        .eq("status", "planned"),
      supabase
        .from("class_activities")
        .select("id, title, class_display, activity_time")
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
        { error: `Bu tarih ve ders saatinde zaten bir sınıf etkinliği var: ${activity.title} (${activity.class_display})` },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("appointments")
      .insert({
        appointment_date,
        start_time,
        participant_type,
        participant_name,
        participant_class,
        participant_phone,
        topic_tags,
        location,
        purpose,
        preparation_note,
        priority,
        status: "planned",
        template_type
      })
      .select()
      .single();

    if (error) {
      console.error("Supabase insert error:", error);
      return NextResponse.json(
        { error: "Randevu oluşturulamadı", details: error.message },
        { status: 500 }
      );
    }

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
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Randevu ID zorunludur" },
        { status: 400 }
      );
    }

    const { data: currentAppointment, error: currentError } = await supabase
      .from("appointments")
      .select("id, appointment_date, start_time, status")
      .eq("id", id)
      .single();

    if (currentError || !currentAppointment) {
      console.error("Mevcut randevu alınamadı:", currentError);
      return NextResponse.json(
        { error: "Randevu bulunamadı", details: currentError?.message },
        { status: 404 }
      );
    }

    const nextAppointmentDate = updateData.appointment_date || currentAppointment.appointment_date;
    const nextStartTime = updateData.start_time || currentAppointment.start_time;
    const normalizedSlot = normalizeLessonSlot(nextStartTime);

    if (normalizedSlot && (updateData.appointment_date || updateData.start_time)) {
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
          .select("id, title, class_display, activity_time")
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
          { error: `Bu tarih ve ders saatinde zaten bir sınıf etkinliği var: ${activity.title} (${activity.class_display})` },
          { status: 400 }
        );
      }
    }

    const { data, error } = await supabase
      .from("appointments")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Supabase update error:", error);
      return NextResponse.json(
        { error: "Randevu güncellenemedi", details: error.message },
        { status: 500 }
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

    if (!id) {
      return NextResponse.json(
        { error: "Randevu ID zorunludur" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("appointments")
      .delete()
      .eq("id", id);

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
