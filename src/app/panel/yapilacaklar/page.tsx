"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  CheckSquare,
  Plus,
  Calendar,
  Clock,
  Flag,
  Trash2,
  Edit2,
  CheckCircle2,
  Circle,
  MoreHorizontal,
  Filter,
  Target,
  AlertCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  User,
  Loader2,
  Star,
  Sparkles,
  ListTodo,
  CalendarCheck
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { normalizeLessonSlot } from "@/lib/lessonSlots";
import { Appointment, AppointmentStatus } from "@/types";

// Görev tipi
interface Task {
  id: string;
  created_at: string;
  updated_at: string;
  title: string;
  description?: string;
  category: string;
  priority: string;
  status: string;
  due_date?: string;
  due_time?: string;
  completed_at?: string;
  related_student_name?: string;
  related_appointment_id?: string;
  related_guidance_plan_id?: string;
}

// Kategori seçenekleri
const CATEGORIES = [
  { value: 'genel', label: 'Genel', color: 'slate', icon: '📋' },
  { value: 'randevu', label: 'Randevu', color: 'blue', icon: '📅' },
  { value: 'toplanti', label: 'Toplantı', color: 'purple', icon: '🗓️' },
  { value: 'veli', label: 'Veli', color: 'teal', icon: '👨‍👩‍👧' },
  { value: 'ogretmen', label: 'Öğretmen', color: 'amber', icon: '👨‍🏫' },
  { value: 'okul-ziyareti', label: 'Okul Ziyareti', color: 'emerald', icon: '🏫' },
  { value: 'kurum-ziyareti', label: 'Kurum Ziyareti', color: 'cyan', icon: '🏢' },
  { value: 'meslek-tanitimi', label: 'Meslek Tanıtımı', color: 'rose', icon: '💼' },
  { value: 'rapor', label: 'Rapor', color: 'purple', icon: '📊' },
  { value: 'diger', label: 'Diğer', color: 'gray', icon: '📌' }
];

// Öncelik seçenekleri
const PRIORITIES = [
  { value: 'low', label: 'Düşük', color: 'slate', icon: Flag },
  { value: 'normal', label: 'Normal', color: 'blue', icon: Flag },
  { value: 'high', label: 'Yüksek', color: 'orange', icon: Flag },
  { value: 'urgent', label: 'Acil', color: 'red', icon: AlertCircle }
];

// Filtre tipi kaldırıldı — artık gün bazlı filtreleme var

const getLocalDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function YapilacaklarPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(getLocalDateString(new Date()));

  // Program verileri
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [guidancePlans, setGuidancePlans] = useState<{id: string; class_display: string; lesson_period: number; teacher_name?: string | null}[]>([]);

  const loadSchedule = async (date: string) => {
    const [aptRes, planRes] = await Promise.all([
      supabase.from('appointments').select('*').eq('appointment_date', date).neq('status', 'cancelled'),
      supabase.from('guidance_plans').select('id, class_display, lesson_period, teacher_name').eq('plan_date', date).eq('status', 'planned')
    ]);
    setAppointments(aptRes.data || []);
    setGuidancePlans(planRes.data || []);
  };

  useEffect(() => { loadSchedule(selectedDate); }, [selectedDate]);
  
  // Yeni görev formu
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    category: 'genel',
    priority: 'normal',
    due_date: '',
    due_time: '',
    related_student_name: ''
  });

  const openTaskForm = (task?: Task) => {
    if (task) {
      setEditingTask(task);
      setNewTask({
        title: task.title || '',
        description: task.description || '',
        category: task.category || 'genel',
        priority: task.priority || 'normal',
        due_date: task.due_date || selectedDate,
        due_time: task.due_time || '',
        related_student_name: task.related_student_name || ''
      });
    } else {
      setEditingTask(null);
      setNewTask((prev) => ({
        ...prev,
        due_date: prev.due_date || selectedDate
      }));
    }
    setShowForm(true);
  };

  const closeTaskForm = () => {
    setShowForm(false);
    setEditingTask(null);
    setNewTask({
      title: '',
      description: '',
      category: 'genel',
      priority: 'normal',
      due_date: '',
      due_time: '',
      related_student_name: ''
    });
  };
  
  // Görevleri yükle
  useEffect(() => {
    loadTasks();
  }, []);
  
  const loadTasks = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error('Görevler yüklenemedi:', error);
      toast.error('Görevler yüklenirken hata oluştu');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Görev ekle
  const handleAddTask = async () => {
    if (!newTask.title.trim()) {
      toast.error('Görev başlığı gerekli');
      return;
    }
    
    try {
      const dueDate = newTask.due_date || selectedDate;
      const taskData = {
        ...newTask,
        status: 'pending',
        due_date: dueDate,
        due_time: newTask.due_time || null
      };

      if (editingTask) {
        const { error } = await supabase
          .from('tasks')
          .update({
            ...taskData,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingTask.id);

        if (error) throw error;
        toast.success('Görev güncellendi');
      } else {
        const { error } = await supabase.from('tasks').insert(taskData);
        if (error) throw error;
        toast.success('Görev eklendi');
      }

      closeTaskForm();
      loadTasks();
    } catch (error) {
      console.error('Görev eklenemedi:', error);
      toast.error(editingTask ? 'Görev güncellenirken hata oluştu' : 'Görev eklenirken hata oluştu');
    }
  };
  
  // Görev durumunu değiştir
  const toggleTaskStatus = async (task: Task) => {
    try {
      const newStatus = task.status === 'completed' ? 'pending' : 'completed';
      const updates: Partial<Task> = {
        status: newStatus,
        updated_at: new Date().toISOString()
      };
      
      if (newStatus === 'completed') {
        updates.completed_at = new Date().toISOString();
      } else {
        updates.completed_at = undefined;
      }
      
      const { error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', task.id);
      
      if (error) throw error;

      // Sınıf rehberliği planıyla bağlantılı mı?
      console.log('related_guidance_plan_id:', task.related_guidance_plan_id);
      if (task.related_guidance_plan_id) {
        if (newStatus === 'completed') {
          const { error: planError } = await supabase
            .from('guidance_plans')
            .update({ status: 'completed', completed_at: new Date().toISOString() })
            .eq('id', task.related_guidance_plan_id);
          console.log('plan update error:', planError);
        } else {
          const { error: planError } = await supabase
            .from('guidance_plans')
            .update({ status: 'planned', completed_at: null })
            .eq('id', task.related_guidance_plan_id);
          console.log('plan update error:', planError);
        }
      }
      
      toast.success(newStatus === 'completed' ? 'Görev tamamlandı!' : 'Görev yeniden açıldı');
      loadTasks();
    } catch (error) {
      console.error('Durum değiştirilemedi:', error);
      toast.error('Durum değiştirilirken hata oluştu');
    }
  };

  const toggleAppointmentStatus = async (appointment: Appointment) => {
    try {
      const nextStatus: AppointmentStatus = appointment.status === 'attended' ? 'planned' : 'attended';
      const { error } = await supabase
        .from('appointments')
        .update({
          status: nextStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', appointment.id);

      if (error) throw error;

      toast.success(nextStatus === 'attended' ? 'Randevu geldi olarak işaretlendi' : 'Randevu tekrar planlandı');
      await loadSchedule(selectedDate);
    } catch (error) {
      console.error('Randevu durumu değiştirilemedi:', error);
      toast.error('Randevu durumu değiştirilirken hata oluştu');
    }
  };
  
  // Görev sil
  const deleteTask = async (task: Task) => {
    if (!confirm('Bu görevi silmek istediğinize emin misiniz?')) return;
    
    try {
      // Bağlantılı plan varsa unplanned'a döndür
      if (task.related_guidance_plan_id) {
        await supabase
          .from('guidance_plans')
          .update({ status: 'unplanned', plan_date: null, lesson_period: null, teacher_name: null })
          .eq('id', task.related_guidance_plan_id);
      }

      const { error } = await supabase.from('tasks').delete().eq('id', task.id);
      if (error) throw error;
      
      toast.success('Görev silindi');
      loadTasks();
    } catch (error) {
      console.error('Görev silinemedi:', error);
      toast.error('Görev silinirken hata oluştu');
    }
  };
  
  const selectedDayTasks = useMemo(
    () => tasks.filter(task => task.due_date === selectedDate),
    [tasks, selectedDate]
  );

  const guidanceTasks = useMemo(
    () => selectedDayTasks.filter(task => !!task.related_guidance_plan_id),
    [selectedDayTasks]
  );

  const otherTasks = useMemo(
    () => selectedDayTasks.filter(task => !task.related_guidance_plan_id),
    [selectedDayTasks]
  );
  
  // Renk haritası
  const colorMap: Record<string, { bg: string; text: string; border: string }> = {
  slate: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' },
  blue: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
  teal: { bg: 'bg-teal-100', text: 'text-teal-700', border: 'border-teal-200' },
  amber: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
  purple: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200' },
  orange: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' },
  red: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' },
  gray: { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-200' },
  green: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200' }
};
  
  // Tarih formatla
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const dateOnly = dateStr.split('T')[0];
    const todayOnly = getLocalDateString(today);
    const tomorrowOnly = getLocalDateString(tomorrow);
    
    if (dateOnly === todayOnly) return 'Bugün';
    if (dateOnly === tomorrowOnly) return 'Yarın';
    
    return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  };
  
  // Gecikmiş mi kontrol et
  const isOverdue = (task: Task) => {
    if (!task.due_date || task.status === 'completed') return false;
    return task.due_date < getLocalDateString(new Date());
  };

  return (
    <div className="space-y-6">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-lg">
            <CheckSquare className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Yapılacaklar</h1>
            <p className="text-sm text-slate-500">Günlük görevlerinizi takip edin</p>
          </div>
        </div>
        
        <Button 
          onClick={() => openTaskForm()}
          className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Yeni Görev
        </Button>
      </div>
      
      {/* Gün Seçici */}
      {(() => {
        const DAYS_TR = ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'];
        const MONTHS_TR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
        const today = getLocalDateString(new Date());
        const d = new Date(selectedDate + 'T00:00:00');
        const label = selectedDate === today
          ? 'Bugün'
          : `${d.getDate()} ${MONTHS_TR[d.getMonth()]} ${DAYS_TR[d.getDay()]}`;

        const goDay = (offset: number) => {
          const next = new Date(selectedDate + 'T00:00:00');
          next.setDate(next.getDate() + offset);
          setSelectedDate(getLocalDateString(next));
        };

        const dayCount = tasks.filter(t => t.due_date === selectedDate).length;
        const doneCount = tasks.filter(t => t.due_date === selectedDate && t.status === 'completed').length;

        return (
          <div className="flex items-center gap-4 bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4">
            <button
              onClick={() => goDay(-1)}
              className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-all"
            >
              <ChevronDown className="h-5 w-5 rotate-90" />
            </button>

            <div className="flex-1 text-center">
              <p className="text-xl font-bold text-slate-800">{label}</p>
              {selectedDate !== today && (
                <button
                  onClick={() => setSelectedDate(today)}
                  className="text-xs text-emerald-600 font-medium hover:underline mt-0.5"
                >
                  Bugüne dön
                </button>
              )}
              {dayCount > 0 && (
                <p className="text-xs text-slate-400 mt-0.5">{doneCount}/{dayCount} tamamlandı</p>
              )}
            </div>

            <button
              onClick={() => goDay(1)}
              className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-all"
            >
              <ChevronDown className="h-5 w-5 -rotate-90" />
            </button>
          </div>
        );
      })()}
      
      {/* Ana İçerik: Sol = Program, Sağ = Görevler */}
      <div className="flex flex-col xl:flex-row gap-5 items-start">

        {/* SOL — 7 Saatlik Program */}
        <div className="w-full xl:w-[36rem] xl:min-w-[36rem] xl:shrink-0 xl:sticky xl:top-6 bg-white rounded-3xl border border-slate-200 shadow-lg shadow-slate-200/60 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-emerald-50/70">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-slate-700">Günlük Program</p>
                <p className="text-xs text-slate-500">1–7 ders satırı</p>
              </div>
              <div className="h-10 w-10 rounded-2xl bg-white/80 border border-slate-200 flex items-center justify-center shadow-sm shrink-0">
                <CalendarCheck className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
          </div>
          <div className="p-3 space-y-2.5 bg-gradient-to-b from-white to-slate-50/70">
            {[1,2,3,4,5,6,7].map(period => {
              const apt = appointments.find(a => normalizeLessonSlot(a.start_time) === String(period));
              const plan = guidancePlans.find(p => p.lesson_period === period);
              return (
                <div
                  key={period}
                  className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 border border-slate-200">
                    <span className="text-sm font-black text-slate-600">{period}</span>
                  </div>
                  {apt ? (
                    <div className="flex-1 min-w-0 rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 to-cyan-50 px-3 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] font-black uppercase tracking-[0.12em] text-blue-700">Görüşme</p>
                        <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-blue-600 border border-blue-100">
                          Randevu
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-semibold text-blue-900 truncate">{apt.participant_name || '—'}</p>
                      {apt.participant_type && (
                        <p className="mt-0.5 text-[11px] text-blue-700/80 capitalize">{apt.participant_type}</p>
                      )}
                    </div>
                  ) : plan ? (
                    <div className="flex-1 min-w-0 rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 px-3 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] font-black uppercase tracking-[0.12em] text-emerald-700">Sınıf Rehberliği</p>
                        <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 border border-emerald-100">
                          Plan
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-semibold text-emerald-900">{plan.class_display}</p>
                    </div>
                  ) : (
                    <div className="flex-1 min-w-0 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2.5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Boş</p>
                      <p className="mt-1 text-sm text-slate-500">Bu saat açık</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* SAĞ — Görev Listesi */}
        <div className="flex-1 min-w-0 space-y-4 xl:pt-0">
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="pb-3 bg-gradient-to-r from-blue-50 to-cyan-50 border-b border-slate-100">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-600" />
              Randevular
            </CardTitle>
            <Badge className="bg-blue-100 text-blue-700 border-0">{appointments.length}</Badge>
          </div>
          <p className="text-sm text-slate-500">Buradan gelen öğrenciyi yuvarlak işaretle tamamla.</p>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          {appointments.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              Bu güne ait randevu yok
            </div>
          ) : (
            appointments
              .slice()
              .sort((a, b) => (normalizeLessonSlot(a.start_time) || '').localeCompare(normalizeLessonSlot(b.start_time) || ''))
              .map((appointment) => {
                const attended = appointment.status === 'attended';
                return (
                  <div
                    key={appointment.id}
                    className={`group relative rounded-2xl border bg-white p-4 shadow-sm transition-all hover:shadow-md ${
                      attended ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-start gap-3 pr-10">
                      <button
                        type="button"
                        onClick={() => void toggleAppointmentStatus(appointment)}
                        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                          attended
                            ? 'border-emerald-500 bg-emerald-500 text-white'
                            : 'border-slate-300 bg-white text-slate-400 hover:border-emerald-400 hover:text-emerald-500'
                        }`}
                        aria-label={attended ? 'Geldi olarak işaretli' : 'Geldi olarak işaretle'}
                        title={attended ? 'Geldi' : 'Geldi olarak işaretle'}
                      >
                        {attended && <CheckCircle2 className="h-4 w-4" />}
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                            {appointment.start_time}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {appointment.participant_type === 'student' ? 'Öğrenci' : appointment.participant_type === 'parent' ? 'Veli' : 'Öğretmen'}
                          </Badge>
                          <span className={`text-xs font-medium ${attended ? 'text-emerald-700' : 'text-slate-500'}`}>
                            {attended ? 'Geldi' : 'Planlandı'}
                          </span>
                        </div>
                        <div className="mt-1 text-sm font-semibold text-slate-800 truncate">
                          {appointment.participant_name}
                        </div>
                        {appointment.participant_class && (
                          <div className="mt-0.5 text-xs text-slate-500">
                            {appointment.participant_class}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
          )}
        </CardContent>
      </Card>

      {/* Görev Ekleme Formu */}
      {false && (
        <Card className="border-2 border-green-200 bg-green-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Plus className="h-5 w-5 text-green-600" />
              Yeni Görev Ekle
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Input
                placeholder="Görev başlığı..."
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                className="text-lg"
              />
            </div>
            
            <div>
              <textarea
                placeholder="Açıklama (opsiyonel)..."
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                rows={2}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
              />
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm text-slate-600 mb-1 block">Kategori</label>
                <select
                  value={newTask.category}
                  onChange={(e) => setNewTask({ ...newTask, category: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.icon} {cat.label}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="text-sm text-slate-600 mb-1 block">Öncelik</label>
                <select
                  value={newTask.priority}
                  onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                >
                  {PRIORITIES.map(pri => (
                    <option key={pri.value} value={pri.value}>{pri.label}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="text-sm text-slate-600 mb-1 block">Tarih</label>
                <Input
                  type="date"
                  value={newTask.due_date}
                  onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                />
              </div>
              
              <div>
                <label className="text-sm text-slate-600 mb-1 block">Saat</label>
                <Input
                  type="time"
                  value={newTask.due_time}
                  onChange={(e) => setNewTask({ ...newTask, due_time: e.target.value })}
                />
              </div>
            </div>
            
            <div>
              <label className="text-sm text-slate-600 mb-1 block">İlgili Öğrenci (opsiyonel)</label>
              <Input
                placeholder="Öğrenci adı..."
                value={newTask.related_student_name}
                onChange={(e) => setNewTask({ ...newTask, related_student_name: e.target.value })}
              />
            </div>
            
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowForm(false)}>
                İptal
              </Button>
              <Button onClick={handleAddTask} className="bg-green-600 hover:bg-green-700">
                <Plus className="h-4 w-4 mr-1" />
                Ekle
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      

      {/* Görev Ekleme Modalı */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm">
          <div className="absolute inset-0" onClick={closeTaskForm} aria-hidden="true" />
          <Card className="relative z-10 w-full max-w-2xl border border-slate-200 shadow-2xl shadow-slate-900/20">
            <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-green-50 via-white to-emerald-50 pb-3">
              <div className="flex items-start justify-between gap-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Plus className="h-5 w-5 text-green-600" />
                  {editingTask ? 'Görev Düzenle' : 'Yeni Görev Ekle'}
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={closeTaskForm} className="text-slate-500 hover:text-slate-900">
                  <XCircle className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-sm text-slate-500">
                {editingTask
                  ? 'Mevcut görevi güncelle.'
                  : 'Varsayılan tarih seçili gün olarak geldi. İstersen değiştirebilirsin.'}
              </p>
            </CardHeader>
            <CardContent className="space-y-4 p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <Input
                    placeholder="Görev başlığı..."
                    value={newTask.title}
                    onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                    className="h-12 text-base"
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
                  <label className="mb-1.5 block text-sm font-medium text-slate-600">Kategori</label>
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
                  <label className="mb-1.5 block text-sm font-medium text-slate-600">Öncelik</label>
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
                  <label className="mb-1.5 block text-sm font-medium text-slate-600">Tarih</label>
                  <Input
                    type="date"
                    value={newTask.due_date}
                    onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                    className="h-11"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-600">Saat</label>
                  <Input
                    type="time"
                    value={newTask.due_time}
                    onChange={(e) => setNewTask({ ...newTask, due_time: e.target.value })}
                    className="h-11"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-slate-600">İlgili Öğrenci (opsiyonel)</label>
                  <Input
                    placeholder="Öğrenci adı..."
                    value={newTask.related_student_name}
                    onChange={(e) => setNewTask({ ...newTask, related_student_name: e.target.value })}
                    className="h-11"
                  />
                </div>
              </div>
              <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
                <Button variant="outline" onClick={closeTaskForm} className="h-10 rounded-xl px-5">
                  İptal
                </Button>
                <Button onClick={handleAddTask} className="h-10 rounded-xl bg-green-600 px-5 hover:bg-green-700">
                  <Plus className="mr-2 h-4 w-4" />
                  {editingTask ? 'Güncelle' : 'Ekle'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="space-y-4">
        {guidanceTasks.length > 0 && (
        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <CardHeader className="pb-3 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-slate-100">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-emerald-600" />
                Sınıf Rehberliği
              </CardTitle>
              <Badge className="bg-emerald-100 text-emerald-700 border-0">{guidanceTasks.length}</Badge>
            </div>
            <p className="text-sm text-slate-500">Seçili güne ait sınıf rehberliği görevleri.</p>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {isLoading ? (
              <div className="py-8 flex items-center justify-center">
                <Loader2 className="h-7 w-7 text-emerald-500 animate-spin" />
              </div>
            ) : (
              guidanceTasks.map((task) => {
                const category = CATEGORIES.find(c => c.value === task.category);
                const priority = PRIORITIES.find(p => p.value === task.priority);
                const overdue = isOverdue(task);
                const linkedPlan = task.related_guidance_plan_id
                  ? guidancePlans.find(plan => plan.id === task.related_guidance_plan_id)
                  : null;
                const teacherName = linkedPlan?.teacher_name?.trim();
                return (
                  <Card
                    key={task.id}
                    className={`group relative hover:shadow-md transition-all ${
                      task.status === 'completed' ? 'bg-slate-50 opacity-75' : ''
                    } ${overdue ? 'border-red-300 bg-red-50/50' : ''}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4 pr-10">
                        <button
                          onClick={() => toggleTaskStatus(task)}
                          className={`mt-1 flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                            task.status === 'completed'
                              ? 'bg-green-500 border-green-500 text-white'
                              : 'border-slate-300 hover:border-green-500'
                          }`}
                        >
                          {task.status === 'completed' && <CheckCircle2 className="h-4 w-4" />}
                        </button>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className={`font-medium ${task.status === 'completed' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                              {task.title}
                            </h3>
                            {category && (
                              <Badge variant="outline" className={`text-xs ${colorMap[category.color].bg} ${colorMap[category.color].text}`}>
                                {category.icon} {category.value === 'ogretmen' && teacherName ? teacherName : category.label}
                              </Badge>
                            )}
                            {priority && priority.value !== 'normal' && (
                              <Badge variant="outline" className={`text-xs ${colorMap[priority.color].bg} ${colorMap[priority.color].text}`}>
                                <priority.icon className="h-3 w-3 mr-1" />
                                {priority.label}
                              </Badge>
                            )}
                            {overdue && (
                              <Badge variant="destructive" className="text-xs">Gecikmiş</Badge>
                            )}
                          </div>
                          {task.description && (
                            <p className="text-sm text-slate-500 mt-1">{task.description}</p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                            {task.due_date && (
                              <span className={`flex items-center gap-1 ${overdue ? 'text-red-500' : ''}`}>
                                <Calendar className="h-3 w-3" />
                                {formatDate(task.due_date)}
                                {task.due_time && ` ${task.due_time.slice(0, 5)}`}
                              </span>
                            )}
                            {task.related_student_name && (
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {task.related_student_name}
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => deleteTask(task)}
                          className="absolute right-3 top-3 rounded-full p-2 text-slate-300 opacity-0 transition-all hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                          aria-label="Görevi sil"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </CardContent>
        </Card>
        )}

        {otherTasks.length > 0 && (
          <Card className="border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="pb-3 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-slate-100">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <ListTodo className="h-5 w-5 text-amber-600" />
                  Diğer Görevler
                </CardTitle>
                <Badge className="bg-amber-100 text-amber-700 border-0">{otherTasks.length}</Badge>
              </div>
              <p className="text-sm text-slate-500">Randevu ve sınıf rehberliği dışındaki görevler.</p>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {isLoading ? (
                <div className="py-8 flex items-center justify-center">
                  <Loader2 className="h-7 w-7 text-amber-500 animate-spin" />
                </div>
              ) : (
                otherTasks.map((task) => {
                  const category = CATEGORIES.find(c => c.value === task.category);
                  const priority = PRIORITIES.find(p => p.value === task.priority);
                  const overdue = isOverdue(task);
                  return (
                    <Card
                      key={task.id}
                      className={`group relative hover:shadow-md transition-all ${
                        task.status === 'completed' ? 'bg-slate-50 opacity-75' : ''
                      } ${overdue ? 'border-red-300 bg-red-50/50' : ''}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4 pr-10">
                          <button
                            onClick={() => toggleTaskStatus(task)}
                            className={`mt-1 flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                              task.status === 'completed'
                                ? 'bg-green-500 border-green-500 text-white'
                                : 'border-slate-300 hover:border-green-500'
                            }`}
                          >
                            {task.status === 'completed' && <CheckCircle2 className="h-4 w-4" />}
                          </button>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className={`font-medium ${task.status === 'completed' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                                {task.title}
                              </h3>
                              {category && (
                                <Badge variant="outline" className={`text-xs ${colorMap[category.color].bg} ${colorMap[category.color].text}`}>
                                  {category.icon} {category.label}
                                </Badge>
                              )}
                              {priority && priority.value !== 'normal' && (
                                <Badge variant="outline" className={`text-xs ${colorMap[priority.color].bg} ${colorMap[priority.color].text}`}>
                                  <priority.icon className="h-3 w-3 mr-1" />
                                  {priority.label}
                                </Badge>
                              )}
                              {overdue && (
                                <Badge variant="destructive" className="text-xs">Gecikmiş</Badge>
                              )}
                            </div>
                            {task.description && (
                              <p className="text-sm text-slate-500 mt-1">{task.description}</p>
                            )}
                            <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                              {task.due_date && (
                                <span className={`flex items-center gap-1 ${overdue ? 'text-red-500' : ''}`}>
                                  <Calendar className="h-3 w-3" />
                                  {formatDate(task.due_date)}
                                  {task.due_time && ` ${task.due_time.slice(0, 5)}`}
                                </span>
                              )}
                              {task.related_student_name && (
                                <span className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {task.related_student_name}
                                </span>
                              )}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => openTaskForm(task)}
                            className="absolute right-12 top-3 rounded-full p-2 text-slate-300 opacity-0 transition-all hover:bg-blue-50 hover:text-blue-600 group-hover:opacity-100"
                            aria-label="Görevi düzenle"
                            title="Düzenle"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => deleteTask(task)}
                            className="absolute right-3 top-3 rounded-full p-2 text-slate-300 opacity-0 transition-all hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                            aria-label="Görevi sil"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </CardContent>
          </Card>
        )}
      </div>

        </div> {/* sağ kolon sonu */}
      </div> {/* flex wrapper sonu */}
    </div>
  );
}


