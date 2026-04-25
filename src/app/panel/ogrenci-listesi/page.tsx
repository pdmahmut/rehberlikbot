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
  const [pendingApplications, setPendingApplications] = useState<any[]>([]);

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
      const today = new Date().toISOString().slice(0, 10);

      // 1. Planlanan randevular
      const appRes = await fetch(
        `/api/appointments?search=${encodeURIComponent(cleanName)}&status=planned&from=${today}`
      );
      if (appRes.ok) {
        const data = await appRes.json();
        const allApps = Array.isArray(data) ? data : data.appointments || [];
        setActiveAppointments(allApps.filter((a: any) => matchName(a.participant_name)));
      } else {
        setActiveAppointments([]);
      }

      // 2. Bekleyen başvurular — tüm tablolardan çek
      if (supabase) {
        const pending: any[] = [];

        // observation_pool (merkezi havuz + gözlemler)
        const { data: obsData } = await supabase
          .from("observation_pool")
          .select("*")
          .ilike("student_name", `%${cleanName}%`)
          .eq("status", "pending");
        (obsData || []).filter((r: any) => matchName(r.student_name)).forEach((r: any) => {
          pending.push({ ...r, _source: r.source_type || "observation", _note: r.note || "" });
        });

        // referrals — randevu verilmemiş olanlar
        const { data: refData } = await supabase
          .from("referrals")
          .select("*")
          .ilike("student_name", `%${cleanName}%`);
        (refData || []).filter((r: any) => matchName(r.student_name)).forEach((r: any) => {
          // referrals'ta status yok, observation_pool'da zaten varsa tekrar ekleme
          const alreadyInPool = pending.some(
            (p) => p.source_record_id === r.id || p._source === "teacher_referral"
          );
          if (!alreadyInPool) {
            // Bu yönlendirme için randevu var mı kontrol et
            // Basit kontrol: son 30 gündeki yönlendirmeler "bekliyor" sayılır
            const refDate = new Date(r.created_at);
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            if (refDate > thirtyDaysAgo) {
              pending.push({ id: r.id, student_name: r.student_name, _source: "teacher_referral", _note: r.reason || "", created_at: r.created_at });
            }
          }
        });

        // individual_requests
        const { data: indData } = await supabase
          .from("individual_requests")
          .select("*")
          .ilike("student_name", `%${cleanName}%`)
          .eq("status", "pending");
        (indData || []).filter((r: any) => matchName(r.student_name)).forEach((r: any) => {
          const alreadyInPool = pending.some((p) => p.source_record_id === r.id);
          if (!alreadyInPool) {
            pending.push({ id: r.id, student_name: r.student_name, _source: "self_application", _note: r.note || "", created_at: r.created_at });
          }
        });

        // student_incidents
        const { data: incData } = await supabase
          .from("student_incidents")
          .select("*")
          .ilike("student_name", `%${cleanName}%`)
          .in("status", ["new", "reviewing"]);
        (incData || []).filter((r: any) => matchName(r.student_name)).forEach((r: any) => {
          const alreadyInPool = pending.some((p) => p.source_record_id === r.id);
          if (!alreadyInPool) {
            pending.push({ id: r.id, student_name: r.student_name, _source: "student_report", _note: r.description || r.note || "", created_at: r.created_at || r.incident_date });
          }
        });

        // parent_meeting_requests
        const { data: parData } = await supabase
          .from("parent_meeting_requests")
          .select("*")
          .ilike("student_name", `%${cleanName}%`);
        (parData || []).filter((r: any) => matchName(r.student_name)).forEach((r: any) => {
          const status = (r.status || "").toLowerCase();
          if (status === "pending" || status === "new" || !status) {
            const alreadyInPool = pending.some((p) => p.source_record_id === r.id);
            if (!alreadyInPool) {
              pending.push({ id: r.id, student_name: r.student_name, _source: "parent_request", _note: r.note || r.reason || "", created_at: r.created_at });
            }
          }
        });

        // ID bazlı tekrar kaldır
        const uniqueMap = new Map();
        pending.forEach((p) => {
          if (!uniqueMap.has(p.id)) uniqueMap.set(p.id, p);
        });
        setPendingApplications(Array.from(uniqueMap.values()));
      } else {
        setPendingApplications([]);
      }
    } catch (err) {
      console.error("loadStudentActiveData error:", err);
      setActiveAppointments([]);
      setPendingApplications([]);
    }
  };

  const loadStudentHistoryDirect = async (studentName: string, classDisplay?: string) => {
    setSelectedStudent({ value: studentName, text: studentName });
    setLoadingHistory(true);
    setStudentHistory(null);
    setActiveAppointments([]);
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

  // ============================================================
  // PROFİL GÖRÜNÜMÜ
  // ============================================================
  if (viewMode === "profile") {
    const hasReferrals = studentHistory && studentHistory.totalReferrals > 0;
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
                <span className="text-sm font-bold text-violet-700">{studentHistory.totalReferrals}</span>
                <span className="text-xs text-violet-500 hidden sm:inline">yönlendirme</span>
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
                    {studentHistory.totalReferrals} kayıt
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
                  <div className="divide-y divide-slate-100">
                    {studentHistory.referrals.map((referral, idx) => (
                      <div key={referral.id} className="p-4 transition-colors hover:bg-slate-50/50">
                        <div className="flex items-start gap-3">
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${
                              idx === 0
                                ? "bg-gradient-to-br from-violet-500 to-purple-600 text-white"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {studentHistory.totalReferrals - idx}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge className={`${getReasonColor(referral.reason)} border text-xs`}>
                                {referral.reason}
                              </Badge>
                              {idx === 0 && (
                                <span className="rounded bg-violet-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                                  SON
                                </span>
                              )}
                            </div>
                            <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
                              <span className="flex items-center gap-1">
                                <UserCheck className="h-3.5 w-3.5" />
                                {referral.teacherName}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3.5 w-3.5" />
                                {formatDateTime(referral.date)}
                              </span>
                            </div>
                            {referral.notes && (
                              <p className="mt-2 rounded-lg border border-slate-100 bg-slate-50 p-2 text-sm text-slate-600">
                                📝 {referral.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
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
      {/* Başlık + Arama */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 p-2.5 shadow-lg">
            <Users className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Öğrenciler</h1>
            <p className="text-xs text-slate-500">
              {selectedClass
                ? `${classes.find((c) => c.value === selectedClass)?.text} · ${filteredStudents.length} öğrenci`
                : `${classes.length} sınıf`}
            </p>
          </div>
        </div>

        {/* Global Öğrenci Arama */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Öğrenci ara (tüm sınıflar)..."
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-4 text-sm shadow-sm outline-none transition-all focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
          />
          {searchingGlobal && (
            <RefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-violet-500" />
          )}
          {globalResults.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
              {globalResults.map((r: any, i: number) => (
                <button
                  key={i}
                  onClick={() => handleGlobalStudentSelect(r)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-violet-50"
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
      </div>

      {/* Sınıf Seçimi — Dropdown */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setClassDropdownOpen(!classDropdownOpen); }}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-all hover:border-violet-300 hover:shadow-md"
          >
            <GraduationCap className="h-4 w-4 text-violet-500" />
            {selectedClass
              ? classes.find((c) => c.value === selectedClass)?.text
              : "Sınıf seçin"}
            <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${classDropdownOpen ? "rotate-180" : ""}`} />
          </button>

          {classDropdownOpen && (
            <div className="absolute left-0 top-full z-50 mt-1 max-h-64 w-56 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
              {loadingClasses ? (
                <div className="flex items-center justify-center py-4">
                  <RefreshCw className="h-4 w-4 animate-spin text-violet-500" />
                </div>
              ) : (
                classes.map((c) => (
                  <button
                    key={c.value}
                    onClick={(e) => { e.stopPropagation(); handleClassChange(c.value); }}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors ${
                      selectedClass === c.value
                        ? "bg-violet-50 font-semibold text-violet-700"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <GraduationCap className={`h-3.5 w-3.5 ${selectedClass === c.value ? "text-violet-500" : "text-slate-400"}`} />
                    {c.text}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {selectedClass && (
          <button
            onClick={() => { setSelectedClass(""); setStudents([]); setSearchTerm(""); }}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Öğrenci Listesi */}
      {selectedClass && (
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
      )}

      {/* Sınıf seçilmemişse boş durum */}
      {!selectedClass && !loadingClasses && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-100">
            <GraduationCap className="h-8 w-8 text-violet-400" />
          </div>
          <p className="font-semibold text-slate-700">Sınıf Seçin</p>
          <p className="mt-1 max-w-xs text-sm text-slate-500">
            Yukarıdan bir sınıf seçerek öğrenci listesini görüntüleyin veya arama kutusunu kullanarak doğrudan öğrenci bulun
          </p>
        </div>
      )}
    </div>
  );
}
