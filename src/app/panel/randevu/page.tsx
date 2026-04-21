"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CalendarDays, 
  CalendarCheck,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Users,
  UserCheck,
  UserX,
  Clock,
  MapPin,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
  CheckCircle2,
  XCircle,
  PauseCircle,
  Ban,
  Sparkles,
  GraduationCap,
  Edit2,
  Trash2,
  X
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useAppointments, useAppointmentTasks, useCalendarHelpers } from "./hooks";
import { parseJsonResponse, parseResponseError } from "@/lib/utils";
import { notifyPotentialMeetingsChanged } from "@/lib/potentialMeetings";
import { normalizeSourceType } from "@/lib/guidanceApplications";
import { AppointmentOutcomeModal, type AppointmentOutcomeChoice } from "@/components/AppointmentOutcomeModal";
import { formatLessonSlotLabel, normalizeLessonSlot } from "@/lib/lessonSlots";
import { 
  Appointment, 
  AppointmentFormData,
  AppointmentClosureData,
  PARTICIPANT_TYPES, 
  APPOINTMENT_STATUS, 
  PRIORITY_LEVELS,
  APPOINTMENT_LOCATIONS,
  LESSON_SLOTS,
  TOPIC_TAGS,
  OUTCOME_DECISIONS,
  ObservationType,
  AppointmentStatus,
  ParticipantType,
  PriorityLevel
} from "@/types";

const APPOINTMENT_TOPICS = [
  "Akademik Sorunlar",
  "Davranış Problemleri",
  "Akran İlişkileri ve Sosyal Problemler",
  "Duygusal Problemler",
  "Ailevi Sorunlar",
  "Devamsızlık ve Okula Uyum Problemleri",
  "Riskli Durumlar",
  "Kimlik ve Gelişimsel Süreçler",
];

// Renk haritaları
const statusColors: Record<AppointmentStatus, { bg: string; text: string; border: string }> = {
  planned: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  attended: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200" },
  not_attended: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
  postponed: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  cancelled: { bg: "bg-slate-50", text: "text-slate-700", border: "border-slate-200" }
};

const participantColors: Record<ParticipantType, { bg: string; text: string; icon: typeof Users }> = {
  student: { bg: "bg-cyan-100", text: "text-cyan-700", icon: GraduationCap },
  parent: { bg: "bg-purple-100", text: "text-purple-700", icon: Users },
  teacher: { bg: "bg-emerald-100", text: "text-emerald-700", icon: UserCheck }
};

const statusIcons: Record<AppointmentStatus, typeof CheckCircle2> = {
  planned: Clock,
  attended: CheckCircle2,
  not_attended: XCircle,
  postponed: PauseCircle,
  cancelled: Ban
};

const poolObservationTagMap: Record<ObservationType, string> = {
  behavior: "Davranış gözlemi",
  academic: "Akademik durum",
  social: "Sosyal uyum",
  emotional: "Duygu-durum"
};

const normalizeStudentText = (value: string) =>
  value
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/^[0-9]+\s+/, "")
    .trim();

const normalizeOutcomeDecisionText = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ÅŸ/g, "s")
    .replace(/Ã§/g, "c")
    .replace(/ÄŸ/g, "g")
    .replace(/Ä±/g, "i")
    .replace(/Ã¶/g, "o")
    .replace(/Ã¼/g, "u")
    .trim();

const normalizeOutcomeDecisionLookupText = (value: string) =>
  normalizeOutcomeDecisionText(value)
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u");

const normalizeClassText = (value: string) =>
  value
    .toLocaleLowerCase("tr-TR")
    .replace(/\s+/g, " ")
    .replace(/[\/\-_.()]/g, "")
    .replace(/ş/g, "s")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .trim();

