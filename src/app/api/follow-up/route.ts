import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/apiAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Öğrenci bazlı "aktif takip" yönetimi.
//
// Takip işareti öğrencinin kendisinde durur (class_students.status), tek tek
// görüşmelerde değil. Böylece öğrenciye yeni bir başvuru geldiğinde takip
// bozulmaz; öğrenci takipte kalmaya devam eder.
//
// GET    -> takipteki öğrenciler + her biri için son görüşme, sıradaki randevu
//           ve açık başvuru sayısı
// POST   -> öğrenciyi takibe al
// DELETE -> öğrenciyi takipten çıkar

const FOLLOW_UP = "aktif_takip";
const DEFAULT = "tumu";

interface StudentRow {
  id: string;
  class_key: string;
  class_display: string | null;
  student_name: string;
  student_number: string | null;
  status: string;
  follow_up_reason: string | null;
  follow_up_since: string | null;
  follow_up_note: string | null;
}

/** İsimleri karşılaştırmak için sadeleştirir (Türkçe duyarlı). */
const normalizeName = (value: string) =>
  String(value || "")
    .trim()
    .toLocaleUpperCase("tr-TR")
    .replace(/\s+/g, " ");

/** "221 GAZAL YALÇIN" gibi metinlerden baştaki okul numarasını atar. */
const stripNumber = (value: string) => normalizeName(String(value || "").replace(/^\d+\s+/, ""));

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const supabase = getSupabaseAdmin();

    const { data: students, error } = await supabase
      .from("class_students")
      .select("id, class_key, class_display, student_name, student_number, status, follow_up_reason, follow_up_since, follow_up_note")
      .eq("status", FOLLOW_UP)
      .order("student_name");

    if (error) throw error;

    const rows = (students as StudentRow[] | null) || [];
    if (rows.length === 0) {
      return NextResponse.json({ students: [] });
    }

    // Bekleyen başvurular tüm kaynaklardan sayılır: yalnızca öğretmen
    // yönlendirmelerine bakmak eksik bir sayı verirdi.
    const [
      { data: appointments },
      { data: referrals },
      { data: parentRequests },
      { data: individualRequests },
      { data: incidents },
    ] = await Promise.all([
      supabase
        .from("appointments")
        .select("participant_name, appointment_date, status")
        .eq("participant_type", "student")
        .neq("status", "cancelled"),
      supabase.from("referrals").select("student_name, status"),
      supabase.from("parent_meeting_requests").select("student_name, status"),
      supabase.from("individual_requests").select("student_name, status"),
      supabase.from("student_incidents").select("target_student_name, status"),
    ]);

    // Her kaynağın "henüz işlem yapılmadı" değeri farklı yazılmış
    const isOpen = (status: unknown) => {
      const v = String(status || "").toLocaleLowerCase("tr-TR");
      return v === "bekliyor" || v === "pending" || v === "new" || v === "reviewing";
    };

    const openByStudent = new Map<string, number>();
    const addOpen = (name: unknown, status: unknown) => {
      if (!isOpen(status)) return;
      const key = stripNumber(String(name || ""));
      if (!key) return;
      openByStudent.set(key, (openByStudent.get(key) || 0) + 1);
    };

    for (const r of referrals || []) addOpen(r.student_name, r.status);
    for (const r of parentRequests || []) addOpen(r.student_name, r.status);
    for (const r of individualRequests || []) addOpen(r.student_name, r.status);
    for (const r of incidents || []) addOpen(r.target_student_name, r.status);

    const today = new Date().toISOString().slice(0, 10);

    const enriched = rows.map((student) => {
      const key = stripNumber(student.student_name);

      const own = (appointments || []).filter(
        (a) => stripNumber(String(a.participant_name || "")) === key
      );

      // Son gerçekleşen görüşme
      const past = own
        .filter((a) => a.status === "attended")
        .map((a) => a.appointment_date)
        .sort()
        .reverse();

      // Bugün veya sonrasına planlanmış ilk randevu
      const upcoming = own
        .filter((a) => a.status === "planned" && a.appointment_date >= today)
        .map((a) => a.appointment_date)
        .sort();

      const openApplications = openByStudent.get(key) || 0;

      return {
        id: student.id,
        studentName: student.student_name,
        studentNumber: student.student_number,
        classKey: student.class_key,
        classDisplay: student.class_display || student.class_key,
        reason: student.follow_up_reason,
        note: student.follow_up_note,
        since: student.follow_up_since,
        lastMeeting: past[0] || null,
        nextAppointment: upcoming[0] || null,
        meetingCount: past.length,
        openApplications,
      };
    });

    return NextResponse.json({ students: enriched });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Takip listesi alınamadı";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const body = await request.json();
    const studentId = String(body.studentId || "").trim();
    const studentName = String(body.studentName || "").trim();
    const classKey = String(body.classKey || "").trim();
    const reason = String(body.reason || "").trim() || null;
    const note = String(body.note || "").trim() || null;

    if (!studentId && !studentName) {
      return NextResponse.json({ error: "Öğrenci bilgisi gerekli" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Öğrenciyi id ile, yoksa ad + sınıf ile bul
    let target: { id: string } | null = null;

    if (studentId) {
      const { data } = await supabase
        .from("class_students")
        .select("id")
        .eq("id", studentId)
        .maybeSingle();
      target = data;
    }

    if (!target && studentName) {
      let query = supabase.from("class_students").select("id, student_name");
      if (classKey) query = query.eq("class_key", classKey);

      const { data: candidates, error } = await query;
      if (error) throw error;

      const wanted = stripNumber(studentName);
      const match = (candidates || []).find(
        (c) => stripNumber(String(c.student_name || "")) === wanted
      );
      if (match) target = { id: match.id };
    }

    if (!target) {
      return NextResponse.json(
        { error: "Öğrenci sınıf listesinde bulunamadı" },
        { status: 404 }
      );
    }

    const { data, error: updateError } = await supabase
      .from("class_students")
      .update({
        status: FOLLOW_UP,
        follow_up_reason: reason,
        follow_up_note: note,
        follow_up_since: new Date().toISOString().slice(0, 10),
        updated_at: new Date().toISOString(),
      })
      .eq("id", target.id)
      .select("id, student_name")
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({ success: true, student: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Takibe alınamadı";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId");

    if (!studentId) {
      return NextResponse.json({ error: "studentId gerekli" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("class_students")
      .update({
        status: DEFAULT,
        follow_up_reason: null,
        follow_up_note: null,
        follow_up_since: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", studentId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Takipten çıkarılamadı";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
