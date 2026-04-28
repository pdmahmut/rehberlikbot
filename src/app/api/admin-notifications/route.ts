import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  AdminNotificationItem,
  AdminNotificationKind,
  buildAdminNotificationId,
  parseAdminNotificationId,
} from "@/lib/adminNotifications";
import { getSession, type SessionUser } from "@/lib/auth";
import {
  listAdminNotificationStates,
  markAdminNotificationsPopupSeen,
  markAdminNotificationsRead,
} from "@/lib/adminNotificationStates";
import { getRequests } from "@/lib/classStudentRequests";
import { getClassRequestDisplayCategory, getClassRequestTeacherNote } from "@/lib/classRequests";

export const dynamic = "force-dynamic";

type ReferralRow = {
  id: string;
  student_name: string | null;
  class_display: string | null;
  teacher_name: string | null;
  reason: string | null;
  status: string | null;
  created_at: string;
  updated_at?: string | null;
};

type ClassRequestRow = {
  id: string;
  teacher_name: string | null;
  class_display: string | null;
  teacher_description: string | null;
  admin_category: string | null;
  topic: string | null;
  status: string | null;
  created_at: string;
  updated_at?: string | null;
};

const createScopedSupabase = (session: SessionUser): SupabaseClient | null => {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) return null;

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        "x-app-role": session.role,
        ...(session.teacherName ? { "x-teacher-name": session.teacherName } : {}),
        ...(session.classKey ? { "x-class-key": session.classKey } : {}),
      },
    },
  });
};

const buildTargetUrl = (kind: AdminNotificationKind, row: any) => {
  const params = new URLSearchParams();

  if (kind === "teacher_referral") {
    params.set("source", "teacher_referral");
    if (row.student_name) params.set("student", row.student_name);
    if (row.class_display) params.set("class", row.class_display);
    return `/panel/basvurular?${params.toString()}`;
  }

  if (kind === "class_request") {
    params.set("tab", "talepler");
    params.set(
      "filter",
      row.status === "pending" || row.status === "scheduled" || row.status === "completed"
        ? row.status
        : "all"
    );
    params.set("requestId", row.id);
    return `/panel/sinif-rehberligi?${params.toString()}`;
  }

  params.set(
    "filter",
    row.status === "pending" || row.status === "approved" || row.status === "rejected"
      ? row.status
      : "all"
  );
  params.set("requestId", row.id);
  return `/panel/sinif-talepleri?${params.toString()}`;
};

