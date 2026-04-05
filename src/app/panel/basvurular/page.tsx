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
  IndividualRequestRecord,
  INCIDENT_STATUSES,
  OBSERVATION_PRIORITIES,
  OBSERVATION_STATUSES,
  OBSERVATION_TYPES,
  PARENT_REQUEST_STATUSES
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
  note?: string | null;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  return new Date(value).toLocaleString("tr-TR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
};

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

const normalizeStudentName = (value?: string | null) =>
  normalizeText((value || "").replace(/\s+/g, " "));

const normalizeClassText = (value?: string | null) =>
  (value || "")
    .toLocaleLowerCase("tr-TR")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[\/\-_.()]/g, "")
    .trim();

const matchesAttendedAppointment = (
  appointment: any,
  studentName?: string | null,
  classDisplay?: string | null,
  classKey?: string | null
) => {
  const appointmentName = normalizeStudentName(appointment.participant_name);
  const sourceName = normalizeStudentName(studentName);

  if (!appointmentName || !sourceName) return false;

  const nameMatches =
    appointmentName === sourceName ||
    appointmentName.includes(sourceName) ||
    sourceName.includes(appointmentName);

  if (!nameMatches) return false;

  const appointmentClass = normalizeClassText(appointment.participant_class);
  const sourceClass = normalizeClassText(classDisplay || classKey);

  if (!appointmentClass || !sourceClass) return true;

  return (
    appointmentClass === sourceClass ||
    appointmentClass.includes(sourceClass) ||
    sourceClass.includes(appointmentClass)
  );
};

