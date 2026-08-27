import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from '@/lib/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

// GET - Randevu görevlerini listele
export async function GET(request: NextRequest) {
  const guard = await requireAdmin();
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
    const appointmentId = searchParams.get("appointmentId");
    const completed = searchParams.get("completed");

    let query = supabase
      .from("appointment_tasks")
      .select("*")
      .order("created_at", { ascending: false });

    if (appointmentId) {
      query = query.eq("appointment_id", appointmentId);
    }

    if (completed !== null) {
      query = query.eq("is_completed", completed === "true");
    }

    const { data, error } = await query;

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json(
        { error: "Görevler alınamadı", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ tasks: data || [] });
  } catch (error) {
    console.error("Tasks GET error:", error);
    return NextResponse.json(
      { error: "Sunucu hatası" },
      { status: 500 }
    );
  }
}

// POST - Yeni görev oluştur
export async function POST(request: NextRequest) {
  const guard = await requireAdmin();
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
      appointment_id,
      task_description,
      due_date
    } = body;

    if (!appointment_id || !task_description) {
      return NextResponse.json(
        { error: "Randevu ID ve görev açıklaması zorunludur" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("appointment_tasks")
      .insert({
        appointment_id,
        task_description,
        due_date,
        is_completed: false
      })
      .select()
      .single();

    if (error) {
      console.error("Supabase insert error:", error);
      return NextResponse.json(
        { error: "Görev oluşturulamadı", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ task: data, message: "Görev oluşturuldu" });
  } catch (error) {
    console.error("Tasks POST error:", error);
    return NextResponse.json(
      { error: "Sunucu hatası" },
      { status: 500 }
    );
  }
}

// PUT - Görev güncelle (tamamlandı olarak işaretle)
export async function PUT(request: NextRequest) {
  const guard = await requireAdmin();
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
    const { id, is_completed, task_description, due_date } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Görev ID zorunludur" },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (is_completed !== undefined) updateData.is_completed = is_completed;
    if (task_description !== undefined) updateData.task_description = task_description;
    if (due_date !== undefined) updateData.due_date = due_date;

    const { data, error } = await supabase
      .from("appointment_tasks")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Supabase update error:", error);
      return NextResponse.json(
        { error: "Görev güncellenemedi", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ task: data, message: "Görev güncellendi" });
  } catch (error) {
    console.error("Tasks PUT error:", error);
    return NextResponse.json(
      { error: "Sunucu hatası" },
      { status: 500 }
    );
  }
}

// DELETE - Görev sil
export async function DELETE(request: NextRequest) {
  const guard = await requireAdmin();
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

    if (!id) {
      return NextResponse.json(
        { error: "Görev ID zorunludur" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("appointment_tasks")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Supabase delete error:", error);
      return NextResponse.json(
        { error: "Görev silinemedi", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Görev silindi" });
  } catch (error) {
    console.error("Tasks DELETE error:", error);
    return NextResponse.json(
      { error: "Sunucu hatası" },
      { status: 500 }
    );
  }
}
