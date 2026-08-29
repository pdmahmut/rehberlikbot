import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireSession } from '@/lib/apiAuth';
import {
  getTeachersData,
  matchTeacherByName,
  addTeacher,
  removeTeacher,
  assignTeacherToClass,
  removeTeacherClassAssignment,
} from "@/lib/teachers";
import { loadTeachersFromStore } from "@/lib/teachersStore";
import {
  clearTeacherAccountClassAssignment,
  deleteTeacherAccountByName,
  ensureTeacherAccount,
  syncTeacherAccountClassAssignment,
} from "@/lib/teacherAccounts";

export const runtime = "nodejs";

async function resolveTeacherName(teacherId?: string, teacherName?: string) {
  const records = await loadTeachersFromStore();

  if (teacherId) {
    const teacherById = records.find((record) => record.teacherId === teacherId);
    if (teacherById) {
      return teacherById.teacherName;
    }
  }

  if (teacherName) {
    return matchTeacherByName(teacherName, records)?.teacherName || teacherName;
  }

  return undefined;
}

export async function GET(req: NextRequest) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;

  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q");
    const all = searchParams.get("all");

    if (all === "1") {
      const records = await loadTeachersFromStore();
      return NextResponse.json({ teachers: records });
    }

    const { records, list } = await getTeachersData();

    if (q) {
      const matchedTeacher = matchTeacherByName(q, records);
      if (!matchedTeacher) return NextResponse.json({ found: false });
      return NextResponse.json({ found: true, teacher: matchedTeacher });
    }

    return NextResponse.json({ teachers: list });
  } catch (error) {
    console.error("Teachers API Error:", error);
    return NextResponse.json({ error: "Öğretmen verileri yüklenemedi" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const body = await req.json();
    const { action } = body;

    if (action === "add") {
      const { teacherName } = body;
      if (!teacherName?.trim()) {
        return NextResponse.json({ error: "Öğretmen adı gerekli" }, { status: 400 });
      }

      const result = await addTeacher(teacherName);
      if (!result.success || !result.teacher) {
        return NextResponse.json({ error: result.error || "Öğretmen eklenemedi" }, { status: 400 });
      }

      try {
        const accountResult = await ensureTeacherAccount(result.teacher.teacherName);
        return NextResponse.json({
          success: true,
          teacher: result.teacher,
          account: accountResult.user,
          accountCreated: accountResult.created,
        });
      } catch (accountError) {
        await removeTeacher(result.teacher.teacherId);
        console.error("Teacher account sync failed:", accountError);
        return NextResponse.json(
          { error: "Öğretmen eklendi ama hesap oluşturulamadığı için işlem geri alındı" },
          { status: 500 }
        );
      }
    }

    if (action === "remove") {
      const { teacherId } = body;
      if (!teacherId) return NextResponse.json({ error: "teacherId gerekli" }, { status: 400 });

      // Once adi bul: kadrodan silindikten sonra hesabi eslestiremeyiz.
      const { records } = await getTeachersData();
      const teacher = records.find((r) => r.teacherId === teacherId);

      const ok = await removeTeacher(teacherId);
      if (!ok) return NextResponse.json({ error: "Öğretmen bulunamadı" }, { status: 404 });

      // Giris hesabi da silinmeli; aksi halde kadrodan cikan ogretmen
      // eski sifresiyle panele girmeye devam eder.
      let accountDeleted = false;
      if (teacher?.teacherName) {
        try {
          accountDeleted = await deleteTeacherAccountByName(teacher.teacherName);
        } catch (err) {
          console.error("Teacher account delete failed:", err);
        }
      }

      return NextResponse.json({ success: true, accountDeleted });
    }

    if (action === "assign_class") {
      const { teacherId, teacherName, sinifSubeKey, sinifSubeDisplay } = body;
      if ((!teacherId && !teacherName) || !sinifSubeKey || !sinifSubeDisplay) {
        return NextResponse.json({ error: "Eksik parametre" }, { status: 400 });
      }

      const resolvedTeacherName = await resolveTeacherName(teacherId, teacherName);
      const result = await assignTeacherToClass(teacherId, sinifSubeKey, sinifSubeDisplay, resolvedTeacherName);
      if (!result.success) return NextResponse.json({ error: result.error }, { status: 404 });

      if (resolvedTeacherName) {
        await syncTeacherAccountClassAssignment(resolvedTeacherName, sinifSubeKey, sinifSubeDisplay);
      }

      return NextResponse.json({ success: true });
    }

    if (action === "remove_class") {
      const { teacherId, teacherName } = body;
      if (!teacherId && !teacherName) {
        return NextResponse.json({ error: "teacherId veya teacherName gerekli" }, { status: 400 });
      }

      const resolvedTeacherName = await resolveTeacherName(teacherId, teacherName);
      const ok = await removeTeacherClassAssignment(teacherId, resolvedTeacherName);
      if (!ok) return NextResponse.json({ error: "Öğretmen bulunamadı" }, { status: 404 });

      if (resolvedTeacherName) {
        await clearTeacherAccountClassAssignment(resolvedTeacherName);
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Geçersiz action" }, { status: 400 });
  } catch (error) {
    console.error("Teachers API POST Error:", error);
    return NextResponse.json({ error: "İşlem başarısız" }, { status: 500 });
  }
}