const buildNotifications = async (session: SessionUser) => {
  const db = createScopedSupabase(session);
  const [stateRows, classStudentRequests, referralsResult, classRequestsResult] = await Promise.all([
    listAdminNotificationStates(),
    Promise.resolve(getRequests({})),
    db
      ? db
          .from("referrals")
          .select("id, student_name, class_display, teacher_name, reason, status, created_at, updated_at")
          .order("created_at", { ascending: false })
          .limit(250)
      : Promise.resolve({ data: [] as ReferralRow[], error: null }),
    db
      ? db
          .from("class_requests")
          .select("id, teacher_name, class_display, teacher_description, admin_category, topic, status, created_at, updated_at")
          .order("created_at", { ascending: false })
          .limit(250)
      : Promise.resolve({ data: [] as ClassRequestRow[], error: null }),
  ]);

  const stateMap = new Map(
    stateRows.map((item) => [`${item.source_type}:${item.source_id}`, item])
  );

  const notifications: AdminNotificationItem[] = [];

  (referralsResult.data || []).forEach((row: ReferralRow) => {
    const state = stateMap.get(`teacher_referral:${row.id}`);
    notifications.push({
      id: buildAdminNotificationId("teacher_referral", row.id),
      kind: "teacher_referral",
      sourceId: row.id,
      title: row.student_name || "Yeni yönlendirme",
      summary: [row.class_display, row.teacher_name, row.reason].filter(Boolean).join(" • "),
      status: row.status || "Bekliyor",
      createdAt: row.created_at,
      updatedAt: row.updated_at || null,
      read: Boolean(state?.read_at),
      popupSeen: Boolean(state?.popup_seen_at),
      targetUrl: buildTargetUrl("teacher_referral", row),
      targetLabel: "Başvurulara git",
      teacherName: row.teacher_name,
      classDisplay: row.class_display,
      studentName: row.student_name,
    });
  });

  (classRequestsResult.data || []).forEach((row: ClassRequestRow) => {
    const state = stateMap.get(`class_request:${row.id}`);
    const category = getClassRequestDisplayCategory(row);
    const teacherNote = getClassRequestTeacherNote(row);
    notifications.push({
      id: buildAdminNotificationId("class_request", row.id),
      kind: "class_request",
      sourceId: row.id,
      title: `${row.class_display || "Sınıf"} için sınıf rehberlik talebi`,
      summary: [row.teacher_name, category || teacherNote].filter(Boolean).join(" • "),
      status: row.status || "pending",
      createdAt: row.created_at,
      updatedAt: row.updated_at || null,
      read: Boolean(state?.read_at),
      popupSeen: Boolean(state?.popup_seen_at),
      targetUrl: buildTargetUrl("class_request", row),
      targetLabel: "Sınıf Rehberliğine git",
      teacherName: row.teacher_name,
      classDisplay: row.class_display,
    });
  });

  classStudentRequests.forEach((row) => {
    const state = stateMap.get(`class_student_request:${row.id}`);
    const actionLabel =
      row.request_type === "class_change" ? "Sınıf değiştirme talebi" : "Öğrenci silme talebi";
    notifications.push({
      id: buildAdminNotificationId("class_student_request", row.id),
      kind: "class_student_request",
      sourceId: row.id,
      title: row.student_name,
      summary: [row.class_display, row.teacher_name, actionLabel].filter(Boolean).join(" • "),
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at || null,
      read: Boolean(state?.read_at),
      popupSeen: Boolean(state?.popup_seen_at),
      targetUrl: buildTargetUrl("class_student_request", row),
      targetLabel: "Sınıf Taleplerine git",
      teacherName: row.teacher_name,
      classDisplay: row.class_display,
      studentName: row.student_name,
    });
  });

  notifications.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return notifications;
};

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum bulunamadı" }, { status: 401 });
  }

  if (session.role !== "admin") {
    return NextResponse.json({ error: "Yetki yok" }, { status: 403 });
  }

  const notifications = await buildNotifications(session);
  const unreadCount = notifications.filter((item) => !item.read).length;

  return NextResponse.json({ notifications, unreadCount });
}

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum bulunamadı" }, { status: 401 });
  }

  if (session.role !== "admin") {
    return NextResponse.json({ error: "Yetki yok" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const ids = Array.isArray(body?.ids) ? body.ids.filter((value: unknown) => typeof value === "string") : [];
  const markRead = body?.read === true;
  const markPopupSeen = body?.popupSeen === true;

  if (ids.length === 0) {
    return NextResponse.json({ error: "Geçerli bildirim id listesi gerekli" }, { status: 400 });
  }

  if (!markRead && !markPopupSeen) {
    return NextResponse.json({ error: "Güncellenecek alan bulunamadı" }, { status: 400 });
  }

  const parsedIds = ids
    .map((id: string) => parseAdminNotificationId(id))
    .filter(
      (
        item: ReturnType<typeof parseAdminNotificationId>
      ): item is {
        kind: AdminNotificationKind;
        sourceId: string;
      } => Boolean(item)
    );

  const refs = parsedIds.map((item: { kind: AdminNotificationKind; sourceId: string }) => ({
    sourceType: item.kind,
    sourceId: item.sourceId,
  }));

  if (refs.length === 0) {
    return NextResponse.json({ error: "Bildirimler çözümlenemedi" }, { status: 400 });
  }

  if (markRead) {
    await markAdminNotificationsRead(refs);
  }

  if (markPopupSeen) {
    await markAdminNotificationsPopupSeen(refs);
  }

  return NextResponse.json({ success: true });
}
