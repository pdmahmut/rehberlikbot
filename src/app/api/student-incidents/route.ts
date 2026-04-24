import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      target_student_name,
      target_class_display,
      target_class_key,
      reporter_student_name,
      description,
      incident_date
    } = body;

    if (!target_student_name?.trim()) {
      return NextResponse.json({ error: "Öğrenci adı gerekli" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("student_incidents")
      .insert({
        target_student_name: target_student_name.trim(),
        target_class_display: target_class_display || null,
        target_class_key: target_class_key || null,
        reporter_student_name: reporter_student_name?.trim() || null,
        description: description?.trim() || null,
        incident_date: incident_date || new Date().toISOString().slice(0, 10),
        status: "new"
      })
      .select()
      .single();

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    console.error("POST /api/student-incidents error:", error);
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
      .from("student_incidents")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Supabase delete error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("DELETE /api/student-incidents error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Bilinmeyen hata" },
      { status: 500 }
    );
  }
}
