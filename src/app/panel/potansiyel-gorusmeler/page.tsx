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
import { notifyPotentialMeetingsChanged } from "@/lib/potentialMeetings";
import { MessageSquare, Users, Eye, Search, RefreshCw, Calendar, Clock, Loader2, PhoneCall, Edit2, Trash2, MapPin, X } from "lucide-react";
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
import { normalizeApplicationStatus, normalizeSourceType } from "@/lib/guidanceApplications";

type SourceTab = "all" | "active-follow-up" | "regular-meetings";

type SourceTabOption = {
  value: SourceTab;
  label: string;
};

const POTENTIAL_MEETINGS_TABS: SourceTabOption[] = [
  { value: "all", label: "Tümü" },
  { value: "active-follow-up", label: "Aktif Takip" },
  { value: "regular-meetings", label: "Düzenli Görüşmeler" },
];

const POTENTIAL_MEETINGS_TAB_TRIGGER_CLASSES =
  "inline-flex items-center justify-center whitespace-nowrap rounded-2xl px-3 py-2 text-sm font-semibold transition-all duration-200 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 " +
  "hover:bg-slate-200/70 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm data-[state=active]:border-b-2 data-[state=active]:border-slate-900 " +
  "data-[state=inactive]:text-slate-500/70";

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

const normalizeDecisionText = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
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

