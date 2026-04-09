"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { MessageSquare, Search, Loader2, Filter, X, User, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  ReferralRecord,
  ObservationPoolRecord,
  StudentIncidentRecord,
  ParentMeetingRequestRecord,
  IndividualRequestRecord
} from "@/types";

type ApplicationRecord = {
  id: string;
  student_name: string;
  class_display?: string | null;
  class_key?: string | null;
  source: "Veli Talepleri" | "Öğretmen Yönlendirmeleri" | "Öğrenci Bildirimleri" | "Gözlem Havuzu" | "Bireysel Başvuru";
  referrer?: string;
  date: string;
  status: "Görüşüldü" | "Randevu verildi" | "Bekliyor";
  outcome_label?: string | null;
  note?: string | null;
};

type ApplicationStatus = ApplicationRecord["status"];
type ApplicationStatusOverrides = Record<string, ApplicationStatus>;

const APPLICATION_STATUS_OVERRIDES_KEY = "application-status-overrides";

const loadApplicationStatusOverrides = (): ApplicationStatusOverrides => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(APPLICATION_STATUS_OVERRIDES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.entries(parsed as Record<string, unknown>).reduce<ApplicationStatusOverrides>((acc, [id, value]) => {
      if (value === "Görüşüldü" || value === "Randevu verildi" || value === "Bekliyor") acc[id] = value;
      return acc;
    }, {});
  } catch { return {}; }
};

const saveApplicationStatusOverrides = (overrides: ApplicationStatusOverrides) => {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(APPLICATION_STATUS_OVERRIDES_KEY, JSON.stringify(overrides)); } catch { }
};

const normalizeText = (value: string) =>
  value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").trim();

const normalizeStudentName = (value?: string | null) =>
  normalizeText((value || "").replace(/\s+/g, " "));

const normalizeClassText = (value?: string | null) =>
  (value || "").toLocaleLowerCase("tr-TR").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").replace(/[\/\-_.()]/g, "").trim();

const normalizeDecisionText = (value: string) =>
  value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ı/g, "i")
    .replace(/ö/g, "o").replace(/ş/g, "s").replace(/ü/g, "u").trim();

const matchesAppointment = (
  appointment: any,
  studentName?: string | null,
  classDisplay?: string | null,
  classKey?: string | null
) => {
  const aName = normalizeStudentName(appointment.participant_name);
  const sName = normalizeStudentName(studentName);
  if (!aName || !sName) return false;
  const nameMatch = aName === sName || aName.includes(sName) || sName.includes(aName);
  if (!nameMatch) return false;
  const aClass = normalizeClassText(appointment.participant_class);
  const sClass = normalizeClassText(classDisplay || classKey);
  if (!aClass || !sClass) return true;
  return aClass === sClass || aClass.includes(sClass) || sClass.includes(aClass);
};

// outcome_decision dizisinden etiket çıkar
const getOutcomeLabel = (decisions: string[] | null | undefined): string | null => {
  if (!decisions || decisions.length === 0) return null;
  for (const d of decisions) {
    const n = normalizeDecisionText(d);
    if (n.includes("tamamlandi")) return "Tamamlandı";
    if (n.includes("aktif takip")) return "Aktif Takip";
    if (n.includes("duzenli gorusme")) return "Düzenli Görüşme";
  }
  return null;
};

// Öğrencinin tamamlanmış randevusundan outcome_label bul
const findOutcomeLabel = (
  attendedAppointments: any[],
  studentName?: string | null,
  classDisplay?: string | null,
  classKey?: string | null
): string | null => {
  for (const apt of attendedAppointments) {
    if (matchesAppointment(apt, studentName, classDisplay, classKey)) {
      const label = getOutcomeLabel(apt.outcome_decision);
      if (label) return label;
    }
  }
  return null;
};

