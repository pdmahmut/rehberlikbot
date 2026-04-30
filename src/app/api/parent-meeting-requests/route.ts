import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      student_name,
      class_display,
      class_key,
      parent_name,
      subject,
      detail,
      request_date
    } = body;

    const parseTopicFromDetail = (value?: string | null) => {
      if (!value) return "";
      const match = value.trim().match(/^\[(.+?)\]/);
      return match?.[1]?.trim() || "";
    };

    const normalizedSubject =
      subject?.trim() ||
      parseTopicFromDetail(detail) ||
      "Genel Veli Talebi";

    const normalizedDetail =
      detail?.trim() ||
      (normalizedSubject ? `[${normalizedSubject}]` : null);

    if (!student_name?.trim()) {
      return NextResponse.json({ error: "Öğrenci adı gerekli" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("parent_meeting_requests")
      .insert({
        student_name: student_name.trim(),
        class_display: class_display || null,
        class_key: class_key || null,
        parent_name: parent_name?.trim() || null,
        subject: normalizedSubject,
        detail: normalizedDetail,
        request_date: request_date || new Date().toISOString().slice(0, 10)
      })
      .select()
      .single();

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    console.error("POST /api/parent-meeting-requests error:", error);
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
      .from("parent_meeting_requests")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Supabase delete error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("DELETE /api/parent-meeting-requests error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Bilinmeyen hata" },
      { status: 500 }
    );
  }
}
