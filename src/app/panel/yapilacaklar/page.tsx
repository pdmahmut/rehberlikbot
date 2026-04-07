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
  Edit,
  CheckCircle2,
  Circle,
  MoreHorizontal,
  Filter,
  Search,
  RefreshCw,
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

// Filtre tipi
type FilterType = 'all' | 'today' | 'week' | 'overdue' | 'completed';

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
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  
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
      const taskData = {
        ...newTask,
        status: 'pending',
        due_date: newTask.due_date || null,
        due_time: newTask.due_time || null
      };
      
      const { error } = await supabase.from('tasks').insert(taskData);
      
      if (error) throw error;
      
      toast.success('Görev eklendi');
      setShowForm(false);
      setNewTask({
        title: '',
        description: '',
        category: 'genel',
        priority: 'normal',
        due_date: '',
        due_time: '',
        related_student_name: ''
      });
      loadTasks();
    } catch (error) {
      console.error('Görev eklenemedi:', error);
      toast.error('Görev eklenirken hata oluştu');
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
  
  // Filtrelenmiş görevler
  const filteredTasks = useMemo(() => {
    const now = new Date();
    const today = getLocalDateString(now);
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const weekEndStr = getLocalDateString(weekEnd);
    
    return tasks.filter(task => {
      // Durum filtresi
      if (filter === 'completed' && task.status !== 'completed') return false;
      if (filter === 'today' && task.due_date !== today) return false;
      if (filter === 'week' && (!task.due_date || task.due_date > weekEndStr)) return false;
      if (filter === 'overdue' && (!task.due_date || task.due_date >= today || task.status === 'completed')) return false;
      
      // Kategori filtresi
      if (categoryFilter && task.category !== categoryFilter) return false;
      
      // Arama filtresi
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = task.title.toLowerCase().includes(query);
        const matchesDesc = task.description?.toLowerCase().includes(query);
        const matchesStudent = task.related_student_name?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesDesc && !matchesStudent) return false;
      }
      
      return true;
    });
  }, [tasks, filter, categoryFilter, searchQuery]);
  
  // İstatistikler
  const stats = useMemo(() => {
    const now = new Date();
    const today = getLocalDateString(now);
    
    const pending = tasks.filter(t => t.status === 'pending');
    const completed = tasks.filter(t => t.status === 'completed');
    const overdue = pending.filter(t => t.due_date && t.due_date < today);
    const todayTasks = pending.filter(t => t.due_date === today);
    const urgent = pending.filter(t => t.priority === 'urgent');
    
    return {
      total: tasks.length,
      pending: pending.length,
      completed: completed.length,
      overdue: overdue.length,
      today: todayTasks.length,
      urgent: urgent.length
    };
  }, [tasks]);
  
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
          onClick={() => setShowForm(true)}
          className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Yeni Görev
        </Button>
      </div>
      
      {/* İstatistik Kartları */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilter('all')}>
          <CardContent className="p-4 text-center">
            <div className={`p-3 rounded-xl w-12 h-12 mx-auto mb-2 flex items-center justify-center ${
              filter === 'all' ? 'bg-blue-500' : 'bg-blue-100'
            }`}>
              <ListTodo className={`h-6 w-6 ${filter === 'all' ? 'text-white' : 'text-blue-600'}`} />
            </div>
            <p className="text-2xl font-bold text-slate-800">{stats.pending}</p>
            <p className="text-xs text-slate-500">Bekleyen</p>
          </CardContent>
        </Card>
        
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilter('today')}>
          <CardContent className="p-4 text-center">
            <div className={`p-3 rounded-xl w-12 h-12 mx-auto mb-2 flex items-center justify-center ${
              filter === 'today' ? 'bg-amber-500' : 'bg-amber-100'
            }`}>
              <CalendarCheck className={`h-6 w-6 ${filter === 'today' ? 'text-white' : 'text-amber-600'}`} />
            </div>
            <p className="text-2xl font-bold text-slate-800">{stats.today}</p>
            <p className="text-xs text-slate-500">Bugün</p>
          </CardContent>
        </Card>
        
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilter('week')}>
          <CardContent className="p-4 text-center">
            <div className={`p-3 rounded-xl w-12 h-12 mx-auto mb-2 flex items-center justify-center ${
              filter === 'week' ? 'bg-purple-500' : 'bg-purple-100'
            }`}>
              <Calendar className={`h-6 w-6 ${filter === 'week' ? 'text-white' : 'text-purple-600'}`} />
            </div>
              <p className="text-2xl font-bold text-slate-800">{tasks.filter(t => {
                const weekEnd = new Date();
                weekEnd.setDate(weekEnd.getDate() + 7);
                return t.due_date && t.due_date <= getLocalDateString(weekEnd) && t.status !== 'completed';
              }).length}</p>
            <p className="text-xs text-slate-500">Bu Hafta</p>
          </CardContent>
        </Card>
        
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilter('overdue')}>
          <CardContent className="p-4 text-center">
            <div className={`p-3 rounded-xl w-12 h-12 mx-auto mb-2 flex items-center justify-center ${
              filter === 'overdue' ? 'bg-red-500' : 'bg-red-100'
            }`}>
              <AlertCircle className={`h-6 w-6 ${filter === 'overdue' ? 'text-white' : 'text-red-600'}`} />
            </div>
            <p className="text-2xl font-bold text-slate-800">{stats.overdue}</p>
            <p className="text-xs text-slate-500">Gecikmiş</p>
          </CardContent>
        </Card>
        
        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardContent className="p-4 text-center">
            <div className="p-3 bg-orange-100 rounded-xl w-12 h-12 mx-auto mb-2 flex items-center justify-center">
              <Flag className="h-6 w-6 text-orange-600" />
            </div>
            <p className="text-2xl font-bold text-slate-800">{stats.urgent}</p>
            <p className="text-xs text-slate-500">Acil</p>
          </CardContent>
        </Card>
        
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilter('completed')}>
          <CardContent className="p-4 text-center">
            <div className={`p-3 rounded-xl w-12 h-12 mx-auto mb-2 flex items-center justify-center ${
              filter === 'completed' ? 'bg-green-500' : 'bg-green-100'
            }`}>
              <CheckCircle2 className={`h-6 w-6 ${filter === 'completed' ? 'text-white' : 'text-green-600'}`} />
            </div>
            <p className="text-2xl font-bold text-slate-800">{stats.completed}</p>
            <p className="text-xs text-slate-500">Tamamlanan</p>
          </CardContent>
        </Card>
      </div>
      
      {/* Görev Ekleme Formu */}
      {showForm && (
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
      
      {/* Filtre ve Arama */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Görev ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <div className="flex gap-2 flex-wrap">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-green-500"
              >
                <option value="">Tüm Kategoriler</option>
                {CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.icon} {cat.label}</option>
                ))}
              </select>
              
              <Button variant="outline" size="sm" onClick={loadTasks}>
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Görev Listesi */}
      {isLoading ? (
        <Card>
          <CardContent className="py-12 flex items-center justify-center">
            <Loader2 className="h-8 w-8 text-green-500 animate-spin" />
            <span className="ml-3 text-slate-600">Görevler yükleniyor...</span>
          </CardContent>
        </Card>
      ) : filteredTasks.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <CheckSquare className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">
              {filter === 'completed' ? 'Tamamlanan görev yok' :
               filter === 'overdue' ? 'Gecikmiş görev yok' :
               'Görev bulunamadı'}
            </p>
            {filter === 'all' && (
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => setShowForm(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                İlk görevini ekle
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredTasks.map(task => {
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
                    {/* Checkbox */}
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
                    
                    {/* İçerik */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className={`font-medium ${
                          task.status === 'completed' 
                            ? 'text-slate-400 line-through' 
                            : 'text-slate-800'
                        }`}>
                          {task.title}
                        </h3>
                        
                        {/* Etiketler */}
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
                          <Badge variant="destructive" className="text-xs">
                            Gecikmiş
                          </Badge>
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
          })}
        </div>
      )}
    </div>
  );
}
