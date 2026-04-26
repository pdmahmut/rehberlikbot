"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  GraduationCap, Users, History, BookOpen, Plus, Trash2,
  RefreshCw, UserCheck, ArrowRightLeft, ArrowLeft, ChevronDown, Award, AlertCircle,
  MessageSquare, X, Calendar, Clock, CheckCircle2, Pencil, User, BarChart3, Activity,
} from "lucide-react";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ReasonDistributionChart,
  TeacherDistributionChart,
  ReferralTimeline,
} from "@/components/charts/StudentCharts";
import { supabase } from "@/lib/supabase";
import {
  buildSourceRecordKey,
  getObservationProxyMeta,
  isAppointmentLinkedToSource,
  isPendingStatus,
} from "@/lib/guidanceApplications";
import {
  getClassRequestDisplayCategory,
  getClassRequestTeacherNote,
} from "@/lib/classRequests";

interface Referral {
  id: string;
  student_name: string;
  class_key: string | null;
  class_display: string | null;
  teacher_name: string | null;
  note: string | null;
  reason: string | null;
  status: string;
  created_at: string;
}

interface StudentOption {
  value: string;
  text: string;
  class_key?: string;
  class_display?: string;
}

interface AuthInfo {
  teacherName: string;
  classKey: string | null;
  classDisplay: string | null;
  isHomeroom: boolean;
}

interface ClassStudentRequest {
  id: string;
  student_name: string;
  request_type: "delete" | "class_change";
  new_class_display: string | null;
  status: "pending" | "approved" | "rejected";
}

interface SinifOption { value: string; text: string; }

interface GuidanceRequest {
  id: string;
  teacher_name: string;
  class_key: string;
  class_display: string;
  teacher_description: string | null;
  admin_category: string | null;
  admin_category_normalized?: string | null;
  topic: string | null;
  description: string | null;
  status: "pending" | "scheduled" | "completed" | "rejected";
  scheduled_date: string | null;
  lesson_slot: number | null;
  lesson_teacher?: string | null;
  feedback: string | null;
  created_at: string;
  updated_at: string | null;
}

interface StudentAppointment {
  id: string;
  participant_name?: string;
  participant_class?: string | null;
  appointment_date?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  outcome_decision?: string[] | null;
}

interface StudentApplicationHistoryItem {
  id: string;
  sourceType: string;
  sourceLabel: string;
  sourceRecordId: string;
  reason: string;
  note: string | null;
  status: "Bekliyor" | "Randevu verildi" | "Görüşüldü";
  outcomeLabel: string | null;
  lastActivityAt: string;
}

const extractReasonAndNote = (rawNote: string | null | undefined, fallback: string) => {
  const text = (rawNote || "").trim();
  if (!text) return { reason: fallback, note: null as string | null };
  const topicMatch = text.match(/^\[(.*?)\]\s*(.*)$/);
  if (topicMatch) {
    const topic = topicMatch[1]?.trim() || fallback;
    const note = (topicMatch[2] || "").trim() || null;
    return { reason: topic, note };
  }
  return { reason: text, note: null as string | null };
};

type TabId = "class-list" | "guidance-requests";

const CHART_COLORS = [
  "#6366f1","#8b5cf6","#a855f7","#ec4899","#f43f5e","#f97316","#eab308",
];

const MONTHS_TR = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];

const normalizeClassValue = (value?: string | null) =>
  (value || "")
    .toLocaleLowerCase("tr-TR")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[\/\-_.()]/g, "")
    .trim();

const matchesApplicationToAppointment = (
  appointment: any,
  studentName?: string | null,
  classDisplay?: string | null,
  classKey?: string | null
) => {
  const appointmentName = (appointment?.participant_name || "")
    .replace(/^\d+\s+/, "")
    .trim()
    .toLowerCase();
  const normalizedStudentName = (studentName || "")
    .replace(/^\d+\s+/, "")
    .trim()
    .toLowerCase();

  if (!appointmentName || !normalizedStudentName) return false;

  const nameMatch =
    appointmentName === normalizedStudentName ||
    appointmentName.includes(normalizedStudentName) ||
    normalizedStudentName.includes(appointmentName);

  if (!nameMatch) return false;

  const appointmentClass = normalizeClassValue(appointment?.participant_class);
  const applicationClass = normalizeClassValue(classDisplay || classKey);

  if (!appointmentClass || !applicationClass) return true;

  return (
    appointmentClass === applicationClass ||
    appointmentClass.includes(applicationClass) ||
    applicationClass.includes(appointmentClass)
  );
};

