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

  // Herhangi bir randevusu tamamlanmış mı (attended)?
  const isAlreadyAttended = (studentName: string, classDisplay?: string | null, classKey?: string | null) =>
    attendedAppointments.some((appointment) =>
      matchesAttendedAppointment(appointment, studentName, classDisplay, classKey)
    );

  const isAppointmentScheduled = (studentName: string, classDisplay?: string | null, classKey?: string | null) =>
    scheduledAppointments.some((appointment) =>
      matchesScheduledAppointment(appointment, studentName, classDisplay, classKey)
    );

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
      observation.status === "pending" &&
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
  }, [observations, query, hiddenPotentialMeetingKeys]);

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
      .sort((a, b) => toTimestamp(b.created_at) - toTimestamp(a.created_at)),
    [trackedAppointments]
  );

  const regularMeetingAppointments = useMemo(
    () => [...trackedAppointments]
      .filter((appointment) => isRegularMeetingAppointment(appointment))
      .sort((a, b) => toTimestamp(b.created_at) - toTimestamp(a.created_at)),
    [trackedAppointments]
  );

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

    // Gözlem Havuzu
    sortedObservations.forEach((observation) => {
      if (isPotentialMeetingHidden("observation", observation.id)) return;
      if (isAlreadyAttended(observation.student_name, observation.class_display, observation.class_key)) return;
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

    return records.sort((a, b) => b.sortTimestamp - a.sortTimestamp);
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
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm shadow-lg">
              <MessageSquare className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Görüşme Listesi</h1>
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
                          incident.description,
                          undefined,
                          undefined,
                          "student_report",
                          incident.id
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
                          referral.note || referral.reason,
                          undefined,
                          undefined,
                          "teacher_referral",
                          referral.id
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
                          observation.note,
                          undefined,
                          [observation.id],
                          "observation",
                          observation.id
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
                          request.detail,
                          undefined,
                          undefined,
                          "parent_request",
                          request.id
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
                          req.note,
                          req.id,
                          undefined,
                          "self_application",
                          req.id
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
                            isScheduled={record.type === "observation" ? false : isScheduled}
                            requestStatus={
                              record.type === "observation"
                                ? (record.data.status === "completed"
                                    ? "completed"
                                    : record.data.status === "converted" || record.data.status === "scheduled"
                                    ? "scheduled"
                                    : "pending")
                                : undefined
                            }
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

          {/* AKTİF TAKİP SEKMESİ */}
          <TabsContent value="active-follow-up" className="mt-6">
            <SectionBlock
              title="Aktif Takip"
              icon={MessageSquare}
              count={activeFollowUpAppointments.length}
              emptyText="Aktif takip kaydı bulunamadı"
            >
              <div className="space-y-3">
                {activeFollowUpAppointments.map((appointment) => (
                  <div key={appointment.id} className="rounded-2xl border border-cyan-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold text-slate-800">{appointment.participant_name}</h3>
                          <Badge variant="outline" className="border-cyan-200 bg-cyan-50 text-cyan-700">
                            Aktif Takip
                          </Badge>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-700">
                          {appointment.purpose || "Takip görüşmesi"}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">
                          <Calendar className="mr-1 h-3.5 w-3.5" />
                          {formatDateTime(appointment.appointment_date)}
                        </Badge>
                        <Badge variant="outline">
                          <Clock className="mr-1 h-3.5 w-3.5" />
                          {appointment.start_time}
                        </Badge>
                      </div>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        asChild
                        className="border-cyan-200 text-cyan-700 hover:bg-cyan-50"
                      >
                        <Link
                          href={buildAppointmentUrl(
                            appointment.participant_name,
                            appointment.participant_class || null,
                            null,
                            appointment.purpose || appointment.outcome_summary || "Aktif takip görüşmesi",
                            undefined,
                            undefined,
                            "self_application",
                            appointment.id
                          )}
                        >
                          Randevu Oluştur
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </SectionBlock>
          </TabsContent>

          {/* DÜZENLİ GÖRÜŞMELER SEKMESİ */}
          <TabsContent value="regular-meetings" className="mt-6">
            <SectionBlock
              title="Düzenli Görüşmeler"
              icon={MessageSquare}
              count={regularMeetingAppointments.length}
              emptyText="Düzenli görüşme kaydı bulunamadı"
            >
              <div className="space-y-3">
                {regularMeetingAppointments.map((appointment) => (
                  <div key={appointment.id} className="rounded-2xl border border-violet-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold text-slate-800">{appointment.participant_name}</h3>
                          <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-700">
                            Düzenli Görüşme
                          </Badge>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-700">
                          {appointment.purpose || "Düzenli görüşme"}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">
                          <Calendar className="mr-1 h-3.5 w-3.5" />
                          {formatDateTime(appointment.appointment_date)}
                        </Badge>
                        <Badge variant="outline">
                          <Clock className="mr-1 h-3.5 w-3.5" />
                          {appointment.start_time}
                        </Badge>
                      </div>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        asChild
                        className="border-violet-200 text-violet-700 hover:bg-violet-50"
                      >
                        <Link
                          href={buildAppointmentUrl(
                            appointment.participant_name,
                            appointment.participant_class || null,
                            null,
                            appointment.purpose || appointment.outcome_summary || "Düzenli görüşme",
                            undefined,
                            undefined,
                            "self_application",
                            appointment.id
                          )}
                        >
                          Randevu Oluştur
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </SectionBlock>
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
