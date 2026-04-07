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
  User,
  MapPin,
  Filter,
  RefreshCw,
  Eye,
  CalendarDays,
  CalendarCheck,
  Users,
  BookOpen,
  Activity,
  Loader2,
  MoreHorizontal,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Trash2
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Appointment, APPOINTMENT_STATUS, PARTICIPANT_TYPES, APPOINTMENT_LOCATIONS } from "@/types";
import Link from "next/link";

// Türkçe ay isimleri
const MONTHS_TR = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

// Türkçe gün isimleri
const DAYS_TR = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const DAYS_FULL_TR = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

const getLocalDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Sınıf etkinliği tipi
interface ClassActivity {
  id: string;
  class_key: string;
  class_display: string;
  activity_date: string;
  activity_time: string;
  duration: number;
  activity_type: string;
  topic: string;
  description?: string;
}

// Takvim görünüm tipi
type ViewType = 'month' | 'week' | 'day';

// Takvim öğesi tipi
interface CalendarEvent {
  id: string;
  date: string;
  time?: string;
  title: string;
  type: 'appointment' | 'activity' | 'task' | 'follow_up';
  status?: string;
  color: string;
  data: Appointment | ClassActivity | Record<string, unknown>;
}

export default function TakvimPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewType, setViewType] = useState<ViewType>('month');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  
  // Veriler
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [activities, setActivities] = useState<ClassActivity[]>([]);
  const [tasks, setTasks] = useState<Record<string, unknown>[]>([]);
  const [followUps, setFollowUps] = useState<Record<string, unknown>[]>([]);
  
  // Filtreler
  const [showAppointments, setShowAppointments] = useState(true);
  const [showActivities, setShowActivities] = useState(true);
  const [showTasks, setShowTasks] = useState(true);
  
  // Verileri yükle
  useEffect(() => {
    loadData();
  }, [currentDate]);
  
  const loadData = async () => {
    setIsLoading(true);
    try {
      // Ay başı ve sonu
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      
      // Görünüm tipine göre tarih aralığını genişlet
      const startDate = new Date(startOfMonth);
      startDate.setDate(startDate.getDate() - 7); // Önceki haftadan başla
      const endDate = new Date(endOfMonth);
      endDate.setDate(endDate.getDate() + 7); // Sonraki haftaya kadar
      
      const startStr = getLocalDateString(startDate);
      const endStr = getLocalDateString(endDate);
      
      const [appResult, actResult, taskResult, followResult] = await Promise.all([
        supabase.from('appointments')
          .select('*')
          .gte('appointment_date', startStr)
          .lte('appointment_date', endStr)
          .order('appointment_date', { ascending: true }),
        supabase.from('class_activities')
          .select('*')
          .gte('activity_date', startStr)
          .lte('activity_date', endStr)
          .order('activity_date', { ascending: true }),
        supabase.from('tasks')
          .select('*')
          .gte('due_date', startStr)
          .lte('due_date', endStr)
          .order('due_date', { ascending: true }),
        supabase.from('follow_ups')
          .select('*')
          .gte('follow_up_date', startStr)
          .lte('follow_up_date', endStr)
          .eq('status', 'pending')
          .order('follow_up_date', { ascending: true })
      ]);
      
      setAppointments(appResult.data || []);
      setActivities(actResult.data || []);
      setTasks(taskResult.data || []);
      setFollowUps(followResult.data || []);
    } catch (error) {
      console.error('Takvim verileri yüklenemedi:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Bu görevi silmek istediğinize emin misiniz?')) return;

    try {
      // Sınıf rehberliği planıyla bağlantılı mı kontrol et
      const { data: taskData } = await supabase
        .from('tasks')
        .select('related_guidance_plan_id')
        .eq('id', taskId)
        .maybeSingle();

      if (taskData?.related_guidance_plan_id) {
        await supabase
          .from('guidance_plans')
          .update({ status: 'unplanned', plan_date: null, lesson_period: null, teacher_name: null })
          .eq('id', taskData.related_guidance_plan_id);
      }

      const res = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (res.error) throw res.error;

      toast.success('Görev silindi');
      await loadData();
    } catch (error) {
      console.error('Görev silinemedi:', error);
      toast.error('Görev silinemedi');
    }
  };
  
  // Tüm etkinlikleri birleştir
  const handleDeleteAppointment = async (appointmentId: string) => {
    if (!confirm('Bu iptal edilen randevuyu silmek istediğinize emin misiniz?')) return;

    try {
      const { error } = await supabase
        .from('appointments')
        .delete()
        .eq('id', appointmentId);

      if (error) throw error;

      toast.success('Randevu silindi');
      await loadData();
    } catch (error) {
      console.error('Randevu silinemedi:', error);
      toast.error('Randevu silinemedi');
    }
  };

  const events = useMemo<CalendarEvent[]>(() => {
    const allEvents: CalendarEvent[] = [];
    
    // Randevular
    if (showAppointments) {
      appointments.forEach(app => {
        const statusColors: Record<string, string> = {
          planned: 'blue',
          attended: 'green',
          not_attended: 'red',
          postponed: 'amber',
          cancelled: 'slate'
        };
        allEvents.push({
          id: app.id,
          date: app.appointment_date,
          time: app.start_time,
          title: `${app.participant_name} (${app.participant_type === 'student' ? 'Öğrenci' : app.participant_type === 'parent' ? 'Veli' : 'Öğretmen'})`,
          type: 'appointment',
          status: app.status,
          color: statusColors[app.status] || 'blue',
          data: app
        });
      });
    }
    
    // Sınıf etkinlikleri
    if (showActivities) {
      activities.forEach(act => {
        allEvents.push({
          id: act.id,
          date: act.activity_date,
          time: act.activity_time,
          title: `${act.class_display}: ${act.topic}`,
          type: 'activity',
          color: 'purple',
          data: act
        });
      });
    }
    
    // Görevler
    if (showTasks) {
      tasks.forEach(task => {
        const priorityColors: Record<string, string> = {
          low: 'slate',
          normal: 'blue',
          high: 'orange',
          urgent: 'red'
        };
        allEvents.push({
          id: (task as { id: string }).id,
          date: (task as { due_date: string }).due_date,
          time: (task as { due_time?: string }).due_time,
          title: (task as { title: string }).title,
          type: 'task',
          status: (task as { status: string }).status,
          color: priorityColors[(task as { priority: string }).priority] || 'blue',
          data: task
        });
      });
      
      // Takip hatırlatıcıları
      followUps.forEach(fu => {
        allEvents.push({
          id: (fu as { id: string }).id,
          date: (fu as { follow_up_date: string }).follow_up_date,
          title: `Takip: ${(fu as { student_name: string }).student_name}`,
          type: 'follow_up',
          color: 'teal',
          data: fu
        });
      });
    }
    
    return allEvents;
  }, [appointments, activities, tasks, followUps, showAppointments, showActivities, showTasks]);
  
  // Belirli bir gün için etkinlikleri getir
  const shouldShowInOverview = (event: CalendarEvent) =>
    !(event.type === 'appointment' && event.status === 'cancelled');

  const getEventsForDate = (date: Date) => {
    const dateStr = getLocalDateString(date);
    return events.filter(e => e.date === dateStr);
  };
  
  // Takvim günlerini oluştur
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    // Pazartesi'den başlat
    let startDay = firstDay.getDay() - 1;
    if (startDay < 0) startDay = 6;
    
    const days: { date: Date; isCurrentMonth: boolean }[] = [];
    
    // Önceki ayın günleri
    for (let i = startDay - 1; i >= 0; i--) {
      const date = new Date(year, month, -i);
      days.push({ date, isCurrentMonth: false });
    }
    
    // Bu ayın günleri
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const date = new Date(year, month, i);
      days.push({ date, isCurrentMonth: true });
    }
    
    // Sonraki ayın günleri (6 satır tamamlamak için)
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      const date = new Date(year, month + 1, i);
      days.push({ date, isCurrentMonth: false });
    }
    
    return days;
  }, [currentDate]);
  
  // Hafta günlerini oluştur
  const weekDays = useMemo(() => {
    const start = new Date(currentDate);
    const day = start.getDay();
    const diff = day === 0 ? -6 : 1 - day; // Pazartesi'den başla
    start.setDate(start.getDate() + diff);
    
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      days.push(date);
    }
    return days;
  }, [currentDate]);
  
  // Navigasyon fonksiyonları
  const navigatePrev = () => {
    const newDate = new Date(currentDate);
    if (viewType === 'month') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else if (viewType === 'week') {
      newDate.setDate(newDate.getDate() - 7);
    } else {
      newDate.setDate(newDate.getDate() - 1);
    }
    setCurrentDate(newDate);
  };
  
  const navigateNext = () => {
    const newDate = new Date(currentDate);
    if (viewType === 'month') {
      newDate.setMonth(newDate.getMonth() + 1);
    } else if (viewType === 'week') {
      newDate.setDate(newDate.getDate() + 7);
    } else {
      newDate.setDate(newDate.getDate() + 1);
    }
    setCurrentDate(newDate);
  };
  
  const goToToday = () => {
    setCurrentDate(new Date());
  };
  
  // Bugün mü kontrol et
  const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };
  
  // Renk haritası
  const colorMap: Record<string, { bg: string; border: string; text: string; dot: string }> = {
    blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', dot: 'bg-blue-500' },
    green: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', dot: 'bg-green-500' },
    red: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', dot: 'bg-red-500' },
    amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', dot: 'bg-amber-500' },
    purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', dot: 'bg-purple-500' },
    orange: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', dot: 'bg-orange-500' },
    teal: { bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-700', dot: 'bg-teal-500' },
    slate: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-700', dot: 'bg-slate-500' }
  };
  
  // Başlık metnini oluştur
  const getHeaderText = () => {
    if (viewType === 'month') {
      return `${MONTHS_TR[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    } else if (viewType === 'week') {
      const start = weekDays[0];
      const end = weekDays[6];
      if (start.getMonth() === end.getMonth()) {
        return `${start.getDate()} - ${end.getDate()} ${MONTHS_TR[start.getMonth()]} ${start.getFullYear()}`;
      } else {
        return `${start.getDate()} ${MONTHS_TR[start.getMonth()]} - ${end.getDate()} ${MONTHS_TR[end.getMonth()]} ${start.getFullYear()}`;
      }
    } else {
      return `${currentDate.getDate()} ${MONTHS_TR[currentDate.getMonth()]} ${currentDate.getFullYear()}, ${DAYS_FULL_TR[(currentDate.getDay() + 6) % 7]}`;
    }
  };

  return (
    <div className="space-y-6">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-xl shadow-lg">
            <Calendar className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Takvim</h1>
            <p className="text-sm text-slate-500">Randevular, etkinlikler ve görevler</p>
          </div>
        </div>
        
        <Link href="/panel/randevu">
          <Button className="bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700">
            <Plus className="h-4 w-4 mr-2" />
            Yeni Randevu
          </Button>
        </Link>
      </div>
      
      {/* Kontroller */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            {/* Navigasyon */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={navigatePrev}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={goToToday}>
                Bugün
              </Button>
              <Button variant="outline" size="sm" onClick={navigateNext}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <h2 className="text-lg font-semibold text-slate-800 ml-4">
                {getHeaderText()}
              </h2>
            </div>
            
            {/* Görünüm Seçimi */}
            <div className="flex items-center gap-2">
              <div className="flex bg-slate-100 rounded-lg p-1">
                {[
                  { value: 'month', label: 'Ay', icon: CalendarDays },
                  { value: 'week', label: 'Hafta', icon: CalendarCheck },
                  { value: 'day', label: 'Gün', icon: Clock }
                ].map(view => (
                  <button
                    key={view.value}
                    onClick={() => setViewType(view.value as ViewType)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                      viewType === view.value
                        ? 'bg-white text-slate-800 shadow-sm'
                        : 'text-slate-600 hover:text-slate-800'
                    }`}
                  >
                    <view.icon className="h-4 w-4" />
                    {view.label}
                  </button>
                ))}
              </div>
              
              <Button variant="outline" size="sm" onClick={loadData}>
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
          
          {/* Filtreler */}
          <div className="flex items-center gap-4 mt-4 pt-4 border-t">
            <span className="text-sm text-slate-500">Göster:</span>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showAppointments}
                onChange={(e) => setShowAppointments(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-blue-600"
              />
              <span className="text-sm flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                Randevular
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showActivities}
                onChange={(e) => setShowActivities(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-purple-600"
              />
              <span className="text-sm flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                Etkinlikler
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showTasks}
                onChange={(e) => setShowTasks(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-teal-600"
              />
              <span className="text-sm flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-teal-500"></span>
                Görevler
              </span>
            </label>
          </div>
        </CardContent>
      </Card>
      
      {/* Takvim İçeriği */}
      {isLoading ? (
        <Card>
          <CardContent className="py-12 flex items-center justify-center">
            <Loader2 className="h-8 w-8 text-teal-500 animate-spin" />
            <span className="ml-3 text-slate-600">Takvim yükleniyor...</span>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Aylık Görünüm */}
          {viewType === 'month' && (
            <Card>
              <CardContent className="p-4">
                {/* Gün başlıkları */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {DAYS_TR.map(day => (
                    <div key={day} className="text-center text-sm font-medium text-slate-500 py-2">
                      {day}
                    </div>
                  ))}
                </div>
                
                {/* Takvim günleri */}
                <div className="grid grid-cols-7 gap-1">
                  {calendarDays.map(({ date, isCurrentMonth }, index) => {
                    const dayEvents = getEventsForDate(date);
                    const isSelected = selectedDate?.toDateString() === date.toDateString();
                    
                    return (
                      <div
                        key={index}
                        onClick={() => setSelectedDate(date)}
                        className={`min-h-[100px] p-2 rounded-lg border cursor-pointer transition-all ${
                          isCurrentMonth ? 'bg-white' : 'bg-slate-50'
                        } ${
                          isToday(date) ? 'border-teal-500 border-2' : 'border-slate-200'
                        } ${
                          isSelected ? 'ring-2 ring-teal-500 ring-offset-2' : ''
                        } hover:border-teal-300`}
                      >
                        <div className={`text-sm font-medium ${
                          isCurrentMonth ? 'text-slate-800' : 'text-slate-400'
                        } ${isToday(date) ? 'text-teal-600' : ''}`}>
                          {date.getDate()}
                        </div>
                        
                        {/* Etkinlikler */}
                        <div className="mt-1 space-y-1">
                          {dayEvents.filter(shouldShowInOverview).slice(0, 3).map(event => (
                            <div
                              key={event.id}
                              className={`text-xs px-1.5 py-0.5 rounded truncate ${colorMap[event.color].bg} ${colorMap[event.color].text}`}
                            >
                              {event.time && <span className="font-medium">{event.time.slice(0, 5)} </span>}
                              {event.title}
                            </div>
                          ))}
                          {dayEvents.filter(shouldShowInOverview).length > 3 && (
                            <div className="text-xs text-slate-500 px-1.5">
                              +{dayEvents.filter(shouldShowInOverview).length - 3} daha
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Haftalık Görünüm */}
          {viewType === 'week' && (
            <Card>
              <CardContent className="p-4">
                <div className="grid grid-cols-7 gap-2">
                  {weekDays.map((date, index) => {
                    const dayEvents = getEventsForDate(date);
                    const dayName = DAYS_TR[index];
                    
                    return (
                      <div key={index} className="space-y-2">
                        <div className={`text-center p-2 rounded-lg ${
                          isToday(date) 
                            ? 'bg-teal-500 text-white' 
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          <div className="text-sm font-medium">{dayName}</div>
                          <div className="text-lg font-bold">{date.getDate()}</div>
                        </div>
                        
                        <div className="space-y-1 min-h-[300px]">
                          {dayEvents.filter(shouldShowInOverview).map(event => (
                            <div
                              key={event.id}
                              className={`group relative p-2 rounded-lg border ${colorMap[event.color].bg} ${colorMap[event.color].border}`}
                            >
                              <div className="flex items-start justify-between gap-2 pr-6">
                                <div className="min-w-0 flex-1">
                                  {event.time && (
                                    <div className={`text-xs font-medium ${colorMap[event.color].text}`}>
                                      {event.time.slice(0, 5)}
                                    </div>
                                  )}
                                  <div className={`text-sm ${colorMap[event.color].text}`}>
                                    {event.title}
                                  </div>
                                </div>
                          {event.type === 'task' && (
                            <button
                              type="button"
                              onClick={() => handleDeleteTask(event.id)}
                              className="absolute right-1 top-1 rounded-full p-1 text-slate-300 opacity-0 transition-all hover:bg-white/80 hover:text-red-600 group-hover:opacity-100"
                              aria-label="Görevi sil"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {event.type === 'appointment' && (
                            <button
                              type="button"
                              onClick={() => handleDeleteAppointment(event.id)}
                              className="absolute right-1 top-1 rounded-full p-1 text-slate-300 opacity-0 transition-all hover:bg-white/80 hover:text-red-600 group-hover:opacity-100"
                              aria-label="Randevuyu sil"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                              {event.status && (
                                <Badge variant="outline" className="text-xs mt-1">
                                  {event.status === 'attended' ? 'Geldi' : 
                                   event.status === 'not_attended' ? 'Gelmedi' :
                                   event.status === 'planned' ? 'Planlandı' :
                                   event.status}
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Günlük Görünüm */}
          {viewType === 'day' && (
            <Card>
              <CardContent className="p-4">
                <div className="space-y-4">
                  {/* Saat çizelgesi */}
                  {Array.from({ length: 12 }, (_, i) => i + 8).map(hour => {
                    const hourStr = `${hour.toString().padStart(2, '0')}:00`;
                    const hourEvents = getEventsForDate(currentDate).filter(e => {
                      if (!e.time) return false;
                      const eventHour = parseInt(e.time.split(':')[0]);
                      return eventHour === hour;
                    });
                    
                    return (
                      <div key={hour} className="flex gap-4">
                        <div className="w-16 text-sm text-slate-500 py-2">
                          {hourStr}
                        </div>
                        <div className="flex-1 border-t border-slate-200 py-2 min-h-[60px]">
                          {hourEvents.length === 0 ? (
                            <div className="text-sm text-slate-300 italic">—</div>
                          ) : (
                            <div className="space-y-2">
                          {hourEvents.filter(shouldShowInOverview).map(event => (
                                <div
                                  key={event.id}
                                  className={`group relative p-3 rounded-lg border ${colorMap[event.color].bg} ${colorMap[event.color].border}`}
                                >
                                  <div className="flex items-start justify-between gap-2 pr-6">
                                    <div className={`font-medium ${colorMap[event.color].text}`}>
                                      {event.title}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {event.status && (
                                        <Badge variant="outline" className={colorMap[event.color].text}>
                                          {event.status === 'attended' ? 'Geldi' : 
                                           event.status === 'not_attended' ? 'Gelmedi' :
                                           event.status === 'planned' ? 'Planlandı' :
                                           event.status}
                                        </Badge>
                                      )}
                                      {event.type === 'task' && (
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteTask(event.id)}
                                          className="absolute right-2 top-2 rounded-full p-1 text-slate-300 opacity-0 transition-all hover:bg-white/80 hover:text-red-600 group-hover:opacity-100"
                                          aria-label="Görevi sil"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                      )}
                                      {event.type === 'appointment' && (
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteAppointment(event.id)}
                                          className="absolute right-2 top-2 rounded-full p-1 text-slate-300 opacity-0 transition-all hover:bg-white/80 hover:text-red-600 group-hover:opacity-100"
                                          aria-label="Randevuyu sil"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                  {event.time && (
                                    <div className="text-sm text-slate-500 mt-1">
                                      <Clock className="h-3 w-3 inline mr-1" />
                                      {event.time.slice(0, 5)}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Seçili Gün Detayları */}
          {selectedDate && viewType === 'month' && (
            <Card className="border-teal-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center justify-between">
                  <span>
                    {selectedDate.getDate()} {MONTHS_TR[selectedDate.getMonth()]} {selectedDate.getFullYear()}
                    <span className="text-slate-500 font-normal ml-2">
                      {DAYS_FULL_TR[(selectedDate.getDay() + 6) % 7]}
                    </span>
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedDate(null)}>
                    Kapat
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {getEventsForDate(selectedDate).length === 0 ? (
                  <p className="text-slate-500 text-center py-4">Bu gün için kayıt yok</p>
                ) : (
                  <div className="space-y-3">
                    {getEventsForDate(selectedDate).map(event => (
                      <div
                        key={event.id}
                        className={`group relative p-4 rounded-xl border-2 ${colorMap[event.color].bg} ${colorMap[event.color].border}`}
                      >
                        <div className="flex items-start justify-between gap-3 pr-8">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className={`w-3 h-3 rounded-full ${colorMap[event.color].dot}`}></span>
                              <span className={`font-medium ${colorMap[event.color].text}`}>
                                {event.type === 'appointment' ? 'Randevu' :
                                 event.type === 'activity' ? 'Etkinlik' :
                                 event.type === 'task' ? 'Görev' : 'Takip'}
                              </span>
                            </div>
                            <h4 className="text-lg font-semibold text-slate-800 mt-1">
                              {event.title}
                            </h4>
                            {event.time && (
                              <p className="text-slate-600 flex items-center gap-1 mt-1">
                                <Clock className="h-4 w-4" />
                                {event.time.slice(0, 5)}
                              </p>
                            )}
                          </div>
                          {event.type === 'task' && (
                            <button
                              type="button"
                              onClick={() => handleDeleteTask(event.id)}
                              className="absolute right-3 top-3 rounded-full p-1 text-slate-300 opacity-0 transition-all hover:bg-white/80 hover:text-red-600 group-hover:opacity-100"
                              aria-label="Görevi sil"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                          {event.type === 'appointment' && (
                            <button
                              type="button"
                              onClick={() => handleDeleteAppointment(event.id)}
                              className="absolute right-3 top-3 z-10 rounded-full border border-red-200 bg-white/90 p-1.5 text-slate-400 shadow-sm transition-all hover:bg-red-50 hover:text-red-600"
                              aria-label="Randevuyu sil"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                          {event.status && (
                            <Badge className={`${colorMap[event.color].bg} ${colorMap[event.color].text} border ${colorMap[event.color].border}`}>
                              {event.status === 'attended' ? '✓ Geldi' : 
                               event.status === 'not_attended' ? '✗ Gelmedi' :
                               event.status === 'planned' ? '◉ Planlandı' :
                               event.status === 'postponed' ? '↻ Ertelendi' :
                               event.status === 'cancelled' ? '✗ İptal' :
                               event.status}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
      
      {/* İstatistik Özeti */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="p-3 bg-blue-100 rounded-xl w-12 h-12 mx-auto mb-2 flex items-center justify-center">
              <CalendarCheck className="h-6 w-6 text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-slate-800">{appointments.length}</p>
            <p className="text-sm text-slate-500">Randevu</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="p-3 bg-purple-100 rounded-xl w-12 h-12 mx-auto mb-2 flex items-center justify-center">
              <BookOpen className="h-6 w-6 text-purple-600" />
            </div>
            <p className="text-2xl font-bold text-slate-800">{activities.length}</p>
            <p className="text-sm text-slate-500">Etkinlik</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="p-3 bg-teal-100 rounded-xl w-12 h-12 mx-auto mb-2 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-teal-600" />
            </div>
            <p className="text-2xl font-bold text-slate-800">{tasks.length}</p>
            <p className="text-sm text-slate-500">Görev</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="p-3 bg-amber-100 rounded-xl w-12 h-12 mx-auto mb-2 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-amber-600" />
            </div>
            <p className="text-2xl font-bold text-slate-800">{followUps.length}</p>
            <p className="text-sm text-slate-500">Takip</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

