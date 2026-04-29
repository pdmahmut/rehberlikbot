import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const normalizeObservationStatus = (value: unknown) => {
  if (value === "randevu_verildi" || value === "scheduled") return "converted";
  if (value === "active") return "active_follow";
  if (value === "regular" || value === "regular_meeting") return "active_follow";

  if (
    value === "pending" ||
    value === "converted" ||
    value === "active_follow" ||
    value === "completed"
  ) {
    return value;
  }

  return "pending";
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      student_name,
      class_display,
      class_key,
      note,
      observation_type,
      priority,
      status,
      observed_at
    } = body;

    if (!student_name?.trim()) {
      return NextResponse.json({ error: "Öğrenci adı gerekli" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("observation_pool")
      .insert({
        student_name: student_name.trim(),
        class_display: class_display || null,
        class_key: class_key || null,
        note: note?.trim() || null,
        observation_type: observation_type || "behavior",
        priority: priority || "medium",
        status: normalizeObservationStatus(status),
        observed_at: observed_at || new Date().toISOString().slice(0, 10)
      })
      .select()
      .single();

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    console.error("POST /api/gozlem-havuzu error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Bilinmeyen hata" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID gerekli" }, { status: 400 });
    }

    const { error } = await supabase
      .from("observation_pool")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Supabase delete error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("DELETE /api/gozlem-havuzu error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Bilinmeyen hata" },
      { status: 500 }
    );
  }
}
