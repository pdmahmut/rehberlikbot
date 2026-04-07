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
import { MessageSquare, Users, Eye, Search, RefreshCw, Calendar, Clock, Loader2, PhoneCall, Edit2, Trash2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { StudentCard } from "@/components/StudentCard";
import { DetailModal, type DetailModalRecord } from "@/components/DetailModal";
import { useAppointments } from "../randevu/hooks";
import {
  POTENTIAL_MEETINGS_CHANGED_EVENT,
  POTENTIAL_MEETINGS_STORAGE_KEY,
  POTENTIAL_MEETINGS_HIDDEN_CHANGED_EVENT,
  POTENTIAL_MEETINGS_HIDDEN_STORAGE_KEY,
  loadHiddenPotentialMeetingKeys,
  buildPotentialMeetingStorageKey,
  hidePotentialMeetingKey
} from "@/lib/potentialMeetings";
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

const buildAppointmentUrl = (
  studentName: string,
  classDisplay?: string | null,
  classKey?: string | null,
  note?: string | null,
  sourceRequestId?: string
) => {
  const params = new URLSearchParams();
  if (studentName) params.set("studentName", studentName);
  if (classDisplay) params.set("classDisplay", classDisplay);
  if (classKey) params.set("classKey", classKey);
  if (note) params.set("note", note);
  if (sourceRequestId) params.set("requestId", sourceRequestId);
  return `/panel/randevu?${params.toString()}`;
};

const buildDetailModalItem = (
  type: "incident" | "referral" | "observation" | "request" | "individual",
  record: any
): DetailModalRecord => {
  switch (type) {
    case "incident":
      return {
        id: record.id,
        type,
        studentName: record.target_student_name || "-",
        classDisplay: record.target_class_display,
        classNumber: record.target_class_key,
        date: record.incident_date || record.created_at,
        note: record.description,
        sourceLabel: "Öğrenci Bildirimi",
        detailEntries: [
          ...(record.reporter_student_name ? [{ label: "Bildirimi Yapan", value: record.reporter_student_name }] : [])
        ]
      };

    case "referral":
      return {
        id: record.id,
        type,
        studentName: record.student_name,
        classDisplay: record.class_display,
        classNumber: record.class_key,
        date: record.created_at,
        note: record.note || record.reason,
        sourceLabel: "Öğretmen Yönlendirmesi",
        detailEntries: [
          { label: "Yönlendiren Öğretmen", value: record.teacher_name },
          { label: "Açıklama", value: record.note || record.reason }
        ]
      };

    case "observation":
      return {
        id: record.id,
        type,
        studentName: record.student_name,
        classDisplay: record.class_display,
        classNumber: record.student_number || record.class_key,
        date: record.observed_at || record.created_at,
        note: record.note,
        sourceLabel: "Gözlem",
        detailEntries: [
          { label: "Açıklama", value: record.note }
        ]
      };

    case "request":
      return {
        id: record.id,
        type,
        studentName: record.student_name,
        classDisplay: record.class_display,
        classNumber: record.class_key,
        date: record.created_at,
        note: record.detail,
        sourceLabel: "Veli Talebi",
        detailEntries: [
          { label: "Veli Adı", value: record.parent_name },
          { label: "Veli İlişkisi", value: record.parent_relation },
          { label: "Telefon", value: record.parent_phone }
        ]
      };

    case "individual":
      return {
        id: record.id,
        type,
        studentName: record.student_name,
        classDisplay: record.class_display,
        classNumber: record.class_key,
        date: record.request_date || record.created_at,
        note: record.note,
        sourceLabel: "Bireysel Başvuru",
        detailEntries: [
          { label: "Başvuru Durumu", value: record.status },
          { label: "Not", value: record.note }
        ]
      };

    default:
      return {
        id: record.id || "unknown",
        type,
        studentName: record.student_name || "-",
        classDisplay: record.class_display,
        classNumber: record.class_key,
        date: record.created_at,
        note: record.note || record.detail || record.description,
        sourceLabel: "Detaylar",
        detailEntries: []
      };
  }
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
  const [hiddenPotentialMeetingKeys, setHiddenPotentialMeetingKeys] = useState<string[]>([]);
  const [referrals, setReferrals] = useState<ReferralRecord[]>([]);
  const [observations, setObservations] = useState<ObservationPoolRecord[]>([]);
  const [incidents, setIncidents] = useState<StudentIncidentRecord[]>([]);
  const [requests, setRequests] = useState<ParentMeetingRequestRecord[]>([]);
  const [individualRequests, setIndividualRequests] = useState<IndividualRequestRecord[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<DetailModalRecord | null>(null);

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
        fetch("/api/individual-requests")
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

  useEffect(() => {
    setHiddenPotentialMeetingKeys(loadHiddenPotentialMeetingKeys());
  }, []);

  useEffect(() => {
    const handlePotentialMeetingsChanged = () => {
      loadData();
    };

    const handleHiddenPotentialMeetingsChanged = () => {
      setHiddenPotentialMeetingKeys(loadHiddenPotentialMeetingKeys());
    };

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === POTENTIAL_MEETINGS_STORAGE_KEY) {
        loadData();
      }
      if (event.key === POTENTIAL_MEETINGS_HIDDEN_STORAGE_KEY) {
        setHiddenPotentialMeetingKeys(loadHiddenPotentialMeetingKeys());
      }
    };

    window.addEventListener(POTENTIAL_MEETINGS_CHANGED_EVENT, handlePotentialMeetingsChanged);
    window.addEventListener(POTENTIAL_MEETINGS_HIDDEN_CHANGED_EVENT, handleHiddenPotentialMeetingsChanged);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener(POTENTIAL_MEETINGS_CHANGED_EVENT, handlePotentialMeetingsChanged);
      window.removeEventListener(POTENTIAL_MEETINGS_HIDDEN_CHANGED_EVENT, handleHiddenPotentialMeetingsChanged);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  const isPotentialMeetingHidden = (kind: "incident" | "referral" | "observation" | "request" | "individual-request", id?: string | null) => {
    if (!id) return false;
    return hiddenPotentialMeetingKeys.includes(buildPotentialMeetingStorageKey(kind, id));
  };

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
      if (record.status === "scheduled") return "Randevu verildi";
      if (record.status === "cancelled") return "Bekliyor";
      return "Bekliyor";
    }

    return "Bekliyor";
  };

  const filteredIncidents = useMemo(() => {
    return incidents.filter((incident) =>
      !isPotentialMeetingHidden("incident", incident.id) &&
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
  }, [incidents, query, attendedAppointments, scheduledAppointments, hiddenPotentialMeetingKeys]);

  const filteredReferrals = useMemo(() => {
    return referrals.filter((referral) =>
      !isPotentialMeetingHidden("referral", referral.id) &&
      !isAlreadyAttended(referral.student_name, referral.class_display, referral.class_key) &&
      !isAppointmentScheduled(referral.student_name, referral.class_display, referral.class_key) &&
      matchesQuery([referral.student_name, referral.teacher_name, referral.class_display, referral.reason, referral.note], query)
    );
  }, [referrals, query, attendedAppointments, scheduledAppointments, hiddenPotentialMeetingKeys]);

  const filteredObservations = useMemo(() => {
    return observations.filter((observation) =>
      !isPotentialMeetingHidden("observation", observation.id) &&
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
  }, [observations, query, attendedAppointments, scheduledAppointments, hiddenPotentialMeetingKeys]);

  const filteredRequests = useMemo(() => {
    return requests.filter((request) =>
      !isPotentialMeetingHidden("request", request.id) &&
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
  }, [requests, query, attendedAppointments, scheduledAppointments, hiddenPotentialMeetingKeys]);

  const filteredIndividualRequests = useMemo(() => {
    return individualRequests.filter((request) =>
      !isPotentialMeetingHidden("individual-request", request.id) &&
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
  }, [individualRequests, query, hiddenPotentialMeetingKeys]);

  // Tüm kayıtları birleştir ve kronolojik sırala
  const allMergedRecords = useMemo(() => {
    const records: Array<{
      id: string;
      studentName: string;
      classDisplay?: string | null;
      classNumber?: string | null;
      note?: string | null;
      date?: string | null;
      type: "incident" | "referral" | "observation" | "request" | "individual";
      data: any;
    }> = [];

    // Öğrenci Bildirimleri
    filteredIncidents.forEach((incident) => {
      if (isPotentialMeetingHidden("incident", incident.id)) return;
      records.push({
        id: `incident-${incident.id}`,
        studentName: incident.target_student_name || "",
        classDisplay: incident.target_class_display,
        classNumber: incident.target_class_key,
        note: incident.description,
        date: incident.incident_date || incident.created_at,
        type: "incident",
        data: incident,
      });
    });

    // Öğretmen Yönlendirmeleri
    filteredReferrals.forEach((referral) => {
      if (isPotentialMeetingHidden("referral", referral.id)) return;
      records.push({
        id: `referral-${referral.id}`,
        studentName: referral.student_name,
        classDisplay: referral.class_display,
        classNumber: referral.class_key,
        note: referral.reason || referral.note,
        date: referral.created_at,
        type: "referral",
        data: referral,
      });
    });

    // Gözlem Havuzu
    filteredObservations.forEach((observation) => {
      if (isPotentialMeetingHidden("observation", observation.id)) return;
      records.push({
        id: `observation-${observation.id}`,
        studentName: observation.student_name,
        classDisplay: observation.class_display,
        classNumber: observation.student_number || observation.class_key,
        note: observation.note,
        date: observation.observed_at || observation.created_at,
        type: "observation",
        data: observation,
      });
    });

    // Veli Talepleri
    filteredRequests.forEach((request) => {
      if (isPotentialMeetingHidden("request", request.id)) return;
      records.push({
        id: `request-${request.id}`,
        studentName: request.student_name,
        classDisplay: request.class_display,
        classNumber: request.class_key,
        note: request.subject || request.detail,
        date: request.created_at,
        type: "request",
        data: request,
      });
    });

    // Bireysel Başvurular
    individualRequests.forEach((request) => {
      if (isPotentialMeetingHidden("individual-request", request.id)) return;
      records.push({
        id: `individual-${request.id}`,
        studentName: request.student_name,
        classDisplay: request.class_display,
        classNumber: request.class_key,
        note: request.note,
        date: request.request_date || request.created_at,
        type: "individual",
        data: request,
      });
    });

    // Tarih'e göre sırala (en yeni en üstte)
    return records.sort((a, b) => {
      const dateA = new Date(a.date || 0).getTime();
      const dateB = new Date(b.date || 0).getTime();
      return dateB - dateA;
    });
  }, [
    filteredIncidents,
    filteredReferrals,
    filteredObservations,
    filteredRequests,
    filteredIndividualRequests,
    individualRequests,
    hiddenPotentialMeetingKeys
  ]);

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

    individualRequests.forEach((request) => {
      const student = request.student_name;
      const classDisplay = request.class_display || request.class_key || "";
      const isScheduled = isAppointmentScheduled(student, request.class_display, request.class_key);
      applications.push({
        id: request.id || `individual-${student}-${request.request_date}`,
        student_name: student,
        class_display: classDisplay,
        class_key: request.class_key || "",
        source: "Bireysel Başvuru",
        referrer: "",
        date: request.request_date || request.created_at || "",
        status: getApplicationStatus("Bireysel Başvuru", request, isScheduled),
        note: request.note || ""
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
    if (!record.id) {
      toast.error("Düzenlenecek kayıt bulunamadı");
      return;
    }

    const pageMap = {
      "incident": "/panel/ogrenci-bildirimleri",
      "referral": "/panel/bireysel-basvurular",
      "observation": "/panel/gozlem-havuzu",
      "request": "/panel/veli-talepleri",
      "individual-request": "/panel/bireysel-basvurular"
    };

    const typeMapForGeneric = {
      "referral": "teacher_referral",
      "individual-request": "individual"
    };

    const baseUrl = pageMap[kind];
    const params = new URLSearchParams();
    params.set("editId", record.id);
    params.set("referer", "potansiyel-gorusmeler");
    
    if (kind === "referral" || kind === "individual-request") {
      params.set("type", typeMapForGeneric[kind]);
    }

    router.push(`${baseUrl}?${params.toString()}`);
  };

  const handleDeleteSource = async (kind: "incident" | "referral" | "observation" | "request" | "individual-request", id?: string) => {
    if (!id) {
      toast.error("Kayıt silinemedi");
      return;
    }

    const confirmed = window.confirm("Bu kaydı silmek istediğinize emin misiniz?");
    if (!confirmed) return;

    try {
      if (kind === "request" || kind === "individual-request") {
        hidePotentialMeetingKey(kind, id);
        setHiddenPotentialMeetingKeys(loadHiddenPotentialMeetingKeys());
        toast.success("Kayıt potansiyel görüşmelerden kaldırıldı");
        return;
      }

      if (kind === "observation") {
        const res = await fetch(`/api/gozlem-havuzu?id=${encodeURIComponent(id)}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Gözlem kaydı silinemedi");
      } else if (kind === "incident") {
        const { error } = await supabase.from("student_incidents").delete().eq("id", id);
        if (error) throw error;
      } else if (kind === "referral") {
        const { error } = await supabase.from("referrals").delete().eq("id", id);
        if (error) throw error;
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

          <TabsContent value="all" className="mt-6">
            <Card className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <CardHeader className="border-b bg-slate-50 p-4">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" /> Tüm Kayıtlar (Kronolojik)
                  <Badge variant="secondary">{allMergedRecords.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {allMergedRecords.length === 0 ? (
                  <p className="py-8 text-center text-slate-500">Kayıt bulunamadı</p>
                ) : (
                  <div className="space-y-2">
                    {allMergedRecords.map((record) => {
                      const isScheduled = isAppointmentScheduled(
                        record.studentName,
                        record.classDisplay,
                        record.classNumber
                      );

                      let onEdit = () => {};
                      let onDelete = () => {};
                      let appointmentUrl = "";

                      if (record.type === "incident") {
                        const incident = record.data;
                        onEdit = () =>
                          handleEditSource("incident", {
                            id: incident.id,
                            studentName: incident.target_student_name || "",
                            classDisplay: incident.target_class_display || null,
                          });
                        onDelete = () => handleDeleteSource("incident", incident.id);
                        appointmentUrl = buildAppointmentUrl(
                          incident.target_student_name || "",
                          incident.target_class_display || null,
                          incident.target_class_key || null,
                          incident.description
                        );
                      } else if (record.type === "referral") {
                        const referral = record.data;
                        onEdit = () =>
                          handleEditSource("referral", {
                            id: referral.id,
                            studentName: referral.student_name,
                            classDisplay: referral.class_display || null,
                          });
                        onDelete = () => handleDeleteSource("referral", referral.id);
                        appointmentUrl = buildAppointmentUrl(
                          referral.student_name,
                          referral.class_display || null,
                          referral.class_key || null,
                          referral.note || referral.reason
                        );
                      } else if (record.type === "observation") {
                        const observation = record.data;
                        onEdit = () =>
                          handleEditSource("observation", {
                            id: observation.id,
                            studentName: observation.student_name,
                            classDisplay: observation.class_display || null,
                          });
                        onDelete = () => handleDeleteSource("observation", observation.id);
                        appointmentUrl = buildAppointmentUrl(
                          observation.student_name,
                          observation.class_display || null,
                          observation.class_key || null,
                          observation.note
                        );
                      } else if (record.type === "request") {
                        const request = record.data;
                        onEdit = () =>
                          handleEditSource("request", {
                            id: request.id,
                            studentName: request.student_name,
                            classDisplay: request.class_display || null,
                          });
                        onDelete = () => handleDeleteSource("request", request.id);
                        appointmentUrl = buildAppointmentUrl(
                          request.student_name,
                          request.class_display || null,
                          request.class_key || null,
                          request.detail
                        );
                      } else if (record.type === "individual") {
                        const req = record.data;
                        onEdit = () =>
                          handleEditSource("individual-request", {
                            id: req.id,
                            studentName: req.student_name,
                            classDisplay: req.class_display || null,
                          });
                        onDelete = () => handleDeleteSource("individual-request", req.id);
                        appointmentUrl = buildAppointmentUrl(
                          req.student_name,
                          req.class_display || null,
                          req.class_key || null,
                          req.note
                        );
                      }

                      return (
                        <div key={record.id} className="relative">
                          <StudentCard
                            studentName={record.studentName}
                            classDisplay={record.classDisplay}
                            classNumber={record.classNumber}
                            note={record.note}
                            date={record.date}
                            isScheduled={isScheduled}
                            onClick={() => setSelectedItem(buildDetailModalItem(record.type, record.data))}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            appointmentUrl={appointmentUrl}
                          />
                          <Badge
                            variant="outline"
                            className="absolute -top-2 -right-2 text-xs bg-white"
                          >
                            {record.type === "incident" && "Öğrenci Bildirimi"}
                            {record.type === "referral" && "Öğretmen Yönl."}
                            {record.type === "observation" && "Gözlem"}
                            {record.type === "request" && "Veli Talebi"}
                            {record.type === "individual" && "Bireysel Başv."}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="incidents" className="mt-6">
            <SectionBlock
              title="Öğrenci Bildirimleri"
              icon={MessageSquare}
              count={filteredIncidents.length}
              emptyText="Bildirim bulunamadı"
            >
              <div className="space-y-2">
                {filteredIncidents.map((incident) => (
                  <StudentCard
                    key={incident.id}
                    studentName={incident.target_student_name || ""}
                    classDisplay={incident.target_class_display}
                    classNumber={incident.target_class_key}
                    note={incident.description}
                    date={incident.incident_date || incident.created_at}
                    isScheduled={isAppointmentScheduled(incident.target_student_name, incident.target_class_display, incident.target_class_key)}
                    onClick={() => setSelectedItem(buildDetailModalItem("incident", incident))}
                    onEdit={() => handleEditSource("incident", { id: incident.id, studentName: incident.target_student_name || "", classDisplay: incident.target_class_display || null })}
                    onDelete={() => handleDeleteSource("incident", incident.id)}
                    appointmentUrl={buildAppointmentUrl(
                      incident.target_student_name || "",
                      incident.target_class_display || null,
                      incident.target_class_key || null,
                      incident.description
                    )}
                  />
                ))}
              </div>
            </SectionBlock>
          </TabsContent>

          <TabsContent value="referrals" className="mt-6">
            <SectionBlock
              title="Öğretmen Yönlendirmeleri"
              icon={Users}
              count={filteredReferrals.length}
              emptyText="Yönlendirme bulunamadı"
            >
              <div className="space-y-2">
                {filteredReferrals.map((referral) => (
                  <StudentCard
                    key={referral.id}
                    studentName={referral.student_name}
                    classDisplay={referral.class_display}
                    classNumber={referral.class_key}
                    note={referral.reason || referral.note}
                    date={referral.created_at}
                    isScheduled={isAppointmentScheduled(referral.student_name, referral.class_display, referral.class_key)}
                    onClick={() => setSelectedItem(buildDetailModalItem("referral", referral))}
                    onEdit={() => handleEditSource("referral", { id: referral.id, studentName: referral.student_name, classDisplay: referral.class_display || null })}
                    onDelete={() => handleDeleteSource("referral", referral.id)}
                    appointmentUrl={buildAppointmentUrl(referral.student_name, referral.class_display || null, referral.class_key || null, referral.note || referral.reason)}
                  />
                ))}
              </div>
            </SectionBlock>
          </TabsContent>

          <TabsContent value="observations" className="mt-6">
            <SectionBlock
              title="Gözlem Havuzu"
              icon={Eye}
              count={filteredObservations.length}
              emptyText="Gözlem kaydı bulunamadı"
            >
              <div className="space-y-2">
                {filteredObservations.map((observation) => (
                  <StudentCard
                    key={observation.id}
                    studentName={observation.student_name}
                    classDisplay={observation.class_display}
                    classNumber={observation.student_number || observation.class_key}
                    note={observation.note}
                    date={observation.observed_at || observation.created_at}
                    isScheduled={isAppointmentScheduled(observation.student_name, observation.class_display, observation.class_key)}
                    onClick={() => setSelectedItem(buildDetailModalItem("observation", observation))}
                    onEdit={() => handleEditSource("observation", { id: observation.id, studentName: observation.student_name, classDisplay: observation.class_display || null })}
                    onDelete={() => handleDeleteSource("observation", observation.id)}
                    appointmentUrl={buildAppointmentUrl(observation.student_name, observation.class_display || null, observation.class_key || null, observation.note)}
                  />
                ))}
              </div>
            </SectionBlock>
          </TabsContent>

          <TabsContent value="requests" className="mt-6">
            <SectionBlock
              title="Veli Talepleri"
              icon={PhoneCall}
              count={filteredRequests.length}
              emptyText="Veli talebi bulunamadı"
            >
              <div className="space-y-2">
                {filteredRequests.map((request) => (
                  <StudentCard
                    key={request.id}
                    studentName={request.student_name}
                    classDisplay={request.class_display}
                    classNumber={request.class_key}
                    note={request.subject || request.detail}
                    date={request.created_at}
                    isScheduled={isAppointmentScheduled(request.student_name, request.class_display, request.class_key)}
                    onClick={() => setSelectedItem(buildDetailModalItem("request", request))}
                    onEdit={() => handleEditSource("request", { id: request.id, studentName: request.student_name, classDisplay: request.class_display || null })}
                    onDelete={() => handleDeleteSource("request", request.id)}
                    appointmentUrl={buildAppointmentUrl(request.student_name, request.class_display || null, request.class_key || null, request.detail)}
                  />
                ))}
              </div>
            </SectionBlock>
          </TabsContent>

          <TabsContent value="individual-requests" className="mt-6">
            <SectionBlock
              title="Bireysel Başvurular"
              icon={MessageSquare}
              count={filteredIndividualRequests.length}
              emptyText="Bireysel başvuru bulunamadı"
            >
              <div className="space-y-2">
                {filteredIndividualRequests.map((request) => (
                  (() => {
                    const displayStatus = request.status === "scheduled"
                      ? (isAlreadyAttended(request.student_name, request.class_display, request.class_key) ? "completed" : "scheduled")
                      : request.status;

                    return (
                  <StudentCard
                    key={request.id}
                    studentName={request.student_name}
                    classDisplay={request.class_display}
                    classNumber={request.class_key}
                    note={request.note}
                    date={request.request_date || request.created_at}
                    requestStatus={displayStatus}
                    onClick={() => setSelectedItem(buildDetailModalItem("individual", request))}
                    onEdit={() => handleEditSource("individual-request", { id: request.id, studentName: request.student_name, classDisplay: request.class_display || null })}
                    onDelete={() => handleDeleteSource("individual-request", request.id)}
                    appointmentUrl={buildAppointmentUrl(request.student_name, request.class_display || null, request.class_key || null, request.note, request.id)}
                  />);
                  })()
                ))}
              </div>
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

      <DetailModal
        open={Boolean(selectedItem)}
        item={selectedItem}
        onOpenChange={(open) => {
          if (!open) setSelectedItem(null);
        }}
      />
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