const toTimestamp = (value?: string | null) => {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const buildAppointmentUrl = (
  studentName: string,
  classDisplay?: string | null,
  classKey?: string | null,
  note?: string | null,
  sourceRequestId?: string,
  sourceObservationIds?: string[],
  sourceType?: string,
  sourceId?: string
) => {
  const params = new URLSearchParams();
  if (studentName) params.set("studentName", studentName);
  if (classDisplay) params.set("classDisplay", classDisplay);
  if (classKey) params.set("classKey", classKey);
  if (note) params.set("note", note);
  if (sourceRequestId) params.set("requestId", sourceRequestId);
  if (sourceType) params.set("sourceType", sourceType);
  if (sourceId) params.set("sourceId", sourceId);
  if (sourceObservationIds && sourceObservationIds.length > 0) {
    params.set("poolIds", sourceObservationIds.join(","));
  }
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
  const [activeFollowSearch, setActiveFollowSearch] = useState("");
  const [reReferralOnly, setReReferralOnly] = useState(false);
  const [multiSourceModal, setMultiSourceModal] = useState<{ studentName: string; classDisplay?: string | null; sources: any[] } | null>(null);
  const [reReferralHistoryModal, setReReferralHistoryModal] = useState<{ studentName: string; records: { type: string; referrer: string; note: string; date: string }[] } | null>(null);
  const [regularMeetingSearch, setRegularMeetingSearch] = useState("");

  const loadData = async () => {
    try {
      setLoading(true);
      setLoadError(null);

      const [referralResult, observationResult, incidentResult, requestResult, attendedResult, scheduledResult, individualRequestResult] = await Promise.all([
        supabase.from("referrals").select("*").order("created_at", { ascending: false }),
        fetch("/api/gozlem-havuzu"),
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

    // Randevu sayfasından geri dönünce (veya tab tekrar aktif olunca) yenile
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        loadData();
      }
    };

    // Next.js route değişikliği sonrası geri dönünce yenile
    const handleFocus = () => {
      loadData();
    };

    window.addEventListener(POTENTIAL_MEETINGS_CHANGED_EVENT, handlePotentialMeetingsChanged);
    window.addEventListener(POTENTIAL_MEETINGS_HIDDEN_CHANGED_EVENT, handleHiddenPotentialMeetingsChanged);
    window.addEventListener("storage", handleStorageChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener(POTENTIAL_MEETINGS_CHANGED_EVENT, handlePotentialMeetingsChanged);
      window.removeEventListener(POTENTIAL_MEETINGS_HIDDEN_CHANGED_EVENT, handleHiddenPotentialMeetingsChanged);
      window.removeEventListener("storage", handleStorageChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  const isPotentialMeetingHidden = (kind: "incident" | "referral" | "observation" | "request" | "individual-request", id?: string | null) => {
    if (!id) return false;
    return hiddenPotentialMeetingKeys.includes(buildPotentialMeetingStorageKey(kind, id));
  };

  const query = normalizeText(searchQuery);

  // Herhangi bir randevusu tamamlanmış mı (attended)?
  const isAlreadyAttended = (studentName: string, classDisplay?: string | null, classKey?: string | null) =>
    attendedAppointments.some((appointment) =>
      matchesAttendedAppointment(appointment, studentName, classDisplay, classKey)
    );

  const isAppointmentScheduled = (studentName: string, classDisplay?: string | null, classKey?: string | null) =>
    scheduledAppointments.some((appointment) =>
      matchesScheduledAppointment(appointment, studentName, classDisplay, classKey)
    );

  // Randevu tarihini döndür (varsa)
  const getScheduledDate = (studentName: string, classDisplay?: string | null, classKey?: string | null): string | null => {
    const apt = scheduledAppointments.find((appointment) =>
      matchesScheduledAppointment(appointment, studentName, classDisplay, classKey)
    );
    return apt?.appointment_date || null;
  };

  const appointmentDecisions = (appointment: Appointment) => appointment.outcome_decision || [];

  const isCompletedAppointment = (appointment: Appointment) =>
    appointmentDecisions(appointment).some((decision) => normalizeDecisionText(decision).includes("tamamlandi"));

  const isActiveFollowUpAppointment = (appointment: Appointment) =>
    appointmentDecisions(appointment).some((decision) => normalizeDecisionText(decision).includes("aktif takip"));

  const isRegularMeetingAppointment = (appointment: Appointment) =>
    appointmentDecisions(appointment).some((decision) => normalizeDecisionText(decision).includes("duzenli gorusme"));

  // Öğrencinin "Tamamlandı" outcome'lu bir randevusu var mı?
  const hasCompletedAppointment = (studentName: string, classDisplay?: string | null, classKey?: string | null) =>
    attendedAppointments.some((appointment) =>
      isCompletedAppointment(appointment) &&
      matchesAttendedAppointment(appointment, studentName, classDisplay, classKey)
    );

  // Öğrencinin herhangi bir işlenmiş (completed/active_follow/regular_meeting) randevusu var mı?
  const hasArchivedAppointment = (studentName: string, classDisplay?: string | null, classKey?: string | null) =>
    attendedAppointments.some((appointment) =>
      (isCompletedAppointment(appointment) || isActiveFollowUpAppointment(appointment) || isRegularMeetingAppointment(appointment)) &&
      matchesAttendedAppointment(appointment, studentName, classDisplay, classKey)
    );

  const isCentralRecordCompleted = (sourceType: string, sourceId?: string | null) =>
    observations.some((observation) =>
      normalizeSourceType(observation.source_type) === normalizeSourceType(sourceType) &&
      String(observation.source_record_id || observation.id) === String(sourceId || "") &&
      normalizeApplicationStatus(observation.status) === "completed"
    );

  const getApplicationStatus = (
    source: "Veli Talepleri" | "Öğretmen Yönlendirmeleri" | "Öğrenci Bildirimleri" | "Gözlem Havuzu" | "Bireysel Başvuru" | "Randevu",
    record: any,
    isScheduled: boolean
  ): "Görüşüldü" | "Randevu verildi" | "Bekliyor" => {
    if (source === "Öğrenci Bildirimleri") {
      if (record.status === "resolved" || record.status === "dismissed") return "Görüşüldü";
      return "Bekliyor";
    }

    if (source === "Öğretmen Yönlendirmeleri") {
      return "Bekliyor";
    }

    if (source === "Gözlem Havuzu") {
      if (record.status === "completed") return "Görüşüldü";
      if (record.status === "converted" || record.status === "scheduled") return "Randevu verildi";
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

    if (isScheduled) return "Randevu verildi";

    return "Bekliyor";
  };

  const filteredIncidents = useMemo(() => {
    return incidents.filter((incident) =>
      !isPotentialMeetingHidden("incident", incident.id) &&
      !isCentralRecordCompleted("student_report", incident.id) &&
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
  }, [incidents, observations, query, attendedAppointments, scheduledAppointments, hiddenPotentialMeetingKeys]);

  const filteredReferrals = useMemo(() => {
    return referrals.filter((referral) =>
      !isPotentialMeetingHidden("referral", referral.id) &&
      !isCentralRecordCompleted("teacher_referral", referral.id) &&
      !isAlreadyAttended(referral.student_name, referral.class_display, referral.class_key) &&
      !isAppointmentScheduled(referral.student_name, referral.class_display, referral.class_key) &&
      matchesQuery([referral.student_name, referral.teacher_name, referral.class_display, referral.reason, referral.note], query)
    );
  }, [referrals, observations, query, attendedAppointments, scheduledAppointments, hiddenPotentialMeetingKeys]);

  const filteredObservations = useMemo(() => {
    return observations.filter((observation) =>
      (observation.status === "pending" || observation.status === "scheduled" || observation.status === "converted") &&
      !isAlreadyAttended(observation.student_name, observation.class_display, observation.class_key) &&
      !isPotentialMeetingHidden("observation", observation.id) &&
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
  }, [observations, query, hiddenPotentialMeetingKeys, attendedAppointments]);

  const filteredRequests = useMemo(() => {
    return requests.filter((request) =>
      !isPotentialMeetingHidden("request", request.id) &&
      !isCentralRecordCompleted("parent_request", request.id) &&
      !isAlreadyAttended(request.student_name, request.class_display, request.class_key) &&
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
  }, [requests, observations, query, attendedAppointments, scheduledAppointments, hiddenPotentialMeetingKeys]);

  const filteredIndividualRequests = useMemo(() => {
    return individualRequests.filter((request) =>
      !isPotentialMeetingHidden("individual-request", request.id) &&
      !isCentralRecordCompleted("self_application", request.id) &&
      request.status !== "completed" &&
      !isAlreadyAttended(request.student_name, request.class_display, request.class_key) &&
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
  }, [individualRequests, observations, query, hiddenPotentialMeetingKeys, attendedAppointments]);

  const allObservationRecords = useMemo(() => {
    return observations
      .filter((observation) =>
        (observation.status === "pending" || observation.status === "converted") &&
        matchesQuery(
          [
            observation.student_name,
            observation.student_number,
            observation.class_display,
            observation.class_key,
            observation.note,
            observation.observation_type,
            observation.priority,
            observation.status
          ],
          query
        )
      )
      .sort((a, b) => toTimestamp(b.created_at) - toTimestamp(a.created_at));
  }, [observations, query]);

  const sortedIncidents = useMemo(() => [...filteredIncidents].sort((a, b) => toTimestamp(b.created_at) - toTimestamp(a.created_at)), [filteredIncidents]);
  const sortedReferrals = useMemo(() => [...filteredReferrals].sort((a, b) => toTimestamp(b.created_at) - toTimestamp(a.created_at)), [filteredReferrals]);
  const sortedObservations = useMemo(() => [...filteredObservations].sort((a, b) => toTimestamp(b.created_at) - toTimestamp(a.created_at)), [filteredObservations]);
  const sortedRequests = useMemo(() => [...filteredRequests].sort((a, b) => toTimestamp(b.created_at) - toTimestamp(a.created_at)), [filteredRequests]);
  const sortedIndividualRequests = useMemo(() => [...filteredIndividualRequests].sort((a, b) => toTimestamp(b.created_at) - toTimestamp(a.created_at)), [filteredIndividualRequests]);
  const sortedAppointments = useMemo(() => [...appointments].sort((a, b) => toTimestamp(b.created_at) - toTimestamp(a.created_at)), [appointments]);

  const trackedAppointments = useMemo(
    () =>
      attendedAppointments.filter((appointment) =>
        !isCompletedAppointment(appointment) &&
        (isActiveFollowUpAppointment(appointment) || isRegularMeetingAppointment(appointment))
      ),
    [attendedAppointments]
  );

  const activeFollowUpAppointments = useMemo(
    () => [...trackedAppointments]
      .filter((appointment) => isActiveFollowUpAppointment(appointment))
      .sort((a, b) => toTimestamp(b.updated_at || b.created_at) - toTimestamp(a.updated_at || a.created_at)),
    [trackedAppointments]
  );

  const regularMeetingAppointments = useMemo(
    () => [...trackedAppointments]
      .filter((appointment) => isRegularMeetingAppointment(appointment))
      .sort((a, b) => toTimestamp(b.updated_at || b.created_at) - toTimestamp(a.updated_at || a.created_at)),
    [trackedAppointments]
  );


  const filteredActiveFollowUp = useMemo(() => {
    if (!activeFollowSearch.trim()) return activeFollowUpAppointments;
    const q = normalizeText(activeFollowSearch);
    return activeFollowUpAppointments.filter((a) =>
      normalizeText(a.participant_name || "").includes(q) ||
      normalizeText(a.participant_class || "").includes(q) ||
      normalizeText(a.purpose || "").includes(q)
    );
  }, [activeFollowUpAppointments, activeFollowSearch]);

  const filteredRegularMeetings = useMemo(() => {
    if (!regularMeetingSearch.trim()) return regularMeetingAppointments;
    const q = normalizeText(regularMeetingSearch);
    return regularMeetingAppointments.filter((a) =>
      normalizeText(a.participant_name || "").includes(q) ||
      normalizeText(a.participant_class || "").includes(q) ||
      normalizeText(a.purpose || "").includes(q)
    );
  }, [regularMeetingAppointments, regularMeetingSearch]);

  const visibleAppointments = useMemo(
    () => sortedAppointments.filter((appointment) => appointment.status === "planned"),
    [sortedAppointments]
  );

  // Tüm kayıtları birleştir — sadece henüz işlenmemiş (archived/attended olmayan) öğrenciler
  const allMergedRecords = useMemo(() => {
    const records: Array<{
      id: string;
      studentName: string;
      classDisplay?: string | null;
      classNumber?: string | null;
      note?: string | null;
      date?: string | null;
      sortTimestamp: number;
      type: "incident" | "referral" | "observation" | "request" | "individual";
      data: any;
    }> = [];

    // Öğrenci Bildirimleri
    sortedIncidents.forEach((incident) => {
      if (isPotentialMeetingHidden("incident", incident.id)) return;
      if (isCentralRecordCompleted("student_report", incident.id)) return;
      if (hasArchivedAppointment(incident.target_student_name, incident.target_class_display, incident.target_class_key)) return;
      // Tamamlandı seçildiyse (isAlreadyAttended) tüm sekmesinden düş
      if (isAlreadyAttended(incident.target_student_name, incident.target_class_display, incident.target_class_key)) return;
      records.push({
        id: `incident-${incident.id}`,
        studentName: incident.target_student_name || "",
        classDisplay: incident.target_class_display,
        classNumber: incident.target_class_key,
        note: incident.description,
        date: incident.incident_date || incident.created_at,
        sortTimestamp: toTimestamp(incident.created_at || incident.incident_date),
        type: "incident",
        data: incident,
      });
    });

    // Öğretmen Yönlendirmeleri
    sortedReferrals.forEach((referral) => {
      if (isPotentialMeetingHidden("referral", referral.id)) return;
      if (isCentralRecordCompleted("teacher_referral", referral.id)) return;
      if (hasArchivedAppointment(referral.student_name, referral.class_display, referral.class_key)) return;
      if (isAlreadyAttended(referral.student_name, referral.class_display, referral.class_key)) return;
      records.push({
        id: `referral-${referral.id}`,
        studentName: referral.student_name,
        classDisplay: referral.class_display,
        classNumber: referral.class_key,
        note: referral.note || referral.reason,
        date: referral.created_at,
        sortTimestamp: toTimestamp(referral.created_at),
        type: "referral",
        data: referral,
      });
    });

    // Gözlem Havuzu — pending ve scheduled olanlar listede kalır
    // isAlreadyAttended kontrolü filteredObservations'da yapılıyor, burada tekrar yapmaya gerek yok
    sortedObservations.forEach((observation) => {
      if (isPotentialMeetingHidden("observation", observation.id)) return;
      records.push({
        id: `observation-${observation.id}`,
        studentName: observation.student_name,
        classDisplay: observation.class_display,
        classNumber: observation.class_key,
        note: observation.note,
        date: observation.observed_at || observation.created_at,
        sortTimestamp: toTimestamp(observation.created_at),
        type: "observation",
        data: observation,
      });
    });

    // Veli Talepleri
    sortedRequests.forEach((request) => {
      if (isPotentialMeetingHidden("request", request.id)) return;
      if (isCentralRecordCompleted("parent_request", request.id)) return;
      if (hasArchivedAppointment(request.student_name, request.class_display, request.class_key)) return;
      if (isAlreadyAttended(request.student_name, request.class_display, request.class_key)) return;
      records.push({
        id: `request-${request.id}`,
        studentName: request.student_name,
        classDisplay: request.class_display,
        classNumber: request.class_key,
        note: request.detail || request.subject,
        date: request.created_at,
        sortTimestamp: toTimestamp(request.created_at),
        type: "request",
        data: request,
      });
    });

    // Bireysel Başvurular
    sortedIndividualRequests.forEach((req) => {
      if (isPotentialMeetingHidden("individual-request", req.id)) return;
      if (isCentralRecordCompleted("self_application", req.id)) return;
      if (hasArchivedAppointment(req.student_name, req.class_display, req.class_key)) return;
      if (isAlreadyAttended(req.student_name, req.class_display, req.class_key)) return;
      records.push({
        id: `individual-${req.id}`,
        studentName: req.student_name,
        classDisplay: req.class_display,
        classNumber: req.class_key,
        note: req.note,
        date: req.request_date || req.created_at,
        sortTimestamp: toTimestamp(req.created_at || req.request_date),
        type: "individual",
        data: req,
      });
    });

    // Aynı öğrenciyi grupla
    const grouped = new Map<string, typeof records>();
    records.forEach((record) => {
      const key = normalizeText(record.studentName) + "__" + normalizeText(record.classDisplay || record.classNumber || "");
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(record);
    });

    const merged = Array.from(grouped.values()).map((group) => {
      const primary = group.reduce((a, b) => b.sortTimestamp > a.sortTimestamp ? b : a);
      return { ...primary, sources: group };
    });

    return merged.sort((a, b) => b.sortTimestamp - a.sortTimestamp);
  }, [
    sortedIncidents,
    sortedReferrals,
    sortedObservations,
    sortedRequests,
    sortedIndividualRequests,
    allObservationRecords,
    attendedAppointments,
    scheduledAppointments,
    hiddenPotentialMeetingKeys
  ]); 

  const totalVisible =
    filteredIncidents.length + filteredReferrals.length + filteredObservations.length + filteredRequests.length + filteredIndividualRequests.length;


  // Yeniden yönlendirme: aktif takip/düzenli görüşmedeki öğrenci adlarını tüm ham kayıtlarla eşleştir
  const trackedNames = useMemo(() => {
    const names = new Set<string>();
    [...activeFollowUpAppointments, ...regularMeetingAppointments].forEach((apt) => {
      if (apt.participant_name) names.add(normalizeText(apt.participant_name));
    });
    return names;
  }, [activeFollowUpAppointments, regularMeetingAppointments]);

  // Aktif takip/düzenli görüşmedeki her öğrencinin listeye girme tarihi
  const trackedEntryDates = useMemo(() => {
    const map = new Map<string, number>();
    [...activeFollowUpAppointments, ...regularMeetingAppointments].forEach((apt) => {
      const name = normalizeText(apt.participant_name || "");
      const entryTime = toTimestamp(apt.updated_at || apt.created_at);
      if (!map.has(name) || entryTime < map.get(name)!) {
        map.set(name, entryTime);
      }
    });
    return map;
  }, [activeFollowUpAppointments, regularMeetingAppointments]);

  // Yeniden yönlendirme: listeye girdikten SONRA gelen öğretmen/veli/bildirim yönlendirmeleri
  const reReferralRecords = useMemo(() => {
    if (trackedEntryDates.size === 0) return [];
    const matched = new Set<string>();
    incidents.forEach(i => {
      const name = normalizeText(i.target_student_name || "");
      const entryDate = trackedEntryDates.get(name);
      if (entryDate && toTimestamp(i.created_at || i.incident_date) > entryDate) matched.add(name);
    });
    referrals.forEach(r => {
      const name = normalizeText(r.student_name || "");
      const entryDate = trackedEntryDates.get(name);
      if (entryDate && toTimestamp(r.created_at) > entryDate) matched.add(name);
    });
    requests.forEach(r => {
      const name = normalizeText(r.student_name || "");
      const entryDate = trackedEntryDates.get(name);
      if (entryDate && toTimestamp(r.created_at) > entryDate) matched.add(name);
    });
    return Array.from(matched);
  }, [incidents, referrals, requests, trackedEntryDates]);

  const reReferralCount = reReferralRecords.length;

  // Son 3 günde gelen tüm yönlendirmeler (tüm kanallar)
  const recentNotifications = useMemo(() => {
    const cutoff = Date.now() - 3 * 24 * 60 * 60 * 1000;
    const results: { studentName: string; classDisplay?: string | null; type: string; referrer: string; note: string; date: string; isReReferral: boolean }[] = [];

    incidents.forEach(i => {
      if (toTimestamp(i.created_at || i.incident_date) >= cutoff) {
        const name = normalizeText(i.target_student_name || "");
        results.push({
          studentName: i.target_student_name || "",
          classDisplay: i.target_class_display,
          type: "Öğrenci Bildirimi",
          referrer: i.reporter_student_name || "Bilinmiyor",
          note: i.description || "",
          date: i.incident_date || i.created_at || "",
          isReReferral: trackedEntryDates.has(name)
        });
      }
    });
    referrals.forEach(r => {
      if (toTimestamp(r.created_at) >= cutoff) {
        const name = normalizeText(r.student_name || "");
        results.push({
          studentName: r.student_name || "",
          classDisplay: r.class_display,
          type: "Öğretmen Yönlendirmesi",
          referrer: r.teacher_name || "Bilinmiyor",
          note: r.note || r.reason || "",
          date: r.created_at || "",
          isReReferral: trackedEntryDates.has(name)
        });
      }
    });
    requests.forEach(r => {
      if (toTimestamp(r.created_at) >= cutoff) {
        const name = normalizeText(r.student_name || "");
        results.push({
          studentName: r.student_name || "",
          classDisplay: r.class_display,
          type: "Veli Talebi",
          referrer: r.parent_name || "Veli",
          note: r.detail || r.subject || "",
          date: r.created_at || "",
          isReReferral: trackedEntryDates.has(name)
        });
      }
    });
    individualRequests.forEach(r => {
      if (toTimestamp(r.created_at) >= cutoff) {
        const name = normalizeText(r.student_name || "");
        results.push({
          studentName: r.student_name || "",
          classDisplay: r.class_display,
          type: "Bireysel Başvuru",
          referrer: "Öğrencinin kendisi",
          note: r.note || "",
          date: r.request_date || r.created_at || "",
          isReReferral: trackedEntryDates.has(name)
        });
      }
    });
    observations.forEach(o => {
      if (toTimestamp(o.created_at) >= cutoff) {
        const name = normalizeText(o.student_name || "");
        results.push({
          studentName: o.student_name || "",
          classDisplay: o.class_display,
          type: "Gözlem Havuzu",
          referrer: "Danışman",
          note: o.note || "",
          date: o.observed_at || o.created_at || "",
          isReReferral: trackedEntryDates.has(name)
        });
      }
    });

    return results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [incidents, referrals, requests, individualRequests, observations, trackedEntryDates]);

  const [showNotificationModal, setShowNotificationModal] = useState(false);

    const getReReferralHistory = (studentName: string) => {
    const name = normalizeText(studentName);
    const entryDate = trackedEntryDates.get(name) || 0;
    const records: { type: string; referrer: string; note: string; date: string }[] = [];
    incidents
      .filter(i => normalizeText(i.target_student_name || "") === name && toTimestamp(i.created_at || i.incident_date) > entryDate)
      .forEach(i => records.push({ type: "Öğrenci Bildirimi", referrer: i.reporter_student_name || "Bilinmiyor", note: i.description || "", date: i.incident_date || i.created_at || "" }));
    referrals
      .filter(r => normalizeText(r.student_name || "") === name && toTimestamp(r.created_at) > entryDate)
      .forEach(r => records.push({ type: "Öğretmen Yönlendirmesi", referrer: r.teacher_name || "Bilinmiyor", note: r.note || r.reason || "", date: r.created_at || "" }));
    requests
      .filter(r => normalizeText(r.student_name || "") === name && toTimestamp(r.created_at) > entryDate)
      .forEach(r => records.push({ type: "Veli Talebi", referrer: r.parent_name || "Veli", note: r.detail || r.subject || "", date: r.created_at || "" }));
    return records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

    const filteredAllMerged = useMemo(() => {
    let base = allMergedRecords;
    if (reReferralOnly) {
      base = base.filter(r => reReferralRecords.includes(normalizeText(r.studentName)));
    }
    if (!searchQuery.trim()) return base;
    const q = normalizeText(searchQuery);
    return base.filter(r =>
      normalizeText(r.studentName).includes(q) ||
      normalizeText(r.classDisplay || "").includes(q) ||
      normalizeText(r.note || "").includes(q)
    );
  }, [allMergedRecords, reReferralOnly, reReferralRecords, searchQuery]);

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
        const res = await fetch("/api/gozlem-havuzu", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, status: "completed" })
        });
        if (!res.ok) throw new Error("Gözlem kaydı güncellenemedi");
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
        <div className="relative flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm shadow-lg">
              <MessageSquare className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Görüşme Listesi</h1>
              <p className="text-slate-200 text-sm">Günlük müdahale gerektiren durumları takip edin.</p>
            </div>
          </div>

          <div className="mt-3">
            <button
              type="button"
              onClick={() => setShowNotificationModal(true)}
              className="relative flex items-center gap-4 w-full sm:w-auto text-left rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 px-5 py-3 backdrop-blur-sm transition-all"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20 text-white text-xl font-black">
                🔔
              </div>
              <div>
                <p className="text-sm font-bold text-white">Son 3 Günde Yönlendirilenler</p>
                <p className="text-xs text-white/70">Tüm kanallardan gelen yeni bildirimler</p>
              </div>
              {recentNotifications.length > 0 && (
                <span className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-500 text-white text-sm font-black shadow-lg">
                  +{recentNotifications.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      <Card className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setReReferralOnly(false); }}
                placeholder="Öğrenci adı, sınıf, öğretmen, açıklama..."
                className="pl-10"
              />
            </div>
            {reReferralOnly && (
              <button
                type="button"
                onClick={() => setReReferralOnly(false)}
                className="flex items-center gap-1 rounded-full bg-red-100 text-red-700 px-3 py-1.5 text-xs font-semibold hover:bg-red-200 transition-colors whitespace-nowrap"
              >
                Yeniden Yönlendirme ✕
              </button>
            )}
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
          <TabsList className="grid h-auto w-full grid-cols-3 gap-2 rounded-2xl bg-slate-100 p-2">
            {POTENTIAL_MEETINGS_TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className={POTENTIAL_MEETINGS_TAB_TRIGGER_CLASSES}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* TÜMÜ SEKMESİ — sadece henüz görüşülmemiş öğrenciler */}
          <TabsContent value="all" className="mt-6">
            <Card className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <CardHeader className="border-b bg-slate-50 p-4">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" /> Tüm Kayıtlar (Kronolojik)
                  <Badge variant="secondary">{filteredAllMerged.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {filteredAllMerged.length === 0 ? (
                  <p className="py-8 text-center text-slate-500">Kayıt bulunamadı</p>
                ) : (
                  <div className="space-y-2">
                    {filteredAllMerged.map((record) => {
                      const isScheduled = isAppointmentScheduled(record.studentName, record.classDisplay, record.classNumber);
                      const scheduledDate = record.type === "observation" ? null : getScheduledDate(record.studentName, record.classDisplay, record.classNumber);
                      const sources: any[] = (record as any).sources || [record];
                      const hasMultiple = sources.length > 1;

                      const getAppointmentUrl = (r: any) => {
                        if (r.type === "incident") return buildAppointmentUrl(r.data.target_student_name || "", r.data.target_class_display || null, r.data.target_class_key || null, r.data.description, undefined, undefined, "student_report", r.data.id);
                        if (r.type === "referral") return buildAppointmentUrl(r.data.student_name, r.data.class_display || null, r.data.class_key || null, r.data.note || r.data.reason, undefined, undefined, "teacher_referral", r.data.id);
                        if (r.type === "observation") return buildAppointmentUrl(r.data.student_name, r.data.class_display || null, r.data.class_key || null, r.data.note, undefined, [r.data.id], "observation", r.data.id);
                        if (r.type === "request") return buildAppointmentUrl(r.data.student_name, r.data.class_display || null, r.data.class_key || null, r.data.detail, undefined, undefined, "parent_request", r.data.id);
                        if (r.type === "individual") return buildAppointmentUrl(r.data.student_name, r.data.class_display || null, r.data.class_key || null, r.data.note, r.data.id, undefined, "self_application", r.data.id);
                        return "";
                      };

                      const sourceLabel = (type: string) => {
                        if (type === "incident") return "Öğrenci Bildirimi";
                        if (type === "referral") return "Öğretmen Yönl.";
                        if (type === "observation") return "Gözlem";
                        if (type === "request") return "Veli Talebi";
                        if (type === "individual") return "Bireysel Başv.";
                        return "";
                      };

                      const onEdit = () => {
                        if (record.type === "incident") handleEditSource("incident", { id: record.data.id, studentName: record.data.target_student_name || "", classDisplay: record.data.target_class_display || null });
                        else if (record.type === "referral") handleEditSource("referral", { id: record.data.id, studentName: record.data.student_name, classDisplay: record.data.class_display || null });
                        else if (record.type === "observation") handleEditSource("observation", { id: record.data.id, studentName: record.data.student_name, classDisplay: record.data.class_display || null });
                        else if (record.type === "request") handleEditSource("request", { id: record.data.id, studentName: record.data.student_name, classDisplay: record.data.class_display || null });
                        else if (record.type === "individual") handleEditSource("individual-request", { id: record.data.id, studentName: record.data.student_name, classDisplay: record.data.class_display || null });
                      };
                      const onDelete = () => {
                        if (record.type === "incident") handleDeleteSource("incident", record.data.id);
                        else if (record.type === "referral") handleDeleteSource("referral", record.data.id);
                        else if (record.type === "observation") handleDeleteSource("observation", record.data.id);
                        else if (record.type === "request") handleDeleteSource("request", record.data.id);
                        else if (record.type === "individual") handleDeleteSource("individual-request", record.data.id);
                      };

                      return (
                        <div key={record.id} className="relative">
                          <StudentCard
                            studentName={record.studentName}
                            classDisplay={record.classDisplay}
                            classNumber={record.classNumber}
                            note={record.note}
                            date={record.date}
                            isScheduled={record.type === "observation" ? false : isScheduled}
                            scheduledDate={scheduledDate}
                            requestStatus={
                              record.type === "observation"
                                ? (record.data.status === "completed" ? "completed" : record.data.status === "converted" || record.data.status === "scheduled" ? "scheduled" : "pending")
                                : undefined
                            }
                            onClick={() => hasMultiple
                              ? setMultiSourceModal({ studentName: record.studentName, classDisplay: record.classDisplay, sources })
                              : setSelectedItem(buildDetailModalItem(record.type, record.data))
                            }
                            onEdit={onEdit}
                            onDelete={onDelete}
                            appointmentUrl={getAppointmentUrl(record)}
                          />
                          {hasMultiple ? (
                            <Badge
                              variant="outline"
                              className="absolute -top-2 -right-2 text-xs bg-amber-50 text-amber-700 border-amber-300 cursor-pointer"
                              onClick={() => setMultiSourceModal({ studentName: record.studentName, classDisplay: record.classDisplay, sources })}
                            >
                              {sources.length} kaynak ▾
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="absolute -top-2 -right-2 text-xs bg-white">
                              {sourceLabel(record.type)}
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* AKTİF TAKİP SEKMESİ */}
          <TabsContent value="active-follow-up" className="mt-6">
            <Card className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <CardHeader className="border-b bg-slate-50 py-3">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <MessageSquare className="h-4 w-4" />
                  <span>Aktif Takip</span>
                  <Badge variant="secondary">{filteredActiveFollowUp.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input value={activeFollowSearch} onChange={(e) => setActiveFollowSearch(e.target.value)} placeholder="Öğrenci adı, sınıf, konu..." className="pl-10" />
                </div>
                <div className="space-y-3">
                  {filteredActiveFollowUp.length === 0 && (
                    <p className="py-6 text-center text-slate-500 text-sm">Kayıt bulunamadı</p>
                  )}
                  {filteredActiveFollowUp.map((appointment) => {
                  const daysSince = appointment.appointment_date
                    ? Math.floor((Date.now() - new Date(appointment.appointment_date).getTime()) / (1000 * 60 * 60 * 24))
                    : null;
                  const nextApt = scheduledAppointments.find((a) =>
                    matchesScheduledAppointment(a, appointment.participant_name, appointment.participant_class, null)
                  );
                  return (
                    <div key={appointment.id} className="rounded-2xl border border-cyan-200 bg-white shadow-sm overflow-hidden">
                      <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-cyan-50 to-sky-50 px-4 py-3 border-b border-cyan-100">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500 text-white font-bold text-sm shadow-sm">
                            {appointment.participant_name?.charAt(0)?.toUpperCase() || "?"}
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-base font-bold text-slate-800 truncate">{appointment.participant_name}</h3>
                            {appointment.participant_class && (
                              <p className="text-xs text-slate-500">{appointment.participant_class}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                          {reReferralRecords.includes(normalizeText(appointment.participant_name)) && !scheduledAppointments.some(a => matchesScheduledAppointment(a, appointment.participant_name, appointment.participant_class, null)) && (
                            <button
                              type="button"
                              onClick={() => setReReferralHistoryModal({ studentName: appointment.participant_name, records: getReReferralHistory(appointment.participant_name) })}
                              className="text-xs font-bold px-2.5 py-1 rounded-full bg-red-100 text-red-700 animate-pulse hover:bg-red-200 transition-colors cursor-pointer"
                            >
                              ⚠ Yeniden Yönlendirildi
                            </button>
                          )}
                          {daysSince !== null && (
                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                              daysSince >= 14 ? "bg-red-100 text-red-700" :
                              daysSince >= 7  ? "bg-amber-100 text-amber-700" :
                                               "bg-emerald-100 text-emerald-700"
                            }`}>
                              {daysSince === 0 ? "Bugün" : `${daysSince} gün önce`}
                            </span>
                          )}
                          <Badge className="border-cyan-200 bg-cyan-100 text-cyan-700">Aktif Takip</Badge>
                        </div>
                      </div>
                      <div className="px-4 py-3 space-y-2">
                        {appointment.purpose && (
                          <p className="text-sm text-slate-700 leading-5">{appointment.purpose}</p>
                        )}
                        {appointment.outcome_summary && (
                          <p className="text-xs text-slate-500 italic border-l-2 border-cyan-200 pl-2">"{appointment.outcome_summary}"</p>
                        )}
                        <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5 text-cyan-500" />
                            Son görüşme: <span className="font-semibold text-slate-700 ml-0.5">{formatDateTime(appointment.appointment_date)}</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5 text-cyan-500" />
                            {appointment.start_time}. Ders
                          </span>
                        </div>
                      </div>
                      <div className="px-4 py-2.5 border-t border-cyan-100 bg-slate-50/60 flex justify-end">
                        {nextApt ? (
                          <div className="flex flex-col items-end gap-0.5">
                            <Badge className="bg-amber-100 text-amber-700 border-0 text-xs">
                              <Calendar className="h-3 w-3 mr-1" />Randevu Verildi
                            </Badge>
                            <span className="text-[11px] text-amber-600 font-medium">
                              {new Date(nextApt.appointment_date).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" })}
                            </span>
                          </div>
                        ) : (
                          <Button type="button" size="sm" variant="outline" asChild className="border-cyan-200 text-cyan-700 hover:bg-cyan-50 text-xs">
                            <Link href={buildAppointmentUrl(
                              appointment.participant_name, appointment.participant_class || null, null,
                              appointment.purpose || appointment.outcome_summary || "Aktif takip görüşmesi",
                              undefined, undefined, "self_application", appointment.id
                            )}>
                              <Calendar className="h-3.5 w-3.5 mr-1" />Randevu Oluştur
                            </Link>
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* DÜZENLİ GÖRÜŞMELER SEKMESİ */}
          <TabsContent value="regular-meetings" className="mt-6">
            <Card className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <CardHeader className="border-b bg-slate-50 py-3">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <MessageSquare className="h-4 w-4" />
                  <span>Düzenli Görüşmeler</span>
                  <Badge variant="secondary">{filteredRegularMeetings.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input value={regularMeetingSearch} onChange={(e) => setRegularMeetingSearch(e.target.value)} placeholder="Öğrenci adı, sınıf, konu..." className="pl-10" />
                </div>
                <div className="space-y-3">
                  {filteredRegularMeetings.length === 0 && (
                    <p className="py-6 text-center text-slate-500 text-sm">Kayıt bulunamadı</p>
                  )}
                  {filteredRegularMeetings.map((appointment) => {
                  const daysSince = appointment.appointment_date
                    ? Math.floor((Date.now() - new Date(appointment.appointment_date).getTime()) / (1000 * 60 * 60 * 24))
                    : null;
                  const isOverdue = daysSince !== null && daysSince >= 14;
                  const nextApt = scheduledAppointments.find((a) =>
                    matchesScheduledAppointment(a, appointment.participant_name, appointment.participant_class, null)
                  );
                  return (
                    <div key={appointment.id} className={`rounded-2xl border bg-white shadow-sm overflow-hidden ${isOverdue ? "border-red-300" : "border-violet-200"}`}>
                      {isOverdue && (
                        <div className="flex items-center gap-2 bg-red-50 border-b border-red-200 px-4 py-2">
                          <span className="text-xs font-semibold text-red-700">⚠️ {daysSince} gündür görüşme yapılmıyor</span>
                        </div>
                      )}
                      <div className={`flex items-center justify-between gap-3 px-4 py-3 border-b ${isOverdue ? "bg-red-50/60 border-red-100" : "bg-gradient-to-r from-violet-50 to-purple-50 border-violet-100"}`}>
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white font-bold text-sm shadow-sm ${isOverdue ? "bg-red-500" : "bg-violet-500"}`}>
                            {appointment.participant_name?.charAt(0)?.toUpperCase() || "?"}
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-base font-bold text-slate-800 truncate">{appointment.participant_name}</h3>
                            {appointment.participant_class && (
                              <p className="text-xs text-slate-500">{appointment.participant_class}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                          {reReferralRecords.includes(normalizeText(appointment.participant_name)) && !scheduledAppointments.some(a => matchesScheduledAppointment(a, appointment.participant_name, appointment.participant_class, null)) && (
                            <button
                              type="button"
                              onClick={() => setReReferralHistoryModal({ studentName: appointment.participant_name, records: getReReferralHistory(appointment.participant_name) })}
                              className="text-xs font-bold px-2.5 py-1 rounded-full bg-red-100 text-red-700 animate-pulse hover:bg-red-200 transition-colors cursor-pointer"
                            >
                              ⚠ Yeniden Yönlendirildi
                            </button>
                          )}
                          {daysSince !== null && (
                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                              daysSince >= 14 ? "bg-red-100 text-red-700" :
                              daysSince >= 7  ? "bg-amber-100 text-amber-700" :
                                               "bg-emerald-100 text-emerald-700"
                            }`}>
                              {daysSince === 0 ? "Bugün" : `${daysSince} gün önce`}
                            </span>
                          )}
                          <Badge className={`${isOverdue ? "border-red-200 bg-red-100 text-red-700" : "border-violet-200 bg-violet-100 text-violet-700"}`}>
                            Düzenli Görüşme
                          </Badge>
                        </div>
                      </div>
                      <div className="px-4 py-3 space-y-2">
                        {appointment.purpose && (
                          <p className="text-sm text-slate-700 leading-5">{appointment.purpose}</p>
                        )}
                        {appointment.outcome_summary && (
                          <p className="text-xs text-slate-500 italic border-l-2 border-violet-200 pl-2">"{appointment.outcome_summary}"</p>
                        )}
                        <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Calendar className={`h-3.5 w-3.5 ${isOverdue ? "text-red-500" : "text-violet-500"}`} />
                            Son görüşme: <span className="font-semibold text-slate-700 ml-0.5">{formatDateTime(appointment.appointment_date)}</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className={`h-3.5 w-3.5 ${isOverdue ? "text-red-500" : "text-violet-500"}`} />
                            {appointment.start_time}. Ders
                          </span>
                        </div>
                      </div>
                      <div className={`px-4 py-2.5 border-t flex justify-end ${isOverdue ? "border-red-100 bg-red-50/40" : "border-violet-100 bg-slate-50/60"}`}>
                        {nextApt ? (
                          <div className="flex flex-col items-end gap-0.5">
                            <Badge className="bg-amber-100 text-amber-700 border-0 text-xs">
                              <Calendar className="h-3 w-3 mr-1" />Randevu Verildi
                            </Badge>
                            <span className="text-[11px] text-amber-600 font-medium">
                              {new Date(nextApt.appointment_date).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" })}
                            </span>
                          </div>
                        ) : (
                          <Button type="button" size="sm" variant="outline" asChild className={`text-xs ${isOverdue ? "border-red-200 text-red-700 hover:bg-red-50" : "border-violet-200 text-violet-700 hover:bg-violet-50"}`}>
                            <Link href={buildAppointmentUrl(
                              appointment.participant_name, appointment.participant_class || null, null,
                              appointment.purpose || appointment.outcome_summary || "Düzenli görüşme",
                              undefined, undefined, "self_application", appointment.id
                            )}>
                              <Calendar className="h-3.5 w-3.5 mr-1" />Randevu Oluştur
                            </Link>
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
                </div>
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

      {/* Son 3 Gün Bildirim Modalı */}
      {showNotificationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b bg-slate-50 px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Son 3 Günde Yönlendirilenler</h2>
                <p className="text-sm text-slate-500">{recentNotifications.length} yeni bildirim</p>
              </div>
              <button type="button" onClick={() => setShowNotificationModal(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-3 max-h-[65vh] overflow-y-auto">
              {recentNotifications.length === 0 ? (
                <p className="text-center text-slate-500 py-6">Son 3 günde yönlendirme yok</p>
              ) : recentNotifications.map((rec, i) => (
                <div key={i} className={`rounded-xl border p-4 ${rec.isReReferral ? "border-red-200 bg-red-50/50" : "border-slate-200 bg-white"}`}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-800 text-sm">{rec.studentName}</span>
                      {rec.classDisplay && <span className="text-xs text-slate-500">{rec.classDisplay}</span>}
                    </div>
                    <span className="text-xs text-slate-400 shrink-0">
                      {new Date(rec.date).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={
                      rec.type === "Öğretmen Yönlendirmesi" ? "border-blue-200 text-blue-700 text-xs" :
                      rec.type === "Veli Talebi" ? "border-emerald-200 text-emerald-700 text-xs" :
                      rec.type === "Öğrenci Bildirimi" ? "border-amber-200 text-amber-700 text-xs" :
                      rec.type === "Gözlem Havuzu" ? "border-purple-200 text-purple-700 text-xs" :
                      "border-slate-200 text-slate-700 text-xs"
                    }>{rec.type}</Badge>
                    {rec.isReReferral ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">Yeniden Yönlendirildi</span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">İlk Yönlendirme</span>
                    )}
                  </div>
                  {rec.referrer && rec.referrer !== "Danışman" && (
                    <p className="text-xs text-slate-500 mt-1.5">👤 {rec.referrer}</p>
                  )}
                  {rec.note && <p className="text-sm text-slate-600 mt-1 line-clamp-2">{rec.note}</p>}
                </div>
              ))}
            </div>
            <div className="border-t bg-slate-50 px-6 py-3 flex justify-end">
              <button type="button" onClick={() => setShowNotificationModal(false)} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Yeniden Yönlendirme Geçmişi Modalı */}
      {reReferralHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b bg-red-50 px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Yeniden Yönlendirme Geçmişi</h2>
                <p className="text-sm text-red-600 font-medium">{reReferralHistoryModal.studentName}</p>
              </div>
              <button type="button" onClick={() => setReReferralHistoryModal(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-3 max-h-[60vh] overflow-y-auto">
              {reReferralHistoryModal.records.length === 0 ? (
                <p className="text-center text-slate-500 py-4">Kayıt bulunamadı</p>
              ) : reReferralHistoryModal.records.map((rec, i) => (
                <div key={i} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <Badge variant="outline" className={
                      rec.type === "Öğretmen Yönlendirmesi" ? "border-blue-200 text-blue-700" :
                      rec.type === "Veli Talebi" ? "border-emerald-200 text-emerald-700" :
                      "border-amber-200 text-amber-700"
                    }>{rec.type}</Badge>
                    <span className="text-xs text-slate-400">
                      {rec.date ? new Date(rec.date).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "-"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mb-1">👤 {rec.referrer}</p>
                  {rec.note && <p className="text-sm text-slate-700 line-clamp-2">{rec.note}</p>}
                </div>
              ))}
            </div>
            <div className="border-t bg-slate-50 px-6 py-3 flex justify-end">
              <button type="button" onClick={() => setReReferralHistoryModal(null)} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Çoklu Kaynak Modalı */}
      {multiSourceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b bg-slate-50 px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800">{multiSourceModal.studentName}</h2>
                {multiSourceModal.classDisplay && (
                  <p className="text-sm text-slate-500">{multiSourceModal.classDisplay}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setMultiSourceModal(null)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-3 max-h-[60vh] overflow-y-auto">
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
                {multiSourceModal.sources.length} farklı kaynaktan başvuru
              </p>
              {multiSourceModal.sources.map((src: any) => {
                const label = src.type === "incident" ? "Öğrenci Bildirimi" : src.type === "referral" ? "Öğretmen Yönlendirmesi" : src.type === "observation" ? "Gözlem Havuzu" : src.type === "request" ? "Veli Talebi" : "Bireysel Başvuru";
                const referrer = src.type === "referral" ? src.data.teacher_name : src.type === "request" ? src.data.parent_name : src.type === "incident" ? src.data.reporter_student_name : null;
                const note = src.type === "incident" ? src.data.description : src.type === "referral" ? src.data.note || src.data.reason : src.type === "observation" ? src.data.note : src.type === "request" ? src.data.detail || src.data.subject : src.data.note;
                const date = src.type === "incident" ? src.data.incident_date || src.data.created_at : src.data.created_at;
                return (
                  <div
                    key={src.id}
                    className="rounded-xl border border-slate-200 p-4 cursor-pointer hover:bg-slate-50 transition-colors"
                    onClick={() => { setSelectedItem(buildDetailModalItem(src.type, src.data)); setMultiSourceModal(null); }}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <Badge variant="outline" className="text-xs">{label}</Badge>
                      <span className="text-xs text-slate-400">
                        {date ? new Date(date).toLocaleDateString("tr-TR") : "-"}
                      </span>
                    </div>
                    {referrer && <p className="text-xs text-slate-500 mb-1">👤 {referrer}</p>}
                    {note && <p className="text-sm text-slate-700 line-clamp-2">{note}</p>}
                  </div>
                );
              })}
            </div>
            <div className="border-t bg-slate-50 px-6 py-3 flex justify-end">
              <button
                type="button"
                onClick={() => setMultiSourceModal(null)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
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
        {children}
      </CardContent>
    </Card>
  );
}