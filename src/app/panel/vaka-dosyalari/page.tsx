"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FolderOpen,
  Search,
  User,
  Calendar,
  Clock,
  FileText,
  AlertTriangle,
  MessageSquare,
  Gavel,
  Phone,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Plus,
  Eye,
  Edit,
  Trash2,
  Filter,
  Download,
  RefreshCw,
  BookOpen,
  Target,
  Users,
  TrendingUp,
  Activity,
  Sparkles,
  History,
  Star,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Info,
  ExternalLink,
  Loader2
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { ReferralRecord, DisiplinRecord, Appointment, StudentIncidentRecord } from "@/types";

// Vaka notu tipi
interface CaseNote {
  id: string;
  created_at: string;
  student_name: string;
  class_key: string;
  class_display: string;
  note_date: string;
  note_type: string;
  content: string;
  is_confidential: boolean;
  tags: string[];
}

// Timeline öğesi tipi
interface TimelineItem {
  id: string;
  date: string;
  type: 'referral' | 'appointment' | 'discipline' | 'note' | 'parent_contact' | 'ram' | 'incident';
  title: string;
  description: string;
  status?: string;
  color: string;
  icon: React.ReactNode;
  data: ReferralRecord | DisiplinRecord | Appointment | CaseNote | StudentIncidentRecord | Record<string, unknown>;
}

// Not tipi etiketleri
const NOTE_TYPES = [
  { value: 'gozlem', label: 'Gözlem', color: 'blue' },
  { value: 'gorusme', label: 'Görüşme', color: 'green' },
  { value: 'degerlendirme', label: 'Değerlendirme', color: 'purple' },
  { value: 'plan', label: 'Plan', color: 'orange' },
  { value: 'diger', label: 'Diğer', color: 'slate' }
];

const INCIDENT_LABELS: Record<string, string> = {
  bullying: 'Zorbalık',
  conflict: 'Akran Çatışması',
  threat: 'Tehdit',
  verbal: 'Sözel Saldırı',
  physical: 'Fiziksel Müdahale',
  damage: 'Eşya Zarar Verme',
  theft: 'Eşya Alma / Kaybetme',
  other: 'Diğer'
};

