"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  RefreshCw,
  CalendarDays,
  CalendarCheck,
  Loader2,
  CheckCircle2,
  Trash2,
  ListTodo,
  XCircle,
  Users,
  X,
  Bell,
  AlertTriangle
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { 
  Appointment, 
  PARTICIPANT_TYPES, 
  APPOINTMENT_LOCATIONS,
  LESSON_SLOTS,
  ParticipantType
} from "@/types";
import { AppointmentOutcomeModal, type AppointmentOutcomeChoice } from "@/components/AppointmentOutcomeModal";
import { ClassRequestCategoryInput } from "@/components/ClassRequestCategoryInput";
import {
  getClassRequestDisplayCategory,
  getClassRequestTeacherNote,
} from "@/lib/classRequests";

const normalizeLessonSlot = (timeStr?: string | null) => {
  if (!timeStr) return '';
  const match = String(timeStr).match(/\d+/);
  return match ? match[0] : '';
};

const formatLessonSlotLabel = (slot: string) => {
  const match = slot.match(/\d+/);
  return match ? `${match[0]}. Ders` : slot;
};

const normalizeClassValue = (value?: string | null) =>
  (value || "")
    .toLocaleLowerCase("tr-TR")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[\/\-_.()]/g, "")
    .trim();

const parseApplicationNote = (rawValue?: string | null) => {
  if (!rawValue) return { purpose: "", preparationNote: "" };
  const trimmed = rawValue.trim();
  const match = trimmed.match(/^\[(.+?)\]\s*([\s\S]*)$/);
  if (!match) return { purpose: trimmed, preparationNote: "" };
  return {
    purpose: match[1]?.trim() || "",
    preparationNote: match[2]?.trim() || ""
  };
};

const getClassRequestCategoryLabel = (request: {
  admin_category?: string | null;
  topic?: string | null;
}) => getClassRequestDisplayCategory(request) || "Teknik kategori bekliyor";

const MONTHS_TR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const DAYS_TR = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const DAYS_FULL_TR = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

const getLocalDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const CATEGORIES = [
  { value: 'genel', label: 'Genel', icon: '📋' },
  { value: 'randevu', label: 'Randevu', icon: '📅' },
  { value: 'toplanti', label: 'Toplantı', icon: '🗓️' },
  { value: 'veli', label: 'Veli', icon: '👨‍👩‍👧' },
  { value: 'ogretmen', label: 'Öğretmen', icon: '👨‍🏫' },
  { value: 'okul-ziyareti', label: 'Okul Ziyareti', icon: '🏫' },
  { value: 'kurum-ziyareti', label: 'Kurum Ziyareti', icon: '🏢' },
  { value: 'meslek-tanitimi', label: 'Meslek Tanıtımı', icon: '💼' },
  { value: 'rapor', label: 'Rapor', icon: '📊' },
  { value: 'diger', label: 'Diğer', icon: '📌' }
];

const PRIORITIES = [
  { value: 'low', label: 'Düşük' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'Yüksek' },
  { value: 'urgent', label: 'Acil' }
];

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

type ViewType = 'month' | 'week' | 'day';

interface CalendarEvent {
  id: string;
  date: string;
  time?: string;
  title: string;
  type: 'appointment' | 'guidance_plan' | 'class_request' | 'task' | 'follow_up';
  status?: string;
  color: string;
  data: any;
}

type PendingApplicationRecord = {
  id: string;
  student_name: string;
  class_display?: string | null;
  class_key?: string | null;
  source: "Veli Talepleri" | "Öğretmen Yönlendirmeleri" | "Öğrenci Bildirimleri" | "Gözlem Havuzu" | "Bireysel Başvuru";
  referrer?: string;
  date: string;
  note?: string | null;
};

const normalizeStudentName = (value?: string | null) =>
  String(value || "")
    .replace(/^\s*\d+\s+/, "")
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("tr-TR")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

const matchesApplicationToAppointment = (
  appointment: Partial<Appointment>,
  studentName?: string | null,
  classDisplay?: string | null,
  classKey?: string | null
) => {
  const appointmentName = normalizeStudentName(appointment.participant_name);
  const applicationName = normalizeStudentName(studentName);
  if (!appointmentName || !applicationName) return false;
  const nameMatch =
    appointmentName === applicationName ||
    appointmentName.includes(applicationName) ||
    applicationName.includes(appointmentName);
  if (!nameMatch) return false;

  const appointmentClass = normalizeClassValue(appointment.participant_class);
  const applicationClass = normalizeClassValue(classDisplay || classKey);
  if (!appointmentClass || !applicationClass) return true;

  return (
    appointmentClass === applicationClass ||
    appointmentClass.includes(applicationClass) ||
    applicationClass.includes(appointmentClass)
  );
};

const isPendingApplicationStatus = (status?: string | null) => {
  if (!status) return true;
  return ["pending", "new", "reviewing", "Bekliyor"].includes(String(status));
};

