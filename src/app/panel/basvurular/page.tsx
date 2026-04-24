"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { MessageSquare, Search, Loader2, Filter, User, Trash2, Plus, X, ChevronDown } from "lucide-react";
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
  last_activity_at?: string | null;
};

type ApplicationStatus = ApplicationRecord["status"];
type ApplicationStatusOverrideEntry = {
  status: ApplicationStatus;
  acted_at: string;
};

type ApplicationStatusOverrides = Record<string, ApplicationStatusOverrideEntry>;

const APPLICATION_STATUS_OVERRIDES_KEY = "application-status-overrides";

const loadApplicationStatusOverrides = (): ApplicationStatusOverrides => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(APPLICATION_STATUS_OVERRIDES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.entries(parsed as Record<string, unknown>).reduce<ApplicationStatusOverrides>((acc, [id, value]) => {
      if (value === "Görüşüldü" || value === "Randevu verildi" || value === "Bekliyor") {
        acc[id] = { status: value, acted_at: "" };
        return acc;
      }
      if (value && typeof value === "object" && !Array.isArray(value)) {
        const entry = value as Record<string, unknown>;
        if (entry.status === "Görüşüldü" || entry.status === "Randevu verildi" || entry.status === "Bekliyor") {
          acc[id] = {
            status: entry.status as ApplicationStatus,
            acted_at: typeof entry.acted_at === "string" ? entry.acted_at : ""
          };
        }
      }
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

const formatClassDisplay = (classDisplay?: string | null): string => {
  if (!classDisplay) return "-";
  // "6. Sınıf / C Şubesi" -> "6/C"
  const match = classDisplay.match(/(\d+)\. Sınıf \/ ([A-ZÇĞİÖŞÜ]) Şubesi/);
  if (match) {
    return `${match[1]}/${match[2]}`;
  }
  return classDisplay;
};

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
    if (n.includes("aktif takip") || n.includes("duzenli gorusme")) return "Aktif Takip";
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

const getLatestTimestamp = (...values: Array<string | null | undefined>) => {
  const validValues = values
    .filter((value): value is string => Boolean(value))
    .map((value) => ({ raw: value, time: new Date(value).getTime() }))
    .filter((item) => Number.isFinite(item.time))
    .sort((a, b) => b.time - a.time);

  return validValues[0]?.raw || null;
};

const extractTopicFromNote = (note?: string | null) => {
  if (!note) return { topic: "", note: "" };
  const trimmed = note.trim();
  const match = trimmed.match(/^\[(.+?)\]\s*([\s\S]*)$/);
  if (!match) return { topic: "", note: trimmed };
  return {
    topic: match[1]?.trim() || "",
    note: match[2]?.trim() || ""
  };
};

export default function BasvurularPage() {
  const [applicationsSearchQuery, setApplicationsSearchQuery] = useState("");
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [entryFormSource, setEntryFormSource] = useState<ApplicationRecord["source"]>("Gözlem Havuzu");
  const [entryForm, setEntryForm] = useState({
    student_name: "",
    class_display: "",
    class_key: "",
    referrer: "",
    note: "",
    topic: "",
    date: new Date().toISOString().slice(0, 10)
  });
  const [entryFormSaving, setEntryFormSaving] = useState(false);
  const [studentSearchQuery, setStudentSearchQuery] = useState("");
  const [studentSearchResults, setStudentSearchResults] = useState<{ student_name: string; class_display: string; class_key: string }[]>([]);
  const [studentSearchLoading, setStudentSearchLoading] = useState(false);
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);
  const [applicationsClassFilter, setApplicationsClassFilter] = useState("");
  const [applicationsSourceFilter, setApplicationsSourceFilter] = useState<"all" | ApplicationRecord["source"]>("all");
  const [applicationsReferrerFilter, setApplicationsReferrerFilter] = useState("");
  const [applicationsStatusFilter, setApplicationsStatusFilter] = useState<"all" | ApplicationStatus>("all");
  const [applicationsOutcomeFilter, setApplicationsOutcomeFilter] = useState<"all" | "Tamamlandı" | "Aktif Takip">("all");

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
  const [statusChoiceRecord, setStatusChoiceRecord] = useState<ApplicationRecord | null>(null);

  // Görüşüldü badge tıklandı → modal aç
  const handleOpenOutcomeModal = (record: ApplicationRecord) => {
    setOutcomeModalRecord(record);
  };

  // Başvuruyu Randevuya Dönüştür - Takvim sayfasına yönlendir
  const handleOpenAppointmentForm = (record: ApplicationRecord) => {
    const parsedNote = extractTopicFromNote(record.note);
    const params = new URLSearchParams();
    params.set("studentName", record.student_name);
    if (record.class_display) params.set("classDisplay", record.class_display);
    if (record.class_key) params.set("classKey", record.class_key);
    params.set("sourceId", record.id);
    params.set("sourceType", record.source);
    if (parsedNote.topic) params.set("purpose", parsedNote.topic);
    if (parsedNote.note) params.set("preparationNote", parsedNote.note);
    window.location.href = `/panel/takvim?${params.toString()}`;
  };

  // Modal seçimi → outcome_decision kaydet
  const handleOutcomeSelect = async (choice: Exclude<AppointmentOutcomeChoice, "cancel">) => {
    if (!outcomeModalRecord) return;
    setSavingOutcome(true);

    const choiceMap: Record<typeof choice, { outcome_decision: string[]; source_application_status: string }> = {
      completed: { outcome_decision: ["Tamamlandı"], source_application_status: "completed" },
      active_follow: { outcome_decision: ["Aktif Takip"], source_application_status: "active_follow" }
    };

    const messages: Record<typeof choice, string> = {
      completed: "Tamamlandı olarak işaretlendi",
      active_follow: "Aktif Takip olarak işaretlendi"
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
      if (type === 'observation') {
        const { error } = await supabase.from("observation_pool").delete().eq("id", id);
        if (error) throw new Error(error.message);
        toast.success('Gözlem kaydı silindi');
      } else {
        const response = await fetch(`${endpoint}?id=${id}`, { method: 'DELETE' });
        if (!response.ok) throw new Error("İşlem başarısız");
        toast.success('Başvuru başarıyla silindi');
      }
      await loadData();
    } catch {
      toast.error('Başvuru silinirken hata oluştu');
    } finally {
      setDeletingId(null);
    }
  };

  const searchStudents = async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setStudentSearchResults([]);
      setShowStudentDropdown(false);
      return;
    }
    setStudentSearchLoading(true);
    try {
      const res = await fetch(`/api/students?query=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setStudentSearchResults(Array.isArray(data) ? data.slice(0, 10).map((s: any) => ({
        student_name: s.text || s.student_name,
        class_display: s.class_display || "",
        class_key: s.class_key || ""
      })) : []);
      setShowStudentDropdown(true);
    } catch {
      setStudentSearchResults([]);
    } finally {
      setStudentSearchLoading(false);
    }
  };

  const selectStudent = (student: { student_name: string; class_display: string; class_key: string }) => {
    setStudentSearchQuery(student.student_name);
    setEntryForm(f => ({ ...f, student_name: student.student_name, class_display: student.class_display, class_key: student.class_key }));
    setShowStudentDropdown(false);
  };

  const openEntryForm = (source: ApplicationRecord["source"]) => {
    setEntryFormSource(source);
    setEntryForm({ student_name: "", class_display: "", class_key: "", referrer: "", note: "", topic: "", date: new Date().toISOString().slice(0, 10) });
    setShowEntryForm(true);
  };

  const handleSaveEntry = async () => {
    if (!entryForm.student_name.trim()) { toast.error("Öğrenci adı gerekli"); return; }
    if (!entryForm.topic) { toast.error("Konu seçimi zorunludur"); return; }
    setEntryFormSaving(true);
    try {
      const today = entryForm.date || new Date().toISOString().slice(0, 10);
      const topicNote = entryForm.topic ? `[${entryForm.topic}]${entryForm.note ? " " + entryForm.note : ""}` : entryForm.note;
      
      let response;

      if (entryFormSource === "Gözlem Havuzu") {
        response = await fetch("/api/gozlem-havuzu", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ student_name: entryForm.student_name, class_display: entryForm.class_display, class_key: entryForm.class_key, note: topicNote, observation_type: "behavior", priority: "medium", status: "pending", observed_at: today })
        });
      } else if (entryFormSource === "Bireysel Başvuru") {
        response = await fetch("/api/individual-requests", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ student_name: entryForm.student_name, class_display: entryForm.class_display, class_key: entryForm.class_key, note: topicNote, request_date: today, status: "pending" })
        });
      } else if (entryFormSource === "Veli Talepleri") {
        response = await fetch("/api/parent-meeting-requests", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ student_name: entryForm.student_name, class_display: entryForm.class_display, class_key: entryForm.class_key, parent_name: entryForm.referrer, detail: topicNote, request_date: today, status: "pending" })
        });
      } else if (entryFormSource === "Öğrenci Bildirimleri") {
        response = await fetch("/api/student-incidents", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ target_student_name: entryForm.student_name, target_class_display: entryForm.class_display, target_class_key: entryForm.class_key, reporter_student_name: entryForm.referrer, description: topicNote, incident_date: today })
        });
      }

      // API'den dönen cevabı kontrol edelim
      if (response && !response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || "API sunucusu hata döndürdü");
      }

      toast.success("Başvuru kaydedildi");
      setShowEntryForm(false);
      await loadData();
    } catch (err: any) {
      console.error("Kayıt hatası detayı:", err);
      toast.error(`Kayıt başarısız: ${err.message}`);
    } finally {
      setEntryFormSaving(false);
    }
  };

  const ENTRY_CHANNELS: { source: ApplicationRecord["source"]; label: string; icon: string; color: string; referrerLabel?: string }[] = [
    { source: "Gözlem Havuzu", label: "Gözlem Havuzu", icon: "👁", color: "bg-purple-100 text-purple-700 hover:bg-purple-200 border-purple-200" },
    { source: "Bireysel Başvuru", label: "Bireysel Başvuru", icon: "🙋", color: "bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200" },
    { source: "Veli Talepleri", label: "Veli Talebi", icon: "👨‍👩‍👧", color: "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-emerald-200", referrerLabel: "Veli Adı" },
    { source: "Öğrenci Bildirimleri", label: "Öğrenci Bildirimi", icon: "📢", color: "bg-amber-100 text-amber-700 hover:bg-amber-200 border-amber-200", referrerLabel: "Bildirimi Yapan Öğrenci" },
    { source: "Öğretmen Yönlendirmeleri", label: "Öğretmen Yönlendirmesi", icon: "👨‍🏫", color: "bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200", referrerLabel: "Öğretmen Adı" },
  ];

  const ENTRY_CHANNELS_FOR_CREATION = ENTRY_CHANNELS.filter((c) => c.source !== "Öğretmen Yönlendirmeleri");

  const loadData = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const [referralResult, observationResult, incidentResult, requestResult, attendedResult, scheduledResult, individualRequestResult] = await Promise.all([
        supabase.from("referrals").select("*").order("created_at", { ascending: false }),
        supabase.from("observation_pool").select("*").order("created_at", { ascending: false }),
        supabase.from("student_incidents").select("*").in("status", ["new", "reviewing"]).order("incident_date", { ascending: false }).order("created_at", { ascending: false }),
        supabase.from("parent_meeting_requests").select("*").order("created_at", { ascending: false }),
        supabase.from("appointments").select("*").eq("status", "attended").eq("participant_type", "student").order("appointment_date", { ascending: false }).order("created_at", { ascending: false }),
        supabase.from("appointments").select("*").neq("status", "pending").neq("status", "attended").neq("status", "cancelled").eq("participant_type", "student").order("appointment_date", { ascending: false }).order("created_at", { ascending: false }),
        supabase.from("individual_requests").select("*").order("created_at", { ascending: false })
      ]);
      if (!referralResult.error) setReferrals(referralResult.data || []);
      if (!observationResult.error) setObservations(observationResult.data || []);
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

  // Yönlendiren filtresini sıfırla eğer Öğretmen Yönlendirmeleri seçili değilse
  useEffect(() => {
    if (applicationsSourceFilter !== "Öğretmen Yönlendirmeleri") {
      setApplicationsReferrerFilter("");
    }
  }, [applicationsSourceFilter]);

  const updateApplicationStatusOverride = (id: string, nextStatus: ApplicationStatus) => {
    setStatusOverrides((prev) => {
      const next = {
        ...prev,
        [id]: {
          status: nextStatus,
          acted_at: new Date().toISOString()
        }
      };
      saveApplicationStatusOverrides(next);
      return next;
    });
  };

  const applicationRecords: ApplicationRecord[] = useMemo(() => {
    const records: ApplicationRecord[] = [];

    const buildRecord = (
      record: any,
      id: string,
      student_name: string,
      class_display: string | null | undefined,
      class_key: string | null | undefined,
      source: ApplicationRecord["source"],
      referrer: string | undefined,
      date: string,
      note: string | null | undefined
    ): ApplicationRecord => {
      const matchedApt = findMatchedAppointment(attendedAppointments, student_name, class_display, class_key);
      const matchedScheduledApt = scheduledAppointments.find((apt) => matchesAppointment(apt, student_name, class_display, class_key));
      const isAttended = !!matchedApt;
      const outcomeLabel = isAttended ? getOutcomeLabel(matchedApt?.outcome_decision) : null;
      const statusMap: Record<string, string> = {
        pending: "Bekliyor",
        scheduled: "Randevu verildi",
        completed: "Görüşüldü",
        cancelled: "İptal",
        "Bekliyor": "Bekliyor",
        "Randevu verildi": "Randevu verildi",
        "Görüşüldü": "Görüşüldü"
      };
      let status: ApplicationRecord["status"] = (statusMap[record.status] || "Bekliyor") as ApplicationRecord["status"];
      const recordDate = (record.created_at || date).slice(0, 10);
      if (matchedScheduledApt && matchedScheduledApt.appointment_date >= recordDate) {
        status = "Randevu verildi";
      } else if (matchedApt && matchedApt.appointment_date >= recordDate) {
        status = "Görüşüldü";
      }
      const lastActivityAt = getLatestTimestamp(
        record.updated_at,
        record.created_at,
        date,
        matchedScheduledApt?.updated_at,
        matchedScheduledApt?.created_at,
        matchedApt?.updated_at,
        matchedApt?.created_at
      );
      return {
        id,
        student_name,
        class_display,
        class_key,
        source,
        referrer,
        date,
        status,
        outcome_label: outcomeLabel,
        matched_appointment_id: matchedApt?.id || null,
        note,
        last_activity_at: lastActivityAt
      };
    };

    incidents.forEach((i) => records.push(buildRecord(
      i, `incident-${i.id}`, i.target_student_name, i.target_class_display, i.target_class_key,
      "Öğrenci Bildirimleri",
      i.record_role === "linked_reporter" ? i.reporter_student_name || undefined : undefined,
      i.created_at || i.incident_date || new Date().toISOString(), i.description
    )));

    observations.forEach((o) => records.push(buildRecord(
      o, `observation-${o.id}`, o.student_name, o.class_display, o.class_key,
      "Gözlem Havuzu", undefined,
      o.created_at || o.observed_at || new Date().toISOString(), o.note
    )));

    referrals.forEach((r) => records.push(buildRecord(
      r, `referral-${r.id}`, r.student_name, r.class_display, r.class_key,
      "Öğretmen Yönlendirmeleri", r.teacher_name,
      r.created_at || new Date().toISOString(), r.note || r.reason
    )));

    requests.forEach((r) => records.push(buildRecord(
      r, `request-${r.id}`, r.student_name, r.class_display, r.class_key,
      "Veli Talepleri", r.parent_name || undefined,
      r.created_at || new Date().toISOString(), r.detail || r.subject
    )));

    individualRequests.forEach((r) => records.push(buildRecord(
      r, `individual-${r.id}`, r.student_name, r.class_display, r.class_key,
      "Bireysel Başvuru", undefined,
      r.created_at || new Date().toISOString(), r.note
    )));

    return records
      .filter((r) => r.student_name)
      .sort((a, b) => new Date(b.last_activity_at || b.date).getTime() - new Date(a.last_activity_at || a.date).getTime());
  }, [incidents, referrals, observations, requests, individualRequests, attendedAppointments, scheduledAppointments]);

  const applicationRecordsWithOverrides = useMemo(() => {
    return applicationRecords.map((record) => ({
      ...record,
      status: statusOverrides[record.id]?.status || record.status,
      last_activity_at: statusOverrides[record.id]?.acted_at?.trim() ? statusOverrides[record.id].acted_at : record.last_activity_at
    }));
  }, [applicationRecords, statusOverrides]);

  const applicationReferrerOptions = useMemo(() => {
    const referrers = new Set<string>();
    applicationRecordsWithOverrides.forEach((item) => { if (item.referrer) referrers.add(item.referrer); });
    return Array.from(referrers).sort((a, b) => a.localeCompare(b, "tr-TR"));
  }, [applicationRecordsWithOverrides]);

  const filteredApplications = useMemo(() => {
    let filtered = applicationRecordsWithOverrides.filter((item) => {
      const matchesSearch = !applicationsSearchQuery || normalizeStudentName(item.student_name).includes(normalizeStudentName(applicationsSearchQuery));
      const matchesClass = !applicationsClassFilter || normalizeClassText(item.class_display) === applicationsClassFilter || normalizeClassText(item.class_key) === applicationsClassFilter;
      const matchesSource = applicationsSourceFilter === "all" || item.source === applicationsSourceFilter;
      const matchesReferrer = !applicationsReferrerFilter || (item.referrer && normalizeText(item.referrer).includes(normalizeText(applicationsReferrerFilter)));
      const matchesStatus = applicationsStatusFilter === "all" || item.status === applicationsStatusFilter;
      const matchesOutcome = applicationsOutcomeFilter === "all" || item.outcome_label === applicationsOutcomeFilter;
      return matchesSearch && matchesClass && matchesSource && matchesReferrer && matchesStatus && matchesOutcome;
    });

    filtered.sort((a, b) => {
      return new Date(b.last_activity_at || b.date).getTime() - new Date(a.last_activity_at || a.date).getTime();
    });

    return filtered;
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

  const applicationStatistics = useMemo(() => {
    const totals = {
      total: 0,
      status: { "Görüşüldü": 0, "Randevu verildi": 0, "Bekliyor": 0 },
      outcome: { "Tamamlandı": 0, "Aktif Takip": 0 }
    };
    applicationRecordsWithOverrides.forEach((item) => {
      totals.total += 1;
      totals.status[item.status] += 1;
      if (item.outcome_label === "Tamamlandı") totals.outcome["Tamamlandı"] += 1;
      else if (item.outcome_label === "Aktif Takip") totals.outcome["Aktif Takip"] += 1;
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
            ].map(({ label, value, cls }) => (
              <div key={label} className={`flex items-center gap-2 rounded-lg backdrop-blur-sm px-3 py-2 border ${cls}`}>
                <p className="text-[10px] text-white/70 uppercase tracking-wider">{label}</p>
                <p className="text-lg font-bold leading-none">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* GİRİŞ KANALLARI */}
      <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-slate-100 p-4">
          <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Yeni Başvuru Ekle
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-2">
            {ENTRY_CHANNELS_FOR_CREATION.map((ch) => (
              <button
                key={ch.source}
                type="button"
                onClick={() => openEntryForm(ch.source)}
                className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all ${ch.color}`}
              >
                <span>{ch.icon}</span>
                {ch.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* GİRİŞ FORMU MODALI */}
      {showEntryForm && (() => {
        const ch = ENTRY_CHANNELS.find(c => c.source === entryFormSource)!;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="flex items-start justify-between gap-3 border-b bg-slate-50 px-4 py-4 sm:px-6">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{ch.icon}</span>
                  <h2 className="text-base font-bold text-slate-800">{ch.label}</h2>
                </div>
                <button type="button" onClick={() => setShowEntryForm(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-4 px-4 py-5 sm:px-6">
                {/* Geliş Türü */}
                <div>
                  <Label className="text-xs font-medium text-slate-600 mb-1 block">Geliş Türü</Label>
                  <select
                    value={entryFormSource}
                    onChange={(e) => setEntryFormSource(e.target.value as ApplicationRecord["source"])}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
                  >
                    {ENTRY_CHANNELS_FOR_CREATION.map(c => <option key={c.source} value={c.source}>{c.icon} {c.label}</option>)}
                  </select>
                </div>
                {/* Öğrenci Adı - Autocomplete */}
                <div className="relative">
                  <Label className="text-xs font-medium text-slate-600 mb-1 block">Öğrenci Adı *</Label>
                  <div className="relative">
                    <Input
                      value={studentSearchQuery}
                      onChange={(e) => {
                        setStudentSearchQuery(e.target.value);
                        setEntryForm(f => ({ ...f, student_name: e.target.value, class_display: "", class_key: "" }));
                        searchStudents(e.target.value);
                      }}
                      onFocus={() => studentSearchResults.length > 0 && setShowStudentDropdown(true)}
                      placeholder="Öğrenci adı yaz..."
                      autoComplete="off"
                    />
                    {studentSearchLoading && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-slate-400" />
                    )}
                  </div>
                  {showStudentDropdown && studentSearchResults.length > 0 && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                      {studentSearchResults.map((s, i) => (
                        <button
                          key={i}
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); selectStudent(s); }}
                          className="w-full text-left px-4 py-2.5 hover:bg-blue-50 transition-colors flex items-center justify-between gap-2"
                        >
                          <span className="text-sm font-medium text-slate-800">{s.student_name}</span>
                          <span className="text-xs text-slate-500 shrink-0">{s.class_display}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {/* Sınıf (otomatik) + Tarih */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label className="text-xs font-medium text-slate-600 mb-1 block">Sınıf</Label>
                    <Input
                      value={entryForm.class_display}
                      onChange={(e) => setEntryForm(f => ({ ...f, class_display: e.target.value }))}
                      placeholder="Otomatik gelir"
                      className="bg-slate-50"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-slate-600 mb-1 block">Tarih</Label>
                    <Input type="date" value={entryForm.date} onChange={(e) => setEntryForm(f => ({ ...f, date: e.target.value }))} />
                  </div>
                </div>
                {/* Yönlendiren (varsa) */}
                {ch.referrerLabel && (
                  <div>
                    <Label className="text-xs font-medium text-slate-600 mb-1 block">{ch.referrerLabel}</Label>
                    <Input value={entryForm.referrer} onChange={(e) => setEntryForm(f => ({ ...f, referrer: e.target.value }))} placeholder={ch.referrerLabel + "..."} />
                  </div>
                )}
                {/* Konu */}
                <div>
                  <Label className="text-xs font-medium text-slate-600 mb-1 block">Konu <span className="text-red-500">*</span></Label>
                  <select
                    value={entryForm.topic}
                    onChange={(e) => setEntryForm(f => ({ ...f, topic: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 bg-white"
                  >
                    <option value="">-- Konu seçin --</option>
                    <option value="Akademik Sorunlar">Akademik Sorunlar</option>
                    <option value="Davranış Problemleri">Davranış Problemleri</option>
                    <option value="Akran İlişkileri ve Sosyal Problemler">Akran İlişkileri ve Sosyal Problemler</option>
                    <option value="Duygusal Problemler">Duygusal Problemler</option>
                    <option value="Ailevi Sorunlar">Ailevi Sorunlar</option>
                    <option value="Devamsızlık ve Okula Uyum Problemleri">Devamsızlık ve Okula Uyum Problemleri</option>
                    <option value="Riskli Durumlar">Riskli Durumlar</option>
                    <option value="Kimlik ve Gelişimsel Süreçler">Kimlik ve Gelişimsel Süreçler</option>
                  </select>
                </div>
                {/* Not */}
                <div>
                  <Label className="text-xs font-medium text-slate-600 mb-1 block">Not / Açıklama</Label>
                  <textarea
                    value={entryForm.note}
                    onChange={(e) => setEntryForm(f => ({ ...f, note: e.target.value }))}
                    placeholder="Açıklama..."
                    rows={3}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 resize-none"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-3 border-t bg-slate-50 px-4 py-4 sm:flex-row sm:justify-end sm:px-6">
                <Button variant="outline" onClick={() => setShowEntryForm(false)} disabled={entryFormSaving}>İptal</Button>
                <Button onClick={handleSaveEntry} disabled={entryFormSaving} className="bg-blue-600 hover:bg-blue-700">
                  {entryFormSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                  Kaydet
                </Button>
              </div>
            </div>
          </div>
        );
      })()}

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
        <CardContent className="space-y-6 p-4 sm:p-6">
          {/* Filtreler */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
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
              </select>
            </div>            {applicationsSourceFilter === "Öğretmen Yönlendirmeleri" && <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700 flex items-center gap-2"><User className="h-4 w-4 text-amber-500" />Yönlendiren</Label>
              <select value={applicationsReferrerFilter} onChange={(e) => setApplicationsReferrerFilter(e.target.value)} className="w-full rounded-lg border border-amber-200 px-3 py-2 text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20">
                <option value="">Tümü</option>
                {applicationReferrerOptions.map((ref) => <option key={ref} value={ref}>{ref}</option>)}
              </select>
            </div>}          </div>

          {/* Tablo */}
          <div className="responsive-scroll overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-gradient-to-r from-purple-50 to-pink-50">
                <tr className="border-b border-slate-200 text-slate-700">
                  <th className="px-4 py-3 font-semibold">Tarih</th>
                  <th className="px-4 py-3 font-semibold">Ad Soyad</th>
                  <th className="px-4 py-3 font-semibold">Sınıf</th>
                  <th className="px-4 py-3 font-semibold">Geliş Türü</th>
                  {applicationsSourceFilter === "Öğretmen Yönlendirmeleri" && <th className="px-4 py-3 font-semibold">Yönlendiren</th>}
                  <th className="px-4 py-3 font-semibold">Durum</th>
                  <th className="px-4 py-3 font-semibold">Görüşme Sonucu</th>
                  <th className="px-4 py-3 font-semibold">İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {filteredApplications.length === 0 ? (
                  <tr>
                    <td colSpan={applicationsSourceFilter === "Öğretmen Yönlendirmeleri" ? 8 : 7} className="p-8 text-center text-slate-500">
                      <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30 text-purple-300" />
                      <p>Kayıt bulunamadı.</p>
                    </td>
                  </tr>
                ) : (
                  filteredApplications.map((item) => (
                    <tr key={item.id} className="group/row border-b border-slate-100 hover:bg-gradient-to-r hover:from-purple-50/50 hover:to-pink-50/50 transition-all duration-200">
                      <td className="px-4 py-3 text-slate-600 text-sm">
                        {new Date(item.last_activity_at || item.date).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800 group-hover/row:text-purple-700 transition-colors">{item.student_name}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">{formatClassDisplay(item.class_display)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">{item.source}</span>
                      </td>
                      {applicationsSourceFilter === "Öğretmen Yönlendirmeleri" && <td className="px-4 py-3 text-slate-600">{item.referrer || "-"}</td>}
                      <td className="px-4 py-3">
                        {item.status === "Bekliyor" ? (
                          <button
                            type="button"
                            onClick={() => setStatusChoiceRecord(item)}
                            className="inline-flex h-auto items-center rounded-full bg-gradient-to-r from-amber-500 to-orange-600 px-3 py-1 text-xs font-semibold text-white shadow-sm transition-all hover:from-amber-600 hover:to-orange-700 hover:shadow-md"
                          >
                            Bekliyor ▾
                          </button>
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
                        {item.outcome_label && (item.status === "Görüşüldü" || item.outcome_label === "Aktif Takip") ? (
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

      {/* Durum Seçim Modalı */}
      {statusChoiceRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b bg-slate-50 px-4 py-4 sm:px-6">
              <div>
                <h2 className="text-base font-bold text-slate-800">{statusChoiceRecord.student_name}</h2>
                <p className="text-xs text-slate-500 mt-0.5">{statusChoiceRecord.class_display || "-"} · {statusChoiceRecord.source}</p>
              </div>
              <button type="button" onClick={() => setStatusChoiceRecord(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 space-y-2">
              <button
                type="button"
                onClick={() => handleOpenAppointmentForm(statusChoiceRecord)}
                className="w-full flex items-center gap-3 rounded-xl border-2 border-blue-200 bg-blue-50 px-4 py-3 text-left text-sm font-semibold text-blue-700 hover:bg-blue-100 transition-all"
              >
                <span className="text-lg">📅</span>
                <div>
                  <div>Randevuya Dönüştür</div>
                  <div className="text-xs font-normal text-blue-500">Randevu formu aç</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setStatusChoiceRecord(null)}
                className="w-full flex items-center gap-3 rounded-xl border-2 border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm font-semibold text-amber-700 hover:bg-amber-100 transition-all"
              >
                <span className="text-lg">⏳</span>
                <div>
                  <div>Bekliyor</div>
                  <div className="text-xs font-normal text-amber-500">Durumu değiştirme</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  updateApplicationStatusOverride(statusChoiceRecord.id, "Görüşüldü");
                  setStatusChoiceRecord(null);
                  setTimeout(() => handleOpenOutcomeModal({ ...statusChoiceRecord, status: "Görüşüldü" }), 100);
                }}
                className="w-full flex items-center gap-3 rounded-xl border-2 border-emerald-200 bg-emerald-50 px-4 py-3 text-left text-sm font-semibold text-emerald-700 hover:bg-emerald-100 transition-all"
              >
                <span className="text-lg">✅</span>
                <div>
                  <div>Görüşüldü</div>
                  <div className="text-xs font-normal text-emerald-500">Tamamlandı / Aktif Takip seç</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

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
