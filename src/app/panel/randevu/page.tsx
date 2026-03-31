"use client";

import { useState, useEffect, useMemo, useRef } from "react";
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
  X
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useAppointments, useAppointmentTasks, useCalendarHelpers } from "./hooks";
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

  const [viewMode, setViewMode] = useState<"day" | "week">("day");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<AppointmentStatus | "all">("all");
  const [filterType, setFilterType] = useState<ParticipantType | "all">("all");
  const [filterPriority, setFilterPriority] = useState<PriorityLevel | "all">("all");
  const [showFilters, setShowFilters] = useState(false);

  const [classes, setClasses] = useState<{ value: string; text: string }[]>([]);
  const [students, setStudents] = useState<{ value: string; text: string }[]>([]);
  const [teachers, setTeachers] = useState<{ value: string; label: string }[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [selectedClass, setSelectedClass] = useState("");
  const [sourceObservationIds, setSourceObservationIds] = useState<string[]>([]);
  const [poolPrefillStudentName, setPoolPrefillStudentName] = useState("");
  const [poolPrefillClassDisplay, setPoolPrefillClassDisplay] = useState("");
  const hasAppliedPoolPrefill = useRef(false);

  const [showNewAppointmentModal, setShowNewAppointmentModal] = useState(false);
  const [showClosureModal, setShowClosureModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const [customTag, setCustomTag] = useState("");
  const [customTags, setCustomTags] = useState<string[]>([]);

  const [formData, setFormData] = useState<AppointmentFormData>({
    appointment_date: new Date().toISOString().slice(0, 10),
    start_time: "1. Ders",
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

  useEffect(() => {
    const fetchClassesAndTeachers = async () => {
      try {
        const classRes = await fetch("/api/data");
        if (classRes.ok) {
          const classData = await classRes.json();
          if (Array.isArray(classData.sinifSubeList)) {
            setClasses(classData.sinifSubeList);
          }
        }
        const teacherRes = await fetch("/api/teachers");
        if (teacherRes.ok) {
          const teacherData = await teacherRes.json();
          if (Array.isArray(teacherData.teachers)) {
            setTeachers(teacherData.teachers);
          }
        }
      } catch (error) {
        console.error("Veri yükleme hatası:", error);
      }
    };
    fetchClassesAndTeachers();
  }, []);

  useEffect(() => {
    const poolIdsParam = searchParams.get("poolIds");
    if (!poolIdsParam || hasAppliedPoolPrefill.current) return;

    const studentName = searchParams.get("studentName") || "";
    const classKey = searchParams.get("classKey") || "";
    const classDisplay = searchParams.get("classDisplay") || "";
    const note = searchParams.get("note") || "";
    const observationType = searchParams.get("observationType") as ObservationType | null;
    const priority = searchParams.get("priority");

    const parsedIds = poolIdsParam
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    if (parsedIds.length === 0) return;

    hasAppliedPoolPrefill.current = true;
    setSourceObservationIds(parsedIds);
    setPoolPrefillStudentName(studentName);
    setPoolPrefillClassDisplay(classDisplay);
    setSelectedClass(classKey);
    setShowNewAppointmentModal(true);

    setFormData((prev) => {
      const nextTags = observationType && poolObservationTagMap[observationType]
        ? Array.from(new Set([...prev.topic_tags, poolObservationTagMap[observationType]]))
        : prev.topic_tags;

      return {
        ...prev,
        participant_type: "student",
        participant_name: studentName || prev.participant_name,
        participant_class: classDisplay || prev.participant_class,
        topic_tags: nextTags,
        purpose: note ? "Gözlem havuzundan aktarıldı" : prev.purpose,
        preparation_note: note
          ? `Gözlem havuzu notu:\n${note}`
          : prev.preparation_note,
        priority: priority === "high" ? "urgent" : prev.priority
      };
    });
  }, [searchParams]);

  const fetchStudentsByClass = async (classKey: string) => {
    if (!classKey) {
      setStudents([]);
      return;
    }
    try {
      setLoadingStudents(true);
      const res = await fetch(`/api/students?sinifSube=${encodeURIComponent(classKey)}`);
      if (res.ok) {
        const data = await res.json();
        setStudents(Array.isArray(data) ? data : []);
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
    const today = new Date().toISOString().slice(0, 10);
    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() + 7);
    fetchAppointments({ from: today, to: weekEnd.toISOString().slice(0, 10) });
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

    if (filterStatus !== "all") {
      filtered = filtered.filter(apt => apt.status === filterStatus);
    }
    if (filterType !== "all") {
      filtered = filtered.filter(apt => apt.participant_type === filterType);
    }
    if (filterPriority !== "all") {
      filtered = filtered.filter(apt => apt.priority === filterPriority);
    }

    // Ders sırasına göre sırala (1. Ders, 2. Ders ...)
    return filtered.sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [appointments, viewMode, currentDate, searchQuery, filterStatus, filterType, filterPriority, getWeekDays]);

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

  const handleCreateAppointment = async () => {
    if (!formData.participant_name) {
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
    const result = await createAppointment({
      ...formData,
      participant_name: formData.participant_name || poolPrefillStudentName,
      participant_class: formData.participant_class || poolPrefillClassDisplay
    });
    if (result) {
      if (sourceObservationIds.length > 0) {
        try {
          const res = await fetch("/api/gozlem-havuzu", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "convert",
              ids: sourceObservationIds,
              appointment_id: result.id
            })
          });

          if (!res.ok) {
            throw new Error("Gözlem kaydı güncellenemedi");
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

  const resetForm = () => {
    setFormData({
      appointment_date: new Date().toISOString().slice(0, 10),
      start_time: "1. Ders",
      participant_type: "student",
      participant_name: "",
      participant_class: "",
      topic_tags: [],
      location: "guidance_office",
      purpose: "",
      preparation_note: "",
      priority: "normal"
    });
    setSelectedClass("");
    setStudents([]);
    setCustomTag("");
  };

  const closeNewAppointmentModal = () => {
    setShowNewAppointmentModal(false);
    resetForm();
    setSourceObservationIds([]);
    setPoolPrefillStudentName("");
    setPoolPrefillClassDisplay("");
    hasAppliedPoolPrefill.current = false;
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

  const handleAppointmentClick = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    if (appointment.status === "planned") {
      setClosureData({
        status: "attended",
        outcome_summary: "",
        outcome_decision: [],
        next_action: "",
        create_follow_up: false
      });
      setShowClosureModal(true);
    } else {
      setShowDetailModal(true);
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

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-500 via-emerald-500 to-cyan-600 p-6 text-white shadow-xl">
        <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,transparent,rgba(255,255,255,0.5))]" />
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-teal-300/20 blur-3xl animate-float-slow" />
        <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-emerald-400/20 blur-3xl animate-float-reverse" />

        <div className="relative">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm shadow-lg">
                <CalendarCheck className="h-7 w-7" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Randevular</h1>
                <p className="text-teal-100">Görüşme planlama ve takip sistemi</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-2 rounded-lg bg-white/10 backdrop-blur-sm px-3 py-2 border border-white/10">
                <Clock className="h-4 w-4 text-teal-200" />
                <div>
                  <p className="text-[10px] text-teal-200 uppercase tracking-wider">Planlandı</p>
                  <p className="text-lg font-bold leading-none">{statusCounts.planned}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-white/10 backdrop-blur-sm px-3 py-2 border border-white/10">
                <CheckCircle2 className="h-4 w-4 text-green-300" />
                <div>
                  <p className="text-[10px] text-teal-200 uppercase tracking-wider">Geldi</p>
                  <p className="text-lg font-bold leading-none">{statusCounts.attended}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-white/10 backdrop-blur-sm px-3 py-2 border border-white/10">
                <XCircle className="h-4 w-4 text-red-300" />
                <div>
                  <p className="text-[10px] text-teal-200 uppercase tracking-wider">Gelmedi</p>
                  <p className="text-lg font-bold leading-none">{statusCounts.not_attended}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-white/20 flex flex-wrap items-center justify-between gap-3">
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
                onClick={() => setShowFilters(!showFilters)}
                className={`bg-white/10 hover:bg-white/20 text-white border-0 ${showFilters ? "ring-2 ring-white/30" : ""}`}
              >
                <Filter className="h-4 w-4 mr-1" />
                Filtreler
              </Button>
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
                onClick={() => setShowNewAppointmentModal(true)}
                className="bg-white text-teal-600 hover:bg-white/90 shadow-lg"
              >
                <Plus className="h-4 w-4 mr-1" />
                Yeni Randevu
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* FİLTRELER */}
      {showFilters && (
        <Card className="bg-white/80 backdrop-blur border-slate-200/50">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[200px]">
                <label className="text-xs font-medium text-slate-500 mb-1 block">Ara</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="İsim veya etiket ara..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Durum</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as AppointmentStatus | "all")}
                  className="px-3 py-2 text-sm border rounded-lg bg-white focus:ring-2 focus:ring-teal-500"
                >
                  <option value="all">Tümü</option>
                  {APPOINTMENT_STATUS.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Görüşme Türü</label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as ParticipantType | "all")}
                  className="px-3 py-2 text-sm border rounded-lg bg-white focus:ring-2 focus:ring-teal-500"
                >
                  <option value="all">Tümü</option>
                  {PARTICIPANT_TYPES.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Öncelik</label>
                <select
                  value={filterPriority}
                  onChange={(e) => setFilterPriority(e.target.value as PriorityLevel | "all")}
                  className="px-3 py-2 text-sm border rounded-lg bg-white focus:ring-2 focus:ring-teal-500"
                >
                  <option value="all">Tümü</option>
                  {PRIORITY_LEVELS.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setFilterStatus("all");
                  setFilterType("all");
                  setFilterPriority("all");
                }}
                className="text-slate-500"
              >
                Temizle
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

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
                  onClick={() => setShowNewAppointmentModal(true)}
                  className="mt-3"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Randevu Ekle
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredAppointments.map((appointment) => {
                  const StatusIcon = statusIcons[appointment.status];
                  const ParticipantIcon = participantColors[appointment.participant_type].icon;
                  const colors = statusColors[appointment.status];
                  const pColors = participantColors[appointment.participant_type];

                  return (
                    <div
                      key={appointment.id}
                      onClick={() => handleAppointmentClick(appointment)}
                      className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all hover:shadow-lg hover:scale-[1.01] ${colors.bg} ${colors.border} ${
                        appointment.priority === "urgent" ? "ring-2 ring-red-400 ring-offset-2" : ""
                      }`}
                    >
                      {appointment.priority === "urgent" && (
                        <div className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                          ACİL
                        </div>
                      )}

                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          {/* Ders bilgisi */}
                          <div className="text-center min-w-[60px]">
                            <div className={`text-base font-bold ${colors.text}`}>
                              {appointment.start_time}
                            </div>
                          </div>

                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge className={`${pColors.bg} ${pColors.text} text-xs gap-1`}>
                                <ParticipantIcon className="h-3 w-3" />
                                {getParticipantLabel(appointment.participant_type)}
                              </Badge>
                              <span className="font-semibold text-slate-800">
                                {appointment.participant_name}
                              </span>
                              {appointment.participant_class && (
                                <span className="text-xs text-slate-500">
                                  ({appointment.participant_class})
                                </span>
                              )}
                            </div>

                            {appointment.topic_tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-2">
                                {appointment.topic_tags.slice(0, 3).map((tag, idx) => (
                                  <span
                                    key={idx}
                                    className="text-[10px] px-2 py-0.5 rounded-full bg-white/80 text-slate-600 border"
                                  >
                                    {tag}
                                  </span>
                                ))}
                                {appointment.topic_tags.length > 3 && (
                                  <span className="text-[10px] text-slate-400">
                                    +{appointment.topic_tags.length - 3}
                                  </span>
                                )}
                              </div>
                            )}

                            <div className="flex items-center gap-3 text-xs text-slate-500">
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {getLocationLabel(appointment.location)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${colors.bg} ${colors.text}`}>
                          <StatusIcon className="h-4 w-4" />
                          <span className="text-xs font-medium">
                            {APPOINTMENT_STATUS.find(s => s.value === appointment.status)?.label}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        /* HAFTALIK GÖRÜNÜM */
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
                        {slotAppointments.map((apt) => {
                          const pColors = participantColors[apt.participant_type];
                          return (
                            <div
                              key={apt.id}
                              onClick={() => handleAppointmentClick(apt)}
                              className={`text-[10px] p-1.5 rounded cursor-pointer ${pColors.bg} ${pColors.text} hover:opacity-80 transition-opacity ${
                                apt.priority === "urgent" ? "ring-1 ring-red-400" : ""
                              }`}
                            >
                              <div className="font-semibold truncate">{apt.participant_name}</div>
                              {apt.topic_tags[0] && (
                                <div className="truncate opacity-80">{apt.topic_tags[0]}</div>
                              )}
                            </div>
                          );
                        })}
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
                Yeni Randevu
              </h2>
              <button
                onClick={closeNewAppointmentModal}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Görüşme Türü ve Öncelik */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Görüşme Türü *</label>
                  <select
                    value={formData.participant_type}
                    onChange={(e) => {
                      const newType = e.target.value as ParticipantType;
                      setFormData({ ...formData, participant_type: newType, participant_name: "", participant_class: "" });
                      setSelectedClass("");
                      setStudents([]);
                    }}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500"
                  >
                    {PARTICIPANT_TYPES.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Öncelik</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as PriorityLevel })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500"
                  >
                    {PRIORITY_LEVELS.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
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
                        setFormData({ ...formData, participant_class: classText, participant_name: "" });
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
                        value={formData.participant_name}
                        onChange={(e) => setFormData({ ...formData, participant_name: e.target.value })}
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
                        placeholder="Veli adını girin veya boş bırakın"
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500"
                        onChange={(e) => {
                          if (e.target.value) {
                            setFormData({
                              ...formData,
                              participant_name: `${e.target.value} (${formData.participant_name} velisi)`
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
                      <option key={slot.value} value={slot.value}>{slot.label}</option>
                    ))}
                  </select>
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

              {/* Konu Etiketleri */}
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Konu Etiketleri</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={customTag}
                    onChange={(e) => setCustomTag(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && customTag.trim()) {
                        e.preventDefault();
                        const newTag = customTag.trim();
                        if (!formData.topic_tags.includes(newTag) && !(TOPIC_TAGS as readonly string[]).includes(newTag)) {
                          setFormData({ ...formData, topic_tags: [...formData.topic_tags, newTag] });
                          if (!customTags.includes(newTag)) setCustomTags([...customTags, newTag]);
                        }
                        setCustomTag("");
                      }
                    }}
                    placeholder="Yeni etiket ekle... (Enter'a bas)"
                    className="flex-1 px-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (customTag.trim()) {
                        const newTag = customTag.trim();
                        if (!formData.topic_tags.includes(newTag) && !(TOPIC_TAGS as readonly string[]).includes(newTag)) {
                          setFormData({ ...formData, topic_tags: [...formData.topic_tags, newTag] });
                          if (!customTags.includes(newTag)) setCustomTags([...customTags, newTag]);
                        }
                        setCustomTag("");
                      }
                    }}
                    className="shrink-0"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {formData.topic_tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2 p-2 bg-teal-50 rounded-lg border border-teal-200">
                    {formData.topic_tags.map(tag => (
                      <span key={tag} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-teal-500 text-white">
                        {tag}
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, topic_tags: formData.topic_tags.filter(t => t !== tag) })}
                          className="hover:bg-teal-600 rounded-full p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap gap-2 p-3 border rounded-lg bg-slate-50 max-h-32 overflow-y-auto">
                  {[...TOPIC_TAGS, ...customTags.filter(t => !(TOPIC_TAGS as readonly string[]).includes(t))].map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        const newTags = formData.topic_tags.includes(tag)
                          ? formData.topic_tags.filter(t => t !== tag)
                          : [...formData.topic_tags, tag];
                        setFormData({ ...formData, topic_tags: newTags });
                      }}
                      className={`text-xs px-2 py-1 rounded-full transition-colors ${
                        formData.topic_tags.includes(tag)
                          ? "bg-teal-500 text-white"
                          : customTags.includes(tag) && !(TOPIC_TAGS as readonly string[]).includes(tag)
                            ? "bg-purple-100 border border-purple-300 hover:bg-purple-200 text-purple-700"
                            : "bg-white border hover:bg-slate-100"
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amaç */}
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Görüşmenin Amacı</label>
                <input
                  type="text"
                  value={formData.purpose || ""}
                  onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                  placeholder="Görüşmenin hedefi ne?"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500"
                />
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
                onClick={handleCreateAppointment}
                disabled={loading || !formData.participant_name}
                className="bg-teal-600 hover:bg-teal-700"
              >
                {loading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                Randevu Oluştur
              </Button>
            </div>
          </div>
        </div>
      )}

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
                <li>• <strong>Acil durumlar:</strong> Öncelik olarak "Acil" seçin, kart kırmızı çerçeve ile vurgulanır</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
