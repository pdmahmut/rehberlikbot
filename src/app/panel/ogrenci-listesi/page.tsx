"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  GraduationCap,
  Search,
  RefreshCw,
  User,
  Calendar,
  X,
  UserCheck,
  ChevronRight,
  ChevronDown,
  History,
  Users,
  BarChart3,
  ArrowLeft,
  Activity,
  CalendarPlus,
  Clock,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import {
  ReasonDistributionChart,
  TeacherDistributionChart,
  ReferralTimeline,
} from "@/components/charts/StudentCharts";
import {
  buildSourceRecordKey,
  getObservationProxyMeta,
  isAppointmentLinkedToSource,
  isPendingStatus,
} from "@/lib/guidanceApplications";

interface Student {
  value: string;
  text: string;
}

interface ClassOption {
  value: string;
  text: string;
}

interface ReferralHistory {
  id: string;
  studentName: string;
  reason: string;
  teacherName: string;
  classDisplay: string;
  date: string;
  notes: string | null;
}

interface StudentHistory {
  studentName: string;
  classDisplay: string;
  totalReferrals: number;
  referrals: ReferralHistory[];
  stats: {
    byReason: Record<string, number>;
    byTeacher: Record<string, number>;
    topReason: { name: string; count: number } | null;
  };
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

export default function OgrenciListesiPage() {
  const searchParams = useSearchParams();
  const urlStudent = searchParams.get("student");
  const urlClass = searchParams.get("class");

  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);

  // Global arama
  const [globalSearch, setGlobalSearch] = useState("");
  const [globalResults, setGlobalResults] = useState<any[]>([]);
  const [searchingGlobal, setSearchingGlobal] = useState(false);

  // Sınıf dropdown
  const [classDropdownOpen, setClassDropdownOpen] = useState(false);