function formatDateShort(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getDate()} ${MONTHS_TR[d.getMonth()]} ${d.getFullYear()}`;
}

const REQUEST_STATUS: Record<GuidanceRequest["status"], { label: string; cls: string }> = {
  pending:   { label: "Bekliyor",   cls: "bg-amber-100 text-amber-700" },
  scheduled: { label: "Planlandı",  cls: "bg-blue-100 text-blue-700" },
  completed: { label: "Tamamlandı", cls: "bg-emerald-100 text-emerald-700" },
  rejected:  { label: "Reddedildi", cls: "bg-red-100 text-red-700" },
};

export default function SinifimPage() {
  const [auth, setAuth] = useState<AuthInfo | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("class-list");
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [pendingRequests, setPendingRequests] = useState<ClassStudentRequest[]>([]);
  const [sinifList, setSinifList] = useState<SinifOption[]>([]);
  const [referralsLoading, setReferralsLoading] = useState(false);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [newStudentName, setNewStudentName] = useState("");
  const [newStudentNumber, setNewStudentNumber] = useState("");
  const [addingStudent, setAddingStudent] = useState(false);
  const [expandedStudents, setExpandedStudents] = useState<Set<string>>(new Set());
  const [requestModal, setRequestModal] = useState<{ student: StudentOption | null; type: "delete" | "class_change" | null }>({ student: null, type: null });
  const [classChangeTarget, setClassChangeTarget] = useState("");
  const [submittingRequest, setSubmittingRequest] = useState(false);

  // Öğrenci profil
  const [selectedProfileStudent, setSelectedProfileStudent] = useState<string | null>(null);
  const [profileHistory, setProfileHistory] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileAppointments, setProfileAppointments] = useState<any[]>([]);
  const [profileAttendedAppointments, setProfileAttendedAppointments] = useState<StudentAppointment[]>([]);
  const [profilePendingApps, setProfilePendingApps] = useState<any[]>([]);
  const [profileApplicationHistory, setProfileApplicationHistory] = useState<StudentApplicationHistoryItem[]>([]);

  // Guidance requests state
  const [guidanceRequests, setGuidanceRequests] = useState<GuidanceRequest[]>([]);
  const [guidanceRequestsLoading, setGuidanceRequestsLoading] = useState(false);
  const [showNewGuidanceModal, setShowNewGuidanceModal] = useState(false);
  const [newTeacherDescription, setNewTeacherDescription] = useState("");
  const [submittingGuidanceRequest, setSubmittingGuidanceRequest] = useState(false);
  const [editingGuidanceRequest, setEditingGuidanceRequest] = useState<GuidanceRequest | null>(null);
  const [editTeacherDescription, setEditTeacherDescription] = useState("");
  const [savingGuidanceEdit, setSavingGuidanceEdit] = useState(false);
  const [deletingGuidanceRequestId, setDeletingGuidanceRequestId] = useState<string | null>(null);
  const [feedbackInputs, setFeedbackInputs] = useState<Record<string, string>>({});
  const [submittingFeedback, setSubmittingFeedback] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => {
      if (d.teacherName) {
        setAuth({ teacherName: d.teacherName, classKey: d.classKey || null, classDisplay: d.classDisplay || null, isHomeroom: d.isHomeroom || false });
      }
    });
    fetch("/api/data").then(r => r.json()).then(d => setSinifList(d.sinifSubeList || []));
  }, []);

  const openStudentProfile = async (studentName: string) => {
    const cleanName = studentName.replace(/^\d+\s+/, "").trim();
    setSelectedProfileStudent(studentName);
    setProfileLoading(true);
    setProfileHistory(null);
    setProfileAppointments([]);
    setProfileAttendedAppointments([]);
    setProfileApplicationHistory([]);
    setProfilePendingApps([]);
    try {
      const res = await fetch(`/api/student-history?studentName=${encodeURIComponent(cleanName)}&classDisplay=${encodeURIComponent(auth?.classDisplay || "")}`);
      if (res.ok) {
        const data = await res.json();
        setProfileHistory(data);
      }
      await loadStudentActiveData(cleanName);
    } catch { /* */ }
    finally { setProfileLoading(false); }
  };

  const loadStudentActiveData = async (studentName: string) => {
    const cleanName = studentName.replace(/^\d+\s+/, "").trim();
    const matchName = (name: string) =>
      (name || "").replace(/^\d+\s+/, "").trim().toLowerCase() === cleanName.toLowerCase();

    try {
      let plannedAppointments: any[] = [];
      let attendedAppointmentsData: StudentAppointment[] = [];
      if (supabase) {
        const [plannedRes, attendedRes] = await Promise.all([
          supabase
            .from("appointments")
            .select("*")
            .eq("participant_type", "student")
            .neq("status", "pending")
            .neq("status", "attended")
            .neq("status", "cancelled")
            .ilike("participant_name", `%${cleanName}%`)
            .order("appointment_date", { ascending: false })
            .order("created_at", { ascending: false }),
          supabase
            .from("appointments")
            .select("*")
            .eq("participant_type", "student")
            .eq("status", "attended")
            .ilike("participant_name", `%${cleanName}%`)
            .order("appointment_date", { ascending: false })
            .order("created_at", { ascending: false }),
        ]);
        plannedAppointments = (plannedRes.data || []).filter((a: any) =>
          matchName(a.participant_name)
        );
        attendedAppointmentsData = (attendedRes.data || []).filter((a: any) =>
          matchName(a.participant_name)
        );
      } else {
        const [plannedRes, attendedRes] = await Promise.all([
          fetch(`/api/appointments?search=${encodeURIComponent(cleanName)}&status=planned`),
          fetch(`/api/appointments?search=${encodeURIComponent(cleanName)}&status=attended`),
        ]);
        if (plannedRes.ok) {
          const data = await plannedRes.json();
          const allApps = Array.isArray(data) ? data : data.appointments || [];
          plannedAppointments = allApps.filter((a: any) => matchName(a.participant_name));
        }
        if (attendedRes.ok) {
          const data = await attendedRes.json();
          const allApps = Array.isArray(data) ? data : data.appointments || [];
          attendedAppointmentsData = allApps.filter((a: any) => matchName(a.participant_name));
        }
      }
      setProfileAppointments(plannedAppointments);
      setProfileAttendedAppointments(attendedAppointmentsData);

      if (supabase) {
        const actualSourceKeys = new Set<string>();
        const [refKeyData, indKeyData, incKeyData, parKeyData] = await Promise.all([
          supabase.from("referrals").select("id").ilike("student_name", `%${cleanName}%`),
          supabase.from("individual_requests").select("id").ilike("student_name", `%${cleanName}%`),
          supabase.from("student_incidents").select("id").ilike("target_student_name", `%${cleanName}%`),
          supabase.from("parent_meeting_requests").select("id").ilike("student_name", `%${cleanName}%`),
        ]);

        (refKeyData.data || []).forEach((r: any) => {
          const key = buildSourceRecordKey("teacher_referral", r.id);
          if (key) actualSourceKeys.add(key);
        });
        (indKeyData.data || []).forEach((r: any) => {
          const key = buildSourceRecordKey("self_application", r.id);
          if (key) actualSourceKeys.add(key);
        });
        (incKeyData.data || []).forEach((r: any) => {
          const key = buildSourceRecordKey("student_report", r.id);
          if (key) actualSourceKeys.add(key);
        });
        (parKeyData.data || []).forEach((r: any) => {
          const key = buildSourceRecordKey("parent_request", r.id);
          if (key) actualSourceKeys.add(key);
        });

        const [obsRes, refRes, indRes, incRes, parRes] = await Promise.all([
          supabase
            .from("observation_pool")
            .select("*")
            .ilike("student_name", `%${cleanName}%`)
            .order("created_at", { ascending: false }),
          supabase.from("referrals").select("*").ilike("student_name", `%${cleanName}%`),
          supabase.from("individual_requests").select("*").ilike("student_name", `%${cleanName}%`),
          supabase.from("student_incidents").select("*").ilike("target_student_name", `%${cleanName}%`),
          supabase.from("parent_meeting_requests").select("*").ilike("student_name", `%${cleanName}%`),
        ]);

        const rawRecords: any[] = [];
        (refRes.data || [])
          .filter((r: any) => matchName(r.student_name))
          .forEach((r: any) =>
            rawRecords.push({
              id: `teacher_referral-${r.id}`,
              source_type: "teacher_referral",
              source_record_id: r.id,
              source_label: "Öğretmen Yönlendirmesi",
              student_name: r.student_name,
              class_display: r.class_display,
              class_key: r.class_key,
              reason: r.reason || "Belirtilmemiş",
              note: r.note || null,
              created_at: r.created_at,
              record_status: r.status || null,
            })
          );
        (indRes.data || [])
          .filter((r: any) => matchName(r.student_name))
          .forEach((r: any) => {
            const parsed = extractReasonAndNote(r.note, "Bireysel Başvuru");
            rawRecords.push({
              id: `self_application-${r.id}`,
              source_type: "self_application",
              source_record_id: r.id,
              source_label: "Bireysel Başvuru",
              student_name: r.student_name,
              class_display: r.class_display,
              class_key: r.class_key,
              reason: parsed.reason,
              note: parsed.note,
              created_at: r.created_at,
              record_status: r.status || null,
            })
          });
        (incRes.data || [])
          .filter((r: any) => matchName(r.target_student_name))
          .forEach((r: any) => {
            const parsed = extractReasonAndNote(
              r.description || r.note || null,
              "Öğrenci Bildirimi"
            );
            rawRecords.push({
              id: `student_report-${r.id}`,
              source_type: "student_report",
              source_record_id: r.id,
              source_label: "Öğrenci Bildirimi",
              student_name: r.target_student_name,
              class_display: r.target_class_display,
              class_key: r.target_class_key,
              reason: parsed.reason,
              note: parsed.note,
              created_at: r.created_at || r.incident_date,
              record_status: r.status || null,
            })
          });
        (parRes.data || [])
          .filter((r: any) => matchName(r.student_name))
          .forEach((r: any) => {
            const parsed = extractReasonAndNote(
              r.note || r.reason || r.detail || r.subject || null,
              "Veli Talebi"
            );
            rawRecords.push({
              id: `parent_request-${r.id}`,
              source_type: "parent_request",
              source_record_id: r.id,
              source_label: "Veli Talebi",
              student_name: r.student_name,
              class_display: r.class_display,
              class_key: r.class_key,
              reason: parsed.reason,
              note: parsed.note,
              created_at: r.created_at,
              record_status: r.status || null,
            })
          });

        (obsRes.data || [])
          .filter((r: any) => matchName(r.student_name))
          .forEach((r: any) => {
            const proxyMeta = getObservationProxyMeta(r);
            const parsed = extractReasonAndNote(r.note || null, "Gözlem Havuzu");
            const proxyKey = buildSourceRecordKey(
              proxyMeta.sourceType,
              proxyMeta.sourceRecordId
            );
            if (proxyMeta.isProxy && proxyKey && actualSourceKeys.has(proxyKey)) return;
            rawRecords.push({
              id: proxyMeta.isProxy
                ? `${proxyMeta.sourceType}-${proxyMeta.sourceRecordId || r.id}`
                : `observation-${r.id}`,
              source_type: proxyMeta.sourceType,
              source_record_id: proxyMeta.sourceRecordId || r.id,
              source_label:
                proxyMeta.sourceType === "teacher_referral"
                  ? "Öğretmen Yönlendirmesi"
                  : proxyMeta.sourceType === "parent_request"
                  ? "Veli Talebi"
                  : proxyMeta.sourceType === "student_report"
                  ? "Öğrenci Bildirimi"
                  : proxyMeta.sourceType === "self_application"
                  ? "Bireysel Başvuru"
                  : "Gözlem Havuzu",
              student_name: r.student_name,
              class_display: r.class_display,
              class_key: r.class_key,
              reason: parsed.reason,
              note: parsed.note,
              created_at: r.created_at || r.observed_at,
              record_status: r.status || null,
            });
          });

        const deduped = new Map<string, any>();
        rawRecords.forEach((record) => {
          const sourceKey = buildSourceRecordKey(record.source_type, record.source_record_id);
          if (!sourceKey) return;
          if (!deduped.has(sourceKey)) deduped.set(sourceKey, record);
        });

        const findAppointmentForRecord = (
          appointments: StudentAppointment[],
          record: any
        ) =>
          appointments.find(
            (appointment) =>
              isAppointmentLinkedToSource(
                appointment,
                record.source_type,
                record.source_record_id
              ) ||
              matchesApplicationToAppointment(
                appointment,
                record.student_name,
                record.class_display,
                record.class_key
              )
          ) || null;

        const allHistory = Array.from(deduped.values())
          .map((record) => {
            const matchedAttended = findAppointmentForRecord(
              attendedAppointmentsData,
              record
            );
            const matchedScheduled = findAppointmentForRecord(plannedAppointments, record);
            const mappedRecordStatus =
              record.record_status === "completed"
                ? "Görüşüldü"
                : record.record_status === "scheduled" || record.record_status === "converted"
                ? "Randevu verildi"
                : isPendingStatus(record.record_status)
                ? "Bekliyor"
                : "Bekliyor";
            const status = matchedAttended
              ? "Görüşüldü"
              : matchedScheduled
              ? "Randevu verildi"
              : mappedRecordStatus;
            const outcomeLabel = getOutcomeLabelFromAppointment(matchedAttended);
            const lastActivityAt = latestTimestamp(
              record.created_at,
              matchedScheduled?.updated_at,
              matchedScheduled?.created_at,
              matchedAttended?.updated_at,
              matchedAttended?.created_at
            );
            return {
              id: record.id,
              sourceType: record.source_type,
              sourceLabel: record.source_label,
              sourceRecordId: record.source_record_id,
              reason: record.reason || "Belirtilmemiş",
              note: record.note || null,
              status,
              outcomeLabel,
              lastActivityAt,
            } as StudentApplicationHistoryItem;
          })
          .sort(
            (a, b) =>
              new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime()
          );

        setProfileApplicationHistory(allHistory);
        setProfilePendingApps(
          allHistory.filter((item) => item.status === "Bekliyor").map((item) => ({
            id: item.id,
            _source: item.sourceType,
            _note: item.note || item.reason || "",
          }))
        );
      } else {
        setProfileApplicationHistory([]);
        setProfilePendingApps([]);
      }
    } catch (err) {
      console.error("loadStudentActiveData error:", err);
      setProfileAppointments([]);
      setProfileAttendedAppointments([]);
      setProfileApplicationHistory([]);
      setProfilePendingApps([]);
    }
  };

  const closeStudentProfile = () => {
    setSelectedProfileStudent(null);
    setProfileHistory(null);
    setProfileAppointments([]);
    setProfileAttendedAppointments([]);
    setProfileApplicationHistory([]);
    setProfilePendingApps([]);
  };

  const loadReferrals = useCallback(async () => {
    setReferralsLoading(true);
    try {
      const data = await fetch("/api/referrals").then(r => r.json());
      setReferrals(data.referrals || []);
    } catch { toast.error("Yönlendirmeler yüklenemedi"); }
    finally { setReferralsLoading(false); }
  }, []);

  const loadStudents = useCallback(async (classKey: string) => {
    setStudentsLoading(true);
    try {
      const data = await fetch(`/api/students?sinifSube=${encodeURIComponent(classKey)}`).then(r => r.json());
      setStudents(Array.isArray(data) ? data : []);
    } catch { toast.error("Öğrenci listesi yüklenemedi"); }
    finally { setStudentsLoading(false); }
  }, []);

  const loadPendingRequests = useCallback(async (classKey: string) => {
    try {
      const data = await fetch(`/api/class-student-requests?classKey=${encodeURIComponent(classKey)}&status=pending`).then(r => r.json());
      setPendingRequests(data.requests || []);
    } catch {}
  }, []);

  const loadGuidanceRequests = useCallback(async (teacherName: string) => {
    setGuidanceRequestsLoading(true);
    try {
      const data = await fetch(`/api/class-requests?teacherName=${encodeURIComponent(teacherName)}`).then(r => r.json());
      setGuidanceRequests(data.requests || []);
    } catch {}
    finally { setGuidanceRequestsLoading(false); }
  }, []);

  useEffect(() => {
    if (!auth) return;
    loadReferrals();
    if (auth.classKey) {
      loadStudents(auth.classKey);
      loadPendingRequests(auth.classKey);
    }
    if (auth.classKey) loadGuidanceRequests(auth.teacherName);
  }, [auth, loadReferrals, loadStudents, loadPendingRequests, loadGuidanceRequests]);

  const myReferrals = useMemo(() => referrals.filter(r => r.teacher_name === auth?.teacherName), [referrals, auth]);
  const classReferrals = useMemo(() => referrals.filter(r => auth?.classKey && r.class_key === auth.classKey), [referrals, auth]);

  const groupedReferrals = useMemo(() => {
    const groups: Record<string, Referral[]> = {};
    myReferrals.forEach(r => {
      if (!groups[r.student_name]) groups[r.student_name] = [];
      groups[r.student_name].push(r);
    });
    return Object.entries(groups)
      .map(([name, refs]) => ({
        name,
        referrals: [...refs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
        count: refs.length,
      }))
      .sort((a, b) => b.count - a.count);
  }, [myReferrals]);

  const reasonsChartData = useMemo(() => {
    const counts: Record<string, number> = {};
    myReferrals.forEach(r => {
      if (r.reason) counts[r.reason] = (counts[r.reason] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 7)
      .map(([name, count]) => ({ name: name.length > 22 ? name.slice(0, 20) + "…" : name, count, fullName: name }));
  }, [myReferrals]);

  const handleAddStudent = async () => {
    if (!newStudentName.trim() || !auth?.classKey) return;
    setAddingStudent(true);
    try {
      const res = await fetch("/api/class-students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classKey: auth.classKey, classDisplay: auth.classDisplay || auth.classKey, studentName: newStudentName.trim(), studentNumber: newStudentNumber.trim() || undefined }),
      });
      if (!res.ok) throw new Error();
      toast.success("Öğrenci eklendi");
      setNewStudentName(""); setNewStudentNumber("");
      loadStudents(auth.classKey);
    } catch { toast.error("Öğrenci eklenemedi"); }
    finally { setAddingStudent(false); }
  };

  const submitRequest = async () => {
    if (!auth || !requestModal.student || !requestModal.type) return;
    if (requestModal.type === "class_change" && !classChangeTarget) { toast.error("Hedef sınıf seçin"); return; }
    setSubmittingRequest(true);
    try {
      const targetSinif = sinifList.find(s => s.value === classChangeTarget);
      const res = await fetch("/api/class-student-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherName: auth.teacherName,
          classKey: auth.classKey,
          classDisplay: auth.classDisplay,
          studentName: requestModal.student.text,
          studentValue: requestModal.student.value,
          requestType: requestModal.type,
          newClassKey: classChangeTarget || null,
          newClassDisplay: targetSinif?.text || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Talep gönderildi. Yönetici onayı bekleniyor.");
      setRequestModal({ student: null, type: null });
      if (auth.classKey) loadPendingRequests(auth.classKey);
    } catch (err: any) {
      toast.error(err.message || "Talep gönderilemedi");
    } finally { setSubmittingRequest(false); }
  };

  const submitGuidanceRequest = async () => {
    if (!auth || !newTeacherDescription.trim()) return;
    setSubmittingGuidanceRequest(true);
    try {
      const res = await fetch("/api/class-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherName: auth.teacherName,
          classKey: auth.classKey,
          classDisplay: auth.classDisplay || auth.classKey,
          teacherDescription: newTeacherDescription.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Talep gönderildi");
      setShowNewGuidanceModal(false);
      setNewTeacherDescription("");
      loadGuidanceRequests(auth.teacherName);
    } catch (err: any) {
      toast.error(err.message || "Talep gönderilemedi");
    } finally { setSubmittingGuidanceRequest(false); }
  };

  const closeEditGuidanceModal = () => {
    if (savingGuidanceEdit) return;
    setEditingGuidanceRequest(null);
    setEditTeacherDescription("");
  };

  const openEditGuidanceModal = (request: GuidanceRequest) => {
    setEditingGuidanceRequest(request);
    setEditTeacherDescription(getClassRequestTeacherNote(request));
  };

  const submitGuidanceEdit = async () => {
    if (!auth || !editingGuidanceRequest || !editTeacherDescription.trim()) return;
    setSavingGuidanceEdit(true);
    try {
      const res = await fetch("/api/class-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingGuidanceRequest.id,
          teacherDescription: editTeacherDescription,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Talep güncellenemedi");
      toast.success("Talep güncellendi");
      closeEditGuidanceModal();
      loadGuidanceRequests(auth.teacherName);
    } catch (err: any) {
      toast.error(err.message || "Talep güncellenemedi");
    } finally {
      setSavingGuidanceEdit(false);
    }
  };

  const deleteGuidanceRequest = async (request: GuidanceRequest) => {
    if (!auth) return;
    if (request.status !== "pending") {
      toast.error("Sadece bekleyen talepler iptal edilebilir");
      return;
    }
    if (!confirm("Bu talebi iptal etmek istediğinizden emin misiniz?")) return;
    setDeletingGuidanceRequestId(request.id);
    try {
      const res = await fetch(`/api/class-requests?id=${encodeURIComponent(request.id)}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Talep iptal edilemedi");
      toast.success("Talep iptal edildi");
      loadGuidanceRequests(auth.teacherName);
    } catch (err: any) {
      toast.error(err.message || "Talep iptal edilemedi");
    } finally {
      setDeletingGuidanceRequestId(null);
    }
  };

  const submitFeedback = async (requestId: string) => {
    const feedback = feedbackInputs[requestId]?.trim();
    if (!feedback || !auth) return;
    setSubmittingFeedback(requestId);
    try {
      const res = await fetch("/api/class-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: requestId, feedback }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Kaydedilemedi");
      toast.success("Geri bildirim kaydedildi");
      setFeedbackInputs(prev => ({ ...prev, [requestId]: "" }));
      loadGuidanceRequests(auth.teacherName);
    } catch (err: any) { toast.error(err.message || "Kaydedilemedi"); }
    finally { setSubmittingFeedback(null); }
  };

  const getStudentPendingRequest = (studentText: string) =>
    pendingRequests.find(r => r.student_name === studentText);

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const getReasonColor = (reason: string) => {
    const r = reason.toLowerCase();
    if (r.includes("devamsızlık")) return "bg-red-100 text-red-700 border-red-200";
    if (r.includes("kavga") || r.includes("şiddet")) return "bg-orange-100 text-orange-700 border-orange-200";
    if (r.includes("ders")) return "bg-blue-100 text-blue-700 border-blue-200";
    if (r.includes("sosyal") || r.includes("uyum")) return "bg-purple-100 text-purple-700 border-purple-200";
    return "bg-slate-100 text-slate-700 border-slate-200";
  };

  const normalizeDecisionText = (value: string) =>
    value
      .toLocaleLowerCase("tr-TR")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/ç/g, "c")
      .replace(/ğ/g, "g")
      .replace(/ı/g, "i")
      .replace(/ö/g, "o")
      .replace(/ş/g, "s")
      .replace(/ü/g, "u")
      .trim();

  const getOutcomeLabel = (decisions?: string[] | null): string | null => {
    if (!decisions || decisions.length === 0) return null;
    for (const decision of decisions) {
      const normalized = normalizeDecisionText(decision);
      if (normalized.includes("tamamlandi")) return "Tamamlandı";
      if (normalized.includes("aktif takip") || normalized.includes("duzenli gorusme")) return "Aktif Takip";
    }
    return null;
  };

  const getOutcomeLabelFromAppointment = (appointment?: any | null): string | null => {
    if (!appointment) return null;
    const byDecision = getOutcomeLabel(appointment.outcome_decision || null);
    if (byDecision) return byDecision;

    const normalizedSourceStatus = normalizeDecisionText(
      String(appointment.source_application_status || "")
    );
    if (normalizedSourceStatus.includes("active_follow")) return "Aktif Takip";
    if (normalizedSourceStatus.includes("completed")) return "Tamamlandı";

    const summaryText = normalizeDecisionText(
      `${appointment.outcome_summary || ""} ${appointment.next_action || ""}`
    );
    if (summaryText.includes("aktif takip")) return "Aktif Takip";
    if (summaryText.includes("tamamlandi")) return "Tamamlandı";

    return null;
  };

  const latestTimestamp = (...values: Array<string | null | undefined>) => {
    const sorted = values
      .filter((value): value is string => Boolean(value))
      .map((value) => ({ raw: value, time: new Date(value).getTime() }))
      .filter((item) => Number.isFinite(item.time))
      .sort((a, b) => b.time - a.time);
    return sorted[0]?.raw || new Date().toISOString();
  };

  const isAppointmentAfterReferral = (
    appointment: StudentAppointment,
    referralDate: string
  ) => {
    const referralTime = new Date(referralDate).getTime();
    if (!Number.isFinite(referralTime)) return true;
    const appointmentDateTime = appointment.appointment_date
      ? new Date(`${appointment.appointment_date}T00:00:00`).getTime()
      : Number.NaN;
    const appointmentCreatedAt = appointment.created_at
      ? new Date(appointment.created_at).getTime()
      : Number.NaN;
    const appointmentUpdatedAt = appointment.updated_at
      ? new Date(appointment.updated_at).getTime()
      : Number.NaN;
    const candidateTimes = [
      appointmentDateTime,
      appointmentCreatedAt,
      appointmentUpdatedAt,
    ].filter((time) => Number.isFinite(time));
    if (candidateTimes.length === 0) return false;
    return Math.max(...candidateTimes) >= referralTime;
  };

  const toggleExpand = (name: string) =>
    setExpandedStudents(prev => {
      const s = new Set(prev);
      if (s.has(name)) s.delete(name);
      else s.add(name);
      return s;
    });

  if (!auth) return (
    <div className="flex items-center justify-center min-h-[300px]">
      <div className="w-8 h-8 border-4 border-violet-500/30 rounded-full animate-spin border-t-violet-500" />
    </div>
  );

  const activeGuidanceRequests = guidanceRequests.filter(r => r.status !== "rejected");

  const tabs: { id: TabId; label: string; icon: typeof History; count: number; hidden?: boolean }[] = [
    { id: "my-referrals", label: "Yaptığım Yönlendirmeler", icon: History, count: myReferrals.length, hidden: true },
    { id: "class-list", label: "Öğrenciler", icon: Users, count: students.length },
    { id: "guidance-requests", label: "Talepler", icon: MessageSquare, count: activeGuidanceRequests.length, hidden: !auth.classKey },
  ];

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* ── Header ── */}
      {!selectedProfileStudent && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 p-2.5 shadow-lg">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-800">Sınıfım</h1>
                {auth.classDisplay && (
                  <span className="rounded-lg bg-teal-100 px-2 py-0.5 text-xs font-semibold text-teal-700">{auth.classDisplay}</span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                {`${auth.teacherName} · ${students.length} öğrenci`}
              </p>
            </div>
          </div>
          {!auth.classKey && (
            <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
              <AlertCircle className="h-3.5 w-3.5" />
              Sınıf ataması yok
            </div>
          )}
        </div>
      )}

      {/* ── Öğrenci Profili ── */}
      {selectedProfileStudent ? (
        <div className="space-y-4">
          {profileLoading ? (
            <div className="flex items-center justify-center py-20">
              <RefreshCw className="h-6 w-6 animate-spin text-teal-500 mr-2" />
              <span className="text-sm text-slate-500">Yükleniyor...</span>
            </div>
          ) : profileHistory ? (() => {
            const hasReferrals = profileApplicationHistory.length > 0;
            const showCharts = profileHistory.totalReferrals >= 5;
            const hasRecentActivity = profileHistory.referrals?.some(
              (r: any) => new Date(r.date) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            );
            const hasActiveAppointment = profileAppointments.length > 0;
            const hasPendingApps = profilePendingApps.length > 0;
            const hasActiveProcesses = hasActiveAppointment || hasPendingApps;

            return (
              <>
                <div className="flex items-center gap-3">
                  <button
                    onClick={closeStudentProfile}
                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-500 shadow-sm transition-all hover:bg-slate-50 hover:text-slate-800"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-sm font-bold text-white shadow-lg">
                    <User className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h1 className="text-lg font-bold text-slate-800 truncate">{selectedProfileStudent}</h1>
                    <p className="text-xs text-slate-500">{profileHistory.classDisplay || auth.classDisplay || ""}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 rounded-full bg-violet-100 px-3 py-1">
                      <History className="h-3.5 w-3.5 text-violet-600" />
                      <span className="text-sm font-bold text-violet-700">{profileApplicationHistory.length}</span>
                      <span className="text-xs text-violet-500 hidden sm:inline">kayıt</span>
                    </div>
                  </div>
                </div>

                {hasActiveProcesses && (
                <Card className="border-0 shadow-sm overflow-hidden">
                  <CardHeader className="border-b bg-slate-50 py-2.5 px-4">
                    <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
                      <Clock className="h-4 w-4 text-blue-500" />
                      Aktif Süreçler
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0 divide-y divide-slate-100">
                    {profileAppointments.map((app: any) => {
                      const appDate = app.appointment_date
                        ? new Date(app.appointment_date + "T00:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "long", weekday: "long" })
                        : "";
                      const lessonSlot = app.start_time || app.lesson_slot || "";
                      return (
                      <div key={app.id} className="flex items-center justify-between px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100">
                            <Calendar className="h-3.5 w-3.5 text-emerald-600" />
                          </div>
                          <div>
                            <span className="text-sm font-medium text-slate-700">{appDate}</span>
                            {lessonSlot && (
                              <span className="ml-2 rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                                {lessonSlot}. ders
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Randevu Verildi</span>
                      </div>
                      );
                    })}
                    {profilePendingApps.map((app: any, idx: number) => {
                      const source = app._source || app.source_type || "observation";
                      const reason = app._note || app.note || "";
                      const sourceLabel = source === "teacher_referral" ? "Öğretmen Yönlendirmesi"
                        : source === "parent_request" ? "Veli Talebi"
                        : source === "student_report" ? "Öğrenci Bildirimi"
                        : source === "self_application" ? "Bireysel Başvuru"
                        : source === "observation" ? "Gözlem"
                        : "Başvuru";
                      const displayNote = reason.replace(/^\[.*?\]\s*/, "").trim();
                      const topicMatch = reason.match(/^\[(.*?)\]/);
                      const topic = topicMatch ? topicMatch[1] : "";
                      return (
                        <div key={app.id || idx} className="flex items-center justify-between px-4 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100">
                              <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-medium text-slate-700">{sourceLabel}</span>
                                {topic && (
                                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">{topic}</span>
                                )}
                              </div>
                              {displayNote && (
                                <p className="text-[11px] text-slate-500 truncate max-w-[300px]">{displayNote}</p>
                              )}
                            </div>
                          </div>
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Bekliyor</span>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}

                {showCharts && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <Card className="border-0 shadow-sm">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
                          <BarChart3 className="h-4 w-4 text-violet-500" />
                          Neden Dağılımı
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ReasonDistributionChart data={profileHistory.stats.byReason} />
                      </CardContent>
                    </Card>
                    <Card className="border-0 shadow-sm">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
                          <UserCheck className="h-4 w-4 text-cyan-500" />
                          Öğretmen Dağılımı
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <TeacherDistributionChart data={profileHistory.stats.byTeacher} />
                      </CardContent>
                    </Card>
                  </div>
                )}

                {hasRecentActivity && (
                  <Card className="border-0 shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
                        <Activity className="h-4 w-4 text-emerald-500" />
                        Son 30 Gün Aktivitesi
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ReferralTimeline referrals={profileHistory.referrals} />
                    </CardContent>
                  </Card>
                )}

              <Card className="border-0 shadow-sm">
                <CardHeader className="border-b bg-slate-50 pb-3">
                  <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <History className="h-4 w-4 text-slate-500" />
                    Yönlendirme Geçmişi
                    <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
                      {profileApplicationHistory.length} kayıt
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {!hasReferrals ? (
                    <div className="p-8 text-center">
                      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
                        <CheckCircle2 className="h-7 w-7 text-emerald-500" />
                      </div>
                      <p className="font-medium text-slate-600">Yönlendirme Kaydı Yok</p>
                      <p className="mt-1 text-xs text-slate-500">Bu öğrenci için henüz yönlendirme yapılmamış</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-left text-sm">
                        <thead className="bg-slate-50">
                          <tr className="border-b border-slate-200 text-slate-700">
                            <th className="px-4 py-3 font-semibold">Nasıl Yönlendirildi</th>
                            <th className="px-4 py-3 font-semibold">Neden</th>
                            <th className="px-4 py-3 font-semibold">Durum</th>
                            <th className="px-4 py-3 font-semibold">Görüşme Sonucu</th>
                            <th className="px-4 py-3 font-semibold">Son Güncelleme</th>
                          </tr>
                        </thead>
                        <tbody>
                          {profileApplicationHistory.map((item) => {
                            return (
                              <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                                <td className="px-4 py-3">
                                  <Badge variant="outline" className="text-xs">
                                    {item.sourceLabel}
                                  </Badge>
                                </td>
                                <td className="px-4 py-3 text-slate-600 max-w-[320px]">
                                  <div className="space-y-1">
                                    <Badge className={`${getReasonColor(item.reason)} border text-xs`}>
                                      {item.reason}
                                    </Badge>
                                    {item.note && (
                                      <p className="text-xs text-slate-500 truncate">{item.note}</p>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <Badge
                                    className={
                                      item.status === "Görüşüldü"
                                        ? "bg-emerald-100 text-emerald-700"
                                        : item.status === "Randevu verildi"
                                        ? "bg-blue-100 text-blue-700"
                                        : "bg-amber-100 text-amber-700"
                                    }
                                  >
                                    {item.status}
                                  </Badge>
                                </td>
                                <td className="px-4 py-3">
                                  {item.outcomeLabel ? (
                                    <Badge className="bg-violet-100 text-violet-700">{item.outcomeLabel}</Badge>
                                  ) : (
                                    <span className="text-xs text-slate-400">—</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-xs text-slate-500">
                                  {new Date(item.lastActivityAt).toLocaleString("tr-TR", {
                                    day: "2-digit",
                                    month: "2-digit",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
              </>
            );
          })() : (
            <div className="text-center py-12 text-slate-400">
              <p className="text-sm">Öğrenci bilgisi yüklenemedi</p>
            </div>
          )}
        </div>
      ) : (
      <>

      {/* ── Tabs ── */}
      <div className="flex gap-2 overflow-x-auto rounded-xl bg-slate-100 p-1.5">
        {tabs.filter(t => !t.hidden).map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex min-w-[148px] flex-none items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-all sm:min-w-0 sm:flex-1 sm:justify-center ${active ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 whitespace-normal leading-tight sm:flex-none sm:whitespace-nowrap">{tab.label}</span>
              <Badge variant="secondary" className={`text-xs ${active ? "bg-violet-100 text-violet-700" : "bg-slate-200 text-slate-600"}`}>
                {tab.count}
              </Badge>
            </button>
          );
        })}
      </div>

      {/* ── My Referrals ── */}
      {activeTab === "my-referrals" && (
        <div className="space-y-4">
          {reasonsChartData.length > 0 && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-700">En Çok Yönlendirme Yapılan Alanlar</CardTitle>
              </CardHeader>
              <CardContent className="pr-2">
                <ResponsiveContainer width="100%" height={Math.max(160, reasonsChartData.length * 38)}>
                  <BarChart data={reasonsChartData} layout="vertical" margin={{ top: 0, right: 28, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#94a3b8" }} />
                    <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11, fill: "#64748b" }} />
                    <Tooltip
                      formatter={((val: number, _: string, props: any) => [`${val} kez`, props.payload.fullName]) as any}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}
                    />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {reasonsChartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          <Card className="border-0 shadow-sm">
            <CardHeader className="flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-base">
                Yönlendirme Listesi
                <span className="ml-2 text-sm font-normal text-slate-400">({groupedReferrals.length} öğrenci)</span>
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={loadReferrals} disabled={referralsLoading}>
                <RefreshCw className={`h-4 w-4 ${referralsLoading ? "animate-spin" : ""}`} />
              </Button>
            </CardHeader>
            <CardContent>
              {referralsLoading ? (
                <div className="flex justify-center py-8"><div className="w-8 h-8 border-4 border-violet-500/30 rounded-full animate-spin border-t-violet-500" /></div>
              ) : groupedReferrals.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <History className="h-10 w-10 mx-auto mb-3 opacity-30" /><p>Henüz yönlendirme yapılmamış</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {groupedReferrals.map(({ name, referrals: refs, count }) => {
                    const expanded = expandedStudents.has(name);
                    const latest = refs[0];
                    const multi = count > 1;
                    return (
                      <div key={name} className="py-2">
                        <button className="w-full text-left" onClick={() => multi && toggleExpand(name)}>
                          <div className="flex items-center gap-3 py-1.5 hover:bg-slate-50 rounded-lg px-2 -mx-2 transition-colors">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${multi ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-500"}`}>
                              {count}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-slate-800 text-sm">{name}</span>
                                {latest.class_display && <Badge variant="outline" className="text-xs">{latest.class_display}</Badge>}
                                {multi && <Badge className="bg-violet-100 text-violet-700 text-xs">{count}× yönlendirildi</Badge>}
                              </div>
                              {!expanded && (
                                <p className="text-xs text-slate-400 mt-0.5 truncate">
                                  Son: {latest.reason || "—"} · {new Date(latest.created_at).toLocaleDateString("tr-TR")}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Badge className={`text-xs ${latest.status === "Tamamlandı" ? "bg-green-100 text-green-700" : latest.status === "Devam Ediyor" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
                                {latest.status}
                              </Badge>
                              {multi && <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`} />}
                            </div>
                          </div>
                        </button>
                        {multi && expanded && (
                          <div className="mt-1 ml-11 border-l-2 border-violet-100 pl-3 space-y-2">
                            {refs.map(r => (
                              <div key={r.id} className="flex items-start justify-between gap-2 py-1.5">
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs text-slate-600 font-medium">{r.reason || "Neden belirtilmemiş"}</p>
                                  <p className="text-xs text-slate-400">{new Date(r.created_at).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}</p>
                                </div>
                                <Badge className={`text-xs shrink-0 ${r.status === "Tamamlandı" ? "bg-green-100 text-green-700" : r.status === "Devam Ediyor" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
                                  {r.status}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Class List ── */}
      {activeTab === "class-list" && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="py-2.5 px-3 sm:px-4 border-b border-slate-100">
            <div className="flex gap-1.5 sm:gap-2">
              <input type="text" placeholder="Ad soyad" value={newStudentName}
                onChange={e => setNewStudentName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleAddStudent()}
                className="flex-1 min-w-0 px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 bg-white" />
              <input type="text" placeholder="No" value={newStudentNumber}
                onChange={e => setNewStudentNumber(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleAddStudent()}
                className="w-14 sm:w-16 px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 bg-white" />
              <Button onClick={handleAddStudent} disabled={!newStudentName.trim() || addingStudent} size="sm" className="bg-teal-600 hover:bg-teal-700 text-white px-2.5 shrink-0">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {!auth.classKey ? (
              <div className="text-center py-12 text-slate-400">
                <UserCheck className="h-10 w-10 mx-auto mb-3 opacity-30" /><p>Sınıf ataması yapılmamış</p>
              </div>
            ) : studentsLoading ? (
              <div className="flex justify-center py-8"><div className="w-8 h-8 border-4 border-teal-500/30 rounded-full animate-spin border-t-teal-500" /></div>
            ) : students.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-30" /><p className="text-sm">Sınıf listesi boş</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {students.map((s, i) => {
                  const studentReferrals = classReferrals.filter(r =>
                    r.student_name.replace(/^\d+\s+/, "").trim().toLowerCase() === s.text.replace(/^\d+\s+/, "").trim().toLowerCase()
                  );
                  const hasReferral = studentReferrals.length > 0;
                  const pending = getStudentPendingRequest(s.text);
                  return (
                    <div key={s.value} className="flex items-center gap-2 px-3 sm:px-4 py-2 transition-colors hover:bg-slate-50/50">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[10px] font-bold text-slate-500">
                        {i + 1}
                      </div>
                      <button
                        onClick={() => openStudentProfile(s.text)}
                        className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700 text-left hover:text-teal-700 transition-colors"
                      >
                        {s.text}
                      </button>
                      <div className="flex items-center gap-1 shrink-0">
                        {hasReferral && (
                          <Badge className="text-[9px] bg-violet-100 text-violet-700 border-0 px-1.5">
                            {studentReferrals.length}
                          </Badge>
                        )}
                        {pending ? (
                          <Badge className="text-[9px] bg-amber-100 text-amber-700 border-0 px-1.5">
                            {pending.request_type === "delete" ? "Silme" : "Değişiklik"}
                          </Badge>
                        ) : (
                          <>
                            <button onClick={(e) => { e.stopPropagation(); setRequestModal({ student: s, type: "class_change" }); setClassChangeTarget(""); }}
                              className="p-1 text-blue-500 hover:bg-blue-50 rounded transition-colors" title="Sınıf değiştir">
                              <ArrowRightLeft className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); setRequestModal({ student: s, type: "delete" }); }}
                              className="p-1 text-red-400 hover:bg-red-50 rounded transition-colors" title="Listeden çıkar">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Guidance Requests ── */}
      {activeTab === "guidance-requests" && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-800">Rehberlik Servisine Talepler</h2>
              <p className="text-xs text-slate-500 mt-0.5">Rehber öğretmenden sınıfınız için çalışma talep edin</p>
            </div>
            <div className="flex gap-2 sm:justify-end">
              <Button variant="ghost" size="sm" onClick={() => auth.teacherName && loadGuidanceRequests(auth.teacherName)} disabled={guidanceRequestsLoading}>
                <RefreshCw className={`h-4 w-4 ${guidanceRequestsLoading ? "animate-spin" : ""}`} />
              </Button>
              <Button onClick={() => setShowNewGuidanceModal(true)} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5">
                <Plus className="h-4 w-4" /> Yeni Talep
              </Button>
            </div>
          </div>

          {guidanceRequestsLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-emerald-500/30 rounded-full animate-spin border-t-emerald-500" />
            </div>
          ) : guidanceRequests.length === 0 ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="py-16 text-center text-slate-400">
                <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Henüz talep oluşturulmamış</p>
                <p className="text-sm mt-1">Rehber öğretmenden sınıfınız için çalışma talebinde bulunabilirsiniz</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {guidanceRequests.map(req => {
                const statusInfo = REQUEST_STATUS[req.status];
                const showFeedbackBox = req.status === "completed" && !req.feedback;
                const isPendingRequest = req.status === "pending";
                const editDisabled = !isPendingRequest || savingGuidanceEdit;
                const deleteDisabled = !isPendingRequest || deletingGuidanceRequestId === req.id;
                const displayCategory = getClassRequestDisplayCategory(req);
                const teacherNote = getClassRequestTeacherNote(req);
                return (
                  <Card key={req.id} className="border-0 shadow-sm overflow-hidden">
                    <CardContent className="p-4 space-y-3">
                      {/* Top row */}
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="mb-1 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="flex items-center gap-2 flex-wrap min-w-0">
                              <span className="font-semibold text-slate-800 text-sm">
                                {displayCategory || "Çalışma konusu planlama sonrası belirlenecek"}
                              </span>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusInfo.cls}`}>{statusInfo.label}</span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => openEditGuidanceModal(req)}
                                disabled={editDisabled}
                                title={isPendingRequest ? "Talebi düzenle" : "Sadece bekleyen talepler düzenlenebilir"}
                                className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${
                                  editDisabled
                                    ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-300"
                                    : "border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100"
                                }`}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteGuidanceRequest(req)}
                                disabled={deleteDisabled}
                                title={isPendingRequest ? "Talebi iptal et" : "Planlanan veya tamamlanan talepler iptal edilemez"}
                                className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${
                                  deleteDisabled
                                    ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-300"
                                    : "border-red-200 bg-red-50 text-red-500 hover:bg-red-100"
                                }`}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                          {!isPendingRequest && (
                            <p className="text-[11px] text-slate-400 mb-1">
                              Talep planlandıktan sonra içerik düzenleme ve iptal kapatılır.
                            </p>
                          )}
                          {teacherNote && (
                            <div className="rounded-xl bg-slate-50 px-3 py-2">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                Öğretmen Notu
                              </p>
                              <p className="mt-1 text-xs leading-relaxed text-slate-600">{teacherNote}</p>
                            </div>
                          )}
                          <p className="text-xs text-slate-400 mt-1">
                            {new Date(req.created_at).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}
                          </p>
                        </div>
                      </div>

                      {/* Scheduled info */}
                      {req.status === "scheduled" && req.scheduled_date && (
                        <div className="flex items-start gap-3 rounded-xl bg-blue-50 p-3 sm:items-center">
                          <Calendar className="h-4 w-4 text-blue-500 shrink-0" />
                          <div>
                            <p className="text-sm font-semibold text-blue-800">{formatDateShort(req.scheduled_date)}</p>
                            {req.lesson_slot && (
                              <p className="text-xs text-blue-600 flex items-center gap-1 mt-0.5">
                                <Clock className="h-3 w-3" /> {req.lesson_slot}. ders saati
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Completed info */}
                      {req.status === "completed" && (
                        <div className="flex items-start gap-2 rounded-xl bg-emerald-50 p-3 sm:items-center">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-emerald-700">Çalışma tamamlandı</p>
                            {req.scheduled_date && (
                              <p className="text-xs text-emerald-600">{formatDateShort(req.scheduled_date)}{req.lesson_slot ? ` — ${req.lesson_slot}. ders` : ""}</p>
                            )}
                            {displayCategory && (
                              <p className="mt-1 text-xs text-slate-600">Çalışma Konusu: {displayCategory}</p>
                            )}
                            {req.feedback && (
                              <p className="text-xs text-slate-600 mt-1 italic">Geri bildiriminiz: {req.feedback}</p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Feedback input for completed requests */}
                      {showFeedbackBox && (
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-slate-600">Geri bildirim ekleyin (isteğe bağlı)</p>
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <textarea
                              rows={2}
                              placeholder="Çalışma hakkında görüşlerinizi paylaşın..."
                              value={feedbackInputs[req.id] || ""}
                              onChange={e => setFeedbackInputs(prev => ({ ...prev, [req.id]: e.target.value }))}
                              className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400/30 focus:border-emerald-400 resize-none"
                            />
                            <Button
                              size="sm"
                              onClick={() => submitFeedback(req.id)}
                              disabled={!feedbackInputs[req.id]?.trim() || submittingFeedback === req.id}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white self-end"
                            >
                              {submittingFeedback === req.id ? "..." : "Gönder"}
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      </>
      )}

      {/* ── Student Request Modal ── */}
      {requestModal.student && requestModal.type && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setRequestModal({ student: null, type: null })} />
          <Card className="relative w-full max-w-md border-0 shadow-2xl z-10">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                {requestModal.type === "delete"
                  ? <><Trash2 className="h-4 w-4 text-red-500" /> Silme Talebi</>
                  : <><ArrowRightLeft className="h-4 w-4 text-blue-500" /> Sınıf Değiştirme Talebi</>}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl">
                <p className="text-xs text-slate-500">Öğrenci</p>
                <p className="text-sm font-semibold text-slate-800 mt-0.5">{requestModal.student.text}</p>
              </div>
              {requestModal.type === "class_change" && (
                <div>
                  <p className="text-xs font-medium text-slate-600 mb-1.5">Hedef Sınıf</p>
                  <select value={classChangeTarget} onChange={e => setClassChangeTarget(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400">
                    <option value="">Sınıf seçin...</option>
                    {sinifList.filter(s => s.value !== auth?.classKey).map(s => (
                      <option key={s.value} value={s.value}>{s.text}</option>
                    ))}
                  </select>
                </div>
              )}
              {requestModal.type === "delete" && (
                <div className="flex items-start gap-2 p-3 bg-red-50 rounded-xl text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  Bu öğrenci için silme talebi yöneticiye gönderilecek. Yönetici onayladıktan sonra işlem gerçekleşecek.
                </div>
              )}
              <div className="flex flex-col gap-2 pt-1 sm:flex-row">
                <Button variant="outline" className="flex-1" onClick={() => setRequestModal({ student: null, type: null })}>
                  İptal
                </Button>
                <Button
                  className={`flex-1 text-white ${requestModal.type === "delete" ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"}`}
                  onClick={submitRequest} disabled={submittingRequest}>
                  {submittingRequest ? "Gönderiliyor..." : "Talep Gönder"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── New Guidance Request Modal ── */}
      {editingGuidanceRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/50" onClick={closeEditGuidanceModal} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden z-10">
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-100">
                  <Pencil className="h-4 w-4 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Talebi Düzenle</h3>
                  <p className="text-xs text-slate-500">Sadece bekleyen talepler güncellenebilir</p>
                </div>
              </div>
              <button onClick={closeEditGuidanceModal} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl">
                <p className="text-xs text-slate-500">Sınıf</p>
                <p className="text-sm font-semibold text-slate-800 mt-0.5">{editingGuidanceRequest.class_display}</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">
                  Çalışma Talebi / Sorun Açıklaması
                </label>
                <textarea
                  rows={4}
                  value={editTeacherDescription}
                  onChange={e => setEditTeacherDescription(e.target.value)}
                  placeholder="Sınıfınızdaki durumu doğal ifadelerle açıklayın..."
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400 resize-none"
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 px-5 pb-5 sm:flex-row">
              <button
                onClick={closeEditGuidanceModal}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                İptal
              </button>
              <button
                onClick={submitGuidanceEdit}
                disabled={!editTeacherDescription.trim() || savingGuidanceEdit}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:from-amber-600 hover:to-orange-600 transition-all"
              >
                {savingGuidanceEdit ? "Kaydediliyor..." : "Değişiklikleri Kaydet"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showNewGuidanceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowNewGuidanceModal(false)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden z-10">
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-100">
                  <MessageSquare className="h-4 w-4 text-emerald-600" />
                </div>
                <h3 className="text-base font-bold text-slate-800">Rehberlik Çalışma Talebi</h3>
              </div>
              <button onClick={() => setShowNewGuidanceModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl">
                <p className="text-xs text-slate-500">Sınıf</p>
                <p className="text-sm font-semibold text-slate-800 mt-0.5">{auth.classDisplay || auth.classKey}</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">
                  Çalışma Talebi / Sorun Açıklaması
                </label>
                <textarea
                  rows={5}
                  value={newTeacherDescription}
                  onChange={e => setNewTeacherDescription(e.target.value)}
                  placeholder="Örn: Çocuklar birbirine lakap takıyor, sınıf içinde gruplaşma arttı, derste birbirlerini çok bölüyorlar..."
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 resize-none"
                />
                <p className="text-xs text-slate-500">
                  Teknik terim kullanmanız gerekmiyor; durumu günlük dille anlatmanız yeterli.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 px-5 pb-5 sm:flex-row">
              <button
                onClick={() => { setShowNewGuidanceModal(false); setNewTeacherDescription(""); }}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                İptal
              </button>
              <button
                onClick={submitGuidanceRequest}
                disabled={!newTeacherDescription.trim() || submittingGuidanceRequest}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:from-emerald-600 hover:to-teal-700 transition-all"
              >
                {submittingGuidanceRequest ? "Gönderiliyor..." : "Talep Gönder"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
