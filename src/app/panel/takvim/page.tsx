"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  ListTodo
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Appointment } from "@/types";
import Link from "next/link";
import { AppointmentOutcomeModal, type AppointmentOutcomeChoice } from "@/components/AppointmentOutcomeModal";

// Saatleri ders sayısına çeviren fonksiyon
const normalizeLessonSlot = (timeStr?: string | null) => {
  if (!timeStr) return '';
  const match = String(timeStr).match(/\d+/);
  return match ? match[0] : '';
};

const MONTHS_TR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const DAYS_TR = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

const getLocalDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

type ViewType = 'month' | 'week' | 'day';

interface CalendarEvent {
  id: string;
  date: string;
  time?: string;
  title: string;
  type: 'appointment' | 'guidance_plan' | 'task' | 'follow_up';
  status?: string;
  color: string;
  data: any;
}

export default function TakvimPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewType, setViewType] = useState<ViewType>('month');
  const [isLoading, setIsLoading] = useState(true);
  
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [guidancePlans, setGuidancePlans] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [followUps, setFollowUps] = useState<any[]>([]);
  
  const [showAppointments, setShowAppointments] = useState(true);
  const [showActivities, setShowActivities] = useState(true);
  const [showTasks, setShowTasks] = useState(true);

  // Randevu Sonuç Modalı State'leri
  const [showAttendanceChoiceModal, setShowAttendanceChoiceModal] = useState(false);
  const [attendanceChoiceAppointment, setAttendanceChoiceAppointment] = useState<Appointment | null>(null);
  const [attendanceSaving, setAttendanceSaving] = useState(false);
  
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
      
      const [appResult, planResult, taskResult, followResult] = await Promise.all([
        supabase.from('appointments').select('*').gte('appointment_date', startStr).lte('appointment_date', endStr),
        supabase.from('guidance_plans').select('*').gte('plan_date', startStr).lte('plan_date', endStr),
        supabase.from('tasks').select('*').gte('due_date', startStr).lte('due_date', endStr),
        supabase.from('follow_ups').select('*').gte('follow_up_date', startStr).lte('follow_up_date', endStr)
      ]);
      
      setAppointments(appResult.data || []);
      setGuidancePlans(planResult.data || []);
      setTasks(taskResult.data || []);
      setFollowUps(followResult.data || []);
    } catch (error) {
      console.error('Veri yükleme hatası:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Randevu Modal İşlemleri ---
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
      active_follow: { status: "attended", outcome_decision: ["Aktif Takip"], source_application_status: "active_follow" },
      regular_meeting: { status: "attended", outcome_decision: ["Düzenli Görüşme"], source_application_status: "regular_meeting" }
    };

    const messages: Record<Exclude<AppointmentOutcomeChoice, "cancel">, string> = {
      completed: "Tamamlandı olarak işaretlendi",
      active_follow: "Aktif Takip olarak işaretlendi",
      regular_meeting: "Düzenli Görüşme olarak işaretlendi"
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
      console.error('Randevu durumu değiştirilemedi:', error);
      toast.error('Randevu durumu değiştirilirken hata oluştu');
    } finally {
      setAttendanceSaving(false);
    }
  };

  // --- Sınıf Rehberliği Durum İşlemi ---
  const toggleGuidancePlanStatus = async (id: string, currentStatus?: string) => {
    const newStatus = currentStatus === 'completed' ? 'planned' : 'completed';
    try {
      const { error } = await supabase.from('guidance_plans').update({ status: newStatus }).eq('id', id);
      if (error) throw error;
      toast.success(newStatus === 'completed' ? 'Sınıf rehberliği tamamlandı' : 'Durum geri alındı');
      await loadData();
    } catch (error) {
      toast.error('Güncellenemedi');
    }
  };

  // --- Sağ Taraf Görev İşlemleri ---
  const toggleTaskStatus = async (id: string, type: string, currentStatus?: string) => {
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    const table = type === 'task' ? 'tasks' : 'follow_ups';
    try {
      const { error } = await supabase.from(table).update({ status: newStatus }).eq('id', id);
      if (error) throw error;
      toast.success(newStatus === 'completed' ? 'Tamamlandı' : 'Geri alındı');
      await loadData();
    } catch (error) {
      toast.error('Güncellenemedi');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Silmek istediğinize emin misiniz?')) return;
    try {
      await supabase.from('tasks').delete().eq('id', taskId);
      toast.success('Silindi');
      await loadData();
    } catch (error) {
      toast.error('Hata oluştu');
    }
  };

  const handleDeleteAppointment = async (appointmentId: string) => {
    if (!confirm('Silmek istediğinize emin misiniz?')) return;
    try {
      await supabase.from('appointments').delete().eq('id', appointmentId);
      toast.success('Silindi');
      await loadData();
    } catch (error) {
      toast.error('Hata oluştu');
    }
  };

  const handleDeleteGuidancePlan = async (planId: string) => {
    if (!confirm('Sınıf rehberliği planını silmek istediğinize emin misiniz?')) return;
    try {
      await supabase.from('guidance_plans').delete().eq('id', planId);
      toast.success('Silindi');
      await loadData();
    } catch (error) {
      toast.error('Hata oluştu');
    }
  };

  const events = useMemo<CalendarEvent[]>(() => {
    const allEvents: CalendarEvent[] = [];
    
    if (showAppointments) {
      appointments.forEach(app => {
        const colors: any = { planned: 'blue', attended: 'green', not_attended: 'red', postponed: 'amber', cancelled: 'slate' };
        const pType = app.participant_type === 'student' ? 'Öğrenci' : app.participant_type === 'parent' ? 'Veli' : 'Öğretmen';
        allEvents.push({ 
          id: app.id, 
          date: app.appointment_date, 
          time: app.start_time, 
          title: `${app.participant_name} (${pType})`, 
          type: 'appointment', 
          status: app.status, 
          color: colors[app.status] || 'blue', 
          data: app 
        });
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
          data: plan 
        });
      });
    }
    
    if (showTasks) {
      tasks.forEach(task => {
        allEvents.push({ 
          id: task.id, 
          date: task.due_date, 
          time: task.due_time, 
          title: task.title, 
          type: 'task', 
          status: task.status, 
          color: 'orange', 
          data: task 
        });
      });
      followUps.forEach(fu => {
        allEvents.push({ 
          id: fu.id, 
          date: fu.follow_up_date, 
          title: `Takip: ${fu.student_name}`, 
          type: 'follow_up', 
          status: fu.status, 
          color: 'teal', 
          data: fu 
        });
      });
    }
    return allEvents;
  }, [appointments, guidancePlans, tasks, followUps, showAppointments, showActivities, showTasks]);
  
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
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
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

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };
  
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
    if (viewType === 'week') return `${weekDays[0].getDate()} - ${weekDays[6].getDate()} ${MONTHS_TR[weekDays[0].getMonth()]} ${weekDays[0].getFullYear()}`;
    return `${currentDate.getDate()} ${MONTHS_TR[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
  };

  return (
    <div className="space-y-6">
      
      {/* Appointment Outcome Modal */}
      <AppointmentOutcomeModal
        open={showAttendanceChoiceModal}
        appointment={attendanceChoiceAppointment}
        loading={attendanceSaving}
        onClose={closeAttendanceChoiceModal}
        onSelect={handleAttendanceChoice}
      />

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
        <Link href="/panel/randevu">
          <Button className="bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700">
            <Plus className="h-4 w-4 mr-2" /> Yeni Randevu
          </Button>
        </Link>
      </div>
      
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
                {[ { v: 'month', l: 'Ay', i: CalendarDays }, { v: 'week', l: 'Hafta', i: CalendarCheck }, { v: 'day', l: 'Gün', i: Clock } ].map(v => (
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
            <Card><CardContent className="p-4"><div className="grid grid-cols-7 gap-1 mb-2">{DAYS_TR.map(d => <div key={d} className="text-center text-sm font-medium text-slate-500 py-2">{d}</div>)}</div><div className="grid grid-cols-7 gap-1">{calendarDays.map(({ date, isCurrentMonth }, i) => { const evs = getEventsForDate(date); return (
              <div key={i} className={`min-h-[100px] p-2 rounded-lg border transition-all ${isCurrentMonth ? 'bg-white' : 'bg-slate-50'} ${isToday(date) ? 'border-teal-500 border-2' : 'border-slate-200'} hover:border-teal-300`}>
                <div className={`text-sm font-medium ${isCurrentMonth ? 'text-slate-800' : 'text-slate-400'} ${isToday(date) ? 'text-teal-600' : ''}`}>{date.getDate()}</div>
                <div className="mt-1 space-y-1">{evs.filter(e => e.status !== 'cancelled').slice(0, 3).map(e => <div key={e.id} className={`text-xs px-1.5 py-0.5 rounded truncate ${colorMap[e.color].bg} ${colorMap[e.color].text}`}>{e.time && <span className="font-medium">{normalizeLessonSlot(e.time)}.Drs </span>}{e.title}</div>)}</div>
              </div>
            );})}</div></CardContent></Card>
          )}
          
          {viewType === 'week' && (
            <Card><CardContent className="p-4"><div className="grid grid-cols-7 gap-2">{weekDays.map((date, i) => <div key={i} className="space-y-2"><div className={`text-center p-2 rounded-lg ${isToday(date) ? 'bg-teal-500 text-white' : 'bg-slate-100 text-slate-700'}`}><div className="text-sm font-medium">{DAYS_TR[i]}</div><div className="text-lg font-bold">{date.getDate()}</div></div><div className="space-y-1 min-h-[300px]">{getEventsForDate(date).filter(e => e.status !== 'cancelled').map(e => <div key={e.id} className={`p-2 rounded-lg border ${colorMap[e.color].bg} ${colorMap[e.color].border}`}><div className="text-xs font-medium">{normalizeLessonSlot(e.time)}.Drs</div><div className="text-sm">{e.title}</div></div>)}</div></div>)}</div></CardContent></Card>
          )}
          
          {viewType === 'day' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Sol Taraf: Günlük Program (Yenilenmiş Modern Tasarım) */}
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
                          if (e.type === 'appointment' || e.type === 'guidance_plan') {
                              return normalizeLessonSlot(e.time) === periodStr;
                          }
                          return false;
                      }); 

                      return (
                        <div key={lesson} className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                          
                          {/* Saat Numarası Göstergesi */}
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 border border-slate-200 shadow-inner">
                            <span className="text-base font-black text-slate-600">{lesson}</span>
                          </div>
                          
                          {/* İçerik */}
                          <div className="flex-1 min-w-0 space-y-2">
                            {lessonEvents.length === 0 ? (
                              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2.5">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Boş</p>
                                <p className="mt-0.5 text-sm text-slate-500">Bu saat açık</p>
                              </div>
                            ) : lessonEvents.map(e => {
                              const isCompleted = e.status === 'attended' || e.status === 'completed';
                              const isApt = e.type === 'appointment';
                              
                              // Renklendirme mantığı
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
                              } else {
                                containerClass = "border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50";
                                typeText = "text-emerald-700";
                                typeLabel = "Sınıf Rehberliği";
                              }

                              return (
                                <div key={e.id} className={`relative rounded-xl border px-3 py-2.5 transition-colors ${containerClass}`}>
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <p className={`text-[11px] font-black uppercase tracking-[0.12em] ${typeText}`}>
                                          {isApt ? 'Görüşme' : 'Sınıf Rehberliği'}
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
                                      {/* Tamamlandı Butonu */}
                                      <button 
                                        onClick={() => {
                                          if (e.type === 'appointment') openAttendanceChoiceModal(e.data);
                                          else if (e.type === 'guidance_plan') toggleGuidancePlanStatus(e.id, e.status);
                                        }} 
                                        className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all ${isCompleted ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 bg-white text-slate-400 hover:border-emerald-400 hover:text-emerald-500'}`}
                                        title={isCompleted ? 'Tamamlandı' : 'Tamamla'}
                                      >
                                          {isCompleted && <CheckCircle2 className="h-5 w-5" />}
                                      </button>
                                      
                                      {/* Sil Butonu (Her ikisi için) */}
                                      <button 
                                        onClick={() => e.type === 'appointment' ? handleDeleteAppointment(e.id) : handleDeleteGuidancePlan(e.id)} 
                                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-transparent text-slate-300 hover:border-red-200 hover:bg-red-50 hover:text-red-500 transition-colors"
                                        title="Sil"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Sağ Taraf: Diğer Görevler */}
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
                                <button onClick={() => handleDeleteTask(t.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1">
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