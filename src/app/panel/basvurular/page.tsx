"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { db as supabase } from "@/lib/dbClient";
import { MessageSquare, Search, Loader2, Filter, Trash2, Plus, X, ChevronDown, Eye } from "lucide-react";
import { toast } from "sonner";
import { AppointmentOutcomeModal, type AppointmentOutcomeChoice } from "@/components/AppointmentOutcomeModal";
import {
  ReferralRecord,
  ApplicationSourceType,
  ObservationPoolRecord,
  StudentIncidentRecord,
  ParentMeetingRequestRecord,
  IndividualRequestRecord
} from "@/types";
import {
  buildSourceRecordKey,
  findAppointmentForApplicationRecord,
  getObservationProxyMeta,
  getPanelSourceLabel,
  getSourceTypeFromPanelLabel,
} from "@/lib/guidanceApplications";

type ApplicationRecord = {
  id: string;
  student_name: string;
  class_display?: string | null;
  class_key?: string | null;
  source: "Veli Talepleri" | "Öğretmen Yönlendirmeleri" | "Öğrenci Bildirimleri" | "Rehberlik İsteği" | "Bireysel Başvuru";
  source_type: ApplicationSourceType;
  source_record_id: string;
  legacy_observation_id?: string | null;
  referrer?: string;
  date: string;
  status: "Görüşüldü" | "Randevu verildi" | "Bekliyor";
  outcome_label?: string | null;
  note?: string | null;
  matched_appointment_id?: string | null;
  last_activity_at?: string | null;
  event_timestamp: string;
};

type ApplicationStatus = ApplicationRecord["status"];
// Kanal adlari kodun iki yerinde cogul ("Veli Talepleri"), bir yerinde tekil
// ("Veli Talebi") yaziliyordu. Listede tek ve kisa isim kullanilir.
// Bu sayfa bir is kuyrugu: siralama aciliyete gore yapilir.
const STATUS_RANK: Record<string, number> = {
  "Bekliyor": 0,
  "Randevu verildi": 1,
  "Görüşüldü": 2,
};