// Dolu saatleri kontrol etmek için hook
function useBusySlots() {
  const [busySlots, setBusySlots] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const fetchBusySlots = useCallback(async (date: string, options?: { excludeAppointmentId?: string }) => {
    try {
      setLoading(true);
      const allBusySlots = new Set<string>();
      
      const appointmentRes = await fetch(`/api/appointments?date=${date}`, {
        headers: { Accept: "application/json" }
      });
      
      if (appointmentRes.ok) {
        const appointmentData = await parseJsonResponse<{ appointments?: Appointment[] }>(appointmentRes);
        appointmentData.appointments?.forEach(apt => {
          if (apt.status === 'planned' && apt.id !== options?.excludeAppointmentId) {
            const normalizedTime = normalizeLessonSlot(apt.start_time);
            if (normalizedTime) {
              allBusySlots.add(normalizedTime);
            }
          }
        });
      }

      try {
        const { supabase } = await import("@/lib/supabase");
        const { data: plans, error } = await supabase
          .from("guidance_plans")
          .select("id, lesson_period")
          .eq("plan_date", date)
          .in("status", ["planned", "completed"]);

        if (!error && plans) {
          plans.forEach(plan => {
            if (plan.id !== options?.excludeAppointmentId) {
              const normalizedTime = normalizeLessonSlot(plan.lesson_period);
              if (normalizedTime) {
                allBusySlots.add(normalizedTime);
              }
            }
          });
        }
      } catch (err) {
        console.error("Sınıf rehberliği planları yüklenemedi:", err);
      }

      try {
        const { supabase } = await import("@/lib/supabase");
        const { data: activities, error } = await supabase
          .from("class_activities")
          .select("id, activity_time")
          .eq("activity_date", date);

        if (!error && activities) {
          activities.forEach(activity => {
            if (activity.id !== options?.excludeAppointmentId) {
              const normalizedTime = normalizeLessonSlot(activity.activity_time);
              if (normalizedTime) {
                allBusySlots.add(normalizedTime);
              }
            }
          });
        }
      } catch (err) {
        console.error("Sınıf etkinlikleri yüklenemedi:", err);
      }

      console.log("Dolu saatler:", Array.from(allBusySlots));
      setBusySlots(allBusySlots);
      return allBusySlots;
    } catch (err) {
      console.error("Dolu saatler alınamadı:", err);
      setBusySlots(new Set());
      return new Set<string>();
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    busySlots,
    loading,
    fetchBusySlots
  };
}

const resolveClassKeyFromDisplay = (
  classDisplay: string,
  classes: { value: string; text: string }[]
) => {
  const normalizedDisplay = normalizeClassText(classDisplay);
  if (!normalizedDisplay) return "";

  const exactMatch = classes.find(
    (item) =>
      normalizeClassText(item.text) === normalizedDisplay ||
      normalizeClassText(item.value) === normalizedDisplay
  );
  if (exactMatch) return exactMatch.value;

  const looseMatch = classes.find((item) => {
    const normalizedText = normalizeClassText(item.text);
    const normalizedValue = normalizeClassText(item.value);
    return (
      normalizedText.includes(normalizedDisplay) ||
      normalizedDisplay.includes(normalizedText) ||
      normalizedValue.includes(normalizedDisplay) ||
      normalizedDisplay.includes(normalizedValue)
    );
  });

  return looseMatch?.value || "";
};

const resolveStudentPrefill = async (studentName: string) => {
  const normalizedName = normalizeStudentText(studentName);
  if (!normalizedName) {
    return {
      studentText: studentName,
      classKey: "",
      classDisplay: ""
    };
  }

  try {
    const res = await fetch(`/api/students?query=${encodeURIComponent(studentName)}`, {
      headers: { Accept: "application/json" }
    });

    const responseText = await res.clone().text();
    console.log("Students API Response:", {
      status: res.status,
      statusText: res.statusText,
      contentType: res.headers.get("content-type"),
      body: responseText.slice(0, 500)
    });

    if (!res.ok) {
      const errorText = await parseResponseError(res);
      console.error("Öğrenci API hatası:", errorText);
      return {
        studentText: studentName,
        classKey: "",
        classDisplay: ""
      };
    }

    const data = await parseJsonResponse<any>(res);
    if (!Array.isArray(data) || data.length === 0) {
      return {
        studentText: studentName,
        classKey: "",
        classDisplay: ""
      };
    }

    const bestMatch =
      data.find((student: { value?: string; text?: string; class_key?: string; class_display?: string }) => {
        const candidate = normalizeStudentText(student.value || student.text || "");
        return (
          candidate === normalizedName ||
          candidate.includes(normalizedName) ||
          normalizedName.includes(candidate)
        );
      }) || data[0];

    return {
      studentText: String(bestMatch.text || bestMatch.value || studentName).trim(),
      classKey: String(bestMatch.class_key || ""),
      classDisplay: String(bestMatch.class_display || "")
    };
  } catch (error) {
    console.error("Öğrenci ön bilgisi çözülemedi:", error);
    return {
      studentText: studentName,
      classKey: "",
      classDisplay: ""
    };
  }
};

export default function RandevuPage() {
  const searchParams = useSearchParams();
  const { 
    appointments, 
    loading, 
    fetchAppointments, 
    createAppointment,
    updateAppointment,
    closeAppointment,
    deleteAppointment,
    getStatusCounts 
  } = useAppointments();
  const { tasks, fetchTasks, createTask } = useAppointmentTasks();
  const { getWeekDays, formatDate, formatShortDate, getDayName, isToday } = useCalendarHelpers();
  const { busySlots, loading: busyLoading, fetchBusySlots } = useBusySlots();

  const [viewMode, setViewMode] = useState<"day" | "week">("day");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState("");

  const [classes, setClasses] = useState<{ value: string; text: string }[]>([]);
  const [students, setStudents] = useState<{ value: string; text: string }[]>([]);
  const [teachers, setTeachers] = useState<{ value: string; label: string }[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [selectedClass, setSelectedClass] = useState("");
  const [sourceObservationIds, setSourceObservationIds] = useState<string[]>([]);
  const [poolPrefillStudentName, setPoolPrefillStudentName] = useState("");
  const [poolPrefillClassDisplay, setPoolPrefillClassDisplay] = useState("");
  const hasAppliedPoolPrefill = useRef(false);
  const poolStudentName = searchParams.get("studentName") || poolPrefillStudentName;
  const poolClassDisplay = searchParams.get("classDisplay") || poolPrefillClassDisplay;
  const sourceIndividualRequestId = searchParams.get("requestId") || "";
  const sourceApplicationId = searchParams.get("sourceId") || "";
  const sourceApplicationType = searchParams.get("sourceType") || "";
  const hasPoolPrefill = Boolean(poolStudentName);

  const [showNewAppointmentModal, setShowNewAppointmentModal] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [showClosureModal, setShowClosureModal] = useState(false);
  const [showAttendanceChoiceModal, setShowAttendanceChoiceModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [attendanceChoiceAppointment, setAttendanceChoiceAppointment] = useState<Appointment | null>(null);

  const [parentName, setParentName] = useState("");
  const [selectedStudentName, setSelectedStudentName] = useState("");

  const [formData, setFormData] = useState<AppointmentFormData>({
    appointment_date: new Date().toISOString().slice(0, 10),
    start_time: "1",
    participant_type: "student",
    participant_name: "",
    participant_class: "",
    topic_tags: [],
    location: "guidance_office",
    purpose: "",
    preparation_note: "",
    priority: "normal"
  });

  const [closureData, setClosureData] = useState<AppointmentClosureData>({
    status: "attended",
    outcome_summary: "",
    outcome_decision: [],
    next_action: "",
    create_follow_up: false
  });

  const [newTaskDescription, setNewTaskDescription] = useState("");

  const createEmptyFormData = (): AppointmentFormData => ({
    appointment_date: new Date().toISOString().slice(0, 10),
    start_time: "1",
    participant_type: "student",
    participant_name: "",
    participant_class: "",
    topic_tags: [],
    location: "guidance_office",
    purpose: "",
    preparation_note: "",
    priority: "normal"
  });

  const getAppointmentFormData = (appointment: Appointment): AppointmentFormData => ({
    appointment_date: appointment.appointment_date,
    start_time: appointment.start_time,
    duration: appointment.duration,
    participant_type: appointment.participant_type,
    participant_name: appointment.participant_name,
    participant_class: appointment.participant_class || "",
    participant_phone: appointment.participant_phone,
    topic_tags: [...appointment.topic_tags],
    location: appointment.location,
    purpose: appointment.purpose || "",
    preparation_note: appointment.preparation_note || "",
    priority: appointment.priority
  });

  useEffect(() => {
    const fetchClassesAndTeachers = async () => {
      try {
        const classRes = await fetch("/api/data", {
          headers: { Accept: "application/json" }
        });
        if (classRes.ok) {
          const classData = await parseJsonResponse<any>(classRes);
          if (Array.isArray(classData.sinifSubeList)) {
            setClasses(classData.sinifSubeList);
          }
        } else {
          const errorText = await parseResponseError(classRes);
          console.error("Data API hatası:", errorText);
        }

        const teacherRes = await fetch("/api/teachers", {
          headers: { Accept: "application/json" }
        });
        if (teacherRes.ok) {
          const teacherData = await parseJsonResponse<any>(teacherRes);
          if (Array.isArray(teacherData.teachers)) {
            setTeachers(teacherData.teachers);
          }
        } else {
          const errorText = await parseResponseError(teacherRes);
          console.error("Teachers API hatası:", errorText);
        }
      } catch (error) {
        console.error("Veri yükleme hatası:", error);
      }
    };
    fetchClassesAndTeachers();
  }, []);

  useEffect(() => {
    if (formData.appointment_date) {
      fetchBusySlots(formData.appointment_date, { excludeAppointmentId: editingAppointment?.id });
    }
  }, [formData.appointment_date, editingAppointment?.id, fetchBusySlots]);

  const searchParamsString = searchParams.toString();
  const classesSignature = useMemo(
    () => classes.map((item) => `${item.value}|${item.text}`).join(";;"),
    [classes]
  );

  useEffect(() => {
    const params = new URLSearchParams(searchParamsString);
    const poolIdsParam = params.get("poolIds");
    const studentName = params.get("studentName") || "";
    const classKey = params.get("classKey") || "";
    const classDisplay = params.get("classDisplay") || "";
    const note = params.get("note") || "";
    const observationType = params.get("observationType") as ObservationType | null;

    if (!studentName && !poolIdsParam) return;
    if (hasAppliedPoolPrefill.current) return;

    let cancelled = false;

    const applyPrefill = async () => {
      const parsedIds = poolIdsParam
        ? poolIdsParam
            .split(",")
            .map((id) => id.trim())
            .filter(Boolean)
        : [];

      let resolvedClassKey =
        classKey ||
        resolveClassKeyFromDisplay(classDisplay, classes) ||
        "";
      let resolvedClassDisplay = classDisplay;
      let resolvedStudentText = studentName;

      if ((!resolvedClassKey || !resolvedClassDisplay) && studentName) {
        const studentPrefill = await resolveStudentPrefill(studentName);
        if (cancelled) return;

        resolvedStudentText = studentPrefill.studentText || resolvedStudentText;
        resolvedClassKey = resolvedClassKey || studentPrefill.classKey || "";
        resolvedClassDisplay = resolvedClassDisplay || studentPrefill.classDisplay || "";
      }

      if ((classDisplay || classKey) && !resolvedClassKey) return;
      if (studentName && !resolvedStudentText) return;

      hasAppliedPoolPrefill.current = true;
      setSourceObservationIds(parsedIds);
      setPoolPrefillStudentName(resolvedStudentText);
      setPoolPrefillClassDisplay(resolvedClassDisplay);
      setSelectedClass(resolvedClassKey);
      setShowNewAppointmentModal(true);

      setFormData((prev) => {
        return {
          ...prev,
          participant_type: "student",
          participant_name: resolvedStudentText || prev.participant_name,
          participant_class: resolvedClassDisplay || prev.participant_class,
          topic_tags: [],
          purpose: note && poolIdsParam ? "Gözlem havuzundan aktarıldı" : prev.purpose,
          preparation_note: note
            ? `Bildirim notu:\n${note}`
            : prev.preparation_note,
          priority: "normal"
        };
      });
    };

    applyPrefill();

    return () => {
      cancelled = true;
    };
  }, [searchParamsString, classesSignature]);

  useEffect(() => {
    if (!showNewAppointmentModal) return;
    if (selectedClass) return;
    if (!formData.participant_class) return;
    if (!(formData.participant_type === "student" || formData.participant_type === "parent")) return;

    const resolved = resolveClassKeyFromDisplay(formData.participant_class, classes);
    if (resolved) {
      setSelectedClass(resolved);
    }
  }, [showNewAppointmentModal, selectedClass, formData.participant_class, formData.participant_type, classesSignature]);

  const fetchStudentsByClass = async (classKey: string) => {
    if (!classKey) {
      setStudents([]);
      return;
    }
    try {
      setLoadingStudents(true);
      const res = await fetch(`/api/students?sinifSube=${encodeURIComponent(classKey)}`, {
        headers: { Accept: "application/json" }
      });
      if (res.ok) {
        const data = await parseJsonResponse<any>(res);
        const nextStudents = Array.isArray(data) ? data : [];
        setStudents(nextStudents);

        if (poolPrefillStudentName) {
          const prefillText = normalizeStudentText(poolPrefillStudentName);
          const matchedStudent = nextStudents.find((student: { value: string; text: string }) => {
            const normalizedText = normalizeStudentText(student.text);
            return (
              normalizedText === prefillText ||
              normalizedText.includes(prefillText) ||
              prefillText.includes(normalizedText)
            );
          });

          if (matchedStudent) {
            setFormData((prev) => ({
              ...prev,
              participant_type: "student",
              participant_name: matchedStudent.text,
              participant_class: classes.find((item) => item.value === classKey)?.text || prev.participant_class,
              priority: prev.priority || "normal"
            }));
          }
        }
      }
    } catch (error) {
      console.error("Öğrenci listesi hatası:", error);
      setStudents([]);
    } finally {
      setLoadingStudents(false);
    }
  };

  useEffect(() => {
    if (selectedClass && (formData.participant_type === "student" || formData.participant_type === "parent")) {
      fetchStudentsByClass(selectedClass);
    }
  }, [selectedClass, formData.participant_type]);

  useEffect(() => {
    const today = new Date();
    const pastDate = new Date(today);
    pastDate.setDate(today.getDate() - 30);
    const futureDate = new Date(today);
    futureDate.setDate(today.getDate() + 30);
    
    fetchAppointments({ 
      from: pastDate.toISOString().slice(0, 10), 
      to: futureDate.toISOString().slice(0, 10) 
    });
  }, [fetchAppointments]);

  const filteredAppointments = useMemo(() => {
    let filtered = [...appointments];

    if (viewMode === "day") {
      const dateStr = currentDate.toISOString().slice(0, 10);
      filtered = filtered.filter(apt => apt.appointment_date === dateStr);
    } else {
      const weekDays = getWeekDays(currentDate);
      const start = weekDays[0].toISOString().slice(0, 10);
      const end = weekDays[6].toISOString().slice(0, 10);
      filtered = filtered.filter(apt =>
        apt.appointment_date >= start && apt.appointment_date <= end
      );
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(apt =>
        apt.participant_name.toLowerCase().includes(query) ||
        apt.topic_tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    return filtered.sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [appointments, viewMode, currentDate, searchQuery, getWeekDays]);

  const goToToday = () => setCurrentDate(new Date());
  const goToPrev = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() - (viewMode === "day" ? 1 : 7));
    setCurrentDate(newDate);
  };
  const goToNext = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + (viewMode === "day" ? 1 : 7));
    setCurrentDate(newDate);
  };

  const resetForm = () => {
    setFormData(createEmptyFormData());
    setSelectedClass("");
    setStudents([]);
    setEditingAppointment(null);
    setParentName("");
    setSelectedStudentName("");
  };

  const closeNewAppointmentModal = () => {
    setShowNewAppointmentModal(false);
    resetForm();
    setSourceObservationIds([]);
    setPoolPrefillStudentName("");
    setPoolPrefillClassDisplay("");
    hasAppliedPoolPrefill.current = false;
  };

  const openNewAppointmentModal = () => {
    setEditingAppointment(null);
    resetForm();
    setShowNewAppointmentModal(true);
  };

  const openEditAppointmentModal = (appointment: Appointment) => {
    setEditingAppointment(appointment);
    setShowDetailModal(false);
    setSelectedAppointment(null);
    setFormData(getAppointmentFormData(appointment));
    setSelectedClass(
      resolveClassKeyFromDisplay(appointment.participant_class || "", classes) ||
      resolveClassKeyFromDisplay(appointment.participant_class || poolClassDisplay, classes) ||
      ""
    );
    setStudents([]);
    setParentName("");
    setSelectedStudentName("");
    if (appointment.participant_type === "parent") {
      const nameParts = appointment.participant_name.split(" (");
      if (nameParts.length > 1) {
        const parentPart = nameParts[0];
        let studentPart = nameParts[1];
        if (studentPart.includes("'ın velisi)")) {
          studentPart = studentPart.replace("'ın velisi)", "");
        } else if (studentPart.includes(" velisi)")) {
          studentPart = studentPart.replace(" velisi)", "");
        } else {
          studentPart = studentPart.replace(")", "");
        }
        setParentName(parentPart);
        setSelectedStudentName(studentPart);
      } else {
        setParentName(appointment.participant_name);
      }
    }
    setShowNewAppointmentModal(true);
  };

  const handleDeleteAppointment = async (appointment: Appointment) => {
    const confirmDelete = window.confirm("Bu randevuyu silmek istediğinize emin misiniz?");
    if (!confirmDelete) return;

    const success = await deleteAppointment(appointment.id);
    if (success) {
      if (selectedAppointment?.id === appointment.id) {
        setShowDetailModal(false);
        setSelectedAppointment(null);
      }
      if (editingAppointment?.id === appointment.id) {
        closeNewAppointmentModal();
      }
    }
  };

  const handleSaveAppointment = async () => {
    const resolvedParticipantName = formData.participant_name || poolStudentName || poolPrefillStudentName;
    const resolvedParticipantClass = formData.participant_class || poolClassDisplay || poolPrefillClassDisplay;

    if (!resolvedParticipantName) {
      if (poolPrefillStudentName) {
        setFormData((prev) => ({
          ...prev,
          participant_name: poolPrefillStudentName,
          participant_class: poolPrefillClassDisplay || prev.participant_class
        }));
      } else {
        toast.error("Katılımcı adı zorunludur");
        return;
      }
    }

    const payload: AppointmentFormData = {
      ...formData,
      participant_name: resolvedParticipantName,
      participant_class: resolvedParticipantClass,
      participant_type: formData.participant_type,
      priority: "normal",
      source_individual_request_id: sourceIndividualRequestId || undefined,
      source_application_id: sourceApplicationId || sourceIndividualRequestId || undefined,
      source_application_type: sourceApplicationType
        ? normalizeSourceType(sourceApplicationType)
        : sourceIndividualRequestId
        ? "self_application"
        : undefined
    };

    const result = editingAppointment
      ? await updateAppointment(editingAppointment.id, payload as Partial<Appointment>)
      : await createAppointment(payload);

    if (result) {
      if (!editingAppointment && sourceObservationIds.length > 0) {
        try {
          const mapStatus: Record<string, "active" | "regular" | "completed" | "converted" | "pending"> = {
            aktif_takip: "active",
            duzenli_gorusme: "regular",
            tamamlandi: "completed",
            scheduled: "converted",
            tumu: "pending"
          };
          const selectedStatus = "scheduled";
          const sourceStatus = mapStatus[selectedStatus] || "pending";
          const body = {
            studentId: sourceObservationIds[0],
            ids: sourceObservationIds,
            status: sourceStatus,
            appointment_id: result.id
          };

          console.log("GİDEN DATA:", body);

          const res = await fetch("/api/observation/convert", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
          });

          const text = await res.text();
          console.log("API CEVAP:", text);

          if (!res.ok) {
            throw new Error(text || "Gözlem kaydı güncellenemedi");
          }
        } catch (error) {
          console.error("Observation pool convert error:", error);
          toast.error("Randevu oluşturuldu ama gözlem havuzu güncellenemedi");
        }
      }

      setShowNewAppointmentModal(false);
      resetForm();
      setSourceObservationIds([]);
      setPoolPrefillStudentName("");
      setPoolPrefillClassDisplay("");
      hasAppliedPoolPrefill.current = false;
      const today = new Date().toISOString().slice(0, 10);
      const weekEnd = new Date();
      weekEnd.setDate(weekEnd.getDate() + 7);
      fetchAppointments({ from: today, to: weekEnd.toISOString().slice(0, 10) });
    }
  };

  const handleAppointmentClick = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setShowDetailModal(true);
  };

  const openAttendanceChoiceModal = (appointment: Appointment) => {
    setAttendanceChoiceAppointment(appointment);
    setShowAttendanceChoiceModal(true);
  };

  const closeAttendanceChoiceModal = () => {
    if (loading) return;
    setShowAttendanceChoiceModal(false);
    setAttendanceChoiceAppointment(null);
  };

  const handleAttendanceChoice = async (choice: Exclude<AppointmentOutcomeChoice, "cancel">) => {
    if (!attendanceChoiceAppointment) return;

    const choiceMap: Record<Exclude<AppointmentOutcomeChoice, "cancel">, Partial<Appointment> & { source_application_status?: string }> = {
      completed: {
        status: "attended",
        outcome_decision: ["Tamamlandı"],
        next_action: undefined,
        source_application_status: "completed",
        source_individual_request_id: attendanceChoiceAppointment.source_individual_request_id,
        source_application_id: attendanceChoiceAppointment.source_application_id,
        source_application_type: attendanceChoiceAppointment.source_application_type
      },
      active_follow: {
        status: "attended",
        outcome_decision: ["Aktif Takip"],
        source_application_status: "active_follow",
        source_individual_request_id: attendanceChoiceAppointment.source_individual_request_id,
        source_application_id: attendanceChoiceAppointment.source_application_id,
        source_application_type: attendanceChoiceAppointment.source_application_type
      },
      regular_meeting: {
        status: "attended",
        outcome_decision: ["Düzenli Görüşme"],
        source_application_status: "regular_meeting",
        source_individual_request_id: attendanceChoiceAppointment.source_individual_request_id,
        source_application_id: attendanceChoiceAppointment.source_application_id,
        source_application_type: attendanceChoiceAppointment.source_application_type
      }
    };

    const messages: Record<Exclude<AppointmentOutcomeChoice, "cancel">, string> = {
      completed: "Tamamlandı olarak işaretlendi",
      active_follow: "Aktif Takip olarak işaretlendi",
      regular_meeting: "Düzenli Görüşme olarak işaretlendi"
    };

    const result = await updateAppointment(attendanceChoiceAppointment.id, choiceMap[choice] as Partial<Appointment>);
    if (result) {
      if (choice === "completed" && result.source_individual_request_id) {
        try {
          const res = await fetch("/api/individual-requests", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: result.source_individual_request_id,
              status: "completed"
            })
          });

          if (!res.ok) {
            throw new Error("Bireysel başvuru güncellenemedi");
          }
        } catch (error) {
          console.error("Individual request completed update error:", error);
          toast.error("Randevu tamamlandı ama bireysel başvuru güncellenemedi");
        }
        notifyPotentialMeetingsChanged({
          action: "update",
          id: result.source_individual_request_id,
          source: "individual-request",
          studentName: result.participant_name
        });
      }

      setSelectedAppointment((prev) => (prev?.id === attendanceChoiceAppointment.id ? result : prev));
      closeAttendanceChoiceModal();
      notifyPotentialMeetingsChanged({
        action: "update",
        id: result.id,
        source: "appointment",
        studentName: result.participant_name
      });
      toast.success(messages[choice]);
    }
  };

  const handleCloseAppointment = async () => {
    if (!selectedAppointment) return;
    const result = await closeAppointment(selectedAppointment.id, closureData);
    if (result) {
      setShowClosureModal(false);
      setSelectedAppointment(null);
      setClosureData({
        status: "attended",
        outcome_summary: "",
        outcome_decision: [],
        next_action: "",
        create_follow_up: false
      });
    }
  };

  const handleAddTask = async () => {
    if (!selectedAppointment || !newTaskDescription) return;
    await createTask(selectedAppointment.id, newTaskDescription);
    setNewTaskDescription("");
  };

  const statusCounts = getStatusCounts();
  const weekDays = getWeekDays(currentDate);

  const getLocationLabel = (location: string) =>
    APPOINTMENT_LOCATIONS.find(l => l.value === location)?.label || location;

  const getParticipantLabel = (type: ParticipantType) =>
    PARTICIPANT_TYPES.find(p => p.value === type)?.label || type;

  const AppointmentCard = ({
    appointment,
    compact = false
  }: {
    appointment: Appointment;
    compact?: boolean;
  }) => {
    const StatusIcon = statusIcons[appointment.status];
    const ParticipantIcon = participantColors[appointment.participant_type].icon;
    const colors = statusColors[appointment.status];
    const pColors = participantColors[appointment.participant_type];

    return (
      <div
        onClick={() => handleAppointmentClick(appointment)}
        className={`group relative overflow-hidden rounded-2xl border bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${
          compact ? "p-3" : "p-4"
        } border-slate-200`}
      >
        <div className={`absolute left-0 top-0 h-full w-1 ${colors.bg}`} />

        <div className={`flex items-start justify-between gap-3 ${compact ? "pl-2" : "pl-3"}`}>
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100">
                <span className={`text-sm font-bold ${colors.text}`}>{appointment.start_time}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={`${pColors.bg} ${pColors.text} border-0 text-xs gap-1`}>
                    <ParticipantIcon className="h-3 w-3" />
                    {getParticipantLabel(appointment.participant_type)}
                  </Badge>
                  <span className="font-semibold text-slate-800">{appointment.participant_name}</span>
                  {appointment.participant_class && (
                    <span className="text-xs text-slate-500">({appointment.participant_class})</span>
                  )}
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {getLocationLabel(appointment.location)}
                  </span>
                  <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 ${colors.bg} ${colors.text}`}>
                    <StatusIcon className="h-3.5 w-3.5" />
                    {APPOINTMENT_STATUS.find(s => s.value === appointment.status)?.label}
                  </span>
                  {appointment.purpose && (
                    <span className="text-slate-500">· {appointment.purpose}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openAttendanceChoiceModal(appointment);
              }}
              className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all ${
                appointment.status === "attended"
                  ? "border-emerald-500 bg-emerald-500 text-white shadow-sm"
                  : "border-slate-300 bg-white text-slate-400 hover:border-emerald-400 hover:text-emerald-500"
              }`}
              aria-label={appointment.status === "attended" ? "Geldi olarak işaretli" : "Geldi olarak işaretle"}
              title={appointment.status === "attended" ? "Geldi" : "Geldi olarak işaretle"}
            >
              <CheckCircle2 className="h-5 w-5" />
            </button>
            <div className={`rounded-xl px-2 py-1 text-right ${colors.bg} ${colors.text}`}>
              <div className="text-[10px] uppercase tracking-wide text-current/70">Ders</div>
              <div className="text-sm font-bold leading-none">{appointment.start_time}</div>
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  openEditAppointmentModal(appointment);
                }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 hover:text-teal-600"
                aria-label="Randevuyu düzenle"
              >
                <Edit2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void handleDeleteAppointment(appointment);
                }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-white text-red-600 transition-colors hover:bg-red-50"
                aria-label="Randevuyu sil"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-cyan-900 to-teal-700 p-6 text-white shadow-xl">
        <div className="absolute inset-0 bg-grid-white/10" />
        <div className="absolute -top-20 -right-20 h-56 w-56 rounded-full bg-cyan-300/20 blur-3xl animate-float-slow" />
        <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-teal-400/20 blur-3xl animate-float-reverse" />

        <div className="relative">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm shadow-lg">
                <CalendarCheck className="h-7 w-7" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Randevular</h1>
                <p className="text-slate-200">Görüşme planlama ve takip sistemi</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/10 px-3 py-2 backdrop-blur-sm">
                <Clock className="h-4 w-4 text-cyan-200" />
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-cyan-100">Planlandı</p>
                  <p className="text-lg font-bold leading-none">{statusCounts.planned}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/10 px-3 py-2 backdrop-blur-sm">
                <CheckCircle2 className="h-4 w-4 text-green-300" />
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-cyan-100">Geldi</p>
                  <p className="text-lg font-bold leading-none">{statusCounts.attended}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/10 px-3 py-2 backdrop-blur-sm">
                <XCircle className="h-4 w-4 text-red-300" />
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-cyan-100">Gelmedi</p>
                  <p className="text-lg font-bold leading-none">{statusCounts.not_attended}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/10 px-3 py-2 backdrop-blur-sm">
                <Sparkles className="h-4 w-4 text-amber-300" />
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-cyan-100">Toplam</p>
                  <p className="text-lg font-bold leading-none">{appointments.length}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/15 pt-4">
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-white/10 rounded-lg p-1">
                <button
                  onClick={() => setViewMode("day")}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    viewMode === "day"
                      ? "bg-white text-teal-600 shadow-sm"
                      : "text-white/80 hover:text-white"
                  }`}
                >
                  <List className="h-3.5 w-3.5 inline mr-1" />
                  Günlük
                </button>
                <button
                  onClick={() => setViewMode("week")}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    viewMode === "week"
                      ? "bg-white text-teal-600 shadow-sm"
                      : "text-white/80 hover:text-white"
                  }`}
                >
                  <LayoutGrid className="h-3.5 w-3.5 inline mr-1" />
                  Haftalık
                </button>
              </div>

              <div className="flex items-center gap-1 bg-white/10 rounded-lg p-1">
                <button onClick={goToPrev} className="p-1.5 rounded hover:bg-white/10 transition-colors">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button onClick={goToToday} className="px-2 py-1 text-xs font-medium hover:bg-white/10 rounded transition-colors">
                  Bugün
                </button>
                <button onClick={goToNext} className="p-1.5 rounded hover:bg-white/10 transition-colors">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              <Badge className="bg-white/20 text-white border-0">
                <CalendarDays className="h-3 w-3 mr-1" />
                {viewMode === "day"
                  ? formatDate(currentDate.toISOString().slice(0, 10))
                  : `${formatShortDate(weekDays[0].toISOString().slice(0, 10))} - ${formatShortDate(weekDays[6].toISOString().slice(0, 10))}`
                }
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  const today = new Date().toISOString().slice(0, 10);
                  const weekEnd = new Date();
                  weekEnd.setDate(weekEnd.getDate() + 7);
                  fetchAppointments({ from: today, to: weekEnd.toISOString().slice(0, 10) });
                }}
                disabled={loading}
                className="bg-white/10 hover:bg-white/20 text-white border-0"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
              <Button
                onClick={openNewAppointmentModal}
                className="bg-white text-teal-600 hover:bg-white/90 shadow-lg"
              >
                <Plus className="h-4 w-4 mr-1" />
                Yeni Randevu
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* TAKVİM ALANI */}
      {viewMode === "day" ? (
        <Card className="bg-white/90 backdrop-blur">
          <CardHeader className="pb-2 border-b">
            <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-teal-600" />
              {formatDate(currentDate.toISOString().slice(0, 10))}
              {isToday(currentDate) && (
                <Badge className="bg-teal-100 text-teal-700 text-xs">Bugün</Badge>
              )}
              <span className="ml-auto text-xs text-slate-500">
                {filteredAppointments.length} randevu
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin text-teal-500" />
              </div>
            ) : filteredAppointments.length === 0 ? (
              <div className="text-center py-12">
                <CalendarCheck className="h-12 w-12 mx-auto text-slate-300 mb-3" />
                <p className="text-slate-500">Bu gün için randevu bulunmuyor</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openNewAppointmentModal}
                  className="mt-3"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Randevu Ekle
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredAppointments.map((appointment) => (
                  <AppointmentCard key={appointment.id} appointment={appointment} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-white/90 backdrop-blur overflow-hidden">
          <CardContent className="p-0">
            <div className="grid grid-cols-8 border-b">
              <div className="p-2 border-r bg-slate-50">
                <div className="h-12"></div>
              </div>
              {weekDays.map((day, idx) => {
                const dayStr = day.toISOString().slice(0, 10);
                const dayAppointments = appointments.filter(a => a.appointment_date === dayStr);
                return (
                  <div
                    key={idx}
                    className={`p-2 text-center border-r ${isToday(day) ? "bg-teal-50" : "bg-slate-50"}`}
                  >
                    <div className={`text-xs font-medium ${isToday(day) ? "text-teal-600" : "text-slate-500"}`}>
                      {getDayName(day)}
                    </div>
                    <div className={`text-lg font-bold ${isToday(day) ? "text-teal-700" : "text-slate-800"}`}>
                      {day.getDate()}
                    </div>
                    {dayAppointments.length > 0 && (
                      <Badge className="bg-teal-100 text-teal-700 text-[10px] mt-1">
                        {dayAppointments.length}
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="max-h-[500px] overflow-y-auto">
              {LESSON_SLOTS.map((slot) => (
                <div key={slot.value} className="grid grid-cols-8 border-b">
                  <div className="p-2 text-xs text-slate-500 text-right border-r bg-slate-50/50 flex items-center justify-end">
                    {slot.label}
                  </div>
                  {weekDays.map((day, dayIdx) => {
                    const dayStr = day.toISOString().slice(0, 10);
                    const slotAppointments = filteredAppointments.filter(a =>
                      a.appointment_date === dayStr &&
                      a.start_time === slot.value
                    );

                    return (
                      <div
                        key={dayIdx}
                        className={`min-h-[48px] p-1 border-r ${isToday(day) ? "bg-teal-50/30" : ""} hover:bg-slate-50 transition-colors`}
                      >
                        {slotAppointments.map((apt) => (
                          <AppointmentCard key={apt.id} appointment={apt} compact />
                        ))}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* YENİ RANDEVU MODALI */}
      {showNewAppointmentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Plus className="h-5 w-5 text-teal-600" />
                {editingAppointment ? "Randevu Düzenle" : "Yeni Randevu"}
              </h2>
              <button
                onClick={closeNewAppointmentModal}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Görüşme Türü */}
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Görüşme Türü *</label>
                <select
                  value={formData.participant_type}
                  onChange={(e) => {
                    const newType = e.target.value as ParticipantType;
                    setFormData({ ...formData, participant_type: newType, participant_name: "", participant_class: "" });
                    setSelectedClass("");
                    setStudents([]);
                    setParentName("");
                    setSelectedStudentName("");
                  }}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500"
                >
                  {PARTICIPANT_TYPES.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>

              {/* Öğrenci / Veli seçimi */}
              {(formData.participant_type === "student" || formData.participant_type === "parent") && (
                <>
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1 block">Sınıf Seçin</label>
                    <select
                      value={selectedClass}
                      onChange={(e) => {
                        const classKey = e.target.value;
                        setSelectedClass(classKey);
                        const classText = classes.find(c => c.value === classKey)?.text || "";
                        setFormData({
                          ...formData,
                          participant_class: classText,
                          participant_name: poolStudentName || formData.participant_name || ""
                        });
                      }}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500"
                    >
                      <option value="">-- Sınıf Seçin --</option>
                      {classes.map(c => (
                        <option key={c.value} value={c.value}>{c.text}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1 block">
                      {formData.participant_type === "student" ? "Öğrenci Seçin *" : "Velisi Olduğu Öğrenci *"}
                    </label>
                    {hasPoolPrefill ? (
                      <div className="rounded-lg border bg-teal-50 px-3 py-2 text-sm text-teal-800">
                        <div className="font-medium">{poolStudentName}</div>
                        <div className="text-xs text-teal-600">
                          {poolClassDisplay || formData.participant_class || "Sınıf bilgisi yok"}
                        </div>
                      </div>
                    ) : loadingStudents ? (
                      <div className="flex items-center gap-2 px-3 py-2 border rounded-lg bg-slate-50">
                        <RefreshCw className="h-4 w-4 animate-spin text-teal-500" />
                        <span className="text-sm text-slate-500">Öğrenciler yükleniyor...</span>
                      </div>
                    ) : (
                      <select
                        value={formData.participant_type === "parent" ? selectedStudentName : formData.participant_name}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (formData.participant_type === "parent") {
                            setSelectedStudentName(value);
                          } else {
                            setFormData({ ...formData, participant_name: value });
                          }
                        }}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500"
                        disabled={!selectedClass}
                      >
                        <option value="">
                          {!selectedClass ? "-- Önce sınıf seçin --" : "-- Öğrenci Seçin --"}
                        </option>
                        {students.map(s => (
                          <option key={s.value} value={s.text}>{s.text}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  {formData.participant_type === "parent" && (
                    <div>
                      <label className="text-xs font-medium text-slate-600 mb-1 block">Veli Adı (opsiyonel)</label>
                      <input
                        type="text"
                        value={parentName}
                        placeholder="Veli adını girin veya boş bırakın"
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500"
                        onChange={(e) => {
                          const newParentName = e.target.value;
                          setParentName(newParentName);
                          if (newParentName.trim() && selectedStudentName) {
                            setFormData({
                              ...formData,
                              participant_name: `${newParentName} (${selectedStudentName}'ın velisi)`
                            });
                          } else {
                            setFormData({
                              ...formData,
                              participant_name: newParentName.trim() || ""
                            });
                          }
                        }}
                      />
                    </div>
                  )}
                </>
              )}

              {/* Öğretmen seçimi */}
              {formData.participant_type === "teacher" && (
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Öğretmen Seçin *</label>
                  <select
                    value={formData.participant_name}
                    onChange={(e) => setFormData({ ...formData, participant_name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="">-- Öğretmen Seçin --</option>
                    {teachers.map(t => (
                      <option key={t.value} value={t.label}>{t.label}</option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 mt-1">veya manuel girin:</p>
                  <input
                    type="text"
                    value={formData.participant_name}
                    onChange={(e) => setFormData({ ...formData, participant_name: e.target.value })}
                    placeholder="Öğretmen adı"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 mt-1"
                  />
                </div>
              )}

              {/* Tarih ve Ders */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Tarih *</label>
                  <input
                    type="date"
                    value={formData.appointment_date}
                    onChange={(e) => setFormData({ ...formData, appointment_date: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Ders *</label>
                  <select
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500"
                  >
                    {LESSON_SLOTS.map(slot => (
                      <option 
                        key={slot.value} 
                        value={slot.value} 
                        disabled={busySlots.has(slot.value)}
                        className={busySlots.has(slot.value) ? "text-slate-400 bg-slate-100" : ""}
                      >
                        {slot.label} {busySlots.has(slot.value) ? "(Dolu)" : ""}
                      </option>
                    ))}
                  </select>
                  {busySlots.size > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {Array.from(busySlots)
                        .sort((a, b) => Number(a) - Number(b))
                        .map((slot) => (
                          <span
                            key={slot}
                            className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-500"
                          >
                            {formatLessonSlotLabel(slot)} dolu
                          </span>
                        ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Yer */}
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Yer</label>
                <select
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value as any })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500"
                >
                  {APPOINTMENT_LOCATIONS.map(l => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
              </div>

              {/* Konu */}
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Konu *</label>
                <select
                  value={formData.purpose || ""}
                  onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">-- Konu seçin --</option>
                  {APPOINTMENT_TOPICS.map(topic => (
                    <option key={topic} value={topic}>{topic}</option>
                  ))}
                </select>
              </div>

              {/* Hazırlık Notu */}
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Hazırlık Notu (opsiyonel)</label>
                <textarea
                  value={formData.preparation_note || ""}
                  onChange={(e) => setFormData({ ...formData, preparation_note: e.target.value })}
                  placeholder="Görüşme öncesi hatırlatmalar..."
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 resize-none"
                />
              </div>
            </div>

            <div className="sticky bottom-0 bg-slate-50 border-t px-6 py-4 flex justify-end gap-3">
              <Button variant="outline" onClick={closeNewAppointmentModal}>
                İptal
              </Button>
              <Button
                onClick={handleSaveAppointment}
                disabled={loading || !formData.participant_name}
                className="bg-teal-600 hover:bg-teal-700"
              >
                {loading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                {editingAppointment ? "Randevu Güncelle" : "Randevu Oluştur"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <AppointmentOutcomeModal
        open={showAttendanceChoiceModal}
        appointment={attendanceChoiceAppointment}
        loading={loading}
        onClose={closeAttendanceChoiceModal}
        onSelect={handleAttendanceChoice}
      />

      {/* GÖRÜŞME KAPANIŞ MODALI */}
      {showClosureModal && selectedAppointment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-teal-500 to-emerald-500 text-white px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5" />
                  Görüşme Kapanışı
                </h2>
                <p className="text-sm text-teal-100">
                  {selectedAppointment.participant_name} - {selectedAppointment.start_time}
                </p>
              </div>
              <button
                onClick={() => { setShowClosureModal(false); setSelectedAppointment(null); }}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-2 block">Katılım Durumu</label>
                <div className="flex gap-2">
                  {[
                    { value: "attended", label: "Geldi", icon: CheckCircle2 },
                    { value: "not_attended", label: "Gelmedi", icon: XCircle },
                    { value: "postponed", label: "Ertelendi", icon: PauseCircle },
                    { value: "cancelled", label: "İptal", icon: Ban }
                  ].map((s) => {
                    const Icon = s.icon;
                    const isSelected = closureData.status === s.value;
                    return (
                      <button
                        key={s.value}
                        onClick={() => setClosureData({ ...closureData, status: s.value as AppointmentStatus })}
                        className={`flex-1 p-3 rounded-lg border-2 transition-all ${
                          isSelected
                            ? "border-teal-500 bg-teal-50 text-teal-700"
                            : "border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <Icon className={`h-5 w-5 mx-auto mb-1 ${isSelected ? "text-teal-500" : "text-slate-400"}`} />
                        <div className="text-xs font-medium">{s.label}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {closureData.status === "attended" && (
                <>
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1 block">
                      Kısa Sonuç <span className="text-slate-400">(1-2 cümle)</span>
                    </label>
                    <textarea
                      value={closureData.outcome_summary || ""}
                      onChange={(e) => setClosureData({ ...closureData, outcome_summary: e.target.value })}
                      placeholder="Görüşmede ne oldu?"
                      rows={2}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 resize-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-2 block">Karar / Yönlendirme</label>
                    <div className="flex flex-wrap gap-2 p-3 border rounded-lg bg-slate-50">
                      {OUTCOME_DECISIONS.map(decision => (
                        <button
                          key={decision}
                          type="button"
                          onClick={() => {
                            const newDecisions = closureData.outcome_decision?.includes(decision)
                              ? closureData.outcome_decision.filter(d => d !== decision)
                              : [...(closureData.outcome_decision || []), decision];
                            setClosureData({ ...closureData, outcome_decision: newDecisions });
                          }}
                          className={`text-xs px-2 py-1 rounded-full transition-colors ${
                            closureData.outcome_decision?.includes(decision)
                              ? "bg-teal-500 text-white"
                              : "bg-white border hover:bg-slate-100"
                          }`}
                        >
                          {decision}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1 block">Bir Sonraki Adım</label>
                    <input
                      type="text"
                      value={closureData.next_action || ""}
                      onChange={(e) => setClosureData({ ...closureData, next_action: e.target.value })}
                      placeholder="Yapılması gereken şey..."
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500"
                    />
                  </div>

                  <div className="p-3 bg-teal-50 rounded-lg border border-teal-200">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={closureData.create_follow_up}
                        onChange={(e) => setClosureData({ ...closureData, create_follow_up: e.target.checked })}
                        className="w-4 h-4 rounded border-teal-300 text-teal-600 focus:ring-teal-500"
                      />
                      <span className="text-sm font-medium text-teal-700">
                        Takip randevusu oluştur (1 hafta sonra)
                      </span>
                    </label>
                  </div>
                </>
              )}

              {(closureData.status === "not_attended" || closureData.status === "postponed") && (
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Not</label>
                  <textarea
                    value={closureData.outcome_summary || ""}
                    onChange={(e) => setClosureData({ ...closureData, outcome_summary: e.target.value })}
                    placeholder={closureData.status === "not_attended" ? "Neden gelmedi?" : "Ne zaman ertelendi?"}
                    rows={2}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 resize-none"
                  />
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-slate-50 border-t px-6 py-4 flex justify-end gap-3">
              <Button variant="outline" onClick={() => { setShowClosureModal(false); setSelectedAppointment(null); }}>
                İptal
              </Button>
              <Button onClick={handleCloseAppointment} disabled={loading} className="bg-teal-600 hover:bg-teal-700">
                {loading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Kaydet
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* DETAY MODALI */}
      {showDetailModal && selectedAppointment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">Randevu Detayı</h2>
              <button
                onClick={() => { setShowDetailModal(false); setSelectedAppointment(null); }}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <Badge className={`${participantColors[selectedAppointment.participant_type].bg} ${participantColors[selectedAppointment.participant_type].text}`}>
                  {getParticipantLabel(selectedAppointment.participant_type)}
                </Badge>
                <span className="text-lg font-semibold">{selectedAppointment.participant_name}</span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-500">Tarih:</span>
                  <span className="ml-2 font-medium">{formatDate(selectedAppointment.appointment_date)}</span>
                </div>
                <div>
                  <span className="text-slate-500">Ders:</span>
                  <span className="ml-2 font-medium">{selectedAppointment.start_time}</span>
                </div>
                <div>
                  <span className="text-slate-500">Yer:</span>
                  <span className="ml-2 font-medium">{getLocationLabel(selectedAppointment.location)}</span>
                </div>
                {selectedAppointment.purpose && (
                  <div>
                    <span className="text-slate-500">Konu:</span>
                    <span className="ml-2 font-medium">{selectedAppointment.purpose}</span>
                  </div>
                )}
              </div>

              <div className={`p-3 rounded-lg ${statusColors[selectedAppointment.status].bg} ${statusColors[selectedAppointment.status].border} border`}>
                <div className="flex items-center gap-2">
                  {(() => {
                    const Icon = statusIcons[selectedAppointment.status];
                    return <Icon className={`h-5 w-5 ${statusColors[selectedAppointment.status].text}`} />;
                  })()}
                  <span className={`font-medium ${statusColors[selectedAppointment.status].text}`}>
                    {APPOINTMENT_STATUS.find(s => s.value === selectedAppointment.status)?.label}
                  </span>
                </div>
              </div>

              {selectedAppointment.outcome_summary && (
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">Sonuç</label>
                  <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg">{selectedAppointment.outcome_summary}</p>
                </div>
              )}

              {selectedAppointment.outcome_decision && selectedAppointment.outcome_decision.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">Kararlar</label>
                  <div className="flex flex-wrap gap-1">
                    {selectedAppointment.outcome_decision.map((d, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">{d}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {selectedAppointment.next_action && (
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">Sonraki Adım</label>
                  <p className="text-sm text-slate-700 bg-amber-50 p-3 rounded-lg border border-amber-200">{selectedAppointment.next_action}</p>
                </div>
              )}
            </div>

            <div className="bg-slate-50 border-t px-6 py-4 flex justify-between gap-3">
              <Button
                variant="outline"
                className="text-red-600 border-red-200 hover:bg-red-50"
                onClick={async () => {
                  const confirmDelete = window.confirm("Bu randevuyu silmek istediğinize emin misiniz?");
                  if (confirmDelete && selectedAppointment) {
                    const appointmentId = selectedAppointment.id;
                    setShowDetailModal(false);
                    setSelectedAppointment(null);
                    const success = await deleteAppointment(appointmentId);
                    if (success) toast.success("Randevu başarıyla silindi");
                  }
                }}
              >
                Sil
              </Button>
              <Button variant="outline" onClick={() => { setShowDetailModal(false); setSelectedAppointment(null); }}>
                Kapat
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* İPUÇLARI */}
      <Card className="bg-gradient-to-r from-teal-50 to-emerald-50 border-teal-200">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-teal-100">
              <Sparkles className="h-5 w-5 text-teal-600" />
            </div>
            <div className="text-sm">
              <p className="font-medium text-teal-800">Randevu Yönetimi İpuçları</p>
              <ul className="mt-1 space-y-1 text-teal-700 text-xs">
                <li>• <strong>Hızlı randevu:</strong> Yeni Randevu butonuna tıklayın, tarih ve ders saatini seçin</li>
                <li>• <strong>Görüşme sonrası:</strong> Randevu kartına tıklayarak hızlıca kapanış yapın</li>
                <li>• <strong>Takip:</strong> Kapanış sırasında "Takip randevusu oluştur" seçeneğini işaretleyin</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}