export default function TakvimPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewType, setViewType] = useState<ViewType>('day');
  const [isLoading, setIsLoading] = useState(true);

  // Auth & Bildirim State'leri
  const [userRole, setUserRole] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<{ pendingRequests: any[]; recentReferrals: any[] }>({ pendingRequests: [], recentReferrals: [] });
  const [notifLoading, setNotifLoading] = useState(false);

  // Veri State'leri
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [guidancePlans, setGuidancePlans] = useState<any[]>([]);
  const [classRequests, setClassRequests] = useState<any[]>([]);
  const [guidanceTopicMap, setGuidanceTopicMap] = useState<Record<string, string>>({});
  const [tasks, setTasks] = useState<any[]>([]);
  const [followUps, setFollowUps] = useState<any[]>([]);

  // Filtre State'leri
  const [showAppointments, setShowAppointments] = useState(true);
  const [showActivities, setShowActivities] = useState(true);
  const [showTasks, setShowTasks] = useState(true);

  // Modallar
  const [dayModalDate, setDayModalDate] = useState<Date | null>(null);

  // Sınıf Talebi Düzenleme Modal State'leri
  const [showCrEditModal, setShowCrEditModal] = useState(false);
  const [editingCr, setEditingCr] = useState<any>(null);
  const [crEditDate, setCrEditDate] = useState('');
  const [crEditPeriod, setCrEditPeriod] = useState<number | null>(null);
  const [crEditTeacher, setCrEditTeacher] = useState('');
  const [crEditCategory, setCrEditCategory] = useState('');
  const [crEditBusySlots, setCrEditBusySlots] = useState<Set<string>>(new Set());
  const [crEditConflict, setCrEditConflict] = useState<string | null>(null);
  const [crEditSaving, setCrEditSaving] = useState(false);
  const [classRequestCategorySuggestions, setClassRequestCategorySuggestions] = useState<string[]>([]);
  
  const [showAttendanceChoiceModal, setShowAttendanceChoiceModal] = useState(false);
  const [attendanceChoiceAppointment, setAttendanceChoiceAppointment] = useState<Appointment | null>(null);
  const [attendanceSaving, setAttendanceSaving] = useState(false);
  const [showPendingApplicationsModal, setShowPendingApplicationsModal] = useState(false);
  const [pendingApplicationsLoading, setPendingApplicationsLoading] = useState(false);
  const [pendingApplications, setPendingApplications] = useState<PendingApplicationRecord[]>([]);
  const [pendingSelectionSlot, setPendingSelectionSlot] = useState<{ date: string; start_time: string } | null>(null);

  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskSaving, setTaskSaving] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    category: 'genel',
    priority: 'normal',
    due_date: '',
    due_time: '',
    related_student_name: ''
  });

  // --- Randevu Modal State'leri (Orijinal Sistem) ---
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [appointmentSaving, setAppointmentSaving] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [classes, setClasses] = useState<{ value: string; text: string }[]>([]);
  const [students, setStudents] = useState<{ value: string; text: string }[]>([]);
  const [teachers, setTeachers] = useState<{ value: string; label: string }[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [selectedClass, setSelectedClass] = useState("");
  const [parentName, setParentName] = useState("");
  const [selectedStudentName, setSelectedStudentName] = useState("");
  const [busySlots, setBusySlots] = useState<Set<string>>(new Set());

  const [formData, setFormData] = useState({
    appointment_date: getLocalDateString(new Date()),
    start_time: "1",
    participant_type: "student" as ParticipantType,
    participant_name: "",
    participant_class: "",
    location: "guidance_office",
    purpose: "",
    preparation_note: "",
    source_application_id: "",
    source_application_type: "",
    source_individual_request_id: ""
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const sName = params.get("studentName");
      const cDisplay = params.get("classDisplay");
      const classKey = params.get("classKey");
      const sId = params.get("sourceId");
      const sType = params.get("sourceType");
      const purposeParam = params.get("purpose");
      const preparationNoteParam = params.get("preparationNote");

      if (sName && sId && sType) {
        let appType = "";
        let indId = "";
        let appId = "";

        if (sType === "Bireysel Başvuru") {
          indId = sId.includes('-') ? sId.split('-')[1] : sId;
        } else if (sType === "Öğretmen Yönlendirmeleri") {
          appType = "teacher_referral";
          appId = sId.includes('-') ? sId.split('-')[1] : sId;
        } else if (sType === "Öğrenci Bildirimleri") {
          appType = "student_incident";
          appId = sId.includes('-') ? sId.split('-')[1] : sId;
        } else if (sType === "Veli Talepleri") {
          appType = "parent_meeting";
          appId = sId.includes('-') ? sId.split('-')[1] : sId;
        } else if (sType === "Gözlem Havuzu") {
          appType = "observation";
          appId = sId.includes('-') ? sId.split('-')[1] : sId;
        }

        // Find matching class from the loaded classes list
        let matchedClassKey = "";
        if (classes.length > 0) {
          const normalizedClassDisplay = normalizeClassValue(cDisplay);
          const foundClass = classes.find(c =>
            c.value === classKey ||
            c.text === cDisplay ||
            normalizeClassValue(c.text) === normalizedClassDisplay
          );
          if (foundClass) {
            matchedClassKey = foundClass.value;
          }
        }

        const parsedNote = parseApplicationNote(preparationNoteParam);
        const initialPurpose = purposeParam || parsedNote.purpose;
        const initialPreparationNote = parsedNote.preparationNote;

        setFormData(prev => ({
          ...prev,
          participant_name: sName,
          participant_class: cDisplay || "",
          purpose: initialPurpose,
          preparation_note: initialPreparationNote,
          source_application_id: appId,
          source_application_type: appType,
          source_individual_request_id: indId,
          appointment_date: getLocalDateString(new Date())
        }));
        
        // Set selectedClass - either the matched key or the display text directly
        if (matchedClassKey) {
          setSelectedClass(matchedClassKey);
        } else if (classKey) {
          setSelectedClass(classKey);
        }

        setSelectedStudentName(sName);
        setShowAppointmentModal(true);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, [classes]);

  // --- Auth & Bildirimler ---
  const loadClassRequestCategorySuggestions = async () => {
    try {
      const res = await fetch('/api/class-request-categories', {
        headers: { Accept: 'application/json' }
      });
      const data = await res.json();
      if (res.ok) setClassRequestCategorySuggestions(data.categories || []);
    } catch {
      // ignore
    }
  };

  const handleDeleteClassRequestCategory = async (label: string) => {
    if (!confirm(`"${label}" kategorisini silmek istiyor musunuz?`)) return;
    try {
      const res = await fetch('/api/class-request-categories', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Kategori silinemedi');
      setClassRequestCategorySuggestions(prev => prev.filter(item => item !== label));
      toast.success('Kategori silindi');
    } catch (err: any) {
      toast.error(err.message || 'Kategori silinemedi');
    }
  };

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      setUserRole(d.role || null);
      if (d.role === 'admin') {
        loadNotifications();
        loadClassRequestCategorySuggestions();
      }
    }).catch(() => {});
  }, []);

  const loadNotifications = async () => {
    setNotifLoading(true);
    try {
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
      const weekAgo = new Date(today); weekAgo.setDate(today.getDate() - 7);
      const weekAgoStr = `${weekAgo.getFullYear()}-${String(weekAgo.getMonth()+1).padStart(2,'0')}-${String(weekAgo.getDate()).padStart(2,'0')}`;

      const [reqRes, refResult] = await Promise.all([
        fetch('/api/class-requests?status=pending'),
        supabase.from('referrals').select('id, teacher_name, class_display, student_name, reason, created_at').gte('created_at', weekAgoStr).order('created_at', { ascending: false }).limit(10)
      ]);
      const reqData = reqRes.ok ? await reqRes.json() : { requests: [] };
      setNotifications({
        pendingRequests: reqData.requests || [],
        recentReferrals: refResult.data || []
      });
    } catch { /* ignore */ }
    finally { setNotifLoading(false); }
  };

  // --- Data Fetching ---
  useEffect(() => {
    loadData();
  }, [currentDate]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

      const startDate = new Date(startOfMonth);
      startDate.setDate(startDate.getDate() - 7);
      const endDate = new Date(endOfMonth);
      endDate.setDate(endDate.getDate() + 7);

      const startStr = getLocalDateString(startDate);
      const endStr = getLocalDateString(endDate);

      const [appResult, planResult, taskResult, followResult, topicResult, classReqResponse] = await Promise.all([
        supabase.from('appointments').select('*').gte('appointment_date', startStr).lte('appointment_date', endStr),
        supabase.from('guidance_plans').select('*').gte('plan_date', startStr).lte('plan_date', endStr),
        supabase.from('tasks').select('*').gte('due_date', startStr).lte('due_date', endStr),
        supabase.from('follow_ups').select('*').gte('follow_up_date', startStr).lte('follow_up_date', endStr),
        supabase.from('guidance_topics').select('id, title'),
        fetch(`/api/class-requests?status=all&scheduledFrom=${encodeURIComponent(startStr)}&scheduledTo=${encodeURIComponent(endStr)}`, {
          headers: { Accept: "application/json" }
        })
      ]);

      const classReqPayload = classReqResponse.ok ? await classReqResponse.json() : { requests: [] };
      const filteredClassRequests = (classReqPayload.requests || []).filter((request: any) =>
        request.status === 'scheduled' || request.status === 'completed'
      );

      setAppointments(appResult.data || []);
      setGuidancePlans(planResult.data || []);
      setTasks(taskResult.data || []);
      setFollowUps(followResult.data || []);
      setClassRequests(filteredClassRequests);
      setGuidanceTopicMap(
        Object.fromEntries(
          (topicResult.data || []).map((topic: { id: string; title: string }) => [topic.id, topic.title])
        )
      );
    } catch (error) {
      console.error('Veri yükleme hatası:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Randevu Modal İşlemleri (Sınıf, Öğrenci ve Dolu Saat Çekimi) ---
  useEffect(() => {
    const fetchClassesAndTeachers = async () => {
      try {
        const classRes = await fetch("/api/data", { headers: { Accept: "application/json" } });
        if (classRes.ok) {
          const classData = await classRes.json();
          if (Array.isArray(classData.sinifSubeList)) setClasses(classData.sinifSubeList);
        }
        const teacherRes = await fetch("/api/teachers", { headers: { Accept: "application/json" } });
        if (teacherRes.ok) {
          const teacherData = await teacherRes.json();
          if (Array.isArray(teacherData.teachers)) setTeachers(teacherData.teachers);
        }
      } catch (error) {
        console.error("Veri yükleme hatası:", error);
      }
    };
    fetchClassesAndTeachers();
  }, []);

  useEffect(() => {
    const fetchStudentsByClass = async (classKey: string) => {
      if (!classKey) { setStudents([]); return; }
      try {
        setLoadingStudents(true);
        const res = await fetch(`/api/students?sinifSube=${encodeURIComponent(classKey)}`);
        if (res.ok) {
          const data = await res.json();
          setStudents(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoadingStudents(false);
      }
    };

    if (selectedClass && (formData.participant_type === "student" || formData.participant_type === "parent")) {
      fetchStudentsByClass(selectedClass);
    }
  }, [selectedClass, formData.participant_type]);

  useEffect(() => {
    const fetchBusySlots = async (date: string) => {
      try {
        const allBusySlots = new Set<string>();
        
        // Tüm randevuları al (status veya participant'ıne bakılmaksızın)
        const appointmentRes = await fetch(`/api/appointments?date=${date}`);
        if (appointmentRes.ok) {
          const data = await appointmentRes.json();
          // Tüm non-cancelled randevuları dolu say
          data.appointments?.forEach((apt: any) => {
            if (apt.status !== 'cancelled' && apt.status !== 'pending') {
              allBusySlots.add(normalizeLessonSlot(apt.start_time));
            }
          });
        }
        
        const { data: plans } = await supabase.from('guidance_plans').select('lesson_period').eq('plan_date', date).in('status', ['planned', 'completed']);
        plans?.forEach(p => allBusySlots.add(normalizeLessonSlot(p.lesson_period)));

        const { data: activities } = await supabase.from('class_activities').select('activity_time').eq('activity_date', date);
        activities?.forEach(a => allBusySlots.add(normalizeLessonSlot(a.activity_time)));

        setBusySlots(allBusySlots);
      } catch (e) {
        console.error(e);
      }
    };

    if (formData.appointment_date) {
      fetchBusySlots(formData.appointment_date);
    }
  }, [formData.appointment_date]);

  const resetAppointmentForm = (baseDate = getLocalDateString(currentDate)) => {
    setFormData({
      appointment_date: baseDate,
      start_time: "1",
      participant_type: "student",
      participant_name: "",
      participant_class: "",
      location: "guidance_office",
      purpose: "",
      preparation_note: "",
      source_application_id: "",
      source_application_type: "",
      source_individual_request_id: ""
    });
    setSelectedClass("");
    setParentName("");
    setSelectedStudentName("");
  };

  const openAppointmentModal = () => {
    setEditingAppointment(null);
    resetAppointmentForm(getLocalDateString(currentDate));
    setShowAppointmentModal(true);
  };

  const openAppointmentEditModal = (appointment: Appointment) => {
    const normalizedClass = normalizeClassValue(appointment.participant_class);
    const matchedClass = classes.find((item) => normalizeClassValue(item.text) === normalizedClass);

    setEditingAppointment(appointment);
    setFormData({
      appointment_date: appointment.appointment_date || getLocalDateString(currentDate),
      start_time: normalizeLessonSlot(appointment.start_time) || "1",
      participant_type: appointment.participant_type,
      participant_name: appointment.participant_name || "",
      participant_class: appointment.participant_class || "",
      location: appointment.location || "guidance_office",
      purpose: appointment.purpose || appointment.topic_tags?.[0] || "",
      preparation_note: appointment.preparation_note || "",
      source_application_id: appointment.source_application_id || "",
      source_application_type: appointment.source_application_type || "",
      source_individual_request_id: appointment.source_individual_request_id || ""
    });
    setSelectedClass(matchedClass?.value || "");
    setSelectedStudentName(appointment.participant_type === "parent" ? "" : appointment.participant_name || "");
    setParentName("");
    setShowAppointmentModal(true);
  };

  const closeAppointmentModal = () => {
    setEditingAppointment(null);
    setShowAppointmentModal(false);
  };

  const getApplicationSourceMeta = (record: PendingApplicationRecord) => {
    if (record.source === "Bireysel Başvuru") {
      return {
        source_application_id: "",
        source_application_type: "",
        source_individual_request_id: record.id.replace("individual-", "")
      };
    }

    const sourceId = record.id.includes("-") ? record.id.split("-").slice(1).join("-") : record.id;

    if (record.source === "Öğretmen Yönlendirmeleri") {
      return {
        source_application_id: sourceId,
        source_application_type: "teacher_referral",
        source_individual_request_id: ""
      };
    }
    if (record.source === "Öğrenci Bildirimleri") {
      return {
        source_application_id: sourceId,
        source_application_type: "student_incident",
        source_individual_request_id: ""
      };
    }
    if (record.source === "Veli Talepleri") {
      return {
        source_application_id: sourceId,
        source_application_type: "parent_meeting",
        source_individual_request_id: ""
      };
    }

    return {
      source_application_id: sourceId,
      source_application_type: "observation",
      source_individual_request_id: ""
    };
  };

  const openAppointmentModalForApplication = (
    record: PendingApplicationRecord,
    overrides?: { date?: string; start_time?: string }
  ) => {
    const parsedNote = parseApplicationNote(record.note);
    const matchedClass = classes.find((item) =>
      item.value === record.class_key ||
      item.text === record.class_display ||
      normalizeClassValue(item.text) === normalizeClassValue(record.class_display || record.class_key)
    );
    const sourceMeta = getApplicationSourceMeta(record);

    setEditingAppointment(null);
    setFormData({
      appointment_date: overrides?.date || getLocalDateString(currentDate),
      start_time: overrides?.start_time || "1",
      participant_type: "student",
      participant_name: record.student_name,
      participant_class: record.class_display || "",
      location: "guidance_office",
      purpose: parsedNote.purpose,
      preparation_note: parsedNote.preparationNote,
      source_application_id: sourceMeta.source_application_id,
      source_application_type: sourceMeta.source_application_type,
      source_individual_request_id: sourceMeta.source_individual_request_id
    });
    setSelectedClass(matchedClass?.value || record.class_key || "");
    setSelectedStudentName(record.student_name);
    setParentName("");
    setShowAppointmentModal(true);
  };

  const openPendingApplicationsModal = async (date: string, start_time: string) => {
    setPendingSelectionSlot({ date, start_time });
    setPendingApplicationsLoading(true);
    setShowPendingApplicationsModal(true);

    try {
      const [
        referralResult,
        observationResult,
        incidentResult,
        requestResult,
        individualRequestResult,
        appointmentResult
      ] = await Promise.all([
        supabase.from("referrals").select("*").order("created_at", { ascending: false }),
        supabase.from("observation_pool").select("*").order("created_at", { ascending: false }),
        supabase.from("student_incidents").select("*").in("status", ["new", "reviewing"]).order("incident_date", { ascending: false }).order("created_at", { ascending: false }),
        supabase.from("parent_meeting_requests").select("*").order("created_at", { ascending: false }),
        supabase.from("individual_requests").select("*").order("created_at", { ascending: false }),
        supabase.from("appointments").select("*").eq("participant_type", "student").neq("status", "cancelled").order("updated_at", { ascending: false })
      ]);

      const activeAppointments = appointmentResult.data || [];
      const records: PendingApplicationRecord[] = [];

      const pushIfPending = (record: PendingApplicationRecord) => {
        const hasAppointment = activeAppointments.some((appointment) =>
          matchesApplicationToAppointment(
            appointment,
            record.student_name,
            record.class_display,
            record.class_key
          )
        );

        if (!hasAppointment) {
          records.push(record);
        }
      };

      (incidentResult.data || []).forEach((item: any) => {
        if (!isPendingApplicationStatus(item.status)) return;
        pushIfPending({
          id: `incident-${item.id}`,
          student_name: item.target_student_name,
          class_display: item.target_class_display,
          class_key: item.target_class_key,
          source: "Öğrenci Bildirimleri",
          referrer: item.record_role === "linked_reporter" ? item.reporter_student_name || undefined : undefined,
          date: item.created_at || item.incident_date || new Date().toISOString(),
          note: item.description
        });
      });

      (observationResult.data || []).forEach((item: any) => {
        if (!isPendingApplicationStatus(item.status)) return;
        pushIfPending({
          id: `observation-${item.id}`,
          student_name: item.student_name,
          class_display: item.class_display,
          class_key: item.class_key,
          source: "Gözlem Havuzu",
          date: item.created_at || item.observed_at || new Date().toISOString(),
          note: item.note
        });
      });

      (referralResult.data || []).forEach((item: any) => {
        if (!isPendingApplicationStatus(item.status)) return;
        pushIfPending({
          id: `referral-${item.id}`,
          student_name: item.student_name,
          class_display: item.class_display,
          class_key: item.class_key,
          source: "Öğretmen Yönlendirmeleri",
          referrer: item.teacher_name,
          date: item.created_at || new Date().toISOString(),
          note: item.note || item.reason
        });
      });

      (requestResult.data || []).forEach((item: any) => {
        if (!isPendingApplicationStatus(item.status)) return;
        pushIfPending({
          id: `request-${item.id}`,
          student_name: item.student_name,
          class_display: item.class_display,
          class_key: item.class_key,
          source: "Veli Talepleri",
          referrer: item.parent_name || undefined,
          date: item.created_at || new Date().toISOString(),
          note: item.detail || item.subject
        });
      });

      (individualRequestResult.data || []).forEach((item: any) => {
        if (!isPendingApplicationStatus(item.status)) return;
        pushIfPending({
          id: `individual-${item.id}`,
          student_name: item.student_name,
          class_display: item.class_display,
          class_key: item.class_key,
          source: "Bireysel Başvuru",
          date: item.created_at || new Date().toISOString(),
          note: item.note
        });
      });

      records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setPendingApplications(records);
    } catch (error) {
      console.error("Pending applications load error:", error);
      toast.error("Bekleyen başvurular yüklenemedi");
      setPendingApplications([]);
    } finally {
      setPendingApplicationsLoading(false);
    }
  };

  const closePendingApplicationsModal = () => {
    setShowPendingApplicationsModal(false);
    setPendingApplications([]);
    setPendingSelectionSlot(null);
  };

  const handleSaveAppointment = async () => {
    let finalName = formData.participant_name;
    if (formData.participant_type === "parent") {
      if (parentName.trim() && selectedStudentName) {
        finalName = `${parentName.trim()} (${selectedStudentName}'ın velisi)`;
      } else if (parentName.trim()) {
        finalName = parentName.trim();
      }
    }

    if (!finalName) { toast.error('Katılımcı adı gerekli'); return; }
    if (!formData.start_time) { toast.error('Saat seçimi gerekli'); return; }
    if (!formData.appointment_date) { toast.error('Tarih seçimi gerekli'); return; }
    if (!formData.purpose) { toast.error('Konu seçimi gerekli'); return; }
    if (!formData.participant_class) { toast.error('Sınıf seçimi gerekli'); return; }
    
    setAppointmentSaving(true);
    try {
      const appointmentData = {
        id: editingAppointment?.id,
        appointment_date: formData.appointment_date,
        start_time: formData.start_time,
        participant_type: formData.participant_type,
        participant_name: finalName,
        participant_class: formData.participant_class,
        location: formData.location,
        purpose: formData.purpose,
        preparation_note: formData.preparation_note || null,
        topic_tags: formData.purpose ? [formData.purpose] : [],
        priority: 'normal',
        source_application_id: formData.source_application_id || null,
        source_application_type: formData.source_application_type || null,
        source_individual_request_id: formData.source_individual_request_id || null
      };
      
      console.log(editingAppointment ? 'Updating appointment:' : 'Inserting appointment:', appointmentData);
      
      const response = await fetch('/api/appointments', {
        method: editingAppointment ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(appointmentData)
      });
      
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        console.error('Appointment API error:', result);
        throw new Error(result.error || result.details || 'Bilinmeyen veritabanı hatası');
      }

      const savedAppointment = result?.appointment;
      if (!savedAppointment?.id) {
        throw new Error('Randevu veritabanına yazıldı ancak veri döndü');
      }
      
      toast.success(editingAppointment ? 'Randevu güncellendi' : 'Randevu başarıyla eklendi');
      closeAppointmentModal();
      await loadData();
    } catch (error: any) {
      console.error('Appointment save error:', error);
      const errorMsg = error?.message || error?.error_description || JSON.stringify(error) || 'Bilinmeyen hata';
      toast.error(`Randevu kaydedilirken hata oluştu: ${errorMsg}`);
    } finally {
      setAppointmentSaving(false);
    }
  };

  // --- Görev Modalı İşlemleri ---
  const openTaskModal = () => {
    setNewTask({
      title: '',
      description: '',
      category: 'genel',
      priority: 'normal',
      due_date: getLocalDateString(currentDate),
      due_time: '',
      related_student_name: ''
    });
    setShowTaskModal(true);
  };

  const closeTaskModal = () => {
    setShowTaskModal(false);
    setNewTask({ title: '', description: '', category: 'genel', priority: 'normal', due_date: '', due_time: '', related_student_name: '' });
  };

  const handleAddTask = async () => {
    if (!newTask.title.trim()) { toast.error('Görev başlığı gerekli'); return; }
    setTaskSaving(true);
    try {
      const { error } = await supabase.from('tasks').insert({
        ...newTask,
        status: 'pending',
        due_date: newTask.due_date || getLocalDateString(currentDate),
        due_time: newTask.due_time || null
      });
      if (error) throw error;
      toast.success('Görev eklendi');
      closeTaskModal();
      loadData();
    } catch (error: any) {
      toast.error('Görev eklenirken hata oluştu');
    } finally {
      setTaskSaving(false);
    }
  };

  // --- Randevu Outcome Modalı İşlemleri ---
  const openAttendanceChoiceModal = (appointment: Appointment) => {
    setAttendanceChoiceAppointment(appointment);
    setShowAttendanceChoiceModal(true);
  };

  const closeAttendanceChoiceModal = () => {
    if (attendanceSaving) return;
    setShowAttendanceChoiceModal(false);
    setAttendanceChoiceAppointment(null);
  };

  const handleAttendanceChoice = async (choice: Exclude<AppointmentOutcomeChoice, "cancel">) => {
    if (!attendanceChoiceAppointment) return;

    const choiceMap: Record<Exclude<AppointmentOutcomeChoice, "cancel">, Partial<Appointment> & { source_application_status?: string }> = {
      completed: { status: "attended", outcome_decision: ["Tamamlandı"], source_application_status: "completed" },
      active_follow: { status: "attended", outcome_decision: ["Aktif Takip"], source_application_status: "active_follow" }
    };

    const messages: Record<Exclude<AppointmentOutcomeChoice, "cancel">, string> = {
      completed: "Tamamlandı olarak işaretlendi",
      active_follow: "Aktif Takip olarak işaretlendi"
    };

    try {
      setAttendanceSaving(true);
      const res = await fetch("/api/appointments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: attendanceChoiceAppointment.id,
          ...choiceMap[choice],
          source_individual_request_id: attendanceChoiceAppointment.source_individual_request_id,
          source_application_id: attendanceChoiceAppointment.source_application_id,
          source_application_type: attendanceChoiceAppointment.source_application_type
        })
      });
      if (!res.ok) throw new Error("Randevu güncellenemedi");
      toast.success(messages[choice]);
      await loadData();
      closeAttendanceChoiceModal();
    } catch (error) {
      toast.error('Randevu durumu değiştirilirken hata oluştu');
    } finally {
      setAttendanceSaving(false);
    }
  };

  const toggleClassRequestStatus = async (id: string, currentStatus?: string) => {
    if (currentStatus === 'completed') return;
    try {
      const res = await fetch('/api/class-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'completed' })
      });
      if (!res.ok) throw new Error();
      toast.success('Sınıf talebi tamamlandı');
      await loadData();
    } catch {
      toast.error('Hata oluştu');
    }
  };

  const handleResetClassRequest = async (id: string) => {
    if (!confirm('Bu talep tekrar "Bekliyor" durumuna alınsın mı? Planlama bilgileri silinecek.')) return;
    try {
      const res = await fetch('/api/class-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'pending', scheduledDate: null, lessonSlot: null, lessonTeacher: null })
      });
      if (!res.ok) throw new Error();
      toast.success('Talep tekrar bekliyor durumuna alındı');
      await loadData();
    } catch {
      toast.error('Hata oluştu');
    }
  };

  const fetchCrBusySlots = async (date: string, excludeId?: string) => {
    const allBusy = new Set<string>();
    try {
      const aptRes = await fetch(`/api/appointments?date=${date}`);
      if (aptRes.ok) {
        const d = await aptRes.json();
        d.appointments?.forEach((a: any) => {
          if (a.status !== 'cancelled' && a.status !== 'pending') allBusy.add(normalizeLessonSlot(a.start_time));
        });
      }
      const { data: plans } = await supabase.from('guidance_plans').select('lesson_period').eq('plan_date', date).eq('status', 'planned');
      plans?.forEach((p: any) => allBusy.add(normalizeLessonSlot(p.lesson_period)));
      const { data: activities } = await supabase.from('class_activities').select('activity_time').eq('activity_date', date);
      activities?.forEach((a: any) => allBusy.add(normalizeLessonSlot(a.activity_time)));
      const query = new URLSearchParams({
        status: 'scheduled',
        scheduledDate: date
      });
      if (excludeId) query.set('excludeId', excludeId);

      const crResponse = await fetch(`/api/class-requests?${query.toString()}`, {
        headers: { Accept: "application/json" }
      });
      if (crResponse.ok) {
        const payload = await crResponse.json();
        payload.requests?.forEach((r: any) => { if (r.lesson_slot) allBusy.add(String(r.lesson_slot)); });
      }
    } catch { /* ignore */ }
    setCrEditBusySlots(allBusy);
    return allBusy;
  };

  const openCrEditModal = (req: any) => {
    setEditingCr(req);
    const date = req.scheduled_date || getLocalDateString(currentDate);
    setCrEditDate(date);
    setCrEditPeriod(req.lesson_slot ? Number(req.lesson_slot) : null);
    setCrEditTeacher(req.lesson_teacher || '');
    setCrEditCategory(getClassRequestCategoryLabel(req));
    setCrEditConflict(null);
    setShowCrEditModal(true);
    fetchCrBusySlots(date, req.id);
  };

  const handleSaveCrEdit = async () => {
    if (!editingCr || !crEditDate || !crEditPeriod) return;
    if (!crEditCategory.trim()) {
      toast.error('Teknik kategori olmadan planlama güncellenemez');
      return;
    }
    if (crEditBusySlots.has(String(crEditPeriod))) {
      setCrEditConflict('Bu saat başka bir etkinlik tarafından kullanılıyor!');
      return;
    }
    setCrEditSaving(true);
    try {
      const res = await fetch('/api/class-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingCr.id,
          status: 'scheduled',
          scheduledDate: crEditDate,
          lessonSlot: crEditPeriod,
          lessonTeacher: crEditTeacher.trim() || null,
          adminCategory: crEditCategory,
        })
      });
      if (!res.ok) throw new Error();
      toast.success('Talep güncellendi');
      setShowCrEditModal(false);
      setEditingCr(null);
      loadClassRequestCategorySuggestions();
      await loadData();
    } catch {
      toast.error('Kaydedilemedi');
    } finally {
      setCrEditSaving(false);
    }
  };

  const toggleGuidancePlanStatus = async (id: string, currentStatus?: string) => {
    const newStatus = currentStatus === 'completed' ? 'planned' : 'completed';
    try {
      const { error } = await supabase.from('guidance_plans').update({ status: newStatus }).eq('id', id);
      if (error) throw error;
      // Bu plana bağlı bir sınıf çalışma talebi varsa onu da güncelle
      await supabase
        .from('work_requests')
        .update({ status: newStatus === 'completed' ? 'tamamlandi' : 'planlandı' })
        .eq('guidance_plan_id', id);
      toast.success(newStatus === 'completed' ? 'Tamamlandı' : 'Durum geri alındı');
      await loadData();
    } catch { toast.error('Güncellenemedi'); }
  };

  const toggleTaskStatus = async (id: string, type: string, currentStatus?: string) => {
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    const table = type === 'task' ? 'tasks' : 'follow_ups';
    try {
      const { error } = await supabase.from(table).update({ status: newStatus }).eq('id', id);
      if (error) throw error;
      toast.success(newStatus === 'completed' ? 'Tamamlandı' : 'Geri alındı');
      await loadData();
    } catch { toast.error('Güncellenemedi'); }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Silmek istediğinize emin misiniz?')) return;
    try { await supabase.from('tasks').delete().eq('id', taskId); toast.success('Silindi'); await loadData(); }
    catch { toast.error('Hata oluştu'); }
  };

  const handleDeleteAppointment = async (appointmentId: string) => {
    if (!confirm('Silmek istediğinize emin misiniz?')) return;
    try { await supabase.from('appointments').delete().eq('id', appointmentId); toast.success('Silindi'); await loadData(); }
    catch { toast.error('Hata oluştu'); }
  };

  const handleDeleteGuidancePlan = async (planId: string) => {
    if (!confirm('Sınıf rehberliği planını silmek istediğinize emin misiniz?')) return;
    try { await supabase.from('guidance_plans').delete().eq('id', planId); toast.success('Silindi'); await loadData(); }
    catch { toast.error('Hata oluştu'); }
  };

  const events = useMemo<CalendarEvent[]>(() => {
    const allEvents: CalendarEvent[] = [];
    if (showAppointments) {
      appointments.forEach(app => {
        const colors: any = { planned: 'blue', attended: 'green', not_attended: 'red', postponed: 'amber', cancelled: 'slate' };
        const pType = app.participant_type === 'student' ? 'Öğrenci' : app.participant_type === 'parent' ? 'Veli' : 'Öğretmen';
        allEvents.push({ id: app.id, date: app.appointment_date, time: app.start_time, title: `${app.participant_name} (${pType})`, type: 'appointment', status: app.status, color: colors[app.status] || 'blue', data: app });
      });
    }
    if (showActivities) {
      guidancePlans.forEach(plan => {
        allEvents.push({
          id: plan.id,
          date: plan.plan_date,
          time: String(plan.lesson_period),
          title: `${plan.class_display}` + (plan.teacher_name ? ` (${plan.teacher_name})` : ''),
          type: 'guidance_plan',
          color: 'emerald',
          status: plan.status,
          data: {
            ...plan,
            topic_title: guidanceTopicMap[plan.topic_id] || ''
          }
        });
      });
      classRequests.forEach(req => {
        allEvents.push({
          id: req.id,
          date: req.scheduled_date,
          time: String(req.lesson_slot),
          title: `${req.class_display} — ${getClassRequestCategoryLabel(req)}` + (req.lesson_teacher ? ` (${req.lesson_teacher})` : ''),
          type: 'class_request',
          color: 'violet',
          status: req.status,
          data: req
        });
      });
    }
    if (showTasks) {
      tasks.forEach(task => {
        allEvents.push({ id: task.id, date: task.due_date, time: task.due_time, title: task.title, type: 'task', status: task.status, color: 'orange', data: task });
      });
      followUps.forEach(fu => {
        allEvents.push({ id: fu.id, date: fu.follow_up_date, title: `Takip: ${fu.student_name}`, type: 'follow_up', status: fu.status, color: 'teal', data: fu });
      });
    }
    return allEvents;
  }, [appointments, guidancePlans, classRequests, tasks, followUps, showAppointments, showActivities, showTasks, guidanceTopicMap]);

  const getEventsForDate = (date: Date) => {
    const dateStr = getLocalDateString(date);
    return events.filter(e => e.date === dateStr);
  };

  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    let startDay = firstDay.getDay() - 1;
    if (startDay < 0) startDay = 6;
    const days: { date: Date; isCurrentMonth: boolean }[] = [];
    for (let i = startDay - 1; i >= 0; i--) days.push({ date: new Date(year, month, -i), isCurrentMonth: false });
    for (let i = 1; i <= new Date(year, month + 1, 0).getDate(); i++) days.push({ date: new Date(year, month, i), isCurrentMonth: true });
    while (days.length < 42) days.push({ date: new Date(year, month + 1, days.length - (new Date(year, month + 1, 0).getDate() + startDay) + 1), isCurrentMonth: false });
    return days;
  }, [currentDate]);

  const weekDays = useMemo(() => {
    const start = new Date(currentDate);
    const diff = start.getDay() === 0 ? -6 : 1 - start.getDay();
    start.setDate(start.getDate() + diff);
    return Array.from({ length: 5 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  }, [currentDate]);

  const navigatePrev = () => {
    const d = new Date(currentDate);
    if (viewType === 'month') d.setMonth(d.getMonth() - 1);
    else if (viewType === 'week') d.setDate(d.getDate() - 7);
    else d.setDate(d.getDate() - 1);
    setCurrentDate(d);
  };

  const navigateNext = () => {
    const d = new Date(currentDate);
    if (viewType === 'month') d.setMonth(d.getMonth() + 1);
    else if (viewType === 'week') d.setDate(d.getDate() + 7);
    else d.setDate(d.getDate() + 1);
    setCurrentDate(d);
  };

  const isToday = (date: Date) => new Date().toDateString() === date.toDateString();

  const colorMap: any = {
    blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', dot: 'bg-blue-500' },
    green: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    red: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', dot: 'bg-red-500' },
    amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', dot: 'bg-amber-500' },
    purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', dot: 'bg-purple-500' },
    orange: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', dot: 'bg-orange-500' },
    teal: { bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-700', dot: 'bg-teal-500' },
    emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    slate: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-700', dot: 'bg-slate-500' }
  };

  const getHeaderText = () => {
    if (viewType === 'month') return `${MONTHS_TR[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    if (viewType === 'week') return `${weekDays[0].getDate()} - ${weekDays[4].getDate()} ${MONTHS_TR[weekDays[0].getMonth()]} ${weekDays[0].getFullYear()}`;
    return `${currentDate.getDate()} ${MONTHS_TR[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
  };

  return (
    <div className="space-y-6">

      {/* Admin Bildirim Paneli */}
      {userRole === 'admin' && (notifications.pendingRequests.length > 0 || notifications.recentReferrals.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Bekleyen Sınıf Talepleri */}
          {notifications.pendingRequests.length > 0 && (
            <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-purple-50 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500 shadow-sm">
                    <Bell className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-violet-800">Sınıf Rehberliği Talepleri</p>
                    <p className="text-xs text-violet-600">{notifications.pendingRequests.length} bekleyen talep</p>
                  </div>
                </div>
                <a href="/panel/sinif-rehberligi" className="text-xs font-semibold text-violet-600 hover:text-violet-800 transition-colors">Görüntüle →</a>
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {notifications.pendingRequests.slice(0, 5).map((req: any) => (
                  <div key={req.id} className="flex items-center gap-2 rounded-xl bg-white/70 border border-violet-100 px-3 py-2">
                    <div className="h-2 w-2 rounded-full bg-violet-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-800 truncate">{req.class_display} — {getClassRequestCategoryLabel(req)}</p>
                      <p className="text-[11px] text-slate-500">{req.teacher_name}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Son Öğretmen Yönlendirmeleri */}
          {notifications.recentReferrals.length > 0 && (
            <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500 shadow-sm">
                    <Bell className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-blue-800">Yeni Öğrenci Yönlendirmeleri</p>
                    <p className="text-xs text-blue-600">Son 7 günde {notifications.recentReferrals.length} yönlendirme</p>
                  </div>
                </div>
                <a href="/panel/basvurular" className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors">Görüntüle →</a>
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {notifications.recentReferrals.slice(0, 5).map((ref: any) => (
                  <div key={ref.id} className="flex items-center gap-2 rounded-xl bg-white/70 border border-blue-100 px-3 py-2">
                    <div className="h-2 w-2 rounded-full bg-blue-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-800 truncate">{ref.student_name} ({ref.class_display})</p>
                      <p className="text-[11px] text-slate-500">{ref.teacher_name} — {ref.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sınıf Talebi Planlama Güncelle Modalı */}
      {showCrEditModal && editingCr && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/50 px-4 backdrop-blur-sm">
          <div className="absolute inset-0" onClick={() => setShowCrEditModal(false)} />
          <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-violet-50 to-purple-50 px-5 py-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-violet-600">Planlama Güncelle</p>
                <p className="text-sm font-bold text-slate-800 mt-0.5">{editingCr.class_display} — {getClassRequestCategoryLabel(editingCr)}</p>
              </div>
              <button onClick={() => setShowCrEditModal(false)} className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors">
                <X className="h-4 w-4 text-slate-500" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="rounded-xl bg-slate-50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Öğretmen Notu</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-700">
                  {getClassRequestTeacherNote(editingCr) || "Not belirtilmemiş"}
                </p>
              </div>

              <ClassRequestCategoryInput
                value={crEditCategory}
                onChange={setCrEditCategory}
                suggestions={classRequestCategorySuggestions}
                onDeleteSuggestion={handleDeleteClassRequestCategory}
                hint="Yazdığınız ifade daha önce yoksa yeni kategori olarak kaydedilir."
              />

              {/* Tarih */}
              <div>
                <Label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5 block">Tarih</Label>
                <Input
                  type="date"
                  value={crEditDate}
                  onChange={e => {
                    setCrEditDate(e.target.value);
                    setCrEditPeriod(null);
                    setCrEditConflict(null);
                    if (e.target.value) fetchCrBusySlots(e.target.value, editingCr.id);
                  }}
                  className="w-full rounded-xl border-slate-200"
                />
              </div>
              {/* Ders Saati */}
              <div>
                <Label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5 block">Ders Saati</Label>
                <div className="grid grid-cols-7 gap-1.5">
                  {Array.from({ length: 7 }, (_, i) => i + 1).map(slot => {
                    const busy = crEditBusySlots.has(String(slot));
                    const selected = crEditPeriod === slot;
                    return (
                      <button
                        key={slot}
                        disabled={busy}
                        onClick={() => { setCrEditPeriod(slot); setCrEditConflict(null); }}
                        className={`flex flex-col items-center gap-0.5 rounded-xl border py-2 text-xs font-bold transition-all ${
                          selected
                            ? 'border-violet-500 bg-violet-500 text-white shadow-md'
                            : busy
                              ? 'border-red-200 bg-red-50 text-red-300 cursor-not-allowed'
                              : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-violet-300 hover:bg-violet-50'
                        }`}
                      >
                        {slot}
                        <span className={`text-[8px] font-semibold ${selected ? 'text-violet-100' : busy ? 'text-red-300' : 'text-slate-400'}`}>
                          {busy ? 'dolu' : 'boş'}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {crEditConflict && (
                  <p className="mt-2 text-xs font-semibold text-red-600 flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" /> {crEditConflict}
                  </p>
                )}
              </div>
              {/* Öğretmen */}
              <div>
                <Label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5 block">Dersi Alınan Öğretmen</Label>
                <select
                  value={crEditTeacher}
                  onChange={e => setCrEditTeacher(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400"
                >
                  <option value="">Öğretmen seçin (isteğe bağlı)</option>
                  {crEditTeacher && !teachers.some(t => t.value === crEditTeacher) && (
                    <option value={crEditTeacher}>{crEditTeacher}</option>
                  )}
                  {teachers.map((teacher) => (
                    <option key={teacher.value} value={teacher.value}>
                      {teacher.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2 border-t border-slate-100 px-5 py-4 bg-slate-50">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setShowCrEditModal(false)}>
                İptal
              </Button>
              <Button
                disabled={!crEditDate || !crEditPeriod || !crEditCategory.trim() || crEditSaving}
                onClick={handleSaveCrEdit}
                className="flex-1 rounded-xl bg-violet-600 hover:bg-violet-700 text-white"
              >
                {crEditSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Kaydet
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Randevu Outcome Modal */}
      <AppointmentOutcomeModal
        open={showAttendanceChoiceModal}
        appointment={attendanceChoiceAppointment}
        loading={attendanceSaving}
        onClose={closeAttendanceChoiceModal}
        onSelect={handleAttendanceChoice}
      />

      {/* Ay Görünümü Gününe Tıklayınca Açılan Gün Detay Modalı */}
      {dayModalDate && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 px-4 py-6 backdrop-blur-sm">
          <div className="absolute inset-0" onClick={() => setDayModalDate(null)} aria-hidden="true" />
          <div className="relative z-10 w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden rounded-2xl bg-slate-50 border border-slate-200 shadow-2xl">
            
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-teal-50 rounded-lg">
                  <CalendarDays className="h-6 w-6 text-teal-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">
                    {dayModalDate.getDate()} {MONTHS_TR[dayModalDate.getMonth()]} {dayModalDate.getFullYear()}
                  </h2>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-0.5">
                    {DAYS_FULL_TR[dayModalDate.getDay() === 0 ? 6 : dayModalDate.getDay() - 1]}
                  </p>
                </div>
              </div>
              <button onClick={() => setDayModalDate(null)} className="text-slate-400 hover:bg-slate-100 hover:text-slate-700 p-2 rounded-full transition-colors">
                <XCircle className="h-6 w-6" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Sol Kolon: Dersler */}
                <div className="space-y-4">
                  <h3 className="font-bold text-slate-700 flex items-center gap-2 mb-2">
                    <Clock className="h-4 w-4 text-emerald-500"/> Ders Programı
                  </h3>
                  {Array.from({ length: 7 }, (_, i) => i + 1).map(lesson => {
                    const periodStr = String(lesson);
                    const lessonEvents = getEventsForDate(dayModalDate).filter(e => {
                      if (e.type === 'appointment' || e.type === 'guidance_plan' || e.type === 'class_request') {
                        return normalizeLessonSlot(e.time) === periodStr;
                      }
                      return false;
                    });

                    return (
                      <div key={lesson} className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm transition-all hover:shadow-md">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 border border-slate-200 shadow-inner">
                          <span className="text-sm font-black text-slate-600">{lesson}</span>
                        </div>
                        <div className="flex-1 min-w-0 space-y-1.5">
                          {lessonEvents.length === 0 ? (
                            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-2.5 py-1.5">
                              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Boş</p>
                            </div>
                          ) : lessonEvents.map(e => {
                            const isCompleted = e.status === 'attended' || e.status === 'completed';
                            const isApt = e.type === 'appointment';
                            const isClassReq = e.type === 'class_request';

                            let containerClass = isCompleted ? "border-slate-200 bg-slate-50 opacity-75" : isApt ? "border-blue-200 bg-gradient-to-r from-blue-50 to-cyan-50" : isClassReq ? "border-violet-200 bg-gradient-to-r from-violet-50 to-purple-50" : "border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50";
                            let typeText = isCompleted ? "text-slate-500" : isApt ? "text-blue-700" : isClassReq ? "text-violet-700" : "text-emerald-700";
                            let typeLabel = isCompleted ? "Tamamlandı" : isApt ? "Randevu" : isClassReq ? "Sınıf Talebi" : "Etkinlik";

                            return (
                              <div key={e.id} className={`relative rounded-lg border px-2.5 py-2 transition-colors ${containerClass}`}>
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                      <p className={`text-[10px] font-black uppercase tracking-wider ${typeText}`}>
                                        {isApt ? 'Görüşme' : isClassReq ? 'Sınıf Talebi' : 'Rehberlik'}
                                      </p>
                                      <span className={`rounded-full px-1.5 py-0 text-[9px] font-bold border ${isCompleted ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-white/80 border-white/50 ' + typeText}`}>
                                        {typeLabel}
                                      </span>
                                    </div>
                                    <p className={`text-xs font-semibold truncate ${isCompleted ? 'text-slate-600 line-through' : 'text-slate-800'}`}>
                                      {e.title}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0 mt-0.5">
                                    <button
                                      onClick={() => {
                                        if (e.type === 'appointment') openAttendanceChoiceModal(e.data);
                                        else if (e.type === 'guidance_plan') toggleGuidancePlanStatus(e.id, e.status);
                                        else if (e.type === 'class_request') toggleClassRequestStatus(e.id, e.status);
                                      }}
                                      className={`flex h-7 w-7 items-center justify-center rounded-full border-2 transition-all ${isCompleted ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 bg-white text-slate-400 hover:border-emerald-400 hover:text-emerald-500'}`}
                                      title={isCompleted ? 'Tamamlandı' : 'Tamamla'}
                                    >
                                      {isCompleted && <CheckCircle2 className="h-4 w-4" />}
                                    </button>
                                    {isClassReq ? (
                                    <button
                                      onClick={() => handleResetClassRequest(e.id)}
                                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-transparent text-slate-300 hover:border-red-200 hover:bg-red-50 hover:text-red-500 transition-colors"
                                      title="Planlamayı İptal Et (Bekliyor'a Al)"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                    ) : (
                                    <button
                                      onClick={() => e.type === 'appointment' ? handleDeleteAppointment(e.id) : handleDeleteGuidancePlan(e.id)}
                                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-transparent text-slate-300 hover:border-red-200 hover:bg-red-50 hover:text-red-500 transition-colors"
                                      title="Sil"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Sağ Kolon: Görevler */}
                <div className="space-y-4">
                  <h3 className="font-bold text-slate-700 flex items-center gap-2 mb-2">
                    <ListTodo className="h-4 w-4 text-orange-500"/> Diğer Görevler
                  </h3>
                  <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm h-full min-h-[300px]">
                    {getEventsForDate(dayModalDate).filter(e => e.type === 'follow_up' || (e.type === 'task' && !e.data.related_guidance_plan_id)).length === 0 ? (
                      <div className="text-center py-12 text-slate-400">
                        <CheckCircle2 className="h-10 w-10 mx-auto mb-2 opacity-20" />
                        <p className="text-sm font-medium">Bu gün için görev yok</p>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {getEventsForDate(dayModalDate).filter(e => e.type === 'follow_up' || (e.type === 'task' && !e.data.related_guidance_plan_id)).map(t => (
                          <div key={t.id} className={`p-2.5 rounded-xl border transition-all ${t.status === 'completed' ? 'bg-slate-50 opacity-60 border-slate-200' : 'bg-slate-50/50 border-slate-200 hover:border-orange-200'}`}>
                            <div className="flex items-start gap-2.5">
                              <button onClick={() => toggleTaskStatus(t.id, t.type, t.status)} className={`mt-0.5 h-6 w-6 shrink-0 rounded-md border-2 flex items-center justify-center transition-colors ${t.status === 'completed' ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 hover:border-orange-500'}`}>
                                {t.status === 'completed' && <CheckCircle2 className="h-4 w-4" />}
                              </button>
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-semibold ${t.status === 'completed' ? 'line-through text-slate-500' : 'text-slate-800'}`}>{t.title}</p>
                                <div className="flex items-center justify-between mt-1">
                                  <span className={`text-[9px] font-bold tracking-wider uppercase ${t.type === 'task' ? 'text-orange-500' : 'text-teal-500'}`}>
                                    {t.type === 'task' ? 'GÖREV' : 'TAKİP'}
                                  </span>
                                  <button onClick={() => handleDeleteTask(t.id)} className="text-slate-300 hover:text-red-500 transition-all p-1">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}

      {/* Görev Ekleme Modalı */}
      {showTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm">
          <div className="absolute inset-0" onClick={closeTaskModal} aria-hidden="true" />
          <div className="relative z-10 w-full max-w-2xl overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between gap-4 border-b border-slate-100 bg-gradient-to-r from-green-50 via-white to-emerald-50 px-6 py-4">
              <div className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-green-600" />
                <h2 className="text-lg font-bold text-slate-800">Yeni Görev Ekle</h2>
              </div>
              <button onClick={closeTaskModal} className="text-slate-400 hover:text-slate-700 transition-colors">
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <Input
                    placeholder="Görev başlığı..."
                    value={newTask.title}
                    onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                    className="h-12 text-base"
                    autoFocus
                  />
                </div>
                <div className="md:col-span-2">
                  <textarea
                    placeholder="Açıklama (opsiyonel)..."
                    value={newTask.description}
                    onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                    rows={2}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-green-500 focus:ring-4 focus:ring-green-100"
                  />
                </div>
                <div>
                  <Label className="mb-1.5 block text-sm font-medium text-slate-600">Kategori</Label>
                  <select
                    value={newTask.category}
                    onChange={(e) => setNewTask({ ...newTask, category: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-green-500 focus:ring-4 focus:ring-green-100"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.icon} {cat.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="mb-1.5 block text-sm font-medium text-slate-600">Öncelik</Label>
                  <select
                    value={newTask.priority}
                    onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none transition focus:border-green-500 focus:ring-4 focus:ring-green-100"
                  >
                    {PRIORITIES.map(pri => (
                      <option key={pri.value} value={pri.value}>{pri.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="mb-1.5 block text-sm font-medium text-slate-600">Tarih</Label>
                  <Input
                    type="date"
                    value={newTask.due_date}
                    onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                    className="h-11"
                  />
                </div>
                <div>
                  <Label className="mb-1.5 block text-sm font-medium text-slate-600">Saat</Label>
                  <Input
                    type="time"
                    value={newTask.due_time}
                    onChange={(e) => setNewTask({ ...newTask, due_time: e.target.value })}
                    className="h-11"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label className="mb-1.5 block text-sm font-medium text-slate-600">İlgili Öğrenci (opsiyonel)</Label>
                  <Input
                    placeholder="Öğrenci adı..."
                    value={newTask.related_student_name}
                    onChange={(e) => setNewTask({ ...newTask, related_student_name: e.target.value })}
                    className="h-11"
                  />
                </div>
              </div>
              <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
                <Button variant="outline" onClick={closeTaskModal} className="h-10 rounded-xl px-5">İptal</Button>
                <Button onClick={handleAddTask} disabled={taskSaving} className="h-10 rounded-xl bg-green-600 px-5 text-white hover:bg-green-700">
                  {taskSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="mr-2 h-4 w-4" />}
                  Ekle
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Randevu Ekleme Modalı */}
      {showAppointmentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Plus className="h-5 w-5 text-teal-600" />
                {editingAppointment ? "Randevuyu Düzenle" : "Yeni Randevu"}
              </h2>
              <button
                onClick={closeAppointmentModal}
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
                          participant_name: formData.participant_name || ""
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
                    {loadingStudents ? (
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
                        {formData.participant_name && !students.find(s => s.text === formData.participant_name) && (
                          <option value={formData.participant_name}>{formData.participant_name}</option>
                        )}
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
              <Button variant="outline" onClick={closeAppointmentModal}>
                İptal
              </Button>
              <Button
                onClick={handleSaveAppointment}
                disabled={appointmentSaving}
                className="bg-teal-600 hover:bg-teal-700 text-white"
              >
                {appointmentSaving ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                {editingAppointment ? "Randevuyu Güncelle" : "Randevu Oluştur"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {showPendingApplicationsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b bg-slate-50 px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Bekleyen Başvurular</h2>
                <p className="mt-0.5 text-sm text-slate-500">
                  {pendingSelectionSlot ? `${pendingSelectionSlot.date} · ${formatLessonSlotLabel(pendingSelectionSlot.start_time)}` : "Uygun saat seçimi"}
                </p>
              </div>
              <button
                type="button"
                onClick={closePendingApplicationsModal}
                className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto p-6">
              {pendingApplicationsLoading ? (
                <div className="flex items-center justify-center py-12 text-slate-500">
                  <RefreshCw className="mr-3 h-5 w-5 animate-spin text-teal-500" />
                  Bekleyen başvurular yükleniyor...
                </div>
              ) : pendingApplications.length === 0 ? (
                <div className="py-12 text-center text-slate-500">
                  <Users className="mx-auto mb-3 h-10 w-10 opacity-20" />
                  <p className="text-sm font-medium">Randevu bekleyen öğrenci bulunamadı</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingApplications.map((record) => (
                    <button
                      key={record.id}
                      type="button"
                      onClick={() => {
                        if (!pendingSelectionSlot) return;
                        closePendingApplicationsModal();
                        openAppointmentModalForApplication(record, pendingSelectionSlot);
                      }}
                      className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-teal-300 hover:bg-teal-50/40 hover:shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800">{record.student_name}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {record.class_display || "-"} · {record.source}
                          </p>
                          {record.referrer && (
                            <p className="mt-1 text-xs text-slate-500">Yönlendiren: {record.referrer}</p>
                          )}
                          {record.note && (
                            <p className="mt-2 line-clamp-2 text-xs text-slate-600">{record.note}</p>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                            Bekliyor
                          </span>
                          <p className="mt-2 text-[11px] text-slate-400">
                            {new Date(record.date).toLocaleString("tr-TR", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit"
                            })}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Başlık ve Üst Butonlar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-xl shadow-lg">
            <Calendar className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Takvim</h1>
            <p className="text-sm text-slate-500">Günlük Ders Programı ve Görevler</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={openTaskModal}
            className="bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white"
          >
            <Plus className="h-4 w-4 mr-2" /> Yeni Görev
          </Button>
          <Button 
            onClick={openAppointmentModal}
            className="bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white"
          >
            <Plus className="h-4 w-4 mr-2" /> Yeni Randevu
          </Button>
        </div>
      </div>

      {/* Navigasyon */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={navigatePrev}><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>Bugün</Button>
              <Button variant="outline" size="sm" onClick={navigateNext}><ChevronRight className="h-4 w-4" /></Button>
              <h2 className="text-lg font-semibold text-slate-800 ml-4">{getHeaderText()}</h2>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex bg-slate-100 rounded-lg p-1">
                {[{ v: 'day', l: 'Gün', i: Clock }, { v: 'week', l: 'Hafta', i: CalendarCheck }, { v: 'month', l: 'Ay', i: CalendarDays }].map(v => (
                  <button key={v.v} onClick={() => setViewType(v.v as ViewType)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewType === v.v ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}>
                    <v.i className="h-4 w-4" /> {v.l}
                  </button>
                ))}
              </div>
              <Button variant="outline" size="sm" onClick={loadData}><RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /></Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <Card><CardContent className="py-12 flex items-center justify-center"><Loader2 className="h-8 w-8 text-teal-500 animate-spin" /><span className="ml-3">Yükleniyor...</span></CardContent></Card>
      ) : (
        <>
          {viewType === 'month' && (
            <Card><CardContent className="p-4">
              <div className="grid grid-cols-7 gap-1 mb-2">{DAYS_TR.map(d => <div key={d} className="text-center text-sm font-medium text-slate-500 py-2">{d}</div>)}</div>
              <div className="grid grid-cols-7 gap-1">{calendarDays.map(({ date, isCurrentMonth }, i) => { 
                const evs = getEventsForDate(date).filter(e => e.status !== 'cancelled'); 
                const displayedEvs = evs.slice(0, 3);
                const extraCount = evs.length - 3;
                
                return (
                <div 
                  key={i} 
                  onClick={() => setDayModalDate(date)}
                  className={`min-h-[100px] p-2 rounded-lg border transition-all cursor-pointer ${isCurrentMonth ? 'bg-white' : 'bg-slate-50'} ${isToday(date) ? 'border-teal-500 border-2' : 'border-slate-200'} hover:border-teal-400 hover:shadow-md`}
                >
                  <div className={`text-sm font-medium ${isCurrentMonth ? 'text-slate-800' : 'text-slate-400'} ${isToday(date) ? 'text-teal-600' : ''}`}>{date.getDate()}</div>
                  <div className="mt-1 space-y-1">
                    {displayedEvs.map(e => (
                      <div key={e.id} className={`text-[10px] px-1.5 py-0.5 rounded truncate ${colorMap[e.color]?.bg || 'bg-slate-50'} ${colorMap[e.color]?.text || 'text-slate-700'}`}>
                        {e.time && <span className="font-medium">{normalizeLessonSlot(e.time)}.Drs </span>}
                        {e.title}
                      </div>
                    ))}
                    {extraCount > 0 && (
                      <div className="text-[10px] text-slate-400 font-medium text-center mt-1">+{extraCount} daha</div>
                    )}
                  </div>
                </div>
              );})}</div>
            </CardContent></Card>
          )}

          {viewType === 'week' && (
            <Card className="shadow-lg border-slate-200 overflow-hidden">
              <CardContent className="p-0">
                <div className="grid grid-cols-5 divide-x divide-slate-200">
                  {weekDays.map((date, i) => {
                    const dayEvents = getEventsForDate(date).filter(e => e.status !== 'cancelled');
                    const isPastDate = getLocalDateString(date) < getLocalDateString(new Date());
                    const otherWeekTasks = dayEvents.filter(
                      e => e.type === 'follow_up' || (e.type === 'task' && !e.data.related_guidance_plan_id)
                    );
                    return (
                      <div key={i} className={`flex flex-col min-h-[650px] ${isToday(date) ? 'bg-teal-50/30' : 'bg-white'}`}>
                        <div className={`p-3 text-center border-b ${isToday(date) ? 'bg-teal-500 text-white' : 'bg-slate-50 text-slate-700'}`}>
                          <div className="text-[10px] uppercase font-bold tracking-wider opacity-80">{DAYS_TR[i]}</div>
                          <div className="text-xl font-black">{date.getDate()}</div>
                        </div>
                        <div className="flex-1 divide-y divide-slate-100">
                          {Array.from({ length: 7 }, (_, idx) => {
                            const lessonNum = idx + 1;
                            const periodEvents = dayEvents.filter(e =>
                              (e.type === 'appointment' || e.type === 'guidance_plan' || e.type === 'class_request') &&
                              normalizeLessonSlot(e.time) === String(lessonNum)
                            );

                            return (
                              <div
                                key={lessonNum}
                                className={`p-2 min-h-[104px] transition-colors ${periodEvents.length === 0 ? 'bg-rose-50/40 hover:bg-rose-50/70' : 'hover:bg-slate-50/80'}`}
                              >
                                <div className="mb-2 flex items-center justify-between">
                                  <div className="text-[10px] font-bold tracking-[0.14em] text-slate-400">{lessonNum}. DERS</div>
                                </div>
                                <div className="space-y-2">
                                  {periodEvents.length === 0 ? (
                                    isPastDate ? (
                                      <div className="min-h-[68px] rounded-xl border border-slate-200 bg-slate-50/70" />
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => openPendingApplicationsModal(getLocalDateString(date), String(lessonNum))}
                                        className="flex min-h-[68px] w-full items-center justify-center rounded-xl border border-dashed border-rose-300 bg-white px-3 text-center transition hover:border-teal-300 hover:bg-teal-50 focus:outline-none focus:ring-2 focus:ring-teal-500/40"
                                      >
                                        <div>
                                          <p className="text-sm font-extrabold tracking-[0.12em] text-rose-600">BOŞ SAAT</p>
                                          <p className="mt-2 text-[11px] font-semibold text-teal-600">Bekleyen başvuruları göster</p>
                                        </div>
                                      </button>
                                    )
                                  ) : periodEvents.map(e => {
                                    const isAppointment = e.type === 'appointment';
                                    const isClassReq = e.type === 'class_request';
                                    const isCompleted = e.status === 'attended' || e.status === 'completed';
                                    const cardClasses = isAppointment
                                      ? isCompleted
                                        ? "border-slate-200 bg-slate-50"
                                        : "border-sky-200 bg-sky-50"
                                      : isClassReq
                                        ? "border-violet-200 bg-violet-50"
                                        : "border-amber-200 bg-amber-50";
                                    const titleText = e.title.replace(/\s*\((Öğrenci|Veli|Öğretmen)\)\s*$/i, "");
                                    const guidanceClass = e.data?.class_display || titleText;
                                    const guidanceTopic =
                                      e.data?.topic_title ||
                                      e.data?.admin_category ||
                                      e.data?.topic ||
                                      e.data?.subject ||
                                      e.data?.detail ||
                                      e.data?.note ||
                                      "";
                                    const guidanceTeacher = e.data?.lesson_teacher || e.data?.teacher_name || "";

                                    return (
                                      <div
                                        key={e.id}
                                        className={`rounded-xl border p-3 shadow-sm ${cardClasses}`}
                                      >
                                        <div className={`space-y-2 ${isAppointment ? '' : 'flex min-h-[68px] flex-col items-center justify-center text-center'}`}>
                                          {isAppointment && (
                                            <div className="flex items-center justify-between gap-2">
                                              <p className="text-[10px] font-semibold text-sky-700">
                                                Öğrenci randevusu
                                              </p>
                                              <span className="rounded-md bg-white px-1.5 py-0.5 text-[9px] font-semibold text-sky-700">
                                                {lessonNum}. ders
                                              </span>
                                            </div>
                                          )}
                                          {isAppointment ? (
                                            <>
                                              <p className={`line-clamp-3 text-[13px] font-semibold leading-5 ${isCompleted ? 'text-slate-500 line-through' : 'text-slate-800'}`} title={titleText}>
                                                {titleText}
                                              </p>
                                              <div className="flex items-center justify-between text-[10px]">
                                                <span className={`${isCompleted ? 'text-slate-500' : 'text-slate-600'}`}>
                                                  {isCompleted ? 'Görüşme tamamlandı' : 'Planlı görüşme'}
                                                </span>
                                                <span className="font-medium text-slate-500">
                                                  {formatLessonSlotLabel(String(lessonNum))}
                                                </span>
                                              </div>
                                            </>
                                          ) : (
                                            <>
                                              <p
                                                className={`line-clamp-2 text-center text-[20px] font-extrabold leading-6 ${isCompleted ? 'text-slate-500 line-through' : isClassReq ? 'text-violet-900' : 'text-amber-900'}`}
                                                title={guidanceTopic ? `${guidanceClass} · ${guidanceTopic}` : guidanceClass}
                                              >
                                                {guidanceClass}
                                              </p>
                                              {guidanceTopic && (
                                                <p
                                                  className={`line-clamp-2 text-center text-[14px] font-semibold leading-5 ${isCompleted ? 'text-slate-400' : isClassReq ? 'text-violet-700' : 'text-amber-700'}`}
                                                  title={guidanceTopic}
                                                >
                                                  {guidanceTopic}
                                                </p>
                                              )}
                                              {guidanceTeacher && (
                                                <p className="text-center text-[11px] text-slate-500">
                                                  Öğretmen: {guidanceTeacher}
                                                </p>
                                              )}
                                              {isClassReq && (
                                                <p className={`text-center text-[10px] font-bold ${isCompleted ? 'text-slate-400' : 'text-violet-600'}`}>
                                                  {isCompleted ? 'Tamamlandı' : 'Sınıf Talebi'}
                                                </p>
                                              )}
                                            </>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="p-2 border-t-2 border-slate-200 bg-slate-50/50 min-h-[120px]">
                          <div className="flex items-center gap-1 text-[9px] font-black text-slate-500 uppercase tracking-tighter mb-2">
                            <ListTodo className="h-3.5 w-3.5" /> Diğer Görevler
                          </div>
                          <div className="space-y-1">
                            {otherWeekTasks.map(t => (
                              <div 
                                key={t.id} 
                                className={`p-1.5 rounded-lg border text-[9px] font-semibold flex items-center gap-1.5 transition-all ${t.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-100 opacity-60' : 'bg-white border-slate-200 text-slate-700 shadow-sm'}`}
                              >
                                <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${t.status === 'completed' ? 'bg-emerald-500' : 'bg-orange-400'}`} />
                                <span className="truncate" title={t.title}>{t.title}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {viewType === 'day' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2 shadow-lg shadow-slate-200/50">
                <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-emerald-50/50 pb-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CalendarCheck className="h-5 w-5 text-emerald-600" />
                    Günlük Program
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 bg-slate-50/50">
                  <div className="space-y-3">
                    {Array.from({ length: 7 }, (_, i) => i + 1).map(lesson => {
                      const periodStr = String(lesson);
                      const lessonEvents = getEventsForDate(currentDate).filter(e => {
                        if (e.type === 'appointment' || e.type === 'guidance_plan' || e.type === 'class_request') {
                          return normalizeLessonSlot(e.time) === periodStr;
                        }
                        return false;
                      });

                      return (
                        <div key={lesson} className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 border border-slate-200 shadow-inner">
                            <span className="text-base font-black text-slate-600">{lesson}</span>
                          </div>
                          <div className="flex-1 min-w-0 space-y-2">
                            {lessonEvents.length === 0 ? (
                              <button
                                type="button"
                                onClick={() => openPendingApplicationsModal(getLocalDateString(currentDate), periodStr)}
                                className="w-full rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2.5 text-left transition hover:border-teal-300 hover:bg-teal-50"
                              >
                                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Boş</p>
                                <p className="mt-0.5 text-sm text-slate-500">Bu saat açık</p>
                                <p className="mt-2 text-xs font-medium text-teal-600">Bekleyen başvuruları göster</p>
                              </button>
                            ) : lessonEvents.map(e => {
                              const isCompleted = e.status === 'attended' || e.status === 'completed';
                              const isApt = e.type === 'appointment';
                              const isClassReq = e.type === 'class_request';

                              let containerClass = "";
                              let typeText = "";
                              let typeLabel = "";

                              if (isCompleted) {
                                containerClass = "border-slate-200 bg-slate-50 opacity-75";
                                typeText = "text-slate-500";
                                typeLabel = "Tamamlandı";
                              } else if (isApt) {
                                containerClass = "border-blue-200 bg-gradient-to-r from-blue-50 to-cyan-50";
                                typeText = "text-blue-700";
                                typeLabel = "Randevu";
                              } else if (isClassReq) {
                                containerClass = "border-violet-200 bg-gradient-to-r from-violet-50 to-purple-50";
                                typeText = "text-violet-700";
                                typeLabel = "Sınıf Talebi";
                              } else {
                                containerClass = "border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50";
                                typeText = "text-emerald-700";
                                typeLabel = "Sınıf Rehberliği";
                              }

                              return (
                                <div
                                  key={e.id}
                                  onClick={() => {
                                    if (e.type === 'appointment') {
                                      openAppointmentEditModal(e.data as Appointment);
                                    } else if (e.type === 'class_request' && !isCompleted) {
                                      openCrEditModal(e.data);
                                    }
                                  }}
                                  className={`relative rounded-xl border px-3 py-2.5 transition-colors ${containerClass} ${(e.type === 'appointment' || (e.type === 'class_request' && !isCompleted)) ? 'cursor-pointer hover:shadow-sm' : ''}`}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <p className={`text-[11px] font-black uppercase tracking-[0.12em] ${typeText}`}>
                                          {isApt ? 'Görüşme' : isClassReq ? 'Sınıf Talebi' : 'Sınıf Rehberliği'}
                                        </p>
                                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold border ${isCompleted ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-white/80 border-white/50 ' + typeText}`}>
                                          {typeLabel}
                                        </span>
                                      </div>
                                      <p className={`mt-1 text-sm font-semibold truncate ${isCompleted ? 'text-slate-600 line-through' : 'text-slate-800'}`}>
                                        {e.title}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0 mt-0.5">
                                      <button
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          if (e.type === 'appointment') openAttendanceChoiceModal(e.data);
                                          else if (e.type === 'guidance_plan') toggleGuidancePlanStatus(e.id, e.status);
                                          else if (e.type === 'class_request') toggleClassRequestStatus(e.id, e.status);
                                        }}
                                        className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all ${isCompleted ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 bg-white text-slate-400 hover:border-emerald-400 hover:text-emerald-500'}`}
                                        title={isCompleted ? 'Tamamlandı' : 'Tamamla'}
                                      >
                                        {isCompleted && <CheckCircle2 className="h-5 w-5" />}
                                      </button>
                                      {isClassReq ? (
                                      <button
                                        onClick={(event) => { event.stopPropagation(); handleResetClassRequest(e.id); }}
                                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-transparent text-slate-300 hover:border-red-200 hover:bg-red-50 hover:text-red-500 transition-colors"
                                        title="Planlamayı İptal Et (Bekliyor'a Al)"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                      ) : (
                                      <button
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          if (e.type === 'appointment') handleDeleteAppointment(e.id);
                                          else handleDeleteGuidancePlan(e.id);
                                        }}
                                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-transparent text-slate-300 hover:border-red-200 hover:bg-red-50 hover:text-red-500 transition-colors"
                                        title="Sil"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-lg shadow-slate-200/50">
                <CardHeader className="border-b bg-gradient-to-r from-orange-50 to-amber-50/50 pb-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ListTodo className="h-5 w-5 text-orange-500" />
                    Diğer Görevler
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 bg-slate-50/50 h-full min-h-[300px]">
                  {getEventsForDate(currentDate).filter(e => e.type === 'follow_up' || (e.type === 'task' && !e.data.related_guidance_plan_id)).length === 0 ? (
                    <div className="text-center py-12 text-slate-400">
                      <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-20" />
                      <p className="text-sm font-medium">Bugün için görev yok</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {getEventsForDate(currentDate).filter(e => e.type === 'follow_up' || (e.type === 'task' && !e.data.related_guidance_plan_id)).map(t => (
                        <div key={t.id} className={`p-3.5 rounded-xl border transition-all shadow-sm ${t.status === 'completed' ? 'bg-slate-50 opacity-60 border-slate-200' : 'bg-white border-slate-200 hover:border-orange-200 hover:shadow-md'}`}>
                          <div className="flex items-start gap-3">
                            <button onClick={() => toggleTaskStatus(t.id, t.type, t.status)} className={`mt-0.5 h-6 w-6 shrink-0 rounded-md border-2 flex items-center justify-center transition-colors ${t.status === 'completed' ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 hover:border-orange-500'}`}>
                              {t.status === 'completed' && <CheckCircle2 className="h-4 w-4" />}
                            </button>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-semibold ${t.status === 'completed' ? 'line-through text-slate-500' : 'text-slate-800'}`}>{t.title}</p>
                              <div className="flex items-center justify-between mt-1.5">
                                <span className={`text-[10px] font-bold tracking-wider uppercase ${t.type === 'task' ? 'text-orange-500' : 'text-teal-500'}`}>
                                  {t.type === 'task' ? 'GÖREV' : 'TAKİP'}
                                </span>
                                <button onClick={() => handleDeleteTask(t.id)} className="text-slate-300 hover:text-red-500 transition-all p-1">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