const CHANNEL_SHORT_LABELS: Record<string, string> = {
  "Öğretmen Yönlendirmeleri": "Öğretmen",
  "Veli Talepleri": "Veli",
  "Öğrenci Bildirimleri": "Öğrenci bildirimi",
  "Rehberlik İsteği": "Rehberlik",
  "Bireysel Başvuru": "Bireysel",
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

const getOutcomeLabel = (decisions: string[] | null | undefined): string | null => {
  if (!decisions || decisions.length === 0) return null;
  for (const d of decisions) {
    const n = normalizeDecisionText(d);
    if (n.includes("tamamlandi")) return "Tamamlandı";
    if (n.includes("aktif takip") || n.includes("duzenli gorusme")) return "Aktif Takip";
  }
  return null;
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
  const searchParams = useSearchParams();
  const [applicationsSearchQuery, setApplicationsSearchQuery] = useState("");
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [showNewEntryDropdown, setShowNewEntryDropdown] = useState(false);
  const [entryFormSource, setEntryFormSource] = useState<ApplicationRecord["source"]>("Rehberlik İsteği");
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

  const [showFilters, setShowFilters] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [savingOutcome, setSavingOutcome] = useState(false);
  const [attendedAppointments, setAttendedAppointments] = useState<any[]>([]);
  const [scheduledAppointments, setScheduledAppointments] = useState<any[]>([]);
  const [cancellingRecordId, setCancellingRecordId] = useState<string | null>(null);
  const [referrals, setReferrals] = useState<ReferralRecord[]>([]);
  const [observations, setObservations] = useState<ObservationPoolRecord[]>([]);
  const [incidents, setIncidents] = useState<StudentIncidentRecord[]>([]);
  const [requests, setRequests] = useState<ParentMeetingRequestRecord[]>([]);
  const [individualRequests, setIndividualRequests] = useState<IndividualRequestRecord[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Takipteki ogrencilerin sadelestirilmis adlari. Basvuru listesinde isim
  // yaninda rozet gostermek icin kullanilir.
  const [followedNames, setFollowedNames] = useState<Set<string>>(new Set());

  // Modal state — tıklanan başvuru kaydı
  const [outcomeModalRecord, setOutcomeModalRecord] = useState<ApplicationRecord | null>(null);
  const [statusChoiceRecord, setStatusChoiceRecord] = useState<ApplicationRecord | null>(null);

  // Görüşüldü badge tıklandı → modal aç
  const handleOpenOutcomeModal = (record: ApplicationRecord) => {
    setOutcomeModalRecord(record);
  };

  // Başvuruyu Randevuya Dönüştür - Takvim sayfasına yönlendir
  // "Randevu verildi" durumundaki bir başvurunun randevusunu iptal eder.
  // Randevu kaydı silinmez (durumu "cancelled" olur), ders saati serbest kalır
  // ve başvuru tekrar "Bekliyor" durumuna döner.
  const handleCancelScheduledAppointment = async (record: ApplicationRecord) => {
    const appointment = findAppointmentForApplicationRecord(scheduledAppointments, record);

    if (!appointment) {
      toast.error("Bu başvuruya bağlı randevu bulunamadı");
      return;
    }

    if (!confirm(`${record.student_name} için verilen randevu iptal edilecek ve başvuru tekrar "Bekliyor" durumuna dönecek. Onaylıyor musunuz?`)) {
      return;
    }

    setCancellingRecordId(record.id);
    try {
      const res = await fetch("/api/appointments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: appointment.id,
          status: "cancelled",
          source_application_status: "pending",
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Randevu iptal edilemedi");
      }

      toast.success("Randevu iptal edildi, başvuru tekrar bekliyor");
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Randevu iptal edilemedi");
    } finally {
      setCancellingRecordId(null);
    }
  };
  const handleOpenAppointmentForm = (record: ApplicationRecord) => {
    const parsedNote = extractTopicFromNote(record.note);
    const params = new URLSearchParams();
    params.set("studentName", record.student_name);
    if (record.class_display) params.set("classDisplay", record.class_display);
    if (record.class_key) params.set("classKey", record.class_key);
    params.set("sourceId", record.source_record_id);
    params.set("sourceType", record.source_type);
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
      const matched = findAppointmentForApplicationRecord(attendedAppointments, {
        source_type: outcomeModalRecord.source_type,
        source_record_id: outcomeModalRecord.source_record_id,
        student_name: outcomeModalRecord.student_name,
        class_display: outcomeModalRecord.class_display,
        class_key: outcomeModalRecord.class_key,
        created_at: outcomeModalRecord.event_timestamp,
      });

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
            source_application_id: outcomeModalRecord.source_record_id,
            source_application_type: outcomeModalRecord.source_type,
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
              source_application_id: outcomeModalRecord.source_record_id,
              source_application_type: outcomeModalRecord.source_type,
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

      // "Aktif Takip" seçildiğinde öğrencinin kendisi takibe alınır.
      // İşaret görüşmede değil öğrencide durduğu için, aynı öğrenciye yeni bir
      // başvuru geldiğinde takip bozulmaz.
      if (choice === "active_follow") {
        try {
          const followRes = await fetch("/api/follow-up", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              studentName: outcomeModalRecord.student_name,
              classKey: outcomeModalRecord.class_key,
              reason: outcomeModalRecord.note || outcomeModalRecord.source,
            }),
          });
          if (!followRes.ok) {
            const data = await followRes.json().catch(() => null);
            toast.warning(data?.error || "Öğrenci takip listesine eklenemedi");
          }
        } catch {
          toast.warning("Öğrenci takip listesine eklenemedi");
        }
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
      const type = application.source_type;
      const id = application.source_record_id;
      const deleteObservationId =
        application.source_type === "observation"
          ? application.source_record_id
          : application.legacy_observation_id;
      let endpoint = '';
      switch (type) {
        case 'student_report': endpoint = '/api/student-incidents'; break;
        case 'teacher_referral': endpoint = '/api/referrals'; break;
        case 'observation': endpoint = '/api/gozlem-havuzu'; break;
        case 'parent_request': endpoint = '/api/parent-meeting-requests'; break;
        case 'self_application': endpoint = '/api/individual-requests'; break;
        default: throw new Error('Geçersiz başvuru türü');
      }
      if (deleteObservationId) {
        const { error } = await supabase.from("observation_pool").delete().eq("id", deleteObservationId);
        if (error) throw new Error(error.message);
      toast.success('Rehberlik isteği kaydı silindi');
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

      if (entryFormSource === "Rehberlik İsteği") {
        response = await fetch("/api/gozlem-havuzu", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ student_name: entryForm.student_name, class_display: entryForm.class_display, class_key: entryForm.class_key, note: topicNote, observation_type: "behavior", priority: "medium", status: "pending", observed_at: today })
        });
      } else if (entryFormSource === "Bireysel Başvuru") {
        response = await fetch("/api/individual-requests", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ student_name: entryForm.student_name, class_display: entryForm.class_display, class_key: entryForm.class_key, note: topicNote, request_date: today, status: "pending" })
        });
      } else if (entryFormSource === "Veli Talepleri") {
        response = await fetch("/api/parent-meeting-requests", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ student_name: entryForm.student_name, class_display: entryForm.class_display, class_key: entryForm.class_key, parent_name: entryForm.referrer, subject: entryForm.topic, detail: topicNote, request_date: today })
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
    { source: "Rehberlik İsteği", label: "Rehberlik İsteği", icon: "👁", color: "bg-purple-100 text-purple-700 hover:bg-purple-200 border-purple-200" },
    { source: "Bireysel Başvuru", label: "Bireysel Başvuru", icon: "🙋", color: "bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200" },
    { source: "Veli Talepleri", label: "Veli Talebi", icon: "👨‍👩‍👧", color: "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-emerald-200", referrerLabel: "Veli Adı" },
    { source: "Öğrenci Bildirimleri", label: "Öğrenci Bildirimi", icon: "📢", color: "bg-amber-100 text-amber-700 hover:bg-amber-200 border-amber-200", referrerLabel: "Bildirimi Yapan Öğrenci" },
    { source: "Öğretmen Yönlendirmeleri", label: "Öğretmen Yönlendirmesi", icon: "👨‍🏫", color: "bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200", referrerLabel: "Öğretmen Adı" },
  ];

  const ENTRY_CHANNELS_FOR_CREATION = ENTRY_CHANNELS.filter((c) => c.source !== "Öğretmen Yönlendirmeleri");

  // Basvurulardaki isimler bazen "24 AZIZ CELENK" gibi numarali geliyor;
  // sinif listesindeki kayitla eslesebilmek icin numara ve buyuk/kucuk harf
  // farki temizlenir.
  const followUpKey = (value: string) =>
    String(value || "")
      .replace(/^\d+\s+/, "")
      .trim()
      .toLocaleUpperCase("tr-TR")
      .replace(/\s+/g, " ");

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

      // Takip listesi ayri bir uc noktadan gelir. Basarisiz olursa liste yine
      // acilir, sadece rozetler gorunmez.
      try {
        const followRes = await fetch("/api/follow-up");
        if (followRes.ok) {
          const followData = await followRes.json();
          setFollowedNames(
            new Set(
              (followData.students || []).map((x: { studentName: string }) =>
                followUpKey(x.studentName)
              )
            )
          );
        }
      } catch {
        // rozetler olmadan devam
      }
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
    const source = searchParams.get("source");
    const student = searchParams.get("student");
    const classDisplay = searchParams.get("class");

    if (source === "teacher_referral") {
      setApplicationsSourceFilter("Öğretmen Yönlendirmeleri");
    }

    if (student) {
      setApplicationsSearchQuery(student);
    }

    if (classDisplay) {
      setApplicationsClassFilter(classDisplay);
    }
  }, [searchParams]);

  // Yönlendiren filtresini sıfırla eğer Öğretmen Yönlendirmeleri seçili değilse
  useEffect(() => {
    if (applicationsSourceFilter !== "Öğretmen Yönlendirmeleri") {
      setApplicationsReferrerFilter("");
    }
  }, [applicationsSourceFilter]);

  const applicationRecords: ApplicationRecord[] = useMemo(() => {
    const records: ApplicationRecord[] = [];

    const buildRecord = (
      record: any,
      id: string,
      student_name: string,
      class_display: string | null | undefined,
      class_key: string | null | undefined,
      source: ApplicationRecord["source"],
      arg1?: string,
      arg2?: string,
      arg3?: string | null,
      arg4?: string,
      arg5?: string | null,
      arg6?: string | null
    ): ApplicationRecord => {
      const inferredSourceType =
        getSourceTypeFromPanelLabel(source) || "observation";
      const sourceTypeValues = ["observation", "self_application", "teacher_referral", "parent_request", "student_report"];
      const explicitSourceType = arg1 && sourceTypeValues.includes(arg1)
        ? (arg1 as ApplicationSourceType)
        : null;
      const referrerFirstSourceType = arg2 && sourceTypeValues.includes(arg2)
        ? (arg2 as ApplicationSourceType)
        : null;
      const source_type = explicitSourceType || referrerFirstSourceType || inferredSourceType;
      const source_record_id = explicitSourceType
        ? (arg2 || (id.includes("-") ? id.split("-").slice(1).join("-") : id))
        : referrerFirstSourceType
          ? (arg3 || (id.includes("-") ? id.split("-").slice(1).join("-") : id))
          : (id.includes("-") ? id.split("-").slice(1).join("-") : id);
      const referrer = explicitSourceType
        ? (arg3 || undefined)
        : referrerFirstSourceType
          ? (arg1 || undefined)
          : (arg1 || undefined);
      const date = explicitSourceType
        ? (arg4 || record.created_at || new Date().toISOString())
        : referrerFirstSourceType
          ? (arg4 || record.created_at || new Date().toISOString())
          : (arg2 || record.created_at || new Date().toISOString());
      const note = explicitSourceType ? arg5 : referrerFirstSourceType ? arg5 : arg3;
      const legacy_observation_id = explicitSourceType ? (arg6 || null) : null;
      const eventTimestamp = record.created_at || date || new Date().toISOString();
      const sharedRecord = {
        source_type,
        source_record_id,
        student_name,
        class_display,
        class_key,
        created_at: eventTimestamp,
      };
      const matchedApt = findAppointmentForApplicationRecord(attendedAppointments, sharedRecord);
      const matchedScheduledApt = findAppointmentForApplicationRecord(scheduledAppointments, sharedRecord);
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
        source_type,
        source_record_id,
        legacy_observation_id: legacy_observation_id || null,
        referrer,
        date,
        status,
        outcome_label: outcomeLabel,
        matched_appointment_id: matchedApt?.id || null,
        note,
        last_activity_at: lastActivityAt,
        event_timestamp: eventTimestamp
      };
    };

    const actualSourceKeys = new Set<string>();
    incidents.forEach((i) => {
      const key = buildSourceRecordKey("student_report", i.id);
      if (key) actualSourceKeys.add(key);
    });
    referrals.forEach((r) => {
      const key = buildSourceRecordKey("teacher_referral", r.id);
      if (key) actualSourceKeys.add(key);
    });
    requests.forEach((r) => {
      const key = buildSourceRecordKey("parent_request", r.id);
      if (key) actualSourceKeys.add(key);
    });
    individualRequests.forEach((r) => {
      const key = buildSourceRecordKey("self_application", r.id);
      if (key) actualSourceKeys.add(key);
    });

    incidents.forEach((i) => records.push(buildRecord(
      i, `incident-${i.id}`, i.target_student_name, i.target_class_display, i.target_class_key,
      "Öğrenci Bildirimleri",
      "student_report",
      i.id || "",
      i.record_role === "linked_reporter" ? i.reporter_student_name || undefined : undefined,
      i.created_at || i.incident_date || new Date().toISOString(), i.description
    )));

    observations.forEach((o) => records.push(buildRecord(
      o, `observation-${o.id}`, o.student_name, o.class_display, o.class_key,
      "Rehberlik İsteği", undefined,
      o.created_at || o.observed_at || new Date().toISOString(), o.note
    )));

    referrals.forEach((r) => records.push(buildRecord(
      r, `referral-${r.id}`, r.student_name, r.class_display, r.class_key,
      "Öğretmen Yönlendirmeleri", r.teacher_name,
      "teacher_referral",
      r.id || "",
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

    const observationById = new Map(
      observations.map((observation) => [observation.id, observation])
    );

    return records
      .flatMap((record) => {
        if (!record.id.startsWith("observation-")) {
          return [record];
        }

        const observationId = record.id.replace("observation-", "");
        const observationRecord = observationById.get(observationId);
        if (!observationRecord) {
          return [record];
        }

        const proxyMeta = getObservationProxyMeta(observationRecord);
        const proxyKey = buildSourceRecordKey(proxyMeta.sourceType, proxyMeta.sourceRecordId);
        if (proxyMeta.isProxy && proxyKey && actualSourceKeys.has(proxyKey)) {
          return [];
        }

        return [
          buildRecord(
            observationRecord,
            proxyMeta.isProxy
              ? `${proxyMeta.sourceType}-${proxyMeta.sourceRecordId || observationRecord.id}`
              : record.id,
            observationRecord.student_name,
            observationRecord.class_display,
            observationRecord.class_key,
            getPanelSourceLabel(proxyMeta.sourceType) as ApplicationRecord["source"],
            proxyMeta.sourceType,
            proxyMeta.sourceRecordId || observationRecord.id,
            undefined,
            observationRecord.created_at || observationRecord.observed_at || new Date().toISOString(),
            observationRecord.note,
            proxyMeta.isProxy ? proxyMeta.legacyObservationId : null
          ),
        ];
      })
      .filter((r) => r.student_name)
      .sort((a, b) => new Date(b.event_timestamp).getTime() - new Date(a.event_timestamp).getTime());
  }, [incidents, referrals, observations, requests, individualRequests, attendedAppointments, scheduledAppointments]);

  // Durum tek kaynaktan gelir: veritabani. Eskiden burada tarayici hafizasindaki
  // bir "override" katmani vardi; okuldaki bilgisayarda isaretlenen bir basvuru
  // baska bir cihazda hala "Bekliyor" gorunuyordu. Katman kaldirildi.
  const applicationRecordsWithOverrides = applicationRecords;

  const applicationReferrerOptions = useMemo(() => {
    const referrers = new Set<string>();
    applicationRecordsWithOverrides.forEach((item) => { if (item.referrer) referrers.add(item.referrer); });
    return Array.from(referrers).sort((a, b) => a.localeCompare(b, "tr-TR"));
  }, [applicationRecordsWithOverrides]);

  const filteredApplications = useMemo(() => {
    const filtered = applicationRecordsWithOverrides.filter((item) => {
      const matchesSearch = !applicationsSearchQuery || normalizeStudentName(item.student_name).includes(normalizeStudentName(applicationsSearchQuery));
      const matchesClass = !applicationsClassFilter || normalizeClassText(item.class_display) === applicationsClassFilter || normalizeClassText(item.class_key) === applicationsClassFilter;
      const matchesSource = applicationsSourceFilter === "all" || item.source === applicationsSourceFilter;
      const matchesReferrer = !applicationsReferrerFilter || (item.referrer && normalizeText(item.referrer).includes(normalizeText(applicationsReferrerFilter)));
      const matchesStatus = applicationsStatusFilter === "all" || item.status === applicationsStatusFilter;
      const matchesOutcome = applicationsOutcomeFilter === "all" || item.outcome_label === applicationsOutcomeFilter;
      return matchesSearch && matchesClass && matchesSource && matchesReferrer && matchesStatus && matchesOutcome;
    });

    // Bu sayfa bir is kuyrugu: once ele alinmasi gerekenler gelir.
    // Ayni durumdakiler kendi icinde yeniden eskiye siralanir.
    filtered.sort((a, b) => {
      const rank = (STATUS_RANK[a.status] ?? 3) - (STATUS_RANK[b.status] ?? 3);
      if (rank !== 0) return rank;
      return new Date(b.event_timestamp).getTime() - new Date(a.event_timestamp).getTime();
    });

    return filtered;
  }, [applicationRecordsWithOverrides, applicationsSearchQuery, applicationsClassFilter, applicationsSourceFilter, applicationsReferrerFilter, applicationsStatusFilter, applicationsOutcomeFilter]);

  // Durum sayaclari filtrelerden etkilenmez: ekranda ne filtrelenmis olursa
  // olsun, toplam is yukunu gormek gerekir.
  const statusCounts = useMemo(() => {
    const counts = { "Bekliyor": 0, "Randevu verildi": 0, "Görüşüldü": 0 };
    for (const item of applicationRecordsWithOverrides) {
      if (item.status in counts) counts[item.status as keyof typeof counts]++;
    }
    return { ...counts, toplam: applicationRecordsWithOverrides.length };
  }, [applicationRecordsWithOverrides]);

  // --- Ogrenci bazli gruplama --------------------------------------------
  // Ayni ogrenci icin birden fazla basvuru gelebilir (ornegin hem veli hem
  // ogretmen). Bunlar ayri kayitlardir ve ayri ayri kapatilir; ama listede
  // ayni ismin tekrar tekrar gorunmesi kuyrugu okumayi zorlastiriyordu.
  // Bu yuzden satirlar ogrenciye gore gruplanir, detay acilarak gorulur.
  const applicationGroups = useMemo(() => {
    const groups = new Map<string, { key: string; records: ApplicationRecord[] }>();
    for (const record of filteredApplications) {
      // Ad + sinif: farkli siniflardaki adaslar ayni gruba dusmesin.
      const key = `${followUpKey(record.student_name)}|${normalizeClassText(record.class_display || record.class_key)}`;
      const existing = groups.get(key);
      if (existing) existing.records.push(record);
      else groups.set(key, { key, records: [record] });
    }

    return [...groups.values()].map((group) => {
      // Grubun sirasi en acil basvurusuna gore belirlenir: bir ogrencinin
      // bekleyen bir basvurusu varsa, grup kuyrugun basinda kalmali.
      const rank = Math.min(...group.records.map((r) => STATUS_RANK[r.status] ?? 3));
      const latest = Math.max(...group.records.map((r) => new Date(r.event_timestamp).getTime()));

      // Ogrencinin tek durumu vardir; en acil olan gosterilir. Islem de o
      // basvuru uzerinden yapilir, cunku bir basvuruyu islemek ayni
      // ogrencinin tum acik basvurularini kapatir.
      const urgent = group.records.filter((r) => (STATUS_RANK[r.status] ?? 3) === rank);

      // Randevusu/gorusmesi olan durumlarda iptal ve sonuc islemleri o kaydin
      // randevusuna bagli oldugu icin, randevuyu tasiyan kayit secilir.
      const owner =
        rank === 1
          ? urgent.find((r) => findAppointmentForApplicationRecord(scheduledAppointments, r))
          : rank === 2
            ? urgent.find((r) => findAppointmentForApplicationRecord(attendedAppointments, r))
            : undefined;

      // Aksi halde en uzun suredir bekleyen basvuru.
      const oldest = [...urgent].sort(
        (a, b) => new Date(a.event_timestamp).getTime() - new Date(b.event_timestamp).getTime()
      )[0];

      return { ...group, rank, latest, primary: group.records[0], actionRecord: owner || oldest };
    }).sort((a, b) => (a.rank - b.rank) || (b.latest - a.latest));
  }, [filteredApplications, scheduledAppointments, attendedAppointments]);

  const toggleGroup = (key: string) =>
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });

  // --- Satir hucreleri ---------------------------------------------------
  // Ayni ogrencinin birden fazla basvurusu tek satirda gruplanip acilarak
  // gosterildigi icin, bu hucreler hem tek satirda hem alt satirlarda
  // kullaniliyor.

  const renderChannelCell = (item: ApplicationRecord) => (
    <span className="inline-flex items-center gap-1.5 text-slate-600">
      <span>{ENTRY_CHANNELS.find((c) => c.source === item.source)?.icon}</span>
      {CHANNEL_SHORT_LABELS[item.source] || item.source}
    </span>
  );

  const renderStatusCell = (item: ApplicationRecord) => {
    if (item.status === "Bekliyor") {
      return (
        <button
          type="button"
          onClick={() => setStatusChoiceRecord(item)}
          className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-100"
        >
          Bekliyor ▾
        </button>
      );
    }
    if (item.status === "Görüşüldü" && !item.outcome_label) {
      return (
        <button
          type="button"
          onClick={() => handleOpenOutcomeModal(item)}
          className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 transition-colors hover:bg-emerald-100"
          title="Görüşme sonucunu belirle"
        >
          Görüşüldü ▾
        </button>
      );
    }
    if (item.status === "Randevu verildi") {
      return (
        <button
          type="button"
          onClick={() => handleCancelScheduledAppointment(item)}
          disabled={cancellingRecordId === item.id}
          className="inline-flex items-center gap-1 rounded-md border border-blue-300 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-800 transition-colors hover:border-rose-300 hover:bg-rose-50 hover:text-rose-800 disabled:opacity-60"
          title="Randevuyu iptal et — başvuru tekrar Bekliyor durumuna döner"
        >
          {cancellingRecordId === item.id ? "İptal ediliyor..." : "Randevu verildi ▾"}
        </button>
      );
    }
    return (
      <Badge className={item.status === "Görüşüldü" ? "border border-emerald-200 bg-emerald-50 text-emerald-800" : "border border-blue-200 bg-blue-50 text-blue-800"}>
        {item.status}
      </Badge>
    );
  };

  const renderOutcomeCell = (item: ApplicationRecord) =>
    item.outcome_label && (item.status === "Görüşüldü" || item.outcome_label === "Aktif Takip") ? (
      <Badge className={
        item.outcome_label === "Tamamlandı" ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
        item.outcome_label === "Aktif Takip" ? "bg-cyan-100 text-cyan-700 border-cyan-200" :
        "bg-violet-100 text-violet-700 border-violet-200"
      }>
        {item.outcome_label}
      </Badge>
    ) : (
      <span className="text-xs text-slate-400">—</span>
    );

  const renderDeleteCell = (item: ApplicationRecord) => (
    <Button
      onClick={() => handleDeleteApplication(item)}
      disabled={deletingId === item.id}
      variant="ghost"
      size="sm"
      className="h-8 w-8 p-0 text-slate-400 hover:bg-red-50 hover:text-red-600"
    >
      {deletingId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
    </Button>
  );

  const formatEventDate = (value: string) =>
    new Date(value).toLocaleString("tr-TR", {
      day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
    });

  // Katlanmis panelde hangi filtrelerin acik oldugu gorunmedigi icin sayilir.
  const activeFilterCount =
    (applicationsClassFilter ? 1 : 0) +
    (applicationsSourceFilter !== "all" ? 1 : 0) +
    (applicationsOutcomeFilter !== "all" ? 1 : 0) +
    (applicationsReferrerFilter ? 1 : 0);

  const clearFilters = () => {
    setApplicationsClassFilter("");
    setApplicationsSourceFilter("all");
    setApplicationsOutcomeFilter("all");
    setApplicationsReferrerFilter("");
  };

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
      {/* Başlık — dekoratif banner yerine calisma basligi:
          solda ne oldugu, ortada is yuku, sagda tek eylem. */}
      <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-slate-800">Başvurular</h1>
            <p className="text-sm text-slate-500">
              Öğrencilerin rehberlik servisine geliş kayıtları
            </p>
          </div>

          <div className="relative">
            <button
              onClick={() => setShowNewEntryDropdown(!showNewEntryDropdown)}
              className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700"
            >
              <Plus className="h-4 w-4" />
              Yeni Başvuru
            </button>
            {showNewEntryDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowNewEntryDropdown(false)} />
                <div className="absolute right-0 top-full z-50 mt-1 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                  {ENTRY_CHANNELS_FOR_CREATION.map((ch) => (
                    <button
                      key={ch.source}
                      onClick={() => { openEntryForm(ch.source); setShowNewEntryDropdown(false); }}
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-slate-700 transition-colors hover:bg-slate-50"
                    >
                      <span>{ch.icon}</span>
                      {ch.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Is yuku ozeti. Tiklayinca o duruma filtreler; ayni sayaca tekrar
            tiklayinca filtre kalkar. */}
        <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          {([
            { key: "Bekliyor", label: "Bekliyor", count: statusCounts["Bekliyor"], tone: "amber" },
            { key: "Randevu verildi", label: "Randevu verildi", count: statusCounts["Randevu verildi"], tone: "blue" },
            { key: "Görüşüldü", label: "Görüşüldü", count: statusCounts["Görüşüldü"], tone: "emerald" },
          ] as const).map((s) => {
            const active = applicationsStatusFilter === s.key;
            const tones: Record<string, string> = {
              amber: active ? "border-amber-400 bg-amber-50 text-amber-800" : "border-slate-200 text-slate-600 hover:border-amber-300",
              blue: active ? "border-blue-400 bg-blue-50 text-blue-800" : "border-slate-200 text-slate-600 hover:border-blue-300",
              emerald: active ? "border-emerald-400 bg-emerald-50 text-emerald-800" : "border-slate-200 text-slate-600 hover:border-emerald-300",
            };
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setApplicationsStatusFilter(active ? "all" : s.key)}
                className={`flex items-baseline gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors ${tones[s.tone]}`}
              >
                <span className="text-base font-semibold tabular-nums">{s.count}</span>
                <span>{s.label}</span>
              </button>
            );
          })}
          <div className="ml-auto flex items-center text-sm text-slate-400">
            {/* Satir sayisi ogrenci sayisidir; basvuru sayisindan az olabilir,
                cunku ayni ogrencinin basvurulari tek satirda toplanir. */}
            {applicationGroups.length === statusCounts.toplam
              ? `toplam ${statusCounts.toplam} başvuru`
              : `${statusCounts.toplam} başvuru · ${applicationGroups.length} öğrenci`}
          </div>
        </div>
      </div>


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

      {/* Sayfa basligi zaten "Basvurular" diyor; kartin ikinci bir baslik
          tasimasi gereksiz tekrardi, kaldirildi. */}
      <Card className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <CardContent className="space-y-4 p-4 sm:p-5">
          {/* Filtreler — arama her zaman acik, gerisi katlanir.
              Durum filtresi yok: ustteki sayaclar onu daha gorunur yapiyor. */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[220px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={applicationsSearchQuery}
                  onChange={(e) => setApplicationsSearchQuery(e.target.value)}
                  placeholder="Öğrenci adı ara..."
                  className="pl-9"
                />
              </div>

              <button
                type="button"
                onClick={() => setShowFilters((v) => !v)}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                  activeFilterCount > 0
                    ? "border-slate-400 bg-slate-50 text-slate-800"
                    : "border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
              >
                <Filter className="h-4 w-4" />
                Filtreler
                {activeFilterCount > 0 && (
                  <span className="rounded-full bg-slate-800 px-1.5 text-xs font-medium text-white">
                    {activeFilterCount}
                  </span>
                )}
                <ChevronDown className={`h-4 w-4 transition-transform ${showFilters ? "rotate-180" : ""}`} />
              </button>

              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="rounded-lg px-2 py-2 text-sm text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
                >
                  Temizle
                </button>
              )}
            </div>

            {showFilters && (
              <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-600">Sınıf</Label>
                  <select
                    value={applicationsClassFilter}
                    onChange={(e) => setApplicationsClassFilter(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                  >
                    <option value="">Tümü</option>
                    {applicationClassOptions.map((cls) => <option key={cls.value} value={cls.value}>{cls.label}</option>)}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-600">Geliş kanalı</Label>
                  <select
                    value={applicationsSourceFilter}
                    onChange={(e) => setApplicationsSourceFilter(e.target.value as any)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                  >
                    <option value="all">Tümü</option>
                    <option value="Öğretmen Yönlendirmeleri">Öğretmen yönlendirmesi</option>
                    <option value="Veli Talepleri">Veli talebi</option>
                    <option value="Öğrenci Bildirimleri">Öğrenci bildirimi</option>
                    <option value="Rehberlik İsteği">Rehberlik isteği</option>
                    <option value="Bireysel Başvuru">Bireysel başvuru</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-600">Görüşme sonucu</Label>
                  <select
                    value={applicationsOutcomeFilter}
                    onChange={(e) => setApplicationsOutcomeFilter(e.target.value as any)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                  >
                    <option value="all">Tümü</option>
                    <option value="Tamamlandı">Tamamlandı</option>
                    <option value="Aktif Takip">Aktif Takip</option>
                  </select>
                </div>

                {applicationsSourceFilter === "Öğretmen Yönlendirmeleri" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-600">Yönlendiren öğretmen</Label>
                    <select
                      value={applicationsReferrerFilter}
                      onChange={(e) => setApplicationsReferrerFilter(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                    >
                      <option value="">Tümü</option>
                      {applicationReferrerOptions.map((ref) => <option key={ref} value={ref}>{ref}</option>)}
                    </select>
                  </div>
                )}
              </div>
            )}

            {filteredApplications.length !== statusCounts.toplam && (
              <div className="text-sm text-slate-500">
                {statusCounts.toplam} başvurudan {filteredApplications.length} tanesi gösteriliyor
              </div>
            )}
          </div>

          {/* Tablo */}
          <div className="responsive-scroll overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2.5 font-medium">Tarih</th>
                  <th className="px-4 py-2.5 font-medium">Öğrenci</th>
                  <th className="px-4 py-2.5 font-medium">Sınıf</th>
                  <th className="px-4 py-2.5 font-medium">Geliş kanalı</th>
                  {applicationsSourceFilter === "Öğretmen Yönlendirmeleri" && <th className="px-4 py-2.5 font-medium">Yönlendiren</th>}
                  <th className="px-4 py-2.5 font-medium">Durum</th>
                  <th className="px-4 py-2.5 font-medium">Sonuç</th>
                  <th className="px-4 py-2.5 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {filteredApplications.length === 0 ? (
                  <tr>
                    <td colSpan={applicationsSourceFilter === "Öğretmen Yönlendirmeleri" ? 8 : 7} className="p-8 text-center text-slate-500">
                      <MessageSquare className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                      <p className="font-medium text-slate-600">Kayıt bulunamadı</p>
                      {activeFilterCount > 0 && (
                        <button type="button" onClick={clearFilters} className="mt-2 text-sm text-slate-500 underline underline-offset-2 hover:text-slate-800">
                          Filtreleri temizle
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  applicationGroups.map((group) => {
                    const item = group.primary;
                    const isFollowed = followedNames.has(followUpKey(item.student_name));
                    const multi = group.records.length > 1;
                    const open = expandedGroups.has(group.key);
                    const colCount = applicationsSourceFilter === "Öğretmen Yönlendirmeleri" ? 8 : 7;

                    const nameCell = (
                      <span className="inline-flex items-center gap-1.5">
                        {item.student_name}
                        {isFollowed && (
                          <span
                            title="Bu öğrenci takip listenizde"
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] font-medium text-slate-600"
                          >
                            <Eye className="h-3 w-3" />
                            takipte
                          </span>
                        )}
                      </span>
                    );

                    // Tek basvurusu olan ogrenci — cogunluk bu. Acilir satir
                    // gostermek gereksiz bir tiklama olurdu.
                    if (!multi) {
                      return (
                        <tr key={group.key} className="border-b border-slate-100 transition-colors hover:bg-slate-50">
                          <td className="px-4 py-3 text-sm text-slate-600">{formatEventDate(item.event_timestamp)}</td>
                          <td className="px-4 py-3 font-medium text-slate-800">{nameCell}</td>
                          <td className="px-4 py-3 text-slate-600">{formatClassDisplay(item.class_display)}</td>
                          <td className="px-4 py-3">{renderChannelCell(item)}</td>
                          {applicationsSourceFilter === "Öğretmen Yönlendirmeleri" && <td className="px-4 py-3 text-slate-600">{item.referrer || "-"}</td>}
                          <td className="px-4 py-3">{renderStatusCell(item)}</td>
                          <td className="px-4 py-3">{renderOutcomeCell(item)}</td>
                          <td className="px-4 py-3">{renderDeleteCell(item)}</td>
                        </tr>
                      );
                    }

                    // Birden fazla basvurusu olan ogrenci: tek satirda toplanir.
                    // Islemler basvuruya ait oldugu icin ozet satirinda eylem
                    // yok; acinca her basvuru kendi dugmeleriyle gorunur.
                    return (
                      <Fragment key={group.key}>
                        <tr
                          onClick={() => toggleGroup(group.key)}
                          className={`cursor-pointer border-b border-slate-100 transition-colors hover:bg-slate-50 ${open ? "bg-slate-50" : ""}`}
                        >
                          <td className="px-4 py-3 text-sm text-slate-600">{formatEventDate(new Date(group.latest).toISOString())}</td>
                          <td className="px-4 py-3 font-medium text-slate-800">
                            <span className="inline-flex items-center gap-1.5">
                              <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${open ? "" : "-rotate-90"}`} />
                              {nameCell}
                              <span className="rounded-md border border-slate-300 bg-white px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
                                {group.records.length} başvuru
                              </span>
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-600">{formatClassDisplay(item.class_display)}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1">
                              {[...new Set(group.records.map((r) => r.source))].map((src) => (
                                <span key={src} title={CHANNEL_SHORT_LABELS[src] || src}>
                                  {ENTRY_CHANNELS.find((c) => c.source === src)?.icon}
                                </span>
                              ))}
                            </span>
                          </td>
                          {applicationsSourceFilter === "Öğretmen Yönlendirmeleri" && <td className="px-4 py-3 text-slate-600">-</td>}
                          {/* Ogrencinin tek bir durumu vardir. Basvurular ayni anda
                              kapandigi icin durumu her satirda tekrarlamak yerine
                              burada bir kez gosterilir; islem de buradan yapilir. */}
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            {renderStatusCell(group.actionRecord)}
                          </td>
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            {renderOutcomeCell(group.actionRecord)}
                          </td>
                          <td className="px-4 py-3"></td>
                        </tr>

                        {open && (
                          <tr className="border-b border-slate-100 bg-slate-50/70">
                            <td colSpan={colCount} className="px-4 py-3">
                              <p className="mb-2 text-xs text-slate-500">
                                Bu öğrenci {group.records.length} ayrı kanaldan geldi. Tek görüşmede
                                hepsi kapanır; durum yukarıdaki tek kutudan yönetilir.
                              </p>
                              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                                <table className="min-w-full text-left text-sm">
                                  <tbody>
                                    {group.records.map((rec, i) => (
                                      <tr key={rec.id} className={i > 0 ? "border-t border-slate-100" : ""}>
                                        <td className="px-3 py-2.5 text-sm text-slate-600">{formatEventDate(rec.event_timestamp)}</td>
                                        <td className="px-3 py-2.5">{renderChannelCell(rec)}</td>
                                        <td className="px-3 py-2.5 text-slate-600">{rec.referrer || ""}</td>
                                        <td className="px-3 py-2.5 text-right">{renderDeleteCell(rec)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })
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
                  // Durum, sonuc penceresi kaydedildiginde veritabanina yazilir.
                  // Pencere kapatilirsa basvuru "Bekliyor" olarak kalir.
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