export default function BasvurularPage() {
  const [applicationsSearchQuery, setApplicationsSearchQuery] = useState("");
  const [applicationsClassFilter, setApplicationsClassFilter] = useState("");
  const [applicationsSourceFilter, setApplicationsSourceFilter] = useState<"all" | "Veli Talepleri" | "Öğretmen Yönlendirmeleri" | "Öğrenci Bildirimleri" | "Gözlem Havuzu" | "Bireysel Başvuru">("all");
  const [applicationsReferrerFilter, setApplicationsReferrerFilter] = useState("");
  const [applicationsStatusFilter, setApplicationsStatusFilter] = useState<"all" | "Görüşüldü" | "Randevu verildi" | "Bekliyor">("all");

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

  const handleDeleteApplication = async (application: ApplicationRecord) => {
    if (!confirm(`${application.student_name} adlı öğrencinin ${application.source} başvurusunu silmek istediğinizden emin misiniz?`)) {
      return;
    }

    setDeletingId(application.id);
    try {
      const dashIndex = application.id.indexOf('-');
      const type = application.id.slice(0, dashIndex);
      const id = application.id.slice(dashIndex + 1);
      console.log('Silme işlemi:', { type, id, application });

      let endpoint = '';
      switch (type) {
        case 'incident':
          endpoint = '/api/student-incidents';
          break;
        case 'referral':
          endpoint = '/api/referrals';
          break;
        case 'observation':
          endpoint = '/api/gozlem-havuzu';
          break;
        case 'request':
          endpoint = '/api/parent-meeting-requests';
          break;
        case 'individual':
          endpoint = '/api/individual-requests';
          break;
        default:
          throw new Error('Geçersiz başvuru türü');
      }

      console.log('API çağrısı:', `${endpoint}?id=${id}`);
      const response = await fetch(`${endpoint}?id=${id}`, {
        method: 'DELETE',
      });

      console.log('API yanıtı:', response.status, response.statusText);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Bilinmeyen hata' }));
        console.log('API hata detayı:', errorData);
        throw new Error(errorData.error || `Silme işlemi başarısız (${response.status})`);
      }

      toast.success('Başvuru başarıyla silindi');

      // Listeyi yeniden yükle
      await loadData();
    } catch (error) {
      console.error('Silme hatası:', error);
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
        supabase
          .from("student_incidents")
          .select("*")
          .in("status", ["new", "reviewing"])
          .order("incident_date", { ascending: false })
          .order("created_at", { ascending: false }),
        supabase
          .from("parent_meeting_requests")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("appointments")
          .select("*")
          .eq("status", "attended")
          .eq("participant_type", "student")
          .order("appointment_date", { ascending: false })
          .order("created_at", { ascending: false }),
        supabase
          .from("appointments")
          .select("*")
          .neq("status", "pending")
          .neq("status", "attended")
          .neq("status", "cancelled")
          .eq("participant_type", "student")
          .order("appointment_date", { ascending: false })
          .order("created_at", { ascending: false }),
        supabase
          .from("individual_requests")
          .select("*")
          .order("created_at", { ascending: false })
      ]);

      if (!referralResult.error) setReferrals(referralResult.data || []);
      if (observationResult.ok) {
        const observationData = await observationResult.json();
        setObservations(observationData.observations || []);
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

  useEffect(() => {
    loadData();
  }, []);

  const applicationRecords: ApplicationRecord[] = useMemo(() => {
    const records: ApplicationRecord[] = [];

    // Öğrenci Bildirimleri
    incidents.forEach((incident) => {
      const isScheduled = scheduledAppointments.some((apt) =>
        matchesAttendedAppointment(apt, incident.target_student_name, incident.target_class_display, incident.target_class_key)
      );
      const isAttended = attendedAppointments.some((apt) =>
        matchesAttendedAppointment(apt, incident.target_student_name, incident.target_class_display, incident.target_class_key)
      );

      records.push({
        id: `incident-${incident.id}`,
        student_name: incident.target_student_name,
        class_display: incident.target_class_display,
        class_key: incident.target_class_key,
        source: "Öğrenci Bildirimleri",
        referrer: incident.record_role === "linked_reporter" ? incident.reporter_student_name || undefined : undefined,
        date: incident.created_at || incident.incident_date || new Date().toISOString(),
        status: isAttended ? "Görüşüldü" : isScheduled ? "Randevu verildi" : "Bekliyor",
        note: incident.description
      });
    });

    // Öğretmen Yönlendirmeleri
    referrals.forEach((referral) => {
      const isScheduled = scheduledAppointments.some((apt) =>
        matchesAttendedAppointment(apt, referral.student_name, referral.class_display, referral.class_key)
      );
      const isAttended = attendedAppointments.some((apt) =>
        matchesAttendedAppointment(apt, referral.student_name, referral.class_display, referral.class_key)
      );

      records.push({
        id: `referral-${referral.id}`,
        student_name: referral.student_name,
        class_display: referral.class_display,
        class_key: referral.class_key,
        source: "Öğretmen Yönlendirmeleri",
        referrer: referral.teacher_name,
        date: referral.created_at || new Date().toISOString(),
        status: isAttended ? "Görüşüldü" : isScheduled ? "Randevu verildi" : "Bekliyor",
        note: referral.note || referral.reason
      });
    });

    // Gözlem Havuzu
    observations.forEach((observation) => {
      const isScheduled = scheduledAppointments.some((apt) =>
        matchesAttendedAppointment(apt, observation.student_name, observation.class_display, observation.class_key)
      );
      const isAttended = attendedAppointments.some((apt) =>
        matchesAttendedAppointment(apt, observation.student_name, observation.class_display, observation.class_key)
      );

      records.push({
        id: `observation-${observation.id}`,
        student_name: observation.student_name,
        class_display: observation.class_display,
        class_key: observation.class_key,
        source: "Gözlem Havuzu",
        referrer: "",
        date: observation.created_at || new Date().toISOString(),
        status: isAttended ? "Görüşüldü" : isScheduled ? "Randevu verildi" : "Bekliyor",
        note: observation.note
      });
    });

    // Veli Talepleri
    requests.forEach((request) => {
      const isScheduled = scheduledAppointments.some((apt) =>
        matchesAttendedAppointment(apt, request.student_name, request.class_display, request.class_key)
      );
      const isAttended = attendedAppointments.some((apt) =>
        matchesAttendedAppointment(apt, request.student_name, request.class_display, request.class_key)
      );

      records.push({
        id: `request-${request.id}`,
        student_name: request.student_name,
        class_display: request.class_display,
        class_key: request.class_key,
        source: "Veli Talepleri",
        referrer: request.parent_name || undefined,
        date: request.created_at || new Date().toISOString(),
        status: isAttended ? "Görüşüldü" : isScheduled ? "Randevu verildi" : "Bekliyor",
        note: request.detail || request.subject
      });
    });

    // Bireysel Başvurular
    individualRequests.forEach((request) => {
      const isScheduled = scheduledAppointments.some((apt) =>
        matchesAttendedAppointment(apt, request.student_name, request.class_display, request.class_key)
      );
      const isAttended = attendedAppointments.some((apt) =>
        matchesAttendedAppointment(apt, request.student_name, request.class_display, request.class_key)
      );

      records.push({
        id: `individual-${request.id}`,
        student_name: request.student_name,
        class_display: request.class_display,
        class_key: request.class_key,
        source: "Bireysel Başvuru",
        referrer: undefined,
        date: request.created_at || new Date().toISOString(),
        status: isAttended ? "Görüşüldü" : isScheduled ? "Randevu verildi" : "Bekliyor",
        note: request.note
      });
    });

    return records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [incidents, referrals, observations, requests, individualRequests, attendedAppointments, scheduledAppointments]);

  const isReferralActive = applicationsSourceFilter === "Öğretmen Yönlendirmeleri";

  useEffect(() => {
    if (!isReferralActive) {
      setApplicationsReferrerFilter("");
    }
  }, [isReferralActive]);

  const filteredApplications = useMemo(() => {
    return applicationRecords.filter((item) => {
      const matchesSearch = !applicationsSearchQuery ||
        normalizeStudentName(item.student_name).includes(normalizeStudentName(applicationsSearchQuery));

      const matchesClass = !applicationsClassFilter ||
        normalizeClassText(item.class_display) === applicationsClassFilter ||
        normalizeClassText(item.class_key) === applicationsClassFilter;

      const matchesSource = applicationsSourceFilter === "all" || item.source === applicationsSourceFilter;

      const matchesReferrer = !applicationsReferrerFilter ||
        item.source !== "Öğretmen Yönlendirmeleri" ||
        (item.referrer && normalizeText(item.referrer).includes(normalizeText(applicationsReferrerFilter)));

      const matchesStatus = applicationsStatusFilter === "all" || item.status === applicationsStatusFilter;

      return matchesSearch && matchesClass && matchesSource && matchesReferrer && matchesStatus;
    });
  }, [applicationRecords, applicationsSearchQuery, applicationsClassFilter, applicationsSourceFilter, applicationsReferrerFilter, applicationsStatusFilter]);

  const applicationClassOptions = useMemo(() => {
    const classMap = new Map<string, string>();

    applicationRecords.forEach((item) => {
      const classValue = item.class_display || item.class_key;
      const normalized = normalizeClassText(classValue);
      if (!normalized) return;

      if (!classMap.has(normalized)) {
        classMap.set(normalized, item.class_display || item.class_key || normalized);
      }
    });

    return Array.from(classMap.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "tr-TR"));
  }, [applicationRecords]);

  const applicationReferrerOptions = useMemo(() => {
    const referrers = new Set<string>();
    applicationRecords.forEach((item) => {
      if (item.referrer) referrers.add(item.referrer);
    });
    return Array.from(referrers).sort((a, b) => a.localeCompare(b, "tr-TR"));
  }, [applicationRecords]);

  const applicationStatistics = useMemo(() => {
    const totals = {
      total: 0,
      status: {
        "Görüşüldü": 0,
        "Randevu verildi": 0,
        "Bekliyor": 0
      },
      source: {
        "Veli Talepleri": 0,
        "Öğretmen Yönlendirmeleri": 0,
        "Öğrenci Bildirimleri": 0,
        "Gözlem Havuzu": 0,
        "Bireysel Başvuru": 0
      },
      byTeacher: {} as Record<string, number>,
      byClass: {} as Record<string, number>,
      bySource: {} as Record<string, number>
    };

    applicationRecords.forEach((item) => {
      totals.total += 1;
      totals.status[item.status] += 1;
      totals.source[item.source] += 1;
      
      // En çok yönlendiren öğretmen
      if (item.referrer) {
        totals.byTeacher[item.referrer] = (totals.byTeacher[item.referrer] || 0) + 1;
      }
      
      // En çok öğrencinin yönlendirildiği sınıf
      const classLabel = item.class_display || item.class_key || "Bilinmeyen";
      totals.byClass[classLabel] = (totals.byClass[classLabel] || 0) + 1;
      
      // Geliş sebebine göre
      const source = item.source;
      totals.bySource[source] = (totals.bySource[source] || 0) + 1;
    });

    return totals;
  }, [applicationRecords]);

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
      {/* Modern Başlık */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 p-6 text-white shadow-xl">
        <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,transparent,rgba(255,255,255,0.5))]" />
        
        {/* Animated Background Elements */}
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-blue-400/20 blur-3xl animate-float-slow" />
        <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-indigo-400/20 blur-3xl animate-float-reverse" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-violet-400/10 blur-3xl animate-pulse-glow" />
        
        {/* Floating Particles */}
        <div className="absolute top-8 right-16 h-2 w-2 rounded-full bg-blue-300/60 animate-float animation-delay-100" />
        <div className="absolute top-16 right-32 h-1.5 w-1.5 rounded-full bg-violet-300/60 animate-float animation-delay-300" />
        <div className="absolute bottom-12 left-24 h-2 w-2 rounded-full bg-cyan-300/60 animate-float animation-delay-500" />
        <div className="absolute top-1/3 left-1/5 h-1 w-1 rounded-full bg-white/40 animate-sparkle animation-delay-200" />
        <div className="absolute bottom-1/4 right-1/5 h-1.5 w-1.5 rounded-full bg-indigo-300/50 animate-sparkle animation-delay-700" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm shadow-lg">
              <MessageSquare className="h-8 w-8 text-blue-700" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">
                Başvurular Takibi
              </h1>
              <p className="text-white/80 mt-1">
                Tüm başvuru kaynaklarından gelen öğrenci başvurularını takip edin ve yönetin
              </p>
            </div>
          </div>
          
          {/* İstatistik Kartları */}
          <div className="flex flex-wrap items-center gap-2 mt-4">
            <div className="flex items-center gap-2 rounded-lg bg-white/10 backdrop-blur-sm px-3 py-2 border border-white/10 hover:bg-white/20 transition-all">
              <div className="p-1 bg-blue-500/20 rounded-lg">
                <MessageSquare className="h-4 w-4 text-blue-200" />
              </div>
              <div>
                <p className="text-[10px] text-blue-200 uppercase tracking-wider">Toplam</p>
                <p className="text-lg font-bold leading-none">{applicationRecords.length}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-indigo-500/30 backdrop-blur-sm px-3 py-2 border border-indigo-400/30 hover:bg-indigo-500/40 transition-all">
              <div className="p-1 bg-indigo-500/20 rounded-lg">
                <Search className="h-4 w-4 text-indigo-200" />
              </div>
              <div>
                <p className="text-[10px] text-indigo-200 uppercase tracking-wider">Görüşüldü</p>
                <p className="text-lg font-bold leading-none">{applicationStatistics.status["Görüşüldü"]}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-violet-500/30 backdrop-blur-sm px-3 py-2 border border-violet-400/30 hover:bg-violet-500/40 transition-all">
              <div className="p-1 bg-violet-500/20 rounded-lg">
                <Filter className="h-4 w-4 text-violet-200" />
              </div>
              <div>
                <p className="text-[10px] text-violet-200 uppercase tracking-wider">Randevu</p>
                <p className="text-lg font-bold leading-none">{applicationStatistics.status["Randevu verildi"]}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-cyan-500/30 backdrop-blur-sm px-3 py-2 border border-cyan-400/30 hover:bg-cyan-500/40 transition-all">
              <div className="p-1 bg-cyan-500/20 rounded-lg">
                <Loader2 className="h-4 w-4 text-cyan-200" />
              </div>
              <div>
                <p className="text-[10px] text-cyan-200 uppercase tracking-wider">Bekliyor</p>
                <p className="text-lg font-bold leading-none">{applicationStatistics.status["Bekliyor"]}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Card className="rounded-2xl border border-slate-200 bg-white shadow-lg overflow-hidden relative group">
        {/* Background Decorations */}
        <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-purple-100/50 blur-2xl animate-float-slow" />
        <div className="absolute -bottom-8 -left-8 w-28 h-28 rounded-full bg-pink-100/50 blur-2xl animate-float-reverse" />
        
        <CardHeader className="border-b bg-gradient-to-r from-purple-50 to-pink-50 p-4 relative">
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
        <CardContent className="p-6 space-y-6 relative">
            <div className="grid gap-4 md:grid-cols-5">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <Search className="h-4 w-4 text-purple-500" />
                  Öğrenci Ara
                </Label>
                <Input
                  value={applicationsSearchQuery}
                  onChange={(e) => setApplicationsSearchQuery(e.target.value)}
                  placeholder="Ad soyad ara..."
                  className="w-full border-purple-200 focus:border-purple-400 focus:ring-purple-400/20"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <Filter className="h-4 w-4 text-blue-500" />
                  Sınıf
                </Label>
                <select
                  value={applicationsClassFilter}
                  onChange={(e) => setApplicationsClassFilter(e.target.value)}
                  className="w-full rounded-lg border border-blue-200 px-3 py-2 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 transition-all"
                >
                  <option value="">Tümü</option>
                  {applicationClassOptions.map((cls) => (
                    <option key={cls.value} value={cls.value}>{cls.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-emerald-500" />
                  Geliş Türü
                </Label>
                <select
                  value={applicationsSourceFilter}
                  onChange={(e) => setApplicationsSourceFilter(e.target.value as any)}
                  className="w-full rounded-lg border border-emerald-200 px-3 py-2 text-sm focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 transition-all"
                >
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
                  <Label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <User className="h-4 w-4 text-amber-500" />
                    Yönlendiren
                  </Label>
                  <select
                    value={applicationsReferrerFilter}
                    onChange={(e) => setApplicationsReferrerFilter(e.target.value)}
                    className="w-full rounded-lg border border-amber-200 px-3 py-2 text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition-all"
                  >
                    <option value="">Tümü</option>
                    {applicationReferrerOptions.map((ref) => (
                      <option key={ref} value={ref}>{ref}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 text-rose-500" />
                  Durum
                </Label>
                <select
                  value={applicationsStatusFilter}
                  onChange={(e) => setApplicationsStatusFilter(e.target.value as any)}
                  className="w-full rounded-lg border border-rose-200 px-3 py-2 text-sm focus:border-rose-400 focus:ring-2 focus:ring-rose-400/20 transition-all"
                >
                  <option value="all">Tümü</option>
                  <option value="Görüşüldü">Görüşüldü</option>
                  <option value="Randevu verildi">Randevu verildi</option>
                  <option value="Bekliyor">Bekliyor</option>
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
                    <th className="px-4 py-3 font-semibold">İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredApplications.length === 0 ? (
                    <tr>
                      <td colSpan={isReferralActive ? 7 : 6} className="p-8 text-center text-slate-500">
                        <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30 text-purple-300" />
                        <p>Kayıt bulunamadı.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredApplications.map((item, index) => (
                      <tr key={item.id} className="border-b border-slate-100 hover:bg-gradient-to-r hover:from-purple-50/50 hover:to-pink-50/50 transition-all duration-200 group">
                        <td className="px-4 py-3 font-medium text-slate-800 group-hover:text-purple-700 transition-colors">{item.student_name}</td>
                        <td className="px-4 py-3 text-slate-600">
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                            {item.class_display || "-"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                            {item.source}
                          </span>
                        </td>
                        {isReferralActive && <td className="px-4 py-3 text-slate-600">{item.referrer || "-"}</td>}
                        <td className="px-4 py-3 text-slate-600 text-sm">
                          {new Date(item.date).toLocaleString("tr-TR", { 
                            day: "2-digit", 
                            month: "2-digit", 
                            year: "numeric", 
                            hour: "2-digit", 
                            minute: "2-digit" 
                          })}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            className={
                              item.status === "Görüşüldü"
                                ? "bg-gradient-to-r from-emerald-500 to-green-600 text-white border-0 shadow-sm"
                                : item.status === "Randevu verildi"
                                ? "bg-gradient-to-r from-blue-500 to-cyan-600 text-white border-0 shadow-sm"
                                : "bg-gradient-to-r from-amber-500 to-orange-600 text-white border-0 shadow-sm"
                            }
                          >
                            {item.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Button
                            onClick={() => handleDeleteApplication(item)}
                            disabled={deletingId === item.id}
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            {deletingId === item.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
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