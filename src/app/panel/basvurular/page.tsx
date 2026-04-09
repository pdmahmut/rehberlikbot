"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { MessageSquare, Search, Loader2, Filter, User, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppointmentOutcomeModal, type AppointmentOutcomeChoice } from "@/components/AppointmentOutcomeModal";
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
  matched_appointment_id?: string | null;
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
  (value || "").toLocaleLowerCase("tr-TR").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ").replace(/[\/\-_.()]/g, "").trim();

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

const findMatchedAppointment = (
  attendedAppointments: any[],
  studentName?: string | null,
  classDisplay?: string | null,
  classKey?: string | null
): any | null => {
  return attendedAppointments.find((apt) =>
    matchesAppointment(apt, studentName, classDisplay, classKey)
  ) || null;
};

export default function BasvurularPage() {
  const [applicationsSearchQuery, setApplicationsSearchQuery] = useState("");
  const [applicationsClassFilter, setApplicationsClassFilter] = useState("");
  const [applicationsSourceFilter, setApplicationsSourceFilter] = useState<"all" | ApplicationRecord["source"]>("all");
  const [applicationsReferrerFilter, setApplicationsReferrerFilter] = useState("");
  const [applicationsStatusFilter, setApplicationsStatusFilter] = useState<"all" | ApplicationStatus>("all");
  const [applicationsOutcomeFilter, setApplicationsOutcomeFilter] = useState<"all" | "Tamamlandı" | "Aktif Takip" | "Düzenli Görüşme">("all");

  const [loading, setLoading] = useState(true);
  const [savingOutcome, setSavingOutcome] = useState(false);
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

  // Modal state — tıklanan başvuru kaydı
  const [outcomeModalRecord, setOutcomeModalRecord] = useState<ApplicationRecord | null>(null);

  // Görüşüldü badge tıklandı → modal aç
  const handleOpenOutcomeModal = (record: ApplicationRecord) => {
    setOutcomeModalRecord(record);
  };

  // Modal seçimi → outcome_decision kaydet
  const handleOutcomeSelect = async (choice: Exclude<AppointmentOutcomeChoice, "cancel">) => {
    if (!outcomeModalRecord) return;
    setSavingOutcome(true);

    const choiceMap: Record<typeof choice, { outcome_decision: string[]; source_application_status: string }> = {
      completed: { outcome_decision: ["Tamamlandı"], source_application_status: "completed" },
      active_follow: { outcome_decision: ["Aktif Takip"], source_application_status: "active_follow" },
      regular_meeting: { outcome_decision: ["Düzenli Görüşme"], source_application_status: "regular_meeting" }
    };

    const messages: Record<typeof choice, string> = {
      completed: "Tamamlandı olarak işaretlendi",
      active_follow: "Aktif Takip olarak işaretlendi",
      regular_meeting: "Düzenli Görüşme olarak işaretlendi"
    };

    try {
      const matched = findMatchedAppointment(
        attendedAppointments,
        outcomeModalRecord.student_name,
        outcomeModalRecord.class_display,
        outcomeModalRecord.class_key
      );

      let appointmentId = matched?.id || null;

      // Eğer attended randevu yoksa → minimal randevu oluştur
      if (!appointmentId) {
        const today = new Date().toISOString().slice(0, 10);
        const res = await fetch("/api/appointments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            appointment_date: today,
            start_time: "1",
            participant_type: "student",
            participant_name: outcomeModalRecord.student_name,
            participant_class: outcomeModalRecord.class_display || outcomeModalRecord.class_key || "",
            status: "attended",
            purpose: outcomeModalRecord.note || "Geçmiş görüşme kaydı",
            ...choiceMap[choice]
          })
        });

        if (!res.ok) {
          // POST çakışma hatası olabilir (dolu slot vs.) — doğrudan Supabase'e yaz
          const { data, error } = await supabase
            .from("appointments")
            .insert({
              appointment_date: today,
              start_time: "retro",
              participant_type: "student",
              participant_name: outcomeModalRecord.student_name,
              participant_class: outcomeModalRecord.class_display || outcomeModalRecord.class_key || "",
              status: "attended",
              purpose: outcomeModalRecord.note || "Geçmiş görüşme kaydı",
              outcome_decision: choiceMap[choice].outcome_decision
            })
            .select()
            .single();
          if (error) throw error;
          appointmentId = data?.id;
        } else {
          const data = await res.json();
          appointmentId = data?.appointment?.id;
          // status'ü attended olarak güncelle
          if (appointmentId) {
            await supabase.from("appointments").update({
              status: "attended",
              outcome_decision: choiceMap[choice].outcome_decision
            }).eq("id", appointmentId);
          }
        }
      } else {
        // Mevcut randevuya outcome_decision yaz
        const res = await fetch("/api/appointments", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: appointmentId,
            status: "attended",
            ...choiceMap[choice]
          })
        });
        if (!res.ok) throw new Error("Randevu güncellenemedi");
      }

      toast.success(messages[choice]);
      setOutcomeModalRecord(null);
      await loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "İşlem başarısız";
      toast.error(message);
    } finally {
      setSavingOutcome(false);
    }
  };

  const handleDeleteApplication = async (application: ApplicationRecord) => {
    if (!confirm(`${application.student_name} adlı öğrencinin ${application.source} başvurusunu silmek istediğinizden emin misiniz?`)) return;
    setDeletingId(application.id);
    try {
      const dashIndex = application.id.indexOf('-');
      const type = application.id.slice(0, dashIndex);
      const id = application.id.slice(dashIndex + 1);
      let endpoint = '';
      switch (type) {
        case 'incident': endpoint = '/api/student-incidents'; break;
        case 'referral': endpoint = '/api/referrals'; break;
        case 'observation': endpoint = '/api/gozlem-havuzu'; break;
        case 'request': endpoint = '/api/parent-meeting-requests'; break;
        case 'individual': endpoint = '/api/individual-requests'; break;
        default: throw new Error('Geçersiz başvuru türü');
      }
      const isObservation = type === 'observation';
      const body = isObservation ? { id, action: "status", status: "completed" } : null;
      const response = isObservation
        ? await fetch(endpoint, { method: 'PUT', headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        : await fetch(`${endpoint}?id=${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error("İşlem başarısız");
      toast.success(isObservation ? 'Gözlem kaydı arşivlendi' : 'Başvuru başarıyla silindi');
      await loadData();
    } catch {
      toast.error('Başvuru silinirken hata oluştu');
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
        fetch("/api/gozlem-havuzu?status=pending"),
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

    const buildRecord = (
      id: string,
      student_name: string,
      class_display: string | null | undefined,
      class_key: string | null | undefined,
      source: ApplicationRecord["source"],
      referrer: string | undefined,
      date: string,
      note: string | null | undefined
    ): ApplicationRecord => {
      const isScheduled = scheduledAppointments.some((apt) => matchesAppointment(apt, student_name, class_display, class_key));
      const matchedApt = findMatchedAppointment(attendedAppointments, student_name, class_display, class_key);
      const isAttended = !!matchedApt;
      const outcomeLabel = isAttended ? getOutcomeLabel(matchedApt?.outcome_decision) : null;
      return {
        id,
        student_name,
        class_display,
        class_key,
        source,
        referrer,
        date,
        status: isAttended ? "Görüşüldü" : isScheduled ? "Randevu verildi" : "Bekliyor",
        outcome_label: outcomeLabel,
        matched_appointment_id: matchedApt?.id || null,
        note
      };
    };

    incidents.forEach((i) => records.push(buildRecord(
      `incident-${i.id}`, i.target_student_name, i.target_class_display, i.target_class_key,
      "Öğrenci Bildirimleri",
      i.record_role === "linked_reporter" ? i.reporter_student_name || undefined : undefined,
      i.created_at || i.incident_date || new Date().toISOString(), i.description
    )));

    referrals.forEach((r) => records.push(buildRecord(
      `referral-${r.id}`, r.student_name, r.class_display, r.class_key,
      "Öğretmen Yönlendirmeleri", r.teacher_name,
      r.created_at || new Date().toISOString(), r.note || r.reason
    )));

    observations.forEach((o) => records.push(buildRecord(
      `observation-${o.id}`, o.student_name, o.class_display, o.class_key,
      "Gözlem Havuzu", "",
      o.created_at || new Date().toISOString(), o.note
    )));

    requests.forEach((r) => records.push(buildRecord(
      `request-${r.id}`, r.student_name, r.class_display, r.class_key,
      "Veli Talepleri", r.parent_name || undefined,
      r.created_at || new Date().toISOString(), r.detail || r.subject
    )));

    individualRequests.forEach((r) => records.push(buildRecord(
      `individual-${r.id}`, r.student_name, r.class_display, r.class_key,
      "Bireysel Başvuru", undefined,
      r.created_at || new Date().toISOString(), r.note
    )));

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

  // Modal için fake appointment nesnesi (sadece UI için)
  const fakeAppointmentForModal = outcomeModalRecord ? {
    id: outcomeModalRecord.matched_appointment_id || "new",
    participant_name: outcomeModalRecord.student_name,
    participant_class: outcomeModalRecord.class_display || outcomeModalRecord.class_key || "",
    participant_type: "student",
    start_time: "—",
    appointment_date: new Date().toISOString().slice(0, 10),
    status: "attended",
    outcome_decision: [],
    outcome_summary: null,
    next_action: null,
    location: null,
    purpose: null,
    preparation_note: null,
    topic_tags: [],
    priority: "normal",
    created_at: new Date().toISOString()
  } as any : null;

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
      {/* Başlık */}
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
            {[
              { label: "Toplam", value: applicationRecords.length, cls: "bg-white/10 border-white/10" },
              { label: "Görüşüldü", value: applicationStatistics.status["Görüşüldü"], cls: "bg-indigo-500/30 border-indigo-400/30" },
              { label: "Randevu", value: applicationStatistics.status["Randevu verildi"], cls: "bg-violet-500/30 border-violet-400/30" },
              { label: "Bekliyor", value: applicationStatistics.status["Bekliyor"], cls: "bg-cyan-500/30 border-cyan-400/30" },
              { label: "Tamamlandı", value: applicationStatistics.outcome["Tamamlandı"], cls: "bg-emerald-500/30 border-emerald-400/30" },
              { label: "Aktif Takip", value: applicationStatistics.outcome["Aktif Takip"], cls: "bg-sky-500/30 border-sky-400/30" },
              { label: "Düzenli Görüşme", value: applicationStatistics.outcome["Düzenli Görüşme"], cls: "bg-purple-500/30 border-purple-400/30" },
            ].map(({ label, value, cls }) => (
              <div key={label} className={`flex items-center gap-2 rounded-lg backdrop-blur-sm px-3 py-2 border ${cls}`}>
                <p className="text-[10px] text-white/70 uppercase tracking-wider">{label}</p>
                <p className="text-lg font-bold leading-none">{value}</p>
              </div>
            ))}
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
          {/* Filtreler */}
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

          {/* Tablo */}
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
                        ) : item.status === "Görüşüldü" && !item.outcome_label ? (
                          // Görüşüldü ama henüz sonuç seçilmemiş → tıklanabilir badge
                          <button
                            type="button"
                            onClick={() => handleOpenOutcomeModal(item)}
                            className="inline-flex h-auto items-center rounded-full bg-gradient-to-r from-emerald-500 to-green-600 px-3 py-1 text-xs font-semibold text-white shadow-sm transition-all hover:from-emerald-600 hover:to-green-700 hover:shadow-md cursor-pointer"
                            title="Görüşme sonucunu belirle"
                          >
                            Görüşüldü ▾
                          </button>
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

      {/* Görüşme Sonucu Modalı */}
      <AppointmentOutcomeModal
        open={!!outcomeModalRecord}
        appointment={fakeAppointmentForModal}
        loading={savingOutcome}
        onClose={() => setOutcomeModalRecord(null)}
        onSelect={handleOutcomeSelect}
      />
    </div>
  );
}
