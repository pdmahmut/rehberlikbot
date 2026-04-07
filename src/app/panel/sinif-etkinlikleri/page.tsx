"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Users,
  Plus,
  Search,
  Calendar,
  Clock,
  Edit,
  Trash2,
  RefreshCw,
  Loader2,
  Eye,
  FileText,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Target,
  Book,
  Heart,
  MessageSquare,
  Brain,
  Shield,
  Sparkles,
  Download,
  Filter
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { normalizeLessonSlot } from "@/lib/lessonSlots";

// Dolu saatleri kontrol etmek için hook
function useBusySlots() {
  const [busySlots, setBusySlots] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const fetchBusySlots = useCallback(async (date: string, options?: { excludeActivityId?: string }) => {
    try {
      setLoading(true);
      const allBusySlots = new Set<string>();
      
      // Randevuları getir
      const appointmentRes = await fetch(`/api/appointments?date=${date}`, {
        headers: { Accept: "application/json" }
      });
      
      if (appointmentRes.ok) {
        const appointmentData = await appointmentRes.json();
        appointmentData.appointments?.forEach((apt: any) => {
          if (apt.status !== 'cancelled') {
            const normalizedTime = normalizeLessonSlot(apt.start_time);
            if (normalizedTime) {
            allBusySlots.add(normalizedTime);
            }
          }
        });
      }

      // Sınıf rehberliği planlarını getir
      try {
        const { data: plans, error } = await supabase
          .from("guidance_plans")
          .select("id, lesson_period")
          .eq("plan_date", date)
          .eq("status", "planned");

        if (!error && plans) {
          plans.forEach((plan: any) => {
            if (plan.id !== options?.excludeActivityId) {
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

      // Sınıf etkinliklerini getir
      try {
        const { data: activities, error } = await supabase
          .from("class_activities")
          .select("id, activity_time")
          .eq("activity_date", date);

        if (!error && activities) {
          activities.forEach(activity => {
            if (activity.id !== options?.excludeActivityId) {
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

// Sınıf etkinliği tipi
interface ClassActivity {
  id: string;
  created_at: string;
  updated_at: string;
  class_key: string;
  class_display: string;
  activity_date: string;
  activity_time: string;
  activity_type: string;
  title: string;
  description: string;
  objectives: string[];
  materials: string[];
  duration_minutes: number;
  participants_count: number;
  observations: string;
  evaluation: string;
  next_steps: string;
  attachments: string[];
  status: string;
}

// Etkinlik tipleri
const ACTIVITY_TYPES = [
  { value: 'tanitim', label: 'Rehberlik Tanıtımı', icon: MessageSquare, color: 'blue', description: 'PDR hizmetleri tanıtımı' },
  { value: 'benlik', label: 'Benlik Gelişimi', icon: Heart, color: 'pink', description: 'Öz saygı, özgüven çalışmaları' },
  { value: 'kariyer', label: 'Kariyer/Meslek', icon: Target, color: 'purple', description: 'Meslek tanıtımı, kariyer planlama' },
  { value: 'akademik', label: 'Akademik Gelişim', icon: Book, color: 'green', description: 'Ders çalışma, sınav kaygısı' },
  { value: 'sosyal', label: 'Sosyal Beceriler', icon: Users, color: 'cyan', description: 'İletişim, empati, işbirliği' },
  { value: 'duygusal', label: 'Duygusal Farkındalık', icon: Brain, color: 'amber', description: 'Duygu tanıma ve yönetimi' },
  { value: 'guvenlik', label: 'Güvenlik/Koruma', icon: Shield, color: 'red', description: 'Özel eğitim, akran zorbalığı' },
  { value: 'deger', label: 'Değerler Eğitimi', icon: Sparkles, color: 'indigo', description: 'Evrensel değerler, ahlak' },
  { value: 'diger', label: 'Diğer', icon: FileText, color: 'slate', description: 'Diğer etkinlikler' }
];

// Durum seçenekleri
const STATUS_OPTIONS = [
  { value: 'planned', label: 'Planlandı', color: 'slate' },
  { value: 'in-progress', label: 'Devam Ediyor', color: 'blue' },
  { value: 'completed', label: 'Tamamlandı', color: 'green' },
  { value: 'cancelled', label: 'İptal', color: 'red' }
];

// Sınıf listesi (örnek)
const CLASS_LIST = [
  '1-A', '1-B', '1-C',
  '2-A', '2-B', '2-C',
  '3-A', '3-B', '3-C',
  '4-A', '4-B', '4-C'
];

export default function SinifEtkinlikleriPage() {
  const [activities, setActivities] = useState<ClassActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingActivity, setEditingActivity] = useState<ClassActivity | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [classFilter, setClassFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  const { busySlots, loading: busyLoading, fetchBusySlots } = useBusySlots();
  
  // Form verileri
  const [formData, setFormData] = useState({
    class_key: '',
    class_display: '',
    activity_date: new Date().toISOString().split('T')[0],
    activity_time: '',
    activity_type: '',
    title: '',
    description: '',
    objectives: [''],
    materials: [''],
    duration_minutes: 40,
    participants_count: 0,
    observations: '',
    evaluation: '',
    next_steps: '',
    attachments: [] as string[],
    status: 'planned'
  });
  
  // Verileri yükle
  useEffect(() => {
    loadActivities();
  }, []);
  
  // Dolu saatleri getir
  useEffect(() => {
    if (formData.activity_date) {
      fetchBusySlots(formData.activity_date, { excludeActivityId: editingActivity?.id });
    }
  }, [formData.activity_date, editingActivity?.id, fetchBusySlots]);
  
  const loadActivities = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('class_activities')
        .select('*')
        .order('activity_date', { ascending: false });
      
      if (error) throw error;
      setActivities(data || []);
    } catch (error) {
      console.error('Sınıf etkinlikleri yüklenemedi:', error);
      toast.error('Veriler yüklenirken hata oluştu');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Hedef ekle/kaldır
  const handleObjectiveChange = (index: number, value: string) => {
    const newObjectives = [...formData.objectives];
    newObjectives[index] = value;
    setFormData({ ...formData, objectives: newObjectives });
  };
  
  const addObjective = () => {
    setFormData({ ...formData, objectives: [...formData.objectives, ''] });
  };
  
  const removeObjective = (index: number) => {
    const newObjectives = formData.objectives.filter((_, i) => i !== index);
    setFormData({ ...formData, objectives: newObjectives.length ? newObjectives : [''] });
  };
  
  // Materyal ekle/kaldır
  const handleMaterialChange = (index: number, value: string) => {
    const newMaterials = [...formData.materials];
    newMaterials[index] = value;
    setFormData({ ...formData, materials: newMaterials });
  };
  
  const addMaterial = () => {
    setFormData({ ...formData, materials: [...formData.materials, ''] });
  };
  
  const removeMaterial = (index: number) => {
    const newMaterials = formData.materials.filter((_, i) => i !== index);
    setFormData({ ...formData, materials: newMaterials.length ? newMaterials : [''] });
  };
  
  // Kaydet
  const handleSave = async () => {
    if (!formData.class_display) {
      toast.error('Sınıf seçin');
      return;
    }
    if (!formData.title.trim()) {
      toast.error('Etkinlik adı gerekli');
      return;
    }
    if (!formData.activity_type) {
      toast.error('Etkinlik türü seçin');
      return;
    }
    if (!formData.activity_time) {
      toast.error('Ders saati seçin');
      return;
    }
    
    // Çakışma kontrolü - aynı tarih ve ders saatinde başka kayıt var mı?
    try {
      const latestBusySlots = await fetchBusySlots(formData.activity_date, { excludeActivityId: editingActivity?.id });

      if (latestBusySlots.has(normalizeLessonSlot(formData.activity_time) || '')) {
        toast.error('Bu tarih ve ders saatinde başka bir kayıt var');
        return;
      }

      const [appointmentCheck, planCheck] = await Promise.all([
        supabase
          .from('appointments')
          .select('id, participant_name, participant_type, start_time')
          .eq('appointment_date', formData.activity_date)
          .neq('status', 'cancelled'),
        supabase
          .from('guidance_plans')
          .select('id, class_display, lesson_period')
          .eq('plan_date', formData.activity_date)
          .eq('status', 'planned')
      ]);

      if (appointmentCheck.error || planCheck.error) {
        console.error('Çakışma kontrolü hatası:', appointmentCheck.error || planCheck.error);
        toast.error('Çakışma kontrolü yapılamadı');
        return;
      }

      const conflictingAppointments = (appointmentCheck.data || []).filter((apt: any) =>
        normalizeLessonSlot(apt.start_time) === normalizeLessonSlot(formData.activity_time)
      );

      if (conflictingAppointments.length > 0) {
        const appointment = conflictingAppointments[0];
        toast.error(`Bu tarih ve ders saatinde zaten bir randevu var: ${appointment.participant_name} (${appointment.participant_type})`);
        return;
      }

      const conflictingPlans = (planCheck.data || []).filter((plan: any) =>
        normalizeLessonSlot(plan.lesson_period) === normalizeLessonSlot(formData.activity_time)
      );

      if (conflictingPlans.length > 0) {
        toast.error(`Bu tarih ve ders saatinde zaten bir sınıf rehberliği planı var: ${conflictingPlans[0].class_display}`);
        return;
      }
    } catch (error) {
      console.error('Çakışma kontrolü hatası:', error);
      toast.error('Çakışma kontrolü yapılamadı');
      return;
    }
    
    const saveData = {
      ...formData,
      class_key: formData.class_display,
      objectives: formData.objectives.filter(o => o.trim()),
      materials: formData.materials.filter(m => m.trim())
    };
    
    try {
      if (editingActivity) {
        const { error } = await supabase
          .from('class_activities')
          .update({
            ...saveData,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingActivity.id);
        
        if (error) throw error;
        toast.success('Etkinlik güncellendi');
      } else {
        const { error } = await supabase
          .from('class_activities')
          .insert(saveData);
        
        if (error) throw error;
        toast.success('Etkinlik oluşturuldu');
      }
      
      resetForm();
      loadActivities();
    } catch (error) {
      console.error('Kaydetme hatası:', error);
      toast.error('Kaydetme sırasında hata oluştu');
    }
  };
  
  // Sil
  const handleDelete = async (id: string) => {
    if (!confirm('Bu etkinliği silmek istediğinize emin misiniz?')) return;
    
    try {
      const { error } = await supabase.from('class_activities').delete().eq('id', id);
      if (error) throw error;
      
      toast.success('Etkinlik silindi');
      loadActivities();
    } catch (error) {
      console.error('Silme hatası:', error);
      toast.error('Silme sırasında hata oluştu');
    }
  };
  
  // Formu sıfırla
  const resetForm = () => {
    setShowForm(false);
    setEditingActivity(null);
    setFormData({
      class_key: '',
      class_display: '',
      activity_date: new Date().toISOString().split('T')[0],
      activity_time: '',
      activity_type: '',
      title: '',
      description: '',
      objectives: [''],
      materials: [''],
      duration_minutes: 40,
      participants_count: 0,
      observations: '',
      evaluation: '',
      next_steps: '',
      attachments: [],
      status: 'planned'
    });
  };
  
  // Düzenleme moduna geç
  const startEditing = (activity: ClassActivity) => {
    setEditingActivity(activity);
    setFormData({
      class_key: activity.class_key || '',
      class_display: activity.class_display || '',
      activity_date: activity.activity_date || '',
      activity_time: activity.activity_time || '',
      activity_type: activity.activity_type || '',
      title: activity.title || '',
      description: activity.description || '',
      objectives: activity.objectives?.length ? activity.objectives : [''],
      materials: activity.materials?.length ? activity.materials : [''],
      duration_minutes: activity.duration_minutes || 40,
      participants_count: activity.participants_count || 0,
      observations: activity.observations || '',
      evaluation: activity.evaluation || '',
      next_steps: activity.next_steps || '',
      attachments: activity.attachments || [],
      status: activity.status || 'planned'
    });
    setShowForm(true);
  };
  
  // Filtrelenmiş liste
  const filteredActivities = useMemo(() => {
    return activities.filter(activity => {
      if (classFilter && activity.class_display !== classFilter) return false;
      if (typeFilter && activity.activity_type !== typeFilter) return false;
      if (statusFilter && activity.status !== statusFilter) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = activity.title.toLowerCase().includes(query);
        const matchesClass = activity.class_display?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesClass) return false;
      }
      return true;
    });
  }, [activities, classFilter, typeFilter, statusFilter, searchQuery]);
  
  // İstatistikler
  const stats = useMemo(() => ({
    total: activities.length,
    completed: activities.filter(a => a.status === 'completed').length,
    planned: activities.filter(a => a.status === 'planned').length,
    thisMonth: activities.filter(a => {
      const activityDate = new Date(a.activity_date);
      const now = new Date();
      return activityDate.getMonth() === now.getMonth() && activityDate.getFullYear() === now.getFullYear();
    }).length,
    totalParticipants: activities.reduce((sum, a) => sum + (a.participants_count || 0), 0),
    byType: ACTIVITY_TYPES.reduce((acc, type) => {
      acc[type.value] = activities.filter(a => a.activity_type === type.value).length;
      return acc;
    }, {} as Record<string, number>)
  }), [activities]);
  
  // Renk haritası
  const colorMap: Record<string, { bg: string; text: string; border: string }> = {
    slate: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' },
    blue: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
    green: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200' },
    red: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' },
    amber: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
    purple: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200' },
    pink: { bg: 'bg-pink-100', text: 'text-pink-700', border: 'border-pink-200' },
    cyan: { bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-200' },
    indigo: { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-200' }
  };

  return (
    <div className="space-y-6">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-cyan-500 to-teal-600 rounded-xl shadow-lg">
            <Users className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Sınıf Etkinlikleri</h1>
            <p className="text-sm text-slate-500">Sınıf rehberlik çalışmaları</p>
          </div>
        </div>
        
        <Button 
          onClick={() => setShowForm(true)}
          className="bg-gradient-to-r from-cyan-500 to-teal-600 hover:from-cyan-600 hover:to-teal-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Yeni Etkinlik
        </Button>
      </div>
      
      {/* İstatistik Kartları */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="p-3 bg-cyan-100 rounded-xl w-12 h-12 mx-auto mb-2 flex items-center justify-center">
              <Users className="h-6 w-6 text-cyan-600" />
            </div>
            <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
            <p className="text-xs text-slate-500">Toplam Etkinlik</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <div className="p-3 bg-green-100 rounded-xl w-12 h-12 mx-auto mb-2 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
            <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
            <p className="text-xs text-slate-500">Tamamlanan</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <div className="p-3 bg-slate-100 rounded-xl w-12 h-12 mx-auto mb-2 flex items-center justify-center">
              <Clock className="h-6 w-6 text-slate-600" />
            </div>
            <p className="text-2xl font-bold text-slate-800">{stats.planned}</p>
            <p className="text-xs text-slate-500">Planlanan</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <div className="p-3 bg-blue-100 rounded-xl w-12 h-12 mx-auto mb-2 flex items-center justify-center">
              <Calendar className="h-6 w-6 text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-blue-600">{stats.thisMonth}</p>
            <p className="text-xs text-slate-500">Bu Ay</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <div className="p-3 bg-purple-100 rounded-xl w-12 h-12 mx-auto mb-2 flex items-center justify-center">
              <Users className="h-6 w-6 text-purple-600" />
            </div>
            <p className="text-2xl font-bold text-purple-600">{stats.totalParticipants}</p>
            <p className="text-xs text-slate-500">Toplam Katılımcı</p>
          </CardContent>
        </Card>
      </div>
      
      {/* Etkinlik Türleri Özeti */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-600">Etkinlik Türleri Dağılımı</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap gap-2">
            {ACTIVITY_TYPES.map(type => {
              const count = stats.byType[type.value] || 0;
              if (count === 0) return null;
              const Icon = type.icon;
              return (
                <Badge key={type.value} className={`${colorMap[type.color].bg} ${colorMap[type.color].text} text-sm py-1 px-3`}>
                  <Icon className="h-3 w-3 mr-1" />
                  {type.label}: {count}
                </Badge>
              );
            })}
          </div>
        </CardContent>
      </Card>
      
      {/* Form */}
      {showForm && (
        <Card className="border-2 border-cyan-200 bg-cyan-50/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5 text-cyan-600" />
              {editingActivity ? 'Etkinlik Düzenle' : 'Yeni Sınıf Etkinliği'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Temel Bilgiler */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Sınıf *</Label>
                <select
                  value={formData.class_display}
                  onChange={(e) => setFormData({ ...formData, class_display: e.target.value, class_key: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="">Seçin...</option>
                  {CLASS_LIST.map(cls => (
                    <option key={cls} value={cls}>{cls}</option>
                  ))}
                </select>
              </div>
              
              <div className="space-y-2">
                <Label>Etkinlik Türü *</Label>
                <select
                  value={formData.activity_type}
                  onChange={(e) => setFormData({ ...formData, activity_type: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="">Seçin...</option>
                  {ACTIVITY_TYPES.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>
              
              <div className="space-y-2">
                <Label>Tarih</Label>
                <Input
                  type="date"
                  value={formData.activity_date}
                  onChange={(e) => setFormData({ ...formData, activity_date: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Ders Saati</Label>
                  <select
                    value={formData.activity_time}
                    onChange={(e) => setFormData({ ...formData, activity_time: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500"
                  >
                  <option value="">Seçin...</option>
                  {[
                    { value: '1. Ders', label: '1. Ders' },
                    { value: '2. Ders', label: '2. Ders' },
                    { value: '3. Ders', label: '3. Ders' },
                    { value: '4. Ders', label: '4. Ders' },
                    { value: '5. Ders', label: '5. Ders' },
                    { value: '6. Ders', label: '6. Ders' },
                    { value: '7. Ders', label: '7. Ders' },
                  ].map(slot => {
                    const normalizedSlot = normalizeLessonSlot(slot.value) || '';
                    return (
                      <option 
                        key={slot.value} 
                        value={slot.value} 
                        disabled={busySlots.has(normalizedSlot)}
                        className={busySlots.has(normalizedSlot) ? "text-slate-400 bg-slate-100" : ""}
                      >
                        {slot.label} {busySlots.has(normalizedSlot) ? "(Dolu)" : ""}
                      </option>
                    );
                  })}
                </select>
              </div>
              
              <div className="space-y-2">
                <Label>Süre (dk)</Label>
                <Input
                  type="number"
                  value={formData.duration_minutes}
                  onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) || 40 })}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Etkinlik Adı *</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Etkinlik başlığı"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Katılımcı Sayısı</Label>
                  <Input
                    type="number"
                    value={formData.participants_count}
                    onChange={(e) => setFormData({ ...formData, participants_count: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Durum</Label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500"
                  >
                    {STATUS_OPTIONS.map(status => (
                      <option key={status.value} value={status.value}>{status.label}</option>
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
                            {slot}. Ders dolu
                          </span>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Açıklama</Label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
                className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-cyan-500"
                placeholder="Etkinlik hakkında kısa açıklama..."
              />
            </div>
            
            {/* Hedefler */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Kazanımlar/Hedefler</Label>
                <Button type="button" variant="outline" size="sm" onClick={addObjective}>
                  <Plus className="h-3 w-3 mr-1" /> Ekle
                </Button>
              </div>
              {formData.objectives.map((obj, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-slate-400" />
                  <Input
                    value={obj}
                    onChange={(e) => handleObjectiveChange(index, e.target.value)}
                    placeholder={`Hedef ${index + 1}`}
                    className="flex-1"
                  />
                  {formData.objectives.length > 1 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeObjective(index)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            
            {/* Materyaller */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Kullanılan Materyaller</Label>
                <Button type="button" variant="outline" size="sm" onClick={addMaterial}>
                  <Plus className="h-3 w-3 mr-1" /> Ekle
                </Button>
              </div>
              {formData.materials.map((mat, index) => (
                <div key={index} className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-slate-400" />
                  <Input
                    value={mat}
                    onChange={(e) => handleMaterialChange(index, e.target.value)}
                    placeholder={`Materyal ${index + 1}`}
                    className="flex-1"
                  />
                  {formData.materials.length > 1 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeMaterial(index)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            
            {/* Değerlendirme (Tamamlandıysa) */}
            {(formData.status === 'completed' || editingActivity?.status === 'completed') && (
              <div className="pt-4 border-t space-y-4">
                <h3 className="font-medium text-slate-700">Değerlendirme</h3>
                
                <div className="space-y-2">
                  <Label>Gözlemler</Label>
                  <textarea
                    value={formData.observations}
                    onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
                    rows={2}
                    className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-cyan-500"
                    placeholder="Etkinlik sırasında yapılan gözlemler..."
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Değerlendirme</Label>
                  <textarea
                    value={formData.evaluation}
                    onChange={(e) => setFormData({ ...formData, evaluation: e.target.value })}
                    rows={2}
                    className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-cyan-500"
                    placeholder="Etkinlik değerlendirmesi..."
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Sonraki Adımlar</Label>
                  <textarea
                    value={formData.next_steps}
                    onChange={(e) => setFormData({ ...formData, next_steps: e.target.value })}
                    rows={2}
                    className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-cyan-500"
                    placeholder="Yapılması gerekenler, öneriler..."
                  />
                </div>
              </div>
            )}
            
            {/* Butonlar */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={resetForm}>İptal</Button>
              <Button onClick={handleSave} className="bg-cyan-600 hover:bg-cyan-700">
                {editingActivity ? 'Güncelle' : 'Kaydet'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Filtreler */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <div className="flex gap-2 flex-wrap">
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm"
              >
                <option value="">Tüm Sınıflar</option>
                {CLASS_LIST.map(cls => (
                  <option key={cls} value={cls}>{cls}</option>
                ))}
              </select>
              
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm"
              >
                <option value="">Tüm Türler</option>
                {ACTIVITY_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
              
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm"
              >
                <option value="">Tüm Durumlar</option>
                {STATUS_OPTIONS.map(status => (
                  <option key={status.value} value={status.value}>{status.label}</option>
                ))}
              </select>
              
              <Button variant="outline" size="sm" onClick={loadActivities}>
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Liste */}
      {isLoading ? (
        <Card>
          <CardContent className="py-12 flex items-center justify-center">
            <Loader2 className="h-8 w-8 text-cyan-500 animate-spin" />
            <span className="ml-3 text-slate-600">Yükleniyor...</span>
          </CardContent>
        </Card>
      ) : filteredActivities.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">Sınıf etkinliği bulunmuyor</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredActivities.map(activity => {
            const type = ACTIVITY_TYPES.find(t => t.value === activity.activity_type);
            const statusInfo = STATUS_OPTIONS.find(s => s.value === activity.status);
            const isExpanded = expandedId === activity.id;
            const TypeIcon = type?.icon || FileText;
            
            return (
              <Card 
                key={activity.id}
                className={`transition-all hover:shadow-md border-l-4 ${colorMap[type?.color || 'slate'].border}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {/* İkon */}
                    <div className={`p-3 rounded-xl ${colorMap[type?.color || 'slate'].bg}`}>
                      <TypeIcon className={`h-6 w-6 ${colorMap[type?.color || 'slate'].text}`} />
                    </div>
                    
                    {/* İçerik */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-slate-800">{activity.title}</h3>
                        <Badge variant="outline">{activity.class_display}</Badge>
                        <Badge className={`${colorMap[type?.color || 'slate'].bg} ${colorMap[type?.color || 'slate'].text}`}>
                          {type?.label}
                        </Badge>
                        <Badge className={`${colorMap[statusInfo?.color || 'slate'].bg} ${colorMap[statusInfo?.color || 'slate'].text}`}>
                          {statusInfo?.label}
                        </Badge>
                      </div>
                      
                      {activity.description && (
                        <p className="text-sm text-slate-600 mt-1 line-clamp-1">{activity.description}</p>
                      )}
                      
                      <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(activity.activity_date).toLocaleDateString('tr-TR')}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {activity.duration_minutes} dk
                        </span>
                        {activity.participants_count > 0 && (
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {activity.participants_count} katılımcı
                          </span>
                        )}
                      </div>
                      
                      {/* Genişletilmiş İçerik */}
                      {isExpanded && (
                        <div className="mt-4 space-y-3 p-4 bg-slate-50 rounded-xl">
                          {activity.objectives && activity.objectives.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-slate-500 mb-1">Kazanımlar</p>
                              <ul className="text-sm text-slate-700 space-y-1">
                                {activity.objectives.map((obj, i) => (
                                  <li key={i} className="flex items-start gap-2">
                                    <Target className="h-3 w-3 mt-1 text-cyan-500" />
                                    {obj}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          
                          {activity.materials && activity.materials.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-slate-500 mb-1">Materyaller</p>
                              <div className="flex flex-wrap gap-2">
                                {activity.materials.map((mat, i) => (
                                  <Badge key={i} variant="outline" className="text-xs">{mat}</Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {activity.observations && (
                            <div>
                              <p className="text-xs font-medium text-slate-500 mb-1">Gözlemler</p>
                              <p className="text-sm text-slate-700">{activity.observations}</p>
                            </div>
                          )}
                          
                          {activity.evaluation && (
                            <div>
                              <p className="text-xs font-medium text-slate-500 mb-1">Değerlendirme</p>
                              <p className="text-sm text-slate-700">{activity.evaluation}</p>
                            </div>
                          )}
                          
                          {activity.next_steps && (
                            <div>
                              <p className="text-xs font-medium text-slate-500 mb-1">Sonraki Adımlar</p>
                              <p className="text-sm text-slate-700">{activity.next_steps}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {/* Aksiyonlar */}
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedId(isExpanded ? null : activity.id)}
                      >
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => startEditing(activity)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(activity.id)} className="text-red-500">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
