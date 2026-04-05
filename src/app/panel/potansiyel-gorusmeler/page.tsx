"use client";

import { useEffect, useMemo, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { MessageSquare, Users, Eye, Search, RefreshCw, Calendar, Clock, ArrowRight, Loader2, PhoneCall, Edit2, Trash2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { useAppointments } from "../randevu/hooks";
import {
  Appointment,
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

type SourceTab = "all" | "incidents" | "referrals" | "observations" | "requests" | "individual-requests" | "applications" | "appointments";

type SourceTabOption = {
  value: SourceTab;
  label: string;
};

const POTENTIAL_MEETINGS_TABS: SourceTabOption[] = [
  { value: "all", label: "Tümü" },
  { value: "incidents", label: "Öğrenci Bildirimleri" },
  { value: "referrals", label: "Öğretmen Yönlendirmeleri" },
  { value: "observations", label: "Gözlem Havuzu" },
  { value: "requests", label: "Veli Talepleri" },
  { value: "individual-requests", label: "Bireysel Başvurular" },
  { value: "applications", label: "Başvurular" },
  { value: "appointments", label: "Randevular" },
];

const VISIBLE_POTENTIAL_MEETINGS_TABS = POTENTIAL_MEETINGS_TABS.filter(
  (tab) => tab.value !== "applications" && tab.value !== "appointments"
);

const POTENTIAL_MEETINGS_TAB_TRIGGER_CLASSES =
  "inline-flex items-center justify-center whitespace-nowrap rounded-2xl px-3 py-2 text-sm font-semibold transition-all duration-200 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 " +
  "hover:bg-slate-200/70 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm data-[state=active]:border-b-2 data-[state=active]:border-slate-900 " +
  "data-[state=inactive]:text-slate-500/70";

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
  appointment: Appointment,
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

const matchesQuery = (fields: Array<string | null | undefined>, query: string) => {
  if (!query) return true;
  const text = fields.filter(Boolean).join(" ");
  return normalizeText(text).includes(query);
};

const buildAppointmentUrl = (studentName: string, classDisplay?: string | null, classKey?: string | null, note?: string | null) => {
  const params = new URLSearchParams();
  if (studentName) params.set("studentName", studentName);
  if (classDisplay) params.set("classDisplay", classDisplay);
  if (classKey) params.set("classKey", classKey);
  if (note) params.set("note", note);
  return `/panel/randevu?${params.toString()}`;
};

const matchesScheduledAppointment = (
  appointment: Appointment,
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

function AppointmentButton({ href, isScheduled = false }: { href: string; isScheduled?: boolean }) {
  if (isScheduled) {
    return (
      <Button size="sm" className="w-full border-0 bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-lg shadow-orange-500/20 transition-all hover:scale-[1.01] hover:from-amber-500 hover:to-orange-500 sm:w-auto" disabled>
        <Calendar className="mr-2 h-4 w-4" />
        Randevu verildi
      </Button>
    );
  }

  return (
    <Button asChild size="sm" className="w-full border-0 bg-gradient-to-r from-indigo-600 via-sky-600 to-cyan-600 text-white shadow-lg shadow-cyan-500/20 transition-all hover:scale-[1.01] hover:from-indigo-500 hover:via-sky-500 hover:to-cyan-500 sm:w-auto">
      <Link href={href}>
        <ArrowRight className="mr-2 h-4 w-4" />
        Randevuya dönüştür
      </Link>
    </Button>
  );
}

export default function PotansiyelGorusmelerPage() {
  const router = useRouter();
  const { appointments, loading: appointmentsLoading, error: appointmentsError, fetchAppointments } = useAppointments();
  const [activeTab, setActiveTab] = useState<SourceTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [applicationsSearchQuery, setApplicationsSearchQuery] = useState("");
  const [applicationsClassFilter, setApplicationsClassFilter] = useState("");
  const [applicationsSourceFilter, setApplicationsSourceFilter] = useState<"all" | "Veli Talepleri" | "Öğretmen Yönlendirmeleri" | "Öğrenci Bildirimleri" | "Gözlem Havuzu" | "Bireysel Başvuru">("all");
  const [applicationsReferrerFilter, setApplicationsReferrerFilter] = useState("");
  const [applicationsStatusFilter, setApplicationsStatusFilter] = useState<"all" | "Görüşüldü" | "Randevu verildi" | "Bekliyor">("all");
  const [loading, setLoading] = useState(true);
  const [attendedAppointments, setAttendedAppointments] = useState<Appointment[]>([]);
  const [scheduledAppointments, setScheduledAppointments] = useState<Appointment[]>([]);
  const [referrals, setReferrals] = useState<ReferralRecord[]>([]);
  const [observations, setObservations] = useState<ObservationPoolRecord[]>([]);
  const [incidents, setIncidents] = useState<StudentIncidentRecord[]>([]);
  const [requests, setRequests] = useState<ParentMeetingRequestRecord[]>([]);
  const [individualRequests, setIndividualRequests] = useState<IndividualRequestRecord[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

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
        fetch("/api/individual-requests?status=pending")
      ]);

      if (referralResult.error) throw referralResult.error;
      if (incidentResult.error) throw incidentResult.error;
      if (requestResult.error) throw requestResult.error;
      if (attendedResult.error) throw attendedResult.error;
      if (scheduledResult.error) throw scheduledResult.error;

      setReferrals((referralResult.data || []) as ReferralRecord[]);
      setIncidents((incidentResult.data || []) as StudentIncidentRecord[]);
      setRequests((requestResult.data || []) as ParentMeetingRequestRecord[]);
      setAttendedAppointments((attendedResult.data || []) as Appointment[]);
      setScheduledAppointments((scheduledResult.data || []) as Appointment[]);

      if (observationResult.ok) {
        const json = await observationResult.json();
        setObservations(Array.isArray(json.observations) ? json.observations : []);
      } else {
        setObservations([]);
      }

      if (individualRequestResult.ok) {
        const json = await individualRequestResult.json();
        setIndividualRequests(Array.isArray(json.requests) ? json.requests : []);
      } else {
        setIndividualRequests([]);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Beklenmeyen hata";
      setLoadError(message);
      toast.error("Potansiyel görüşmeler yüklenemedi");
      console.error("Potansiyel görüşmeler yüklenemedi:", message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const query = normalizeText(searchQuery);

  const isAlreadyAttended = (studentName: string, classDisplay?: string | null, classKey?: string | null) =>
    attendedAppointments.some((appointment) =>
      matchesAttendedAppointment(appointment, studentName, classDisplay, classKey)
    );

  const isAppointmentScheduled = (studentName: string, classDisplay?: string | null, classKey?: string | null) =>
    scheduledAppointments.some((appointment) =>
      matchesScheduledAppointment(appointment, studentName, classDisplay, classKey)
    );

  const getApplicationStatus = (
    source: ApplicationRecord["source"],
    record: any,
    isScheduled: boolean
  ): ApplicationRecord["status"] => {
    if (isScheduled) return "Randevu verildi";

    if (source === "Öğrenci Bildirimleri") {
      if (record.status === "resolved" || record.status === "dismissed") return "Görüşüldü";
      return "Bekliyor";
    }

    if (source === "Öğretmen Yönlendirmeleri") {
      return "Bekliyor";
    }

    if (source === "Gözlem Havuzu") {
      if (record.status === "converted") return "Randevu verildi";
      if (record.status === "completed") return "Görüşüldü";
      return "Bekliyor";
    }

    if (source === "Veli Talepleri") {
      if (record.status === "scheduled") return "Randevu verildi";
      if (record.status === "closed") return "Görüşüldü";
      return "Bekliyor";
    }

    if (source === "Bireysel Başvuru") {
      if (record.status === "completed") return "Görüşüldü";
      if (record.status === "cancelled") return "Bekliyor";
      return "Bekliyor";
    }

    return "Bekliyor";
  };

  const filteredIncidents = useMemo(() => {
    return incidents.filter((incident) =>
      !isAlreadyAttended(incident.target_student_name, incident.target_class_display, incident.target_class_key) &&
      !isAppointmentScheduled(incident.target_student_name, incident.target_class_display, incident.target_class_key) &&
      matchesQuery(
        [
          incident.target_student_name,
          incident.reporter_student_name,
          incident.description,
          incident.status,
          incident.incident_type
        ],
        query
      )
    );
  }, [incidents, query, attendedAppointments, scheduledAppointments]);

  const filteredReferrals = useMemo(() => {
    return referrals.filter((referral) =>
      !isAlreadyAttended(referral.student_name, referral.class_display, referral.class_key) &&
      !isAppointmentScheduled(referral.student_name, referral.class_display, referral.class_key) &&
      matchesQuery([referral.student_name, referral.teacher_name, referral.class_display, referral.reason, referral.note], query)
    );
  }, [referrals, query, attendedAppointments, scheduledAppointments]);

  const filteredObservations = useMemo(() => {
    return observations.filter((observation) =>
      !isAlreadyAttended(observation.student_name, observation.class_display, observation.class_key) &&
      !isAppointmentScheduled(observation.student_name, observation.class_display, observation.class_key) &&
      matchesQuery(
        [
          observation.student_name,
          observation.student_number,
          observation.class_display,
          observation.note,
          observation.observation_type,
          observation.priority,
          observation.status
        ],
        query
      )
    );
  }, [observations, query, attendedAppointments, scheduledAppointments]);

  const filteredRequests = useMemo(() => {
    return requests.filter((request) =>
      !isAlreadyAttended(request.student_name, request.class_display, request.class_key) &&
      !isAppointmentScheduled(request.student_name, request.class_display, request.class_key) &&
      matchesQuery(
        [
          request.student_name,
          request.parent_name,
          request.class_display,
          request.subject,
          request.detail,
          request.status
        ],
        query
      )
    );
  }, [requests, query, attendedAppointments, scheduledAppointments]);

  const filteredIndividualRequests = useMemo(() => {
    return individualRequests.filter((request) =>
      !isAlreadyAttended(request.student_name, request.class_display, request.class_key) &&
      !isAppointmentScheduled(request.student_name, request.class_display, request.class_key) &&
      matchesQuery(
        [
          request.student_name,
          request.class_display,
          request.note,
          request.status
        ],
        query
      )
    );
  }, [individualRequests, query, attendedAppointments, scheduledAppointments]);

  const applicationRecords = useMemo<ApplicationRecord[]>(() => {
    const applications: ApplicationRecord[] = [];

    incidents.forEach((incident) => {
      const student = incident.target_student_name || "";
      const classDisplay = incident.target_class_display || incident.target_class_key || "";
      const isScheduled = isAppointmentScheduled(student, incident.target_class_display, incident.target_class_key);
      applications.push({
        id: incident.id || `incident-${student}-${incident.incident_date}`,
        student_name: student,
        class_display: classDisplay,
        class_key: incident.target_class_key || "",
        source: "Öğrenci Bildirimleri",
        referrer: incident.reporter_student_name || "",
        date: incident.incident_date || incident.created_at || "",
        status: getApplicationStatus("Öğrenci Bildirimleri", incident, isScheduled),
        note: incident.description || ""
      });
    });

    referrals.forEach((referral) => {
      const student = referral.student_name;
      const classDisplay = referral.class_display || referral.class_key || "";
      const isScheduled = isAppointmentScheduled(student, referral.class_display, referral.class_key);
      applications.push({
        id: referral.id || `referral-${student}-${referral.created_at}`,
        student_name: student,
        class_display: classDisplay,
        class_key: referral.class_key || "",
        source: "Öğretmen Yönlendirmeleri",
        referrer: referral.teacher_name || "",
        date: referral.created_at || "",
        status: getApplicationStatus("Öğretmen Yönlendirmeleri", referral, isScheduled),
        note: referral.reason || referral.note || ""
      });
    });

    observations.forEach((observation) => {
      const student = observation.student_name;
      const classDisplay = observation.class_display || observation.class_key || "";
      const isScheduled = isAppointmentScheduled(student, observation.class_display, observation.class_key);
      applications.push({
        id: observation.id || `observation-${student}-${observation.observed_at}`,
        student_name: student,
        class_display: classDisplay,
        class_key: observation.class_key || "",
        source: "Gözlem Havuzu",
        referrer: "",
        date: observation.observed_at || observation.created_at || "",
        status: getApplicationStatus("Gözlem Havuzu", observation, isScheduled),
        note: observation.note || ""
      });
    });

    requests.forEach((request) => {
      const student = request.student_name;
      const classDisplay = request.class_display || request.class_key || "";
      const isScheduled = isAppointmentScheduled(student, request.class_display, request.class_key);
      applications.push({
        id: request.id || `request-${student}-${request.created_at}`,
        student_name: student,
        class_display: classDisplay,
        class_key: request.class_key || "",
        source: "Veli Talepleri",
        referrer: request.parent_name || "Veli",
        date: request.created_at || "",
        status: getApplicationStatus("Veli Talepleri", request, isScheduled),
        note: request.subject || request.detail || ""
      });
    });

    individualRequests.forEach((req) => {
      const student = req.student_name;
      const classDisplay = req.class_display || req.class_key || "";
      const isScheduled = isAppointmentScheduled(student, req.class_display, req.class_key);
      applications.push({
        id: req.id || `individual-${student}-${req.request_date}`,
        student_name: student,
        class_display: classDisplay,
        class_key: req.class_key || "",
        source: "Bireysel Başvuru",
        referrer: "",
        date: req.request_date || req.created_at || "",
        status: getApplicationStatus("Bireysel Başvuru", req, isScheduled),
        note: req.note || ""
      });
    });

    return applications
      .filter((record) => record.student_name)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [incidents, referrals, observations, requests, individualRequests, isAppointmentScheduled]);

  const applicationClassOptions = useMemo(() => {
    const classesSet = new Set<string>();
    applicationRecords.forEach((record) => {
      if (record.class_display) classesSet.add(record.class_display);
    });
    return Array.from(classesSet).sort((a, b) => a.localeCompare(b, "tr"));
  }, [applicationRecords]);

  const applicationReferrerOptions = useMemo(() => {
    const refs = new Set<string>();
    applicationRecords.forEach((record) => {
      if (record.referrer) refs.add(record.referrer);
    });
    return Array.from(refs).sort((a, b) => a.localeCompare(b, "tr"));
  }, [applicationRecords]);

  const filteredApplications = useMemo(() => {
    return applicationRecords.filter((record) => {
      const matchesStudent = applicationsSearchQuery
        ? normalizeText(record.student_name).includes(normalizeText(applicationsSearchQuery))
        : true;
      const matchesClass = applicationsClassFilter
        ? normalizeText(record.class_display || "").includes(normalizeText(applicationsClassFilter))
        : true;
      const matchesSource = applicationsSourceFilter === "all" ? true : record.source === applicationsSourceFilter;
      const matchesReferrer = applicationsReferrerFilter
        ? normalizeText(record.referrer || "").includes(normalizeText(applicationsReferrerFilter))
        : true;
      const matchesStatus = applicationsStatusFilter === "all" ? true : record.status === applicationsStatusFilter;
      return matchesStudent && matchesClass && matchesSource && matchesReferrer && matchesStatus;
    });
  }, [applicationRecords, applicationsSearchQuery, applicationsClassFilter, applicationsSourceFilter, applicationsReferrerFilter, applicationsStatusFilter]);

  const totalVisible =

    filteredIncidents.length + filteredReferrals.length + filteredObservations.length + filteredRequests.length + filteredIndividualRequests.length;

  const handleEditSource = (kind: "incident" | "referral" | "observation" | "request" | "individual-request", record: { id?: string; studentName: string; classDisplay?: string | null }) => {
    const classDisplay = record.classDisplay || undefined;
    const studentName = record.studentName || undefined;

    switch (kind) {
      case "incident":
        router.push("/panel/ogrenci-bildirimleri");
        return;
      case "referral":
        router.push(studentName ? `/panel/ogrenci-gecmisi?studentName=${encodeURIComponent(studentName)}${classDisplay ? `&classDisplay=${encodeURIComponent(classDisplay)}` : ""}` : "/panel/ogrenci-gecmisi");
        return;
      case "observation":
        router.push(studentName ? `/panel/gozlem-havuzu?studentName=${encodeURIComponent(studentName)}${classDisplay ? `&classDisplay=${encodeURIComponent(classDisplay)}` : ""}` : "/panel/gozlem-havuzu");
        return;
      case "request":
        router.push("/panel/veli-talepleri");
        return;
      case "individual-request":
        router.push(record.id ? `/panel/bireysel-basvurular?editId=${encodeURIComponent(record.id)}` : "/panel/bireysel-basvurular");
        return;
    }
  };

  const handleDeleteSource = async (kind: "incident" | "referral" | "observation" | "request" | "individual-request", id?: string) => {
    if (!id) {
      toast.error("Kayıt silinemedi");
      return;
    }

    const confirmed = window.confirm("Bu kaydı silmek istediğinize emin misiniz?");
    if (!confirmed) return;

    try {
      if (kind === "observation") {
        const res = await fetch(`/api/gozlem-havuzu?id=${encodeURIComponent(id)}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Gözlem kaydı silinemedi");
      } else if (kind === "incident") {
        const { error } = await supabase.from("student_incidents").delete().eq("id", id);
        if (error) throw error;
      } else if (kind === "referral") {
        const { error } = await supabase.from("referrals").delete().eq("id", id);
        if (error) throw error;
      } else if (kind === "request") {
        const { error } = await supabase.from("parent_meeting_requests").delete().eq("id", id);
        if (error) throw error;
      } else if (kind === "individual-request") {
        const res = await fetch(`/api/individual-requests?id=${encodeURIComponent(id)}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Bireysel başvuru silinemedi");
      }

      toast.success("Kayıt silindi");
      await loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Kayıt silinemedi";
      toast.error(message);
      console.error("Potansiyel görüşme silme hatası:", error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-cyan-900 to-teal-700 p-6 text-white shadow-xl">
        <div className="absolute inset-0 bg-grid-white/10" />
        <div className="absolute -top-20 -right-20 h-56 w-56 rounded-full bg-cyan-300/20 blur-3xl animate-float-slow" />
        <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-teal-400/20 blur-3xl animate-float-reverse" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm shadow-lg">
              <MessageSquare className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Potansiyel Görüşmeler</h1>
              <p className="text-slate-200">
                Öğretmen yönlendirmeleri, gözlem havuzu ve öğrenci bildirimleri tek ekranda.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="rounded-lg border border-white/10 bg-white/10 px-3 py-2 backdrop-blur-sm">
              <p className="text-[10px] uppercase tracking-wider text-cyan-100">Toplam</p>
              <p className="text-lg font-bold leading-none">{totalVisible}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/10 px-3 py-2 backdrop-blur-sm">
              <p className="text-[10px] uppercase tracking-wider text-cyan-100">Bildirim</p>
              <p className="text-lg font-bold leading-none">{filteredIncidents.length}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/10 px-3 py-2 backdrop-blur-sm">
              <p className="text-[10px] uppercase tracking-wider text-cyan-100">Yönlendirme</p>
              <p className="text-lg font-bold leading-none">{filteredReferrals.length}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/10 px-3 py-2 backdrop-blur-sm">
              <p className="text-[10px] uppercase tracking-wider text-cyan-100">Gözlem</p>
              <p className="text-lg font-bold leading-none">{filteredObservations.length}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/10 px-3 py-2 backdrop-blur-sm">
              <p className="text-[10px] uppercase tracking-wider text-cyan-100">Veli Talebi</p>
              <p className="text-lg font-bold leading-none">{filteredRequests.length}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/10 px-3 py-2 backdrop-blur-sm">
              <p className="text-[10px] uppercase tracking-wider text-cyan-100">Bireysel</p>
              <p className="text-lg font-bold leading-none">{filteredIndividualRequests.length}</p>
            </div>
          </div>
        </div>
      </div>

      <Card className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Öğrenci adı, sınıf, öğretmen, açıklama..."
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {loadError && (
        <Card className="overflow-hidden rounded-2xl border border-amber-200 bg-amber-50 shadow-sm">
          <CardContent className="p-4 text-sm text-amber-800">
            <strong>Yükleme uyarısı:</strong> {loadError}
          </CardContent>
        </Card>
      )}

      {loading ? (
        <Card className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <CardContent className="flex items-center justify-center py-14">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-600" />
            <span className="ml-3 text-slate-600">Potansiyel görüşmeler yükleniyor...</span>
          </CardContent>
        </Card>
      ) : (
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as SourceTab)}>
          <TabsList className="grid h-auto w-full grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-2 md:grid-cols-6">
            {VISIBLE_POTENTIAL_MEETINGS_TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className={POTENTIAL_MEETINGS_TAB_TRIGGER_CLASSES}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="all" className="mt-6 space-y-4">
            <SectionBlock
              title="Öğrenci Bildirimleri"
              icon={MessageSquare}
              count={filteredIncidents.length}
              emptyText="Bildirim bulunamadı"
            >
              {filteredIncidents.map((incident) => (
                <IncidentCard
                  key={incident.id}
                  incident={incident}
                  isScheduled={isAppointmentScheduled(incident.target_student_name, incident.target_class_display, incident.target_class_key)}
                  onEdit={() => handleEditSource("incident", { studentName: incident.target_student_name || "", classDisplay: incident.target_class_display || null })}
                  onDelete={() => handleDeleteSource("incident", incident.id)}
                />
              ))}
            </SectionBlock>

            <SectionBlock
              title="Öğretmen Yönlendirmeleri"
              icon={Users}
              count={filteredReferrals.length}
              emptyText="Yönlendirme bulunamadı"
            >
              {filteredReferrals.map((referral) => (
                <ReferralCard
                  key={referral.id}
                  referral={referral}
                  isScheduled={isAppointmentScheduled(referral.student_name, referral.class_display, referral.class_key)}
                  onEdit={() => handleEditSource("referral", { studentName: referral.student_name, classDisplay: referral.class_display || null })}
                  onDelete={() => handleDeleteSource("referral", referral.id)}
                />
              ))}
            </SectionBlock>

            <SectionBlock
              title="Gözlem Havuzu"
              icon={Eye}
              count={filteredObservations.length}
              emptyText="Gözlem kaydı bulunamadı"
            >
              {filteredObservations.map((observation) => (
                <ObservationCard
                  key={observation.id}
                  observation={observation}
                  isScheduled={isAppointmentScheduled(observation.student_name, observation.class_display, observation.class_key)}
                  onEdit={() => handleEditSource("observation", { studentName: observation.student_name, classDisplay: observation.class_display || null })}
                  onDelete={() => handleDeleteSource("observation", observation.id)}
                />
              ))}
            </SectionBlock>

            <SectionBlock
              title="Veli Talepleri"
              icon={PhoneCall}
              count={filteredRequests.length}
              emptyText="Veli talebi bulunamadı"
            >
              {filteredRequests.map((request) => (
                <ParentRequestCard
                  key={request.id}
                  request={request}
                  isScheduled={isAppointmentScheduled(request.student_name, request.class_display, request.class_key)}
                  onEdit={() => handleEditSource("request", { studentName: request.student_name, classDisplay: request.class_display || null })}
                  onDelete={() => handleDeleteSource("request", request.id)}
                />
              ))}
            </SectionBlock>

            <SectionBlock
              title="Bireysel Başvurular"
              icon={MessageSquare}
              count={filteredIndividualRequests.length}
              emptyText="Bireysel başvuru bulunamadı"
            >
              {filteredIndividualRequests.map((request) => (
                <IndividualRequestCard
                  key={request.id}
                  request={request}
                  isScheduled={isAppointmentScheduled(request.student_name, request.class_display, request.class_key)}
                  onEdit={() => handleEditSource("individual-request", { studentName: request.student_name, classDisplay: request.class_display || null })}
                  onDelete={() => handleDeleteSource("individual-request", request.id)}
                />
              ))}
            </SectionBlock>
          </TabsContent>

          <TabsContent value="incidents" className="mt-6">
            <SectionBlock
              title="Öğrenci Bildirimleri"
              icon={MessageSquare}
              count={filteredIncidents.length}
              emptyText="Bildirim bulunamadı"
            >
              {filteredIncidents.map((incident) => (
                <IncidentCard
                  key={incident.id}
                  incident={incident}
                  isScheduled={isAppointmentScheduled(incident.target_student_name, incident.target_class_display, incident.target_class_key)}
                  onEdit={() => handleEditSource("incident", { studentName: incident.target_student_name || "", classDisplay: incident.target_class_display || null })}
                  onDelete={() => handleDeleteSource("incident", incident.id)}
                />
              ))}
            </SectionBlock>
          </TabsContent>

          <TabsContent value="referrals" className="mt-6">
            <SectionBlock
              title="Öğretmen Yönlendirmeleri"
              icon={Users}
              count={filteredReferrals.length}
              emptyText="Yönlendirme bulunamadı"
            >
              {filteredReferrals.map((referral) => (
                <ReferralCard
                  key={referral.id}
                  referral={referral}
                  isScheduled={isAppointmentScheduled(referral.student_name, referral.class_display, referral.class_key)}
                  onEdit={() => handleEditSource("referral", { studentName: referral.student_name, classDisplay: referral.class_display || null })}
                  onDelete={() => handleDeleteSource("referral", referral.id)}
                />
              ))}
            </SectionBlock>
          </TabsContent>

          <TabsContent value="observations" className="mt-6">
            <SectionBlock
              title="Gözlem Havuzu"
              icon={Eye}
              count={filteredObservations.length}
              emptyText="Gözlem kaydı bulunamadı"
            >
              {filteredObservations.map((observation) => (
                <ObservationCard
                  key={observation.id}
                  observation={observation}
                  isScheduled={isAppointmentScheduled(observation.student_name, observation.class_display, observation.class_key)}
                  onEdit={() => handleEditSource("observation", { studentName: observation.student_name, classDisplay: observation.class_display || null })}
                  onDelete={() => handleDeleteSource("observation", observation.id)}
                />
              ))}
            </SectionBlock>
          </TabsContent>

          <TabsContent value="requests" className="mt-6">
            <SectionBlock
              title="Veli Talepleri"
              icon={PhoneCall}
              count={filteredRequests.length}
              emptyText="Veli talebi bulunamadı"
            >
              {filteredRequests.map((request) => (
                <ParentRequestCard
                  key={request.id}
                  request={request}
                  isScheduled={isAppointmentScheduled(request.student_name, request.class_display, request.class_key)}
                  onEdit={() => handleEditSource("request", { studentName: request.student_name, classDisplay: request.class_display || null })}
                  onDelete={() => handleDeleteSource("request", request.id)}
                />
              ))}
            </SectionBlock>
          </TabsContent>

          <TabsContent value="individual-requests" className="mt-6">
            <SectionBlock
              title="Bireysel Başvurular"
              icon={MessageSquare}
              count={filteredIndividualRequests.length}
              emptyText="Bireysel başvuru bulunamadı"
            >
              {filteredIndividualRequests.map((request) => (
                <IndividualRequestCard
                  key={request.id}
                  request={request}
                  isScheduled={isAppointmentScheduled(request.student_name, request.class_display, request.class_key)}
                  onEdit={() => handleEditSource("individual-request", { id: request.id, studentName: request.student_name, classDisplay: request.class_display || null })}
                  onDelete={() => handleDeleteSource("individual-request", request.id)}
                />
              ))}
            </SectionBlock>
          </TabsContent>

          <TabsContent value="applications" className="mt-6">
            <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <CardHeader className="border-b bg-slate-50 p-4">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" /> Başvurular
                  <Badge variant="secondary">{filteredApplications.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="grid gap-3 md:grid-cols-5">
                  <div>
                    <Label className="text-xs font-medium text-slate-500 mb-1 block">Öğrenci Ara</Label>
                    <Input
                      value={applicationsSearchQuery}
                      onChange={(e) => setApplicationsSearchQuery(e.target.value)}
                      placeholder="Ad soyad ara..."
                      className="w-full"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-slate-500 mb-1 block">Sınıf</Label>
                    <select
                      value={applicationsClassFilter}
                      onChange={(e) => setApplicationsClassFilter(e.target.value)}
                      className="w-full rounded-lg border px-2 py-2 text-sm"
                    >
                      <option value="">Tümü</option>
                      {applicationClassOptions.map((cls) => (
                        <option key={cls} value={cls}>{cls}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-slate-500 mb-1 block">Geliş Türü</Label>
                    <select
                      value={applicationsSourceFilter}
                      onChange={(e) => setApplicationsSourceFilter(e.target.value as any)}
                      className="w-full rounded-lg border px-2 py-2 text-sm"
                    >
                      <option value="all">Tümü</option>
                      <option value="Veli Talepleri">Veli Talepleri</option>
                      <option value="Öğretmen Yönlendirmeleri">Öğretmen Yönlendirmeleri</option>
                      <option value="Öğrenci Bildirimleri">Öğrenci Bildirimleri</option>
                      <option value="Gözlem Havuzu">Gözlem Havuzu</option>
                      <option value="Bireysel Başvuru">Bireysel Başvuru</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-slate-500 mb-1 block">Yönlendiren</Label>
                    <select
                      value={applicationsReferrerFilter}
                      onChange={(e) => setApplicationsReferrerFilter(e.target.value)}
                      className="w-full rounded-lg border px-2 py-2 text-sm"
                    >
                      <option value="">Tümü</option>
                      {applicationReferrerOptions.map((ref) => (
                        <option key={ref} value={ref}>{ref}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-slate-500 mb-1 block">Durum</Label>
                    <select
                      value={applicationsStatusFilter}
                      onChange={(e) => setApplicationsStatusFilter(e.target.value as any)}
                      className="w-full rounded-lg border px-2 py-2 text-sm"
                    >
                      <option value="all">Tümü</option>
                      <option value="Görüşüldü">Görüşüldü</option>
                      <option value="Randevu verildi">Randevu verildi</option>
                      <option value="Bekliyor">Bekliyor</option>
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-600">
                        <th className="px-3 py-2">Ad Soyad</th>
                        <th className="px-3 py-2">Sınıf</th>
                        <th className="px-3 py-2">Geliş Türü</th>
                        <th className="px-3 py-2">Yönlendiren</th>
                        <th className="px-3 py-2">Tarih</th>
                        <th className="px-3 py-2">Durum</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredApplications.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-4 text-center text-slate-500">Kayıt bulunamadı.</td>
                        </tr>
                      ) : (
                        filteredApplications.map((item) => (
                          <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="px-3 py-2 font-medium text-slate-800">{item.student_name}</td>
                            <td className="px-3 py-2">{item.class_display || "-"}</td>
                            <td className="px-3 py-2">{item.source}</td>
                            <td className="px-3 py-2">{item.referrer || "-"}</td>
                            <td className="px-3 py-2">{new Date(item.date).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                            <td className="px-3 py-2">
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
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="appointments" className="mt-6">
            <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <CardHeader className="border-b bg-slate-50 p-4">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Calendar className="h-4 w-4" /> Randevular
                  <Badge variant="secondary">{appointments.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {appointmentsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-cyan-600" />
                    <span className="ml-2 text-slate-600">Randevular yükleniyor...</span>
                  </div>
                ) : appointments.length === 0 ? (
                  <p className="py-8 text-center text-slate-500">Randevu bulunamadı.</p>
                ) : (
                  <div className="space-y-3">
                    {appointments.map((appointment) => (
                      <div key={appointment.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-lg font-semibold text-slate-800">{appointment.participant_name}</h3>
                              <Badge variant="outline" className={
                                appointment.status === "planned" ? "border-blue-200 bg-blue-100 text-blue-700" :
                                appointment.status === "attended" ? "border-emerald-200 bg-emerald-100 text-emerald-700" :
                                appointment.status === "cancelled" ? "border-red-200 bg-red-100 text-red-700" :
                                "border-slate-200 bg-slate-100 text-slate-700"
                              }>
                                {appointment.status === "planned" ? "Planlandı" :
                                 appointment.status === "attended" ? "Gerçekleşti" :
                                 appointment.status === "cancelled" ? "İptal edildi" :
                                 appointment.status === "not_attended" ? "Gelmedi" :
                                 appointment.status === "postponed" ? "Ertelendi" :
                                 appointment.status}
                              </Badge>
                            </div>
                            <p className="mt-2 text-sm leading-6 text-slate-700">{appointment.purpose || "Konu belirtilmemiş"}</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="outline">
                              <Calendar className="mr-1 h-3.5 w-3.5" />
                              {formatDateTime(appointment.appointment_date)}
                            </Badge>
                            {appointment.location && (
                              <Badge variant="outline">
                                <MapPin className="mr-1 h-3.5 w-3.5" />
                                {appointment.location}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function SectionBlock({
  title,
  icon: Icon,
  count,
  emptyText,
  children
}: {
  title: string;
  icon: ComponentType<{ className?: string }>;
  count: number;
  emptyText: string;
  children: ReactNode;
}) {
  return (
    <Card className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <CardHeader className="border-b bg-slate-50 py-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Icon className="h-4 w-4" />
          <span>{title}</span>
          <Badge variant="secondary">{count}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-4">
        {count === 0 ? <p className="py-8 text-center text-slate-500">{emptyText}</p> : children}
      </CardContent>
    </Card>
  );
}

function IncidentCard({
  incident,
  onEdit,
  onDelete,
  isScheduled = false
}: {
  incident: StudentIncidentRecord;
  onEdit: () => void;
  onDelete: () => void;
  isScheduled?: boolean;
}) {
  const isLinkedReporter = incident.record_role === "linked_reporter";
  const roleLabel = isLinkedReporter ? "Bildirimi yapan" : "Hakkında bildirim yapılan";
  const roleBadgeClass = isLinkedReporter
    ? "border-emerald-200 bg-emerald-100 text-emerald-700"
    : "border-orange-200 bg-orange-100 text-orange-700";
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-slate-800">{incident.target_student_name}</h3>
            <Badge variant="outline" className={roleBadgeClass}>{roleLabel}</Badge>
            <div className="w-full sm:ml-auto sm:w-auto">
              <AppointmentButton
                href={buildAppointmentUrl(
                  incident.target_student_name,
                  incident.target_class_display || null,
                  incident.target_class_key || null,
                  incident.description
                )}
                isScheduled={isScheduled}
              />
            </div>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-700">{incident.description}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={onEdit}
            >
              <Edit2 className="mr-2 h-4 w-4" />
              Düzenle
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onDelete}
              className="text-red-600 hover:bg-red-50"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Sil
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">
            <Clock className="mr-1 h-3.5 w-3.5" />
            {formatDateTime(incident.created_at || incident.incident_date)}
          </Badge>
          {incident.is_confidential && <Badge variant="destructive">Gizli</Badge>}
        </div>
      </div>
    </div>
  );
}

function ReferralCard({
  referral,
  onEdit,
  onDelete,
  isScheduled = false
}: {
  referral: ReferralRecord;
  onEdit: () => void;
  onDelete: () => void;
  isScheduled?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-slate-800">{referral.student_name}</h3>
            <Badge variant="outline">Öğretmen yönlendirmesi</Badge>
            <div className="w-full sm:ml-auto sm:w-auto">
              <AppointmentButton href={buildAppointmentUrl(referral.student_name, referral.class_display || null, referral.class_key || null, referral.note || referral.reason)} isScheduled={isScheduled} />
            </div>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            {referral.teacher_name} - {referral.class_display}
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-700">{referral.reason}</p>
          {referral.note && <p className="mt-2 text-xs text-slate-500">Not: {referral.note}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={onEdit}>
              <Edit2 className="mr-2 h-4 w-4" />
              Düzenle
            </Button>
            <Button size="sm" variant="outline" onClick={onDelete} className="text-red-600 hover:bg-red-50">
              <Trash2 className="mr-2 h-4 w-4" />
              Sil
            </Button>
          </div>
        </div>
        <Badge variant="outline">
          <Calendar className="mr-1 h-3.5 w-3.5" />
          {formatDateTime(referral.created_at)}
        </Badge>
      </div>
    </div>
  );
}

function ObservationCard({
  observation,
  onEdit,
  onDelete,
  isScheduled = false
}: {
  observation: ObservationPoolRecord;
  onEdit: () => void;
  onDelete: () => void;
  isScheduled?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-slate-800">{observation.student_name}</h3>
            <Badge variant="outline">
              {OBSERVATION_TYPES.find((item) => item.value === observation.observation_type)?.label}
            </Badge>
            <Badge variant="outline">
              {OBSERVATION_PRIORITIES.find((item) => item.value === observation.priority)?.label}
            </Badge>
            <Badge variant="outline">
              {OBSERVATION_STATUSES.find((item) => item.value === observation.status)?.label}
            </Badge>
            <div className="w-full sm:ml-auto sm:w-auto">
              <AppointmentButton href={buildAppointmentUrl(observation.student_name, observation.class_display || null, observation.class_key || null, observation.note)} isScheduled={isScheduled} />
            </div>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            {observation.class_display || observation.class_key || "-"}{observation.student_number ? ` - ${observation.student_number}` : ""}
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-700">{observation.note}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={onEdit}>
              <Edit2 className="mr-2 h-4 w-4" />
              Düzenle
            </Button>
            <Button size="sm" variant="outline" onClick={onDelete} className="text-red-600 hover:bg-red-50">
              <Trash2 className="mr-2 h-4 w-4" />
              Sil
            </Button>
          </div>
        </div>
        <Badge variant="outline">
          <Clock className="mr-1 h-3.5 w-3.5" />
          {formatDateTime(observation.observed_at)}
        </Badge>
      </div>
    </div>
  );
}

function ParentRequestCard({
  request,
  onEdit,
  onDelete,
  isScheduled = false
}: {
  request: ParentMeetingRequestRecord;
  onEdit: () => void;
  onDelete: () => void;
  isScheduled?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-slate-800">{request.student_name}</h3>
            <Badge variant="outline">
              {PARENT_REQUEST_STATUSES.find((item) => item.value === request.status)?.label || request.status}
            </Badge>
            <div className="w-full sm:ml-auto sm:w-auto">
              <AppointmentButton href={buildAppointmentUrl(request.student_name, request.class_display || null, request.class_key || null, request.detail)} isScheduled={isScheduled} />
            </div>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            {request.class_display || request.class_key || "-"}
            {request.parent_name ? ` - ${request.parent_name}` : ""}
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-700">{request.subject}</p>
          <p className="mt-1 text-sm text-slate-500">{request.detail}</p>
          {request.preferred_contact && (
            <p className="mt-2 text-xs text-slate-500">Tercih edilen iletişim: {request.preferred_contact}</p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={onEdit}>
              <Edit2 className="mr-2 h-4 w-4" />
              Düzenle
            </Button>
            <Button size="sm" variant="outline" onClick={onDelete} className="text-red-600 hover:bg-red-50">
              <Trash2 className="mr-2 h-4 w-4" />
              Sil
            </Button>
          </div>
        </div>
        <Badge variant="outline">
          <Clock className="mr-1 h-3.5 w-3.5" />
          {formatDateTime(request.created_at)}
        </Badge>
      </div>
    </div>
  );
}

function IndividualRequestCard({
  request,
  onEdit,
  onDelete,
  isScheduled = false
}: {
  request: IndividualRequestRecord;
  onEdit: () => void;
  onDelete: () => void;
  isScheduled?: boolean;
}) {
  const formatDate = (value?: string | null) => {
    if (!value) return "-";
    return new Date(value).toLocaleDateString("tr-TR", {
      year: "numeric",
      month: "short",
      day: "2-digit"
    });
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-slate-800">{request.student_name}</h3>
            <Badge variant="outline">Bireysel başvuru</Badge>
            <div className="w-full sm:ml-auto sm:w-auto">
              <AppointmentButton href={buildAppointmentUrl(request.student_name, request.class_display || null, request.class_key || null, request.note)} isScheduled={isScheduled} />
            </div>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            {request.class_display || request.class_key || "Sınıf bilinmiyor"}
          </p>
          {request.note && <p className="mt-2 text-sm leading-6 text-slate-700">{request.note}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={onEdit}>
              <Edit2 className="mr-2 h-4 w-4" />
              Düzenle
            </Button>
            <Button size="sm" variant="outline" onClick={onDelete} className="text-red-600 hover:bg-red-50">
              <Trash2 className="mr-2 h-4 w-4" />
              Sil
            </Button>
          </div>
        </div>
        <Badge variant="outline">
          <Calendar className="mr-1 h-3.5 w-3.5" />
          {formatDate(request.request_date)}
        </Badge>
      </div>
    </div>
  );
}