export default function VakaDosyalariPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [students, setStudents] = useState<{ name: string; class_display: string; class_key: string }[]>([]);
  const [searchResults, setSearchResults] = useState<{ name: string; class_display: string; class_key: string }[]>([]);
  
  // Vaka verileri
  const [referrals, setReferrals] = useState<ReferralRecord[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [disciplines, setDisciplines] = useState<DisiplinRecord[]>([]);
  const [caseNotes, setCaseNotes] = useState<CaseNote[]>([]);
  const [studentIncidents, setStudentIncidents] = useState<StudentIncidentRecord[]>([]);
  const [parentContacts, setParentContacts] = useState<Record<string, unknown>[]>([]);
  const [ramReferrals, setRamReferrals] = useState<Record<string, unknown>[]>([]);
  
  // Not ekleme
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [newNote, setNewNote] = useState({
    note_type: 'gozlem',
    content: '',
    is_confidential: false,
    tags: [] as string[]
  });
  
  // Zaman filtresi
  const [timeFilter, setTimeFilter] = useState<'all' | '30days' | '90days' | 'year'>('all');
  
  // Öğrenci listesini yükle
  useEffect(() => {
    const loadStudents = async () => {
      try {
        // Tüm kaynaklardan benzersiz öğrenci listesi oluştur
        const [refResult, appResult, discResult, incidentResult] = await Promise.all([
          supabase.from('referrals').select('student_name, class_display, class_key'),
          supabase.from('appointments').select('participant_name, participant_class'),
          supabase.from('discipline_records').select('student_name, class_display, class_key'),
          supabase.from('student_incidents').select('target_student_name, reporter_student_name, target_class_display, reporter_class_display, target_class_key, reporter_class_key')
        ]);
        
        const studentMap = new Map<string, { name: string; class_display: string; class_key: string }>();
        
        refResult.data?.forEach(r => {
          if (r.student_name && !studentMap.has(r.student_name)) {
            studentMap.set(r.student_name, {
              name: r.student_name,
              class_display: r.class_display || '',
              class_key: r.class_key || ''
            });
          }
        });
        
        appResult.data?.forEach(a => {
          if (a.participant_name && !studentMap.has(a.participant_name)) {
            studentMap.set(a.participant_name, {
              name: a.participant_name,
              class_display: a.participant_class || '',
              class_key: a.participant_class || ''
            });
          }
        });
        
        discResult.data?.forEach(d => {
          if (d.student_name && !studentMap.has(d.student_name)) {
            studentMap.set(d.student_name, {
              name: d.student_name,
              class_display: d.class_display || '',
              class_key: d.class_key || ''
            });
          }
        });

        incidentResult.data?.forEach((incident) => {
          if (incident.reporter_student_name && !studentMap.has(incident.reporter_student_name)) {
            studentMap.set(incident.reporter_student_name, {
              name: incident.reporter_student_name,
              class_display: incident.reporter_class_display || '',
              class_key: incident.reporter_class_key || ''
            });
          }

          if (incident.target_student_name && !studentMap.has(incident.target_student_name)) {
            studentMap.set(incident.target_student_name, {
              name: incident.target_student_name,
              class_display: incident.target_class_display || '',
              class_key: incident.target_class_key || ''
            });
          }
        });
        
        setStudents(Array.from(studentMap.values()).sort((a, b) => a.name.localeCompare(b.name, 'tr')));
      } catch (error) {
        console.error('Öğrenci listesi yüklenemedi:', error);
      }
    };
    
    loadStudents();
  }, []);
  
  // Arama sonuçlarını güncelle
  useEffect(() => {
    if (searchQuery.length >= 2) {
      const query = searchQuery.toLowerCase();
      const results = students.filter(s => 
        s.name.toLowerCase().includes(query) ||
        s.class_display.toLowerCase().includes(query)
      ).slice(0, 10);
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, students]);
  
  // Öğrenci seçildiğinde verileri yükle
  const loadStudentData = async (studentName: string) => {
    setIsLoading(true);
    try {
      const [refResult, appResult, discResult, noteResult, contactResult, ramResult, incidentTargetResult, incidentReporterResult] = await Promise.all([
        supabase.from('referrals').select('*').eq('student_name', studentName).order('created_at', { ascending: false }),
        supabase.from('appointments').select('*').eq('participant_name', studentName).order('appointment_date', { ascending: false }),
        supabase.from('discipline_records').select('*').eq('student_name', studentName).order('created_at', { ascending: false }),
        supabase.from('case_notes').select('*').eq('student_name', studentName).order('note_date', { ascending: false }),
        supabase.from('parent_contacts').select('*').eq('student_name', studentName).order('contact_date', { ascending: false }),
        supabase.from('ram_referrals').select('*').eq('student_name', studentName).order('created_at', { ascending: false }),
        supabase.from('student_incidents').select('*').eq('target_student_name', studentName).order('incident_date', { ascending: false }),
        supabase.from('student_incidents').select('*').eq('reporter_student_name', studentName).order('incident_date', { ascending: false })
      ]);
      
      setReferrals(refResult.data || []);
      setAppointments(appResult.data || []);
      setDisciplines(discResult.data || []);
      setCaseNotes(noteResult.data || []);
      setParentContacts(contactResult.data || []);
      setRamReferrals(ramResult.data || []);
      const incidentMap = new Map<string, StudentIncidentRecord>();
      [...(incidentTargetResult.data || []), ...(incidentReporterResult.data || [])].forEach((incident) => {
        if (incident.id && !incidentMap.has(incident.id)) {
          incidentMap.set(incident.id, incident as StudentIncidentRecord);
        }
      });
      setStudentIncidents(Array.from(incidentMap.values()));
      
      // Sınıf bilgisini al
      const student = students.find(s => s.name === studentName);
      if (student) {
        setSelectedClass(student.class_display);
      }
      
      toast.success(`${studentName} vaka dosyası yüklendi`);
    } catch (error) {
      console.error('Veri yüklenemedi:', error);
      toast.error('Vaka dosyası yüklenirken hata oluştu');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Öğrenci seç
  const handleSelectStudent = (studentName: string) => {
    setSelectedStudent(studentName);
    setSearchQuery("");
    setSearchResults([]);
    loadStudentData(studentName);
  };
  
  // Timeline oluştur
  const timeline = useMemo<TimelineItem[]>(() => {
    if (!selectedStudent) return [];
    
    const items: TimelineItem[] = [];
    
    // Yönlendirmeler
    referrals.forEach(r => {
      items.push({
        id: r.id || '',
        date: r.created_at || '',
        type: 'referral',
        title: 'Rehberliğe Yönlendirme',
        description: r.reason || 'Neden belirtilmemiş',
        color: 'amber',
        icon: <Target className="h-4 w-4" />,
        data: r
      });
    });
    
    // Randevular
    appointments.forEach(a => {
      const statusColors: Record<string, string> = {
        planned: 'blue',
        attended: 'green',
        not_attended: 'red',
        postponed: 'orange',
        cancelled: 'slate'
      };
      items.push({
        id: a.id,
        date: a.appointment_date,
        type: 'appointment',
        title: `Randevu (${a.participant_type === 'student' ? 'Öğrenci' : a.participant_type === 'parent' ? 'Veli' : 'Öğretmen'})`,
        description: a.purpose || a.topic_tags?.join(', ') || 'Görüşme',
        status: a.status,
        color: statusColors[a.status] || 'blue',
        icon: <Calendar className="h-4 w-4" />,
        data: a
      });
    });
    
    // Disiplin kayıtları
    disciplines.forEach(d => {
      items.push({
        id: d.id || '',
        date: d.event_date || d.created_at || '',
        type: 'discipline',
        title: 'Disiplin Kaydı',
        description: `${d.penalty_type}: ${d.reason}`,
        color: 'rose',
        icon: <Gavel className="h-4 w-4" />,
        data: d
      });
    });
    
    // Vaka notları
    caseNotes.forEach(n => {
      const noteType = NOTE_TYPES.find(t => t.value === n.note_type);
      items.push({
        id: n.id,
        date: n.note_date,
        type: 'note',
        title: noteType?.label || 'Not',
        description: n.content.substring(0, 100) + (n.content.length > 100 ? '...' : ''),
        color: noteType?.color || 'slate',
        icon: <FileText className="h-4 w-4" />,
        data: n
      });
    });
    
    // Veli iletişimleri
    parentContacts.forEach(p => {
      items.push({
        id: (p as { id?: string }).id || '',
        date: (p as { contact_date?: string }).contact_date || '',
        type: 'parent_contact',
        title: 'Veli İletişimi',
        description: (p as { summary?: string }).summary || 'İletişim kaydı',
        color: 'teal',
        icon: <Phone className="h-4 w-4" />,
        data: p
      });
    });
    
    // RAM yönlendirmeleri
    ramReferrals.forEach(r => {
      items.push({
        id: (r as { id?: string }).id || '',
        date: (r as { referral_date?: string }).referral_date || '',
        type: 'ram',
        title: 'RAM Yönlendirme',
        description: (r as { referral_reason?: string }).referral_reason || 'RAM başvurusu',
        status: (r as { status?: string }).status,
        color: 'purple',
        icon: <ExternalLink className="h-4 w-4" />,
        data: r
      });
    });

    // Öğrenci bildirimleri / şikayetler
    studentIncidents.forEach(incident => {
      const severityColor = incident.severity === 'critical'
        ? 'red'
        : incident.severity === 'high'
          ? 'rose'
          : incident.severity === 'medium'
            ? 'amber'
            : 'blue';

      const description = selectedStudent === incident.target_student_name
        ? `${incident.reporter_student_name || 'Bir öğrenci'} tarafından bildirildi: ${incident.description}`
        : selectedStudent === incident.reporter_student_name
          ? `Şikayet bildirimi: ${incident.target_student_name} hakkında ${incident.description}`
          : incident.description;

      items.push({
        id: incident.id || `${incident.incident_date}-${incident.target_student_name}`,
        date: incident.incident_date,
        type: 'incident',
        title: INCIDENT_LABELS[incident.incident_type] || 'Bildirim',
        description,
        status: incident.status,
        color: severityColor,
        icon: <MessageSquare className="h-4 w-4" />,
        data: incident
      });
    });
    
    // Tarihe göre sırala (en yeni en üstte)
    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    // Zaman filtresini uygula
    const now = new Date();
    return items.filter(item => {
      if (timeFilter === 'all') return true;
      const itemDate = new Date(item.date);
      const diffDays = Math.floor((now.getTime() - itemDate.getTime()) / (1000 * 60 * 60 * 24));
      if (timeFilter === '30days') return diffDays <= 30;
      if (timeFilter === '90days') return diffDays <= 90;
      if (timeFilter === 'year') return diffDays <= 365;
      return true;
    });
  }, [selectedStudent, referrals, appointments, disciplines, caseNotes, studentIncidents, parentContacts, ramReferrals, timeFilter]);
  
  // Yeni not ekle
  const handleAddNote = async () => {
    if (!selectedStudent || !newNote.content.trim()) {
      toast.error('Lütfen not içeriği girin');
      return;
    }
    
    try {
      const student = students.find(s => s.name === selectedStudent);
      const { error } = await supabase.from('case_notes').insert({
        student_name: selectedStudent,
        class_key: student?.class_key || '',
        class_display: student?.class_display || '',
        note_date: new Date().toISOString().split('T')[0],
        note_type: newNote.note_type,
        content: newNote.content,
        is_confidential: newNote.is_confidential,
        tags: newNote.tags
      });
      
      if (error) throw error;
      
      toast.success('Not başarıyla eklendi');
      setShowNoteForm(false);
      setNewNote({ note_type: 'gozlem', content: '', is_confidential: false, tags: [] });
      loadStudentData(selectedStudent);
    } catch (error) {
      console.error('Not eklenemedi:', error);
      toast.error('Not eklenirken hata oluştu');
    }
  };
  
  // İstatistikler
  const stats = useMemo(() => ({
    totalReferrals: referrals.length,
    totalAppointments: appointments.length,
    completedAppointments: appointments.filter(a => a.status === 'attended').length,
    totalDiscipline: disciplines.length,
    totalNotes: caseNotes.length,
    totalIncidents: studentIncidents.length,
    totalParentContacts: parentContacts.length,
    ramStatus: ramReferrals.length > 0 ? (ramReferrals[0] as { status?: string }).status : null
  }), [referrals, appointments, disciplines, caseNotes, studentIncidents, parentContacts, ramReferrals]);
  
  // Renk haritası
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-700 border-blue-200',
    green: 'bg-green-100 text-green-700 border-green-200',
    amber: 'bg-amber-100 text-amber-700 border-amber-200',
    red: 'bg-red-100 text-red-700 border-red-200',
    rose: 'bg-rose-100 text-rose-700 border-rose-200',
    purple: 'bg-purple-100 text-purple-700 border-purple-200',
    orange: 'bg-orange-100 text-orange-700 border-orange-200',
    teal: 'bg-teal-100 text-teal-700 border-teal-200',
    slate: 'bg-slate-100 text-slate-700 border-slate-200'
  };
  
  const dotColorMap: Record<string, string> = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
    rose: 'bg-rose-500',
    purple: 'bg-purple-500',
    orange: 'bg-orange-500',
    teal: 'bg-teal-500',
    slate: 'bg-slate-500'
  };

  return (
    <div className="space-y-6">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg">
            <FolderOpen className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Vaka Dosyaları</h1>
            <p className="text-sm text-slate-500">Öğrenci bazlı tüm kayıtları görüntüleyin</p>
          </div>
        </div>
        
        {selectedStudent && (
          <Button
            variant="outline"
            onClick={() => {
              setSelectedStudent(null);
              setSelectedClass(null);
              setReferrals([]);
              setAppointments([]);
              setDisciplines([]);
              setCaseNotes([]);
              setStudentIncidents([]);
              setParentContacts([]);
              setRamReferrals([]);
            }}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Yeni Arama
          </Button>
        )}
      </div>
      
      {/* Arama Alanı */}
      {!selectedStudent && (
        <Card className="border-2 border-dashed border-slate-200 bg-slate-50/50">
          <CardContent className="py-12">
            <div className="max-w-xl mx-auto text-center space-y-6">
              <div className="p-4 bg-white rounded-full w-20 h-20 mx-auto shadow-lg flex items-center justify-center">
                <Search className="h-10 w-10 text-indigo-500" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-700 mb-2">Öğrenci Ara</h2>
                <p className="text-slate-500">
                  Öğrenci adı veya sınıf yazarak vaka dosyasına erişin
                </p>
              </div>
              
              <div className="relative">
                <Input
                  type="text"
                  placeholder="Öğrenci adı veya sınıf yazın..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12 h-14 text-lg border-2 focus:border-indigo-500"
                />
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                
                {/* Arama sonuçları */}
                {searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border rounded-xl shadow-xl z-50 overflow-hidden">
                    {searchResults.map((student, index) => (
                      <button
                        key={index}
                        onClick={() => handleSelectStudent(student.name)}
                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-indigo-50 transition-colors text-left border-b last:border-0"
                      >
                        <div className="p-2 bg-indigo-100 rounded-lg">
                          <User className="h-5 w-5 text-indigo-600" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">{student.name}</p>
                          <p className="text-sm text-slate-500">{student.class_display}</p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-slate-400 ml-auto" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Son aranan öğrenciler */}
              {students.length > 0 && searchQuery.length === 0 && (
                <div className="pt-4">
                  <p className="text-sm text-slate-500 mb-3">Kayıtlı öğrenciler ({students.length})</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {students.slice(0, 8).map((student, index) => (
                      <button
                        key={index}
                        onClick={() => handleSelectStudent(student.name)}
                        className="px-3 py-1.5 bg-white border rounded-full text-sm text-slate-600 hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
                      >
                        {student.name}
                      </button>
                    ))}
                    {students.length > 8 && (
                      <span className="px-3 py-1.5 text-sm text-slate-400">
                        +{students.length - 8} daha
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Yükleniyor */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
          <span className="ml-3 text-slate-600">Vaka dosyası yükleniyor...</span>
        </div>
      )}
      
      {/* Öğrenci Profil Kartı */}
      {selectedStudent && !isLoading && (
        <>
          <Card className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-sm">
                    <User className="h-10 w-10" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">{selectedStudent}</h2>
                    <p className="text-white/80 flex items-center gap-2 mt-1">
                      <BookOpen className="h-4 w-4" />
                      {selectedClass || 'Sınıf bilgisi yok'}
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    variant="secondary" 
                    size="sm"
                    onClick={() => setShowNoteForm(true)}
                    className="bg-white/20 hover:bg-white/30 text-white border-0"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Not Ekle
                  </Button>
                </div>
              </div>
              
              {/* İstatistikler */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mt-6">
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold">{stats.totalReferrals}</p>
                  <p className="text-xs text-white/70">Yönlendirme</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold">{stats.totalAppointments}</p>
                  <p className="text-xs text-white/70">Randevu</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold">{stats.completedAppointments}</p>
                  <p className="text-xs text-white/70">Görüşme</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold">{stats.totalDiscipline}</p>
                  <p className="text-xs text-white/70">Disiplin</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold">{stats.totalNotes}</p>
                  <p className="text-xs text-white/70">Not</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold">{stats.totalIncidents}</p>
                  <p className="text-xs text-white/70">Bildirim</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold">{stats.totalParentContacts}</p>
                  <p className="text-xs text-white/70">Veli İletişim</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold">{stats.ramStatus ? '✓' : '-'}</p>
                  <p className="text-xs text-white/70">RAM</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Not Ekleme Formu */}
          {showNoteForm && (
            <Card className="border-2 border-indigo-200 bg-indigo-50/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5 text-indigo-600" />
                  Yeni Not Ekle
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2 flex-wrap">
                  {NOTE_TYPES.map(type => (
                    <button
                      key={type.value}
                      onClick={() => setNewNote({ ...newNote, note_type: type.value })}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                        newNote.note_type === type.value
                          ? colorMap[type.color]
                          : 'bg-white text-slate-600 border hover:border-slate-300'
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
                
                <textarea
                  placeholder="Not içeriğini yazın..."
                  value={newNote.content}
                  onChange={(e) => setNewNote({ ...newNote, content: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newNote.is_confidential}
                      onChange={(e) => setNewNote({ ...newNote, is_confidential: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-slate-600">Gizli not</span>
                  </label>
                </div>
                
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowNoteForm(false)}>
                    İptal
                  </Button>
                  <Button onClick={handleAddNote}>
                    <Plus className="h-4 w-4 mr-1" />
                    Kaydet
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Zaman Filtresi */}
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <History className="h-5 w-5 text-indigo-600" />
              Kronolojik Geçmiş
            </h3>
            <div className="flex gap-2">
              {[
                { value: 'all', label: 'Tümü' },
                { value: '30days', label: 'Son 30 Gün' },
                { value: '90days', label: 'Son 90 Gün' },
                { value: 'year', label: 'Bu Yıl' }
              ].map(filter => (
                <button
                  key={filter.value}
                  onClick={() => setTimeFilter(filter.value as 'all' | '30days' | '90days' | 'year')}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                    timeFilter === filter.value
                      ? 'bg-indigo-100 text-indigo-700 font-medium'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
          
          {/* Timeline */}
          {timeline.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <Info className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">Bu öğrenci için henüz kayıt bulunmuyor</p>
              </CardContent>
            </Card>
          ) : (
            <div className="relative">
              {/* Timeline çizgisi */}
              <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-slate-200" />
              
              <div className="space-y-4">
                {timeline.map((item, index) => (
                  <div key={item.id} className="relative pl-14">
                    {/* Nokta */}
                    <div className={`absolute left-4 w-5 h-5 rounded-full border-4 border-white shadow ${dotColorMap[item.color]}`} />
                    
                    <Card className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg ${colorMap[item.color]}`}>
                              {item.icon}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium text-slate-800">{item.title}</h4>
                                {item.status && (
                                  <Badge variant="outline" className={`text-xs ${colorMap[item.color]}`}>
                                    {item.status === 'attended' ? 'Geldi' : 
                                     item.status === 'not_attended' ? 'Gelmedi' :
                                     item.status === 'planned' ? 'Planlandı' :
                                     item.status === 'postponed' ? 'Ertelendi' :
                                     item.status === 'cancelled' ? 'İptal' :
                                     item.status === 'hazirlaniyor' ? 'Hazırlanıyor' :
                                     item.status === 'gonderildi' ? 'Gönderildi' :
                                     item.status === 'degerlendirmede' ? 'Değerlendirmede' :
                                     item.status === 'sonuclandi' ? 'Sonuçlandı' :
                                     item.status}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-slate-600 mt-1">{item.description}</p>
                              <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {new Date(item.date).toLocaleDateString('tr-TR', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric'
                                })}
                              </p>
                            </div>
                          </div>
                          
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