  // Öğrenci profil
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentHistory, setStudentHistory] = useState<StudentHistory | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [urlProcessed, setUrlProcessed] = useState(false);

  // Aktif randevular ve bekleyen başvurular
  const [activeAppointments, setActiveAppointments] = useState<any[]>([]);
  const [attendedAppointments, setAttendedAppointments] = useState<StudentAppointment[]>([]);
  const [pendingApplications, setPendingApplications] = useState<any[]>([]);
  const [studentApplicationHistory, setStudentApplicationHistory] = useState<StudentApplicationHistoryItem[]>([]);

  // Sınıf rehber öğretmenleri ve mevcutlar
  const [classTeachers, setClassTeachers] = useState<Record<string, string>>({});
  const [classCounts, setClassCounts] = useState<Record<string, number>>({});

  // Görünüm: 'list' veya 'profile'
  const viewMode = selectedStudent ? "profile" : "list";

  // Sınıfları yükle
  useEffect(() => {
    const loadClasses = async () => {
      try {
        const res = await fetch("/api/data");
        if (res.ok) {
          const data = await res.json();
          setClasses(data.sinifSubeList || []);
        }
      } catch {
        toast.error("Sınıflar yüklenemedi");
      } finally {
        setLoadingClasses(false);
      }
    };
    loadClasses();
  }, []);

  // URL'den gelen öğrenciyi direkt yükle
  useEffect(() => {
    if (urlStudent && !urlProcessed && !loadingClasses) {
      setUrlProcessed(true);
      loadStudentHistoryDirect(urlStudent, urlClass || undefined);
    }
  }, [urlStudent, urlClass, urlProcessed, loadingClasses]);

  // Global öğrenci arama
  useEffect(() => {
    if (globalSearch.trim().length < 2) {
      setGlobalResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchingGlobal(true);
      try {
        const res = await fetch(
          `/api/students?query=${encodeURIComponent(globalSearch.trim())}`
        );
        if (res.ok) {
          const data = await res.json();
          setGlobalResults(Array.isArray(data) ? data.slice(0, 8) : []);
        }
      } catch {
        setGlobalResults([]);
      } finally {
        setSearchingGlobal(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [globalSearch]);

  // Dropdown dışına tıklanınca kapat
  useEffect(() => {
    if (!classDropdownOpen) return;
    const close = () => setClassDropdownOpen(false);
    const timer = setTimeout(() => document.addEventListener("click", close), 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("click", close);
    };
  }, [classDropdownOpen]);

  // Sınıf rehber öğretmenleri ve mevcutları yükle
  useEffect(() => {
    fetch("/api/teacher-accounts")
      .then((r) => r.json())
      .then((data) => {
        const mapping: Record<string, string> = {};
        (data.users || []).forEach((u: any) => {
          if (u.class_key) mapping[u.class_key] = u.teacher_name;
        });
        setClassTeachers(mapping);
      })
      .catch(() => {});

    if (classes.length > 0) {
      classes.forEach((c) => {
        fetch(`/api/students?sinifSube=${encodeURIComponent(c.value)}`)
          .then((r) => r.json())
          .then((data) => {
            const count = Array.isArray(data) ? data.length : 0;
            setClassCounts((prev) => ({ ...prev, [c.value]: count }));
          })
          .catch(() => {});
      });
    }
  }, [classes]);

  const handleGlobalStudentSelect = (result: any) => {
    setGlobalSearch("");
    setGlobalResults([]);
    const studentName = result.student_name || result.text || result.name || "";
    const classDisplay = result.class_display || result.classDisplay || "";
    loadStudentHistoryDirect(studentName, classDisplay);
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
      setActiveAppointments(plannedAppointments);
      setAttendedAppointments(attendedAppointmentsData);

      // 2. Başvuru geçmişi (tüm kaynaklar)
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

        setStudentApplicationHistory(allHistory);
        setPendingApplications(
          allHistory.filter((item) => item.status === "Bekliyor").map((item) => ({
            id: item.id,
            _source: item.sourceType,
            _note: item.note || item.reason || "",
          }))
        );
      } else {
        setStudentApplicationHistory([]);
        setPendingApplications([]);
      }
    } catch (err) {
      console.error("loadStudentActiveData error:", err);
      setActiveAppointments([]);
      setAttendedAppointments([]);
      setStudentApplicationHistory([]);
      setPendingApplications([]);
    }
  };

  const loadStudentHistoryDirect = async (studentName: string, classDisplay?: string) => {
    setSelectedStudent({ value: studentName, text: studentName });
    setLoadingHistory(true);
    setStudentHistory(null);
    setActiveAppointments([]);
    setAttendedAppointments([]);
    setStudentApplicationHistory([]);
    try {
      let url = `/api/student-history?studentName=${encodeURIComponent(studentName)}`;
      if (classDisplay) url += `&classDisplay=${encodeURIComponent(classDisplay)}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setStudentHistory(data);
      } else {
        toast.error("Öğrenci geçmişi yüklenemedi");
      }
      loadStudentActiveData(studentName);
    } catch {
      toast.error("Öğrenci geçmişi yüklenirken hata oluştu");
    } finally {
      setLoadingHistory(false);
    }
  };

  const loadStudents = async (classKey: string) => {
    if (!classKey) return;
    setLoadingStudents(true);
    try {
      const res = await fetch(`/api/students?sinifSube=${encodeURIComponent(classKey)}`);
      if (res.ok) {
        const data = await res.json();
        setStudents(data || []);
      } else {
        setStudents([]);
        toast.error("Öğrenciler yüklenemedi");
      }
    } catch {
      setStudents([]);
    } finally {
      setLoadingStudents(false);
    }
  };

  const handleClassChange = (value: string) => {
    setSelectedClass(value);
    setSearchTerm("");
    setClassDropdownOpen(false);
    loadStudents(value);
  };

  const loadStudentHistory = async (student: Student) => {
    setSelectedStudent(student);
    setLoadingHistory(true);
    setStudentHistory(null);
    setActiveAppointments([]);
    setAttendedAppointments([]);
    setStudentApplicationHistory([]);
    try {
      const studentName = student.text.replace(/^\d+\s+/, "").trim();
      const classDisplay = classes.find((c) => c.value === selectedClass)?.text || "";
      const res = await fetch(
        `/api/student-history?studentName=${encodeURIComponent(studentName)}&classDisplay=${encodeURIComponent(classDisplay)}`
      );
      if (res.ok) {
        const data = await res.json();
        setStudentHistory(data);
      } else {
        toast.error("Öğrenci geçmişi yüklenemedi");
      }
      loadStudentActiveData(studentName);
    } catch {
      toast.error("Öğrenci geçmişi yüklenirken hata oluştu");
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleBack = () => {
    setSelectedStudent(null);
    setStudentHistory(null);
    setActiveAppointments([]);
    setAttendedAppointments([]);
    setStudentApplicationHistory([]);
    setPendingApplications([]);
  };

  const filteredStudents = useMemo(() => {
    return students.filter((s) =>
      s.text.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [students, searchTerm]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });
  };

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

  const lastReferralDate = studentHistory?.referrals[0]?.date
    ? formatDate(studentHistory.referrals[0].date)
    : undefined;

  // Randevu oluştur — takvim sayfasına yönlendir, modal otomatik açılsın
  const handleCreateAppointment = () => {
    const studentName = selectedStudent?.text?.replace(/^\d+\s+/, "").trim() || "";
    const classDisplay = studentHistory?.classDisplay || classes.find((c) => c.value === selectedClass)?.text || "";
    const today = new Date().toISOString().slice(0, 10);
    const params = new URLSearchParams({
      openAppointment: "true",
      participantType: "student",
      participantName: studentName,
      participantClass: classDisplay,
      appointmentDate: today,
    });
    window.location.href = `/panel/takvim?${params.toString()}`;
  };

  // Sınıfları seviyeye göre grupla (5, 6, 7, 8...)
  const groupedClasses = useMemo(() => {
    const groups: Record<string, typeof classes> = {};
    classes.forEach((c) => {
      const grade = c.value.replace(/[^0-9]/g, "") || "?";
      if (!groups[grade]) groups[grade] = [];
      groups[grade].push(c);
    });
    return Object.entries(groups).sort(([a], [b]) => Number(a) - Number(b));
  }, [classes]);

  // ============================================================
  // PROFİL GÖRÜNÜMÜ
  // ============================================================
  if (viewMode === "profile") {
    const hasReferrals = studentApplicationHistory.length > 0;
    const showCharts = studentHistory && studentHistory.totalReferrals >= 5;
    const hasRecentActivity = studentHistory?.referrals.some(
      (r) => new Date(r.date) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    );
    const hasActiveAppointment = activeAppointments.length > 0;
    const hasPendingApps = pendingApplications.length > 0;
    const hasActiveProcesses = hasActiveAppointment || hasPendingApps;

    return (
      <div className="space-y-4">
        {/* Kompakt Başlık Satırı */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-500 shadow-sm transition-all hover:bg-slate-50 hover:text-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-sm font-bold text-white shadow-lg">
            <User className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold text-slate-800 truncate">
              {selectedStudent?.text}
            </h1>
            <p className="text-xs text-slate-500">
              {studentHistory?.classDisplay ||
                classes.find((c) => c.value === selectedClass)?.text ||
                ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {studentHistory && (
              <div className="flex items-center gap-1.5 rounded-full bg-violet-100 px-3 py-1">
                <History className="h-3.5 w-3.5 text-violet-600" />
                <span className="text-sm font-bold text-violet-700">{studentApplicationHistory.length}</span>
                <span className="text-xs text-violet-500 hidden sm:inline">kayıt</span>
              </div>
            )}
            <button
              onClick={handleCreateAppointment}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-emerald-700"
            >
              <CalendarPlus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Randevu Oluştur</span>
              <span className="sm:hidden">Randevu</span>
            </button>
          </div>
        </div>

        {loadingHistory ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="h-6 w-6 animate-spin text-violet-500 mr-2" />
            <span className="text-sm text-slate-500">Yükleniyor...</span>
          </div>
        ) : studentHistory ? (
          <div className="space-y-4">
            {/* Aktif Süreçler Kartı */}
            {hasActiveProcesses && (
              <Card className="border-0 shadow-sm overflow-hidden">
                <CardHeader className="border-b bg-slate-50 py-2.5 px-4">
                  <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-500" />
                    Aktif Süreçler
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 divide-y divide-slate-100">
                  {/* Planlanan randevular */}
                  {activeAppointments.map((app: any) => {
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
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                          Randevu Verildi
                        </span>
                      </div>
                    );
                  })}
                  {/* Bekleyen başvurular */}
                  {pendingApplications.map((app: any, idx: number) => {
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
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                          Bekliyor
                        </span>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}
            {/* Grafikler — sadece 5+ yönlendirme varsa */}
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
                    <ReasonDistributionChart data={studentHistory.stats.byReason} />
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
                    <TeacherDistributionChart data={studentHistory.stats.byTeacher} />
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Zaman Çizelgesi — sadece son 30 günde aktivite varsa */}
            {hasRecentActivity && (
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <Activity className="h-4 w-4 text-emerald-500" />
                    Son 30 Gün Aktivitesi
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ReferralTimeline referrals={studentHistory.referrals} />
                </CardContent>
              </Card>
            )}

            {/* Yönlendirme Listesi */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="border-b bg-slate-50 pb-3">
                <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <History className="h-4 w-4 text-slate-500" />
                  Yönlendirme Geçmişi
                  <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
                    {studentApplicationHistory.length} kayıt
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
                        {studentApplicationHistory.map((item) => {
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
          </div>
        ) : null}
      </div>
    );
  }

  // ============================================================
  // LİSTE GÖRÜNÜMÜ
  // ============================================================
  return (
    <div className="space-y-4">
      {/* Başlık — gradient fon */}
      <div className="rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 px-5 py-4 text-white shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-white/20 rounded-xl">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Öğrenciler</h1>
            <p className="text-white/70 text-xs">
              {selectedClass
                ? `${classes.find((c) => c.value === selectedClass)?.text} · ${filteredStudents.length} öğrenci`
                : `${classes.length} sınıf`}
            </p>
          </div>
        </div>
      </div>

      {/* Global Öğrenci Arama */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
        <input
          type="text"
          placeholder="Öğrenci ara (tüm sınıflar)..."
          value={globalSearch}
          onChange={(e) => setGlobalSearch(e.target.value)}
          className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-12 pr-4 text-sm shadow-sm outline-none transition-all focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
        />
        {searchingGlobal && (
          <RefreshCw className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-violet-500" />
        )}
        {globalResults.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
            {globalResults.map((r: any, i: number) => (
              <button
                key={i}
                onClick={() => handleGlobalStudentSelect(r)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-violet-50"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100 text-xs font-bold text-violet-600">
                  <User className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">
                    {r.text || r.student_name || r.name}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {r.class_display || r.classDisplay || ""}
                  </p>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
              </button>
            ))}
          </div>
        )}
        {globalSearch.trim().length >= 2 && !searchingGlobal && globalResults.length === 0 && (
          <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border border-slate-200 bg-white p-4 text-center shadow-xl">
            <p className="text-xs text-slate-500">Sonuç bulunamadı</p>
          </div>
        )}
      </div>

      {/* Sınıf Kartları */}
      {!selectedClass && (
        <div className="space-y-4">
          {loadingClasses ? (
            <div className="flex justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-violet-500" />
            </div>
          ) : (
            groupedClasses.map(([grade, gradeClasses]) => (
              <div key={grade}>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">{grade}. Sınıflar</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {gradeClasses.map((c) => {
                    const teacher = classTeachers[c.value];
                    const count = classCounts[c.value];
                    return (
                      <button
                        key={c.value}
                        onClick={() => handleClassChange(c.value)}
                        className="group flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-violet-400 hover:shadow-md hover:bg-violet-50/30 text-left"
                      >
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-lg font-black text-white shadow-md group-hover:scale-105 transition-transform">
                          {c.value}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-slate-800">{c.text}</p>
                          {teacher ? (
                            <p className="text-xs text-slate-500 truncate mt-0.5">{teacher}</p>
                          ) : (
                            <p className="text-xs text-slate-400 mt-0.5">&nbsp;</p>
                          )}
                        </div>
                        {count !== undefined && (
                          <div className="shrink-0 text-right">
                            <p className="text-lg font-bold text-violet-600">{count}</p>
                            <p className="text-[9px] text-slate-400">öğrenci</p>
                          </div>
                        )}
                        <ChevronRight className="h-4 w-4 text-slate-300 shrink-0 group-hover:text-violet-500" />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Seçili Sınıf — Geri + Öğrenci Listesi */}
      {selectedClass && (
        <>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setSelectedClass(""); setStudents([]); setSearchTerm(""); }}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-500 shadow-sm hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold text-slate-700">
              {classes.find((c) => c.value === selectedClass)?.text}
            </span>
          </div>

          <Card className="border-0 shadow-sm overflow-hidden">
            <CardHeader className="border-b bg-slate-50 py-3 px-4">
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Bu sınıfta ara..."
                    className="pl-9 h-9 bg-white"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <span className="text-xs text-slate-500 whitespace-nowrap">
                  {filteredStudents.length} öğrenci
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loadingStudents ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="h-5 w-5 animate-spin text-violet-500 mr-2" />
                  <span className="text-sm text-slate-500">Yükleniyor...</span>
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="py-12 text-center">
                  <User className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                  <p className="text-sm text-slate-500">
                    {searchTerm ? `"${searchTerm}" ile eşleşen öğrenci yok` : "Öğrenci bulunamadı"}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredStudents.map((student, idx) => (
                    <button
                      key={student.value}
                      onClick={() => loadStudentHistory(student)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-violet-50/50"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-500">
                        {idx + 1}
                      </div>
                      <p className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700">
                        {student.text}
                      </p>
                      <ChevronRight className="h-4 w-4 text-slate-300" />
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