export default function BasvurularPage() {
  const [applicationsSearchQuery, setApplicationsSearchQuery] = useState("");
  const [applicationsClassFilter, setApplicationsClassFilter] = useState("");
  const [applicationsSourceFilter, setApplicationsSourceFilter] = useState<"all" | ApplicationRecord["source"]>("all");
  const [applicationsReferrerFilter, setApplicationsReferrerFilter] = useState("");
  const [applicationsStatusFilter, setApplicationsStatusFilter] = useState<"all" | ApplicationStatus>("all");
  const [applicationsOutcomeFilter, setApplicationsOutcomeFilter] = useState<"all" | "Tamamlandı" | "Aktif Takip" | "Düzenli Görüşme">("all");

  const [loading, setLoading] = useState(true);
  const [attendedAppointments, setAttendedAppointments] = useState<any[]>([]);
  const [scheduledAppointments, setScheduledAppointments] = useState<any[]>([]);
  const [referrals, setReferrals] = useState<ReferralRecord[]>([]);
  const [observations, setObservations] = useState<ObservationPoolRecord[]>([]);
  const [incidents, setIncidents] = useState<StudentIncidentRecord[]>([]);
  const [requests, setRequests] = useState<ParentMeetingRequestRecord[]>([]);
  const [individualRequests, setIndividualRequests] = useState<IndividualRequestRecord[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [statusOverrides, setStatusOverrides] = useState<ApplicationStatusOverrides>({});

  const handleDeleteApplication = async (application: ApplicationRecord) => {
    if (!confirm(`${application.student_name} adlı öğrencinin ${application.source} başvurusunu silmek istediğinizden emin misiniz?`)) return;
    setDeletingId(application.id);
    try {
      const dashIndex = application.id.indexOf('-');
      const type = application.id.slice(0, dashIndex);
      const id = application.id.slice(dashIndex + 1);
      let endpoint = '';
      let sourceApplicationType = '';
      switch (type) {
        case 'incident':
          endpoint = '/api/student-incidents';
          sourceApplicationType = 'student_report';
          break;
        case 'referral':
          endpoint = '/api/referrals';
          sourceApplicationType = 'teacher_referral';
          break;
        case 'observation':
          endpoint = '/api/gozlem-havuzu';
          sourceApplicationType = 'observation';
          break;
        case 'request':
          endpoint = '/api/parent-meeting-requests';
          sourceApplicationType = 'parent_request';
          break;
        case 'individual':
          endpoint = '/api/individual-requests';
          sourceApplicationType = 'self_application';
          break;
        default:
          throw new Error('Geçersiz başvuru türü');
      }

      const response = await fetch(`${endpoint}?id=${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Bilinmeyen hata' }));
        throw new Error(errorData.error || 'İşlem başarısız');
      }

      try {
        await fetch(
          `/api/appointments?source_application_id=${encodeURIComponent(id)}&source_application_type=${encodeURIComponent(sourceApplicationType)}`,
          { method: 'DELETE' }
        );
      } catch (cleanupError) {
        console.error("Bağlı randevu silinirken hata oluştu:", cleanupError);
      }

      toast.success('Başvuru başarıyla silindi');
      try {
        await loadData();
      } catch (refreshError) {
        console.error("Başvurular yenilenemedi:", refreshError);
      }
    } catch (error) {
      console.error('Başvuru silme hatası:', error);
      toast.error(`Başvuru silinirken hata oluştu: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`);
    } finally {
      setDeletingId(null);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const [referralResult, observationResult, incidentResult, requestResult, attendedResult, scheduledResult, individualRequestResult] = await Promise.all([
        supabase.from("referrals").select("*").order("created_at", { ascending: false }),
        fetch("/api/gozlem-havuzu"),
        supabase.from("student_incidents").select("*").in("status", ["new", "reviewing"]).order("incident_date", { ascending: false }).order("created_at", { ascending: false }),
        supabase.from("parent_meeting_requests").select("*").order("created_at", { ascending: false }),
        supabase.from("appointments").select("*").eq("status", "attended").eq("participant_type", "student").order("appointment_date", { ascending: false }).order("created_at", { ascending: false }),
        supabase.from("appointments").select("*").neq("status", "pending").neq("status", "attended").neq("status", "cancelled").eq("participant_type", "student").order("appointment_date", { ascending: false }).order("created_at", { ascending: false }),
        supabase.from("individual_requests").select("*").order("created_at", { ascending: false })
      ]);
      if (!referralResult.error) setReferrals(referralResult.data || []);
      if (observationResult.ok) {
        const d = await observationResult.json();
        setObservations(d.observations || []);
      }
      if (!incidentResult.error) setIncidents(incidentResult.data || []);
      if (!requestResult.error) setRequests(requestResult.data || []);
      if (!attendedResult.error) setAttendedAppointments(attendedResult.data || []);
      if (!scheduledResult.error) setScheduledAppointments(scheduledResult.data || []);
      if (!individualRequestResult.error) setIndividualRequests(individualRequestResult.data || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Veri yüklenirken hata oluştu";
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    setStatusOverrides(loadApplicationStatusOverrides());
    const handleStorage = (e: StorageEvent) => {
      if (e.key === APPLICATION_STATUS_OVERRIDES_KEY) setStatusOverrides(loadApplicationStatusOverrides());
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const updateApplicationStatusOverride = (id: string, nextStatus: ApplicationStatus) => {
    setStatusOverrides((prev) => {
      const next = { ...prev, [id]: nextStatus };
      saveApplicationStatusOverrides(next);
      return next;
    });
  };

  const applicationRecords: ApplicationRecord[] = useMemo(() => {
    const records: ApplicationRecord[] = [];

    incidents.forEach((incident) => {
      const isScheduled = scheduledAppointments.some((apt) => matchesAppointment(apt, incident.target_student_name, incident.target_class_display, incident.target_class_key));
      const isAttended = attendedAppointments.some((apt) => matchesAppointment(apt, incident.target_student_name, incident.target_class_display, incident.target_class_key));
      const outcomeLabel = isAttended ? findOutcomeLabel(attendedAppointments, incident.target_student_name, incident.target_class_display, incident.target_class_key) : null;
      records.push({
        id: `incident-${incident.id}`,
        student_name: incident.target_student_name,
        class_display: incident.target_class_display,
        class_key: incident.target_class_key,
        source: "Öğrenci Bildirimleri",
        referrer: incident.record_role === "linked_reporter" ? incident.reporter_student_name || undefined : undefined,
        date: incident.created_at || incident.incident_date || new Date().toISOString(),
        status: isAttended ? "Görüşüldü" : isScheduled ? "Randevu verildi" : "Bekliyor",
        outcome_label: outcomeLabel,
        note: incident.description
      });
    });

    referrals.forEach((referral) => {
      const isScheduled = scheduledAppointments.some((apt) => matchesAppointment(apt, referral.student_name, referral.class_display, referral.class_key));
      const isAttended = attendedAppointments.some((apt) => matchesAppointment(apt, referral.student_name, referral.class_display, referral.class_key));
      const outcomeLabel = isAttended ? findOutcomeLabel(attendedAppointments, referral.student_name, referral.class_display, referral.class_key) : null;
      records.push({
        id: `referral-${referral.id}`,
        student_name: referral.student_name,
        class_display: referral.class_display,
        class_key: referral.class_key,
        source: "Öğretmen Yönlendirmeleri",
        referrer: referral.teacher_name,
        date: referral.created_at || new Date().toISOString(),
        status: isAttended ? "Görüşüldü" : isScheduled ? "Randevu verildi" : "Bekliyor",
        outcome_label: outcomeLabel,
        note: referral.note || referral.reason
      });
    });

    observations.forEach((observation) => {
      const normalizedStatus = observation.status === "randevu_verildi" || observation.status === "converted" ? "scheduled" : observation.status;
      const appointmentScheduled = scheduledAppointments.some((apt) => matchesAppointment(apt, observation.student_name, observation.class_display, observation.class_key));
      const appointmentAttended = attendedAppointments.some((apt) => matchesAppointment(apt, observation.student_name, observation.class_display, observation.class_key));
      const isScheduled = normalizedStatus === "scheduled" || appointmentScheduled;
      const isAttended =
        normalizedStatus === "completed" ||
        normalizedStatus === "active_follow" ||
        normalizedStatus === "regular_meeting" ||
        appointmentAttended;
      const outcomeLabel = isAttended ? findOutcomeLabel(attendedAppointments, observation.student_name, observation.class_display, observation.class_key) : null;
      records.push({
        id: `observation-${observation.id}`,
        student_name: observation.student_name,
        class_display: observation.class_display,
        class_key: observation.class_key,
        source: "Gözlem Havuzu",
        referrer: "",
        date: observation.created_at || new Date().toISOString(),
        status: isAttended ? "Görüşüldü" : isScheduled ? "Randevu verildi" : "Bekliyor",
        outcome_label: outcomeLabel,
        note: observation.note
      });
    });

    requests.forEach((request) => {
      const isScheduled = scheduledAppointments.some((apt) => matchesAppointment(apt, request.student_name, request.class_display, request.class_key));
      const isAttended = attendedAppointments.some((apt) => matchesAppointment(apt, request.student_name, request.class_display, request.class_key));
      const outcomeLabel = isAttended ? findOutcomeLabel(attendedAppointments, request.student_name, request.class_display, request.class_key) : null;
      records.push({
        id: `request-${request.id}`,
        student_name: request.student_name,
        class_display: request.class_display,
        class_key: request.class_key,
        source: "Veli Talepleri",
        referrer: request.parent_name || undefined,
        date: request.created_at || new Date().toISOString(),
        status: isAttended ? "Görüşüldü" : isScheduled ? "Randevu verildi" : "Bekliyor",
        outcome_label: outcomeLabel,
        note: request.detail || request.subject
      });
    });

    individualRequests.forEach((request) => {
      const isScheduled = scheduledAppointments.some((apt) => matchesAppointment(apt, request.student_name, request.class_display, request.class_key));
      const isAttended = attendedAppointments.some((apt) => matchesAppointment(apt, request.student_name, request.class_display, request.class_key));
      const outcomeLabel = isAttended ? findOutcomeLabel(attendedAppointments, request.student_name, request.class_display, request.class_key) : null;
      records.push({
        id: `individual-${request.id}`,
        student_name: request.student_name,
        class_display: request.class_display,
        class_key: request.class_key,
        source: "Bireysel Başvuru",
        referrer: undefined,
        date: request.created_at || new Date().toISOString(),
        status: isAttended ? "Görüşüldü" : isScheduled ? "Randevu verildi" : "Bekliyor",
        outcome_label: outcomeLabel,
        note: request.note
      });
    });

    return records.filter((r) => r.student_name).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [incidents, referrals, observations, requests, individualRequests, attendedAppointments, scheduledAppointments]);

  const applicationRecordsWithOverrides = useMemo(() => {
    return applicationRecords.map((record) => ({
      ...record,
      status: statusOverrides[record.id] || record.status
    }));
  }, [applicationRecords, statusOverrides]);

  const isReferralActive = applicationsSourceFilter === "Öğretmen Yönlendirmeleri";

  useEffect(() => {
    if (!isReferralActive) setApplicationsReferrerFilter("");
  }, [isReferralActive]);

  const filteredApplications = useMemo(() => {
    return applicationRecordsWithOverrides.filter((item) => {
      const matchesSearch = !applicationsSearchQuery || normalizeStudentName(item.student_name).includes(normalizeStudentName(applicationsSearchQuery));
      const matchesClass = !applicationsClassFilter || normalizeClassText(item.class_display) === applicationsClassFilter || normalizeClassText(item.class_key) === applicationsClassFilter;
      const matchesSource = applicationsSourceFilter === "all" || item.source === applicationsSourceFilter;
      const matchesReferrer = !applicationsReferrerFilter || item.source !== "Öğretmen Yönlendirmeleri" || (item.referrer && normalizeText(item.referrer).includes(normalizeText(applicationsReferrerFilter)));
      const matchesStatus = applicationsStatusFilter === "all" || item.status === applicationsStatusFilter;
      const matchesOutcome = applicationsOutcomeFilter === "all" || item.outcome_label === applicationsOutcomeFilter;
      return matchesSearch && matchesClass && matchesSource && matchesReferrer && matchesStatus && matchesOutcome;
    });
  }, [applicationRecordsWithOverrides, applicationsSearchQuery, applicationsClassFilter, applicationsSourceFilter, applicationsReferrerFilter, applicationsStatusFilter, applicationsOutcomeFilter]);

  const applicationClassOptions = useMemo(() => {
    const classMap = new Map<string, string>();
    applicationRecordsWithOverrides.forEach((item) => {
      const classValue = item.class_display || item.class_key;
      const normalized = normalizeClassText(classValue);
      if (!normalized) return;
      if (!classMap.has(normalized)) classMap.set(normalized, item.class_display || item.class_key || normalized);
    });
    return Array.from(classMap.entries()).map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, "tr-TR"));
  }, [applicationRecordsWithOverrides]);

  const applicationReferrerOptions = useMemo(() => {
    const referrers = new Set<string>();
    applicationRecordsWithOverrides.forEach((item) => { if (item.referrer) referrers.add(item.referrer); });
    return Array.from(referrers).sort((a, b) => a.localeCompare(b, "tr-TR"));
  }, [applicationRecordsWithOverrides]);

  const applicationStatistics = useMemo(() => {
    const totals = {
      total: 0,
      status: { "Görüşüldü": 0, "Randevu verildi": 0, "Bekliyor": 0 },
      outcome: { "Tamamlandı": 0, "Aktif Takip": 0, "Düzenli Görüşme": 0 }
    };
    applicationRecordsWithOverrides.forEach((item) => {
      totals.total += 1;
      totals.status[item.status] += 1;
      if (item.outcome_label === "Tamamlandı") totals.outcome["Tamamlandı"] += 1;
      else if (item.outcome_label === "Aktif Takip") totals.outcome["Aktif Takip"] += 1;
      else if (item.outcome_label === "Düzenli Görüşme") totals.outcome["Düzenli Görüşme"] += 1;
    });
    return totals;
  }, [applicationRecordsWithOverrides]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-14">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-600" />
        <span className="ml-3 text-slate-600">Başvurular yükleniyor...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 p-6 text-white shadow-xl">
        <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,transparent,rgba(255,255,255,0.5))]" />
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-blue-400/20 blur-3xl animate-float-slow" />
        <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-indigo-400/20 blur-3xl animate-float-reverse" />
        <div className="relative z-10">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm shadow-lg">
              <MessageSquare className="h-8 w-8 text-blue-700" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">Başvurular Takibi</h1>
              <p className="text-white/80 mt-1">Tüm başvuru kaynaklarından gelen öğrenci başvurularını takip edin ve yönetin</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-4">
            <div className="flex items-center gap-2 rounded-lg bg-white/10 backdrop-blur-sm px-3 py-2 border border-white/10">
              <p className="text-[10px] text-blue-200 uppercase tracking-wider">Toplam</p>
              <p className="text-lg font-bold leading-none">{applicationRecords.length}</p>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-indigo-500/30 backdrop-blur-sm px-3 py-2 border border-indigo-400/30">
              <p className="text-[10px] text-indigo-200 uppercase tracking-wider">Görüşüldü</p>
              <p className="text-lg font-bold leading-none">{applicationStatistics.status["Görüşüldü"]}</p>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-violet-500/30 backdrop-blur-sm px-3 py-2 border border-violet-400/30">
              <p className="text-[10px] text-violet-200 uppercase tracking-wider">Randevu</p>
              <p className="text-lg font-bold leading-none">{applicationStatistics.status["Randevu verildi"]}</p>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-cyan-500/30 backdrop-blur-sm px-3 py-2 border border-cyan-400/30">
              <p className="text-[10px] text-cyan-200 uppercase tracking-wider">Bekliyor</p>
              <p className="text-lg font-bold leading-none">{applicationStatistics.status["Bekliyor"]}</p>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-emerald-500/30 backdrop-blur-sm px-3 py-2 border border-emerald-400/30">
              <p className="text-[10px] text-emerald-200 uppercase tracking-wider">Tamamlandı</p>
              <p className="text-lg font-bold leading-none">{applicationStatistics.outcome["Tamamlandı"]}</p>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-sky-500/30 backdrop-blur-sm px-3 py-2 border border-sky-400/30">
              <p className="text-[10px] text-sky-200 uppercase tracking-wider">Aktif Takip</p>
              <p className="text-lg font-bold leading-none">{applicationStatistics.outcome["Aktif Takip"]}</p>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-purple-500/30 backdrop-blur-sm px-3 py-2 border border-purple-400/30">
              <p className="text-[10px] text-purple-200 uppercase tracking-wider">Düzenli Görüşme</p>
              <p className="text-lg font-bold leading-none">{applicationStatistics.outcome["Düzenli Görüşme"]}</p>
            </div>
          </div>
        </div>
      </div>

      <Card className="rounded-2xl border border-slate-200 bg-white shadow-lg overflow-hidden">
        <CardHeader className="border-b bg-gradient-to-r from-purple-50 to-pink-50 p-4">
          <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg shadow-lg">
              <MessageSquare className="h-5 w-5 text-white" />
            </div>
            Başvurular Listesi
            <Badge className="bg-gradient-to-r from-purple-500 to-pink-600 text-white border-0 shadow-sm">
              {filteredApplications.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700 flex items-center gap-2"><Search className="h-4 w-4 text-purple-500" />Öğrenci Ara</Label>
              <Input value={applicationsSearchQuery} onChange={(e) => setApplicationsSearchQuery(e.target.value)} placeholder="Ad soyad ara..." className="border-purple-200 focus:border-purple-400" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700 flex items-center gap-2"><Filter className="h-4 w-4 text-blue-500" />Sınıf</Label>
              <select value={applicationsClassFilter} onChange={(e) => setApplicationsClassFilter(e.target.value)} className="w-full rounded-lg border border-blue-200 px-3 py-2 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20">
                <option value="">Tümü</option>
                {applicationClassOptions.map((cls) => <option key={cls.value} value={cls.value}>{cls.label}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700 flex items-center gap-2"><MessageSquare className="h-4 w-4 text-emerald-500" />Geliş Türü</Label>
              <select value={applicationsSourceFilter} onChange={(e) => setApplicationsSourceFilter(e.target.value as any)} className="w-full rounded-lg border border-emerald-200 px-3 py-2 text-sm focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20">
                <option value="all">Tümü</option>
                <option value="Veli Talepleri">Veli Talepleri</option>
                <option value="Öğretmen Yönlendirmeleri">Öğretmen Yönlendirmeleri</option>
                <option value="Öğrenci Bildirimleri">Öğrenci Bildirimleri</option>
                <option value="Gözlem Havuzu">Gözlem Havuzu</option>
                <option value="Bireysel Başvuru">Bireysel Başvuru</option>
              </select>
            </div>
            {isReferralActive && (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700 flex items-center gap-2"><User className="h-4 w-4 text-amber-500" />Yönlendiren</Label>
                <select value={applicationsReferrerFilter} onChange={(e) => setApplicationsReferrerFilter(e.target.value)} className="w-full rounded-lg border border-amber-200 px-3 py-2 text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20">
                  <option value="">Tümü</option>
                  {applicationReferrerOptions.map((ref) => <option key={ref} value={ref}>{ref}</option>)}
                </select>
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700 flex items-center gap-2"><Loader2 className="h-4 w-4 text-rose-500" />Durum</Label>
              <select value={applicationsStatusFilter} onChange={(e) => setApplicationsStatusFilter(e.target.value as any)} className="w-full rounded-lg border border-rose-200 px-3 py-2 text-sm focus:border-rose-400 focus:ring-2 focus:ring-rose-400/20">
                <option value="all">Tümü</option>
                <option value="Görüşüldü">Görüşüldü</option>
                <option value="Randevu verildi">Randevu verildi</option>
                <option value="Bekliyor">Bekliyor</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700 flex items-center gap-2"><Filter className="h-4 w-4 text-violet-500" />Görüşme Sonucu</Label>
              <select value={applicationsOutcomeFilter} onChange={(e) => setApplicationsOutcomeFilter(e.target.value as any)} className="w-full rounded-lg border border-violet-200 px-3 py-2 text-sm focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20">
                <option value="all">Tümü</option>
                <option value="Tamamlandı">Tamamlandı</option>
                <option value="Aktif Takip">Aktif Takip</option>
                <option value="Düzenli Görüşme">Düzenli Görüşme</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto bg-white rounded-xl border border-slate-200 shadow-sm">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-gradient-to-r from-purple-50 to-pink-50">
                <tr className="border-b border-slate-200 text-slate-700">
                  <th className="px-4 py-3 font-semibold">Ad Soyad</th>
                  <th className="px-4 py-3 font-semibold">Sınıf</th>
                  <th className="px-4 py-3 font-semibold">Geliş Türü</th>
                  {isReferralActive && <th className="px-4 py-3 font-semibold">Yönlendiren</th>}
                  <th className="px-4 py-3 font-semibold">Tarih</th>
                  <th className="px-4 py-3 font-semibold">Durum</th>
                  <th className="px-4 py-3 font-semibold">Görüşme Sonucu</th>
                  <th className="px-4 py-3 font-semibold">İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {filteredApplications.length === 0 ? (
                  <tr>
                    <td colSpan={isReferralActive ? 8 : 7} className="p-8 text-center text-slate-500">
                      <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30 text-purple-300" />
                      <p>Kayıt bulunamadı.</p>
                    </td>
                  </tr>
                ) : (
                  filteredApplications.map((item) => (
                    <tr key={item.id} className="group/row border-b border-slate-100 hover:bg-gradient-to-r hover:from-purple-50/50 hover:to-pink-50/50 transition-all duration-200">
                      <td className="px-4 py-3 font-medium text-slate-800 group-hover/row:text-purple-700 transition-colors">{item.student_name}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">{item.class_display || "-"}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">{item.source}</span>
                      </td>
                      {isReferralActive && <td className="px-4 py-3 text-slate-600">{item.referrer || "-"}</td>}
                      <td className="px-4 py-3 text-slate-600 text-sm">
                        {new Date(item.date).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-4 py-3">
                        {item.status === "Bekliyor" ? (
                          <Button
                            type="button"
                            onClick={() => updateApplicationStatusOverride(item.id, "Görüşüldü")}
                            className="inline-flex h-auto items-center rounded-full bg-gradient-to-r from-amber-500 to-orange-600 px-3 py-1 text-xs font-semibold text-white shadow-sm transition-all hover:from-emerald-500 hover:to-green-600 hover:shadow-md"
                          >
                            <span className="group-hover/row:hidden">Bekliyor</span>
                            <span className="hidden group-hover/row:inline">Görüşüldü yap</span>
                          </Button>
                        ) : (
                          <Badge className={item.status === "Görüşüldü" ? "bg-gradient-to-r from-emerald-500 to-green-600 text-white border-0 shadow-sm" : "bg-gradient-to-r from-blue-500 to-cyan-600 text-white border-0 shadow-sm"}>
                            {item.status}
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {item.outcome_label ? (
                          <Badge className={
                            item.outcome_label === "Tamamlandı" ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
                            item.outcome_label === "Aktif Takip" ? "bg-cyan-100 text-cyan-700 border-cyan-200" :
                            "bg-violet-100 text-violet-700 border-violet-200"
                          }>
                            {item.outcome_label}
                          </Badge>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Button onClick={() => handleDeleteApplication(item)} disabled={deletingId === item.id} variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50">
                          {deletingId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
