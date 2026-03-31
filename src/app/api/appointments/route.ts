import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

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