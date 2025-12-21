"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { 
  History, 
  Search, 
  Trash2, 
  RefreshCw, 
  AlertTriangle,
  GraduationCap,
  User,
  Calendar,
  FileText,
  Gavel,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Clock,
  TrendingUp,
  Download,
  Filter,
  ArrowUpDown,
  Eye,
  MoreHorizontal,
  Printer,
  Share2,
  BarChart3,
  Activity,
  Target,
  Shield,
  Send
} from "lucide-react";
import { toast } from "sonner";
import {
  HistorySummaryCard,
  ReferralReasonsChart,
  PenaltyTypesChart,
  MonthlyActivityChart,
  TeacherReferralsChart,
  ActivityTimeline,
  RiskIndicator,
} from "@/components/charts/StudentHistoryCharts";

interface ReferralRecord {
  id: string;
  reason: string;
  teacherName: string;
  classDisplay: string;
  date: string;
  notes: string | null;
}

interface DisciplineRecord {
  id: string;
  student_id: string;
  student_name: string;
  class_key: string;
  class_display: string;
  event_date: string;
  reason: string;
  penalty_type: string;
  notes: string | null;
  created_at: string;
}

interface ClassOption {
  value: string;
  text: string;
}

interface StudentOption {
  value: string;
  text: string;
}

type SortField = "date" | "type" | "reason";
type SortOrder = "asc" | "desc";
type FilterType = "all" | "referral" | "discipline";

export default function OgrenciGecmisiPage() {
  // State
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [selectedStudent, setSelectedStudent] = useState<StudentOption | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  const [referrals, setReferrals] = useState<ReferralRecord[]>([]);
  const [disciplineRecords, setDisciplineRecords] = useState<DisciplineRecord[]>([]);
  
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  const [showReferrals, setShowReferrals] = useState(true);
  const [showDiscipline, setShowDiscipline] = useState(true);
  const [showCharts, setShowCharts] = useState(true);
  
  // Yeni state'ler
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [viewMode, setViewMode] = useState<"list" | "timeline">("list");
  const [activeTab, setActiveTab] = useState<"all" | "referrals" | "discipline">("all");

  // Sınıfları yükle
  useEffect(() => {
    const loadClasses = async () => {
      try {
        const res = await fetch("/api/data");
        if (res.ok) {
          const data = await res.json();
          setClasses(data.sinifSubeList || []);
        }
      } catch (error) {
        console.error("Classes load error:", error);
        toast.error("Sınıflar yüklenemedi");
      } finally {
        setLoadingClasses(false);
      }
    };
    loadClasses();
  }, []);

  // Öğrencileri yükle
  const loadStudents = async (classKey: string) => {
    if (!classKey) return;
    
    setLoadingStudents(true);
    try {
      const res = await fetch(`/api/students?sinifSube=${encodeURIComponent(classKey)}`);
      if (res.ok) {
        const data = await res.json();
        setStudents(data || []);
      } else {
        setStudents([]);
      }
    } catch (error) {
      console.error("Students load error:", error);
      setStudents([]);
    } finally {
      setLoadingStudents(false);
    }
  };

  // Öğrenci geçmişini yükle
  const loadHistory = async (studentName: string, classDisplay?: string) => {
    if (!studentName) return;
    
    setLoadingHistory(true);
    try {
      // Yönlendirmeleri getir
      const referralRes = await fetch(
        `/api/student-history?studentName=${encodeURIComponent(studentName)}${classDisplay ? `&classDisplay=${encodeURIComponent(classDisplay)}` : ''}`
      );
      if (referralRes.ok) {
        const data = await referralRes.json();
        setReferrals(data.referrals || []);
      }

      // Disiplin kayıtlarını getir
      const disciplineRes = await fetch(
        `/api/discipline?studentName=${encodeURIComponent(studentName)}`
      );
      if (disciplineRes.ok) {
        const data = await disciplineRes.json();
        setDisciplineRecords(data.records || []);
      }
    } catch (error) {
      console.error("History load error:", error);
      toast.error("Geçmiş yüklenemedi");
    } finally {
      setLoadingHistory(false);
    }
  };

  // Sınıf seçimi
  const handleClassChange = (value: string) => {
    setSelectedClass(value);
    setSelectedStudent(null);
    setReferrals([]);
    setDisciplineRecords([]);
    loadStudents(value);
  };

  // Öğrenci seçimi
  const handleStudentChange = (value: string) => {
    const student = students.find(s => s.value === value);
    if (student) {
      setSelectedStudent(student);
      const classText = classes.find(c => c.value === selectedClass)?.text || "";
      loadHistory(student.text, classText);
    }
  };

  // Arama ile geçmiş getir
  const handleSearch = () => {
    if (searchQuery.trim()) {
      setSelectedClass("");
      setSelectedStudent(null);
      loadHistory(searchQuery.trim());
    }
  };

  // Yönlendirme kaydını sil
  const handleDeleteReferral = async (id: string) => {
    if (!confirm("Bu yönlendirme kaydını silmek istediğinizden emin misiniz?")) return;
    
    setDeletingId(id);
    try {
      const res = await fetch(`/api/student-history?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      
      if (res.ok) {
        setReferrals(prev => prev.filter(r => r.id !== id));
        toast.success("Yönlendirme kaydı silindi");
      } else {
        const data = await res.json();
        toast.error(data.error || "Kayıt silinemedi");
      }
    } catch (error) {
      console.error("Delete referral error:", error);
      toast.error("Kayıt silinirken hata oluştu");
    } finally {
      setDeletingId(null);
    }
  };

  // Disiplin kaydını sil
  const handleDeleteDiscipline = async (id: string) => {
    if (!confirm("Bu disiplin kaydını silmek istediğinizden emin misiniz?")) return;
    
    setDeletingId(id);
    try {
      const res = await fetch(`/api/discipline?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      
      if (res.ok) {
        setDisciplineRecords(prev => prev.filter(r => r.id !== id));
        toast.success("Disiplin kaydı silindi");
      } else {
        const data = await res.json();
        toast.error(data.error || "Kayıt silinemedi");
      }
    } catch (error) {
      console.error("Delete discipline error:", error);
      toast.error("Kayıt silinirken hata oluştu");
    } finally {
      setDeletingId(null);
    }
  };

  // Tarih formatla
  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return date.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return date.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Chart verileri hesapla
  const chartData = useMemo(() => {
    // Yönlendirme nedenleri
    const reasonCounts: Record<string, number> = {};
    referrals.forEach(r => {
      reasonCounts[r.reason] = (reasonCounts[r.reason] || 0) + 1;
    });
    const referralReasons = Object.entries(reasonCounts).map(([reason, count]) => ({
      reason,
      count,
    }));

    // Ceza türleri
    const penaltyCounts: Record<string, number> = {};
    disciplineRecords.forEach(r => {
      penaltyCounts[r.penalty_type] = (penaltyCounts[r.penalty_type] || 0) + 1;
    });
    const penaltyTypes = Object.entries(penaltyCounts).map(([type, count]) => ({
      type,
      count,
    }));

    // Öğretmen bazlı
    const teacherCounts: Record<string, number> = {};
    referrals.forEach(r => {
      teacherCounts[r.teacherName] = (teacherCounts[r.teacherName] || 0) + 1;
    });
    const teacherReferrals = Object.entries(teacherCounts)
      .map(([teacher, count]) => ({ teacher, count }))
      .sort((a, b) => b.count - a.count);

    // Aylık aktivite
    const monthlyData: Record<string, { referrals: number; discipline: number }> = {};
    const months = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
    
    referrals.forEach(r => {
      const date = new Date(r.date);
      const monthKey = `${months[date.getMonth()]} ${date.getFullYear()}`;
      if (!monthlyData[monthKey]) monthlyData[monthKey] = { referrals: 0, discipline: 0 };
      monthlyData[monthKey].referrals++;
    });
    
    disciplineRecords.forEach(r => {
      const date = new Date(r.event_date || r.created_at);
      const monthKey = `${months[date.getMonth()]} ${date.getFullYear()}`;
      if (!monthlyData[monthKey]) monthlyData[monthKey] = { referrals: 0, discipline: 0 };
      monthlyData[monthKey].discipline++;
    });
    
    const monthlyActivity = Object.entries(monthlyData)
      .map(([month, data]) => ({ month, ...data }))
      .slice(-6);

    // Timeline aktiviteleri
    const activities = [
      ...referrals.map(r => ({
        id: r.id,
        type: "referral" as const,
        date: formatDate(r.date),
        title: r.reason,
        description: `${r.teacherName} tarafından yönlendirildi`,
        rawDate: new Date(r.date),
      })),
      ...disciplineRecords.map(r => ({
        id: r.id,
        type: "discipline" as const,
        date: formatDate(r.event_date || r.created_at),
        title: r.penalty_type,
        description: r.reason,
        rawDate: new Date(r.event_date || r.created_at),
      })),
    ].sort((a, b) => b.rawDate.getTime() - a.rawDate.getTime());

    // Son aktivite tarihi
    const lastActivity = activities.length > 0 ? activities[0].date : undefined;

    return {
      referralReasons,
      penaltyTypes,
      teacherReferrals,
      monthlyActivity,
      activities,
      lastActivity,
    };
  }, [referrals, disciplineRecords]);

  const totalRecords = referrals.length + disciplineRecords.length;

  // Excel olarak dışa aktar
  const handleExportExcel = () => {
    if (totalRecords === 0) {
      toast.error("Dışa aktarılacak kayıt yok");
      return;
    }

    const csvContent = [
      ["Tür", "Tarih", "Neden/Ceza", "Öğretmen/Sınıf", "Notlar"].join(","),
      ...referrals.map(r => 
        [`Yönlendirme`, formatDate(r.date), r.reason, r.teacherName, r.notes || ""].join(",")
      ),
      ...disciplineRecords.map(r => 
        [`Disiplin`, formatDate(r.event_date), `${r.penalty_type} - ${r.reason}`, r.class_display, r.notes || ""].join(",")
      ),
    ].join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ogrenci-gecmisi-${selectedStudent?.text || searchQuery}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Kayıtlar dışa aktarıldı");
  };

  // Yazdır
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Modern Başlık */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-violet-600 p-6 text-white shadow-xl">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAzMHYySDI0di0yaDF6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
        
        {/* Animated Background Elements */}
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-purple-400/20 blur-3xl animate-float-slow" />
        <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-indigo-400/20 blur-3xl animate-float-reverse" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-violet-400/10 blur-3xl animate-pulse-glow" />
        
        {/* Floating Particles */}
        <div className="absolute top-8 right-16 h-2 w-2 rounded-full bg-purple-300/60 animate-float animation-delay-100" />
        <div className="absolute top-16 right-32 h-1.5 w-1.5 rounded-full bg-indigo-300/60 animate-float animation-delay-300" />
        <div className="absolute bottom-12 left-24 h-2 w-2 rounded-full bg-violet-300/60 animate-float animation-delay-500" />
        <div className="absolute top-1/3 left-1/5 h-1 w-1 rounded-full bg-white/40 animate-sparkle animation-delay-200" />
        <div className="absolute bottom-1/4 right-1/5 h-1.5 w-1.5 rounded-full bg-pink-300/50 animate-sparkle animation-delay-700" />
        
        <div className="relative z-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm shadow-lg">
                <History className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold">
                  Öğrenci Geçmişi
                </h1>
                <p className="text-white/80 mt-1">
                  Yönlendirme ve disiplin kayıtlarını görüntüleyin, analiz edin
                </p>
              </div>
            </div>
            
            {/* İstatistik Kartları */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-lg bg-white/10 backdrop-blur-sm px-3 py-2 border border-white/10 hover:bg-white/20 transition-all cursor-default">
                <GraduationCap className="h-4 w-4 text-purple-200" />
                <div>
                  <p className="text-[10px] text-purple-200 uppercase tracking-wider">Sınıf</p>
                  <p className="text-lg font-bold leading-none">{classes.length}</p>
                </div>
              </div>
              {selectedStudent && (
                <>
                  <div className="flex items-center gap-2 rounded-lg bg-blue-500/30 backdrop-blur-sm px-3 py-2 border border-blue-400/30 hover:bg-blue-500/40 transition-all cursor-default">
                    <Send className="h-4 w-4 text-blue-200" />
                    <div>
                      <p className="text-[10px] text-blue-200 uppercase tracking-wider">Yönlendirme</p>
                      <p className="text-lg font-bold leading-none">{referrals.length}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-orange-500/30 backdrop-blur-sm px-3 py-2 border border-orange-400/30 hover:bg-orange-500/40 transition-all cursor-default">
                    <ShieldAlert className="h-4 w-4 text-orange-200" />
                    <div>
                      <p className="text-[10px] text-orange-200 uppercase tracking-wider">Disiplin</p>
                      <p className="text-lg font-bold leading-none">{disciplineRecords.length}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-emerald-500/30 backdrop-blur-sm px-3 py-2 border border-emerald-400/30 hover:bg-emerald-500/40 transition-all cursor-default">
                    <BarChart3 className="h-4 w-4 text-emerald-200" />
                    <div>
                      <p className="text-[10px] text-emerald-200 uppercase tracking-wider">Toplam</p>
                      <p className="text-lg font-bold leading-none">{totalRecords}</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
          
          {/* Alt bilgi çubuğu - Fonksiyonel */}
          <div className="mt-4 pt-4 border-t border-white/20 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {/* Kayıt Tipi Filtre Toggle */}
              <div className="flex items-center bg-white/10 rounded-lg p-1">
                <button
                  onClick={() => setActiveTab("all")}
                  className={`px-2 py-1 rounded text-xs font-medium transition-all flex items-center gap-1 ${
                    activeTab === "all" 
                      ? "bg-white text-purple-600 shadow-sm" 
                      : "text-white/80 hover:text-white"
                  }`}
                >
                  <Activity className="h-3 w-3" />
                  Tümü
                </button>
                <button
                  onClick={() => setActiveTab("referrals")}
                  className={`px-2 py-1 rounded text-xs font-medium transition-all flex items-center gap-1 ${
                    activeTab === "referrals" 
                      ? "bg-white text-purple-600 shadow-sm" 
                      : "text-white/80 hover:text-white"
                  }`}
                >
                  <Send className="h-3 w-3" />
                  Yönlendirme
                </button>
                <button
                  onClick={() => setActiveTab("discipline")}
                  className={`px-2 py-1 rounded text-xs font-medium transition-all flex items-center gap-1 ${
                    activeTab === "discipline" 
                      ? "bg-white text-purple-600 shadow-sm" 
                      : "text-white/80 hover:text-white"
                  }`}
                >
                  <ShieldAlert className="h-3 w-3" />
                  Disiplin
                </button>
              </div>
              
              {/* Seçili Öğrenci */}
              {selectedStudent && (
                <Badge className="bg-white/20 text-white border-0 hover:bg-white/30">
                  <User className="h-3 w-3 mr-1" />
                  {selectedStudent.text}
                </Badge>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              {/* CSV Export */}
              {selectedStudent && totalRecords > 0 && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleExport}
                  className="bg-white/10 hover:bg-white/20 text-white border-0"
                >
                  <Download className="h-4 w-4 mr-1" />
                  CSV
                </Button>
              )}
              
              {/* Yazdır */}
              {selectedStudent && totalRecords > 0 && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handlePrint}
                  className="bg-white/10 hover:bg-white/20 text-white border-0"
                >
                  <Printer className="h-4 w-4 mr-1" />
                  Yazdır
                </Button>
              )}
              
              {/* Seçimi Temizle */}
              {selectedStudent && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setSelectedStudent(null);
                    setSearchQuery("");
                    setReferrals([]);
                    setDisciplineRecords([]);
                  }}
                  className="bg-red-500/20 hover:bg-red-500/30 text-white border-0"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Temizle
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Arama ve Filtreler */}
      <div className="grid gap-4 lg:grid-cols-12">
        {/* Sınıf ve Öğrenci Seçimi */}
        <Card className="lg:col-span-4 bg-gradient-to-br from-indigo-50 to-white border-indigo-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-indigo-800 flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-indigo-600" />
              Öğrenci Seçimi
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Sınıf */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Sınıf / Şube</label>
              <Select
                disabled={loadingClasses}
                value={selectedClass}
                onValueChange={handleClassChange}
              >
                <SelectTrigger className="h-10 border-indigo-200 focus:border-indigo-400">
                  <SelectValue placeholder={loadingClasses ? "Yükleniyor..." : "Sınıf seçin"} />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.text}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Öğrenci */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Öğrenci</label>
              <Select
                disabled={!selectedClass || loadingStudents}
                value={selectedStudent?.value || ""}
                onValueChange={handleStudentChange}
              >
                <SelectTrigger className="h-10 border-indigo-200 focus:border-indigo-400">
                  <SelectValue placeholder={
                    loadingStudents ? "Yükleniyor..." : 
                    !selectedClass ? "Önce sınıf seçin" : 
                    "Öğrenci seçin"
                  } />
                </SelectTrigger>
                <SelectContent>
                  {students.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.text}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Seçili Öğrenci */}
            {selectedStudent && (
              <div className="p-3 bg-gradient-to-r from-indigo-100 to-violet-100 rounded-xl border border-indigo-200">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-indigo-500 rounded-lg">
                    <User className="h-4 w-4 text-white" />
                  </div>
                  <span className="text-sm font-medium text-indigo-800">
                    {selectedStudent.text}
                  </span>
                </div>
                <p className="text-xs text-indigo-600 mt-1 ml-8">
                  {classes.find(c => c.value === selectedClass)?.text}
                </p>
                <div className="flex gap-2 mt-2 ml-8">
                  <Badge className="bg-blue-500 text-white border-0">
                    {referrals.length} Yönlendirme
                  </Badge>
                  <Badge className="bg-orange-500 text-white border-0">
                    {disciplineRecords.length} Disiplin
                  </Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* İsimle Arama */}
        <Card className="lg:col-span-4 bg-white/80 backdrop-blur shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
              <Search className="h-5 w-5 text-slate-600" />
              İsimle Ara
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Öğrenci Adı</label>
              <div className="flex gap-2">
                <Input
                  placeholder="Öğrenci adı yazın..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="h-10"
                />
                <Button 
                  onClick={handleSearch}
                  disabled={!searchQuery.trim() || loadingHistory}
                  className="gap-2 bg-indigo-600 hover:bg-indigo-700"
                >
                  {loadingHistory ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  Ara
                </Button>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Öğrenci adının bir kısmını yazarak tüm kayıtlarda arama yapabilirsiniz.
            </p>
          </CardContent>
        </Card>

        {/* Hızlı İşlemler */}
        <Card className="lg:col-span-4 bg-gradient-to-br from-slate-50 to-white shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
              <Activity className="h-5 w-5 text-slate-600" />
              Hızlı İşlemler
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={handleExportExcel}
                disabled={totalRecords === 0}
              >
                <Download className="h-4 w-4" />
                Dışa Aktar
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={handlePrint}
                disabled={totalRecords === 0}
              >
                <Printer className="h-4 w-4" />
                Yazdır
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === "list" ? "default" : "outline"}
                size="sm"
                className="flex-1 gap-1"
                onClick={() => setViewMode("list")}
              >
                <FileText className="h-4 w-4" />
                Liste
              </Button>
              <Button
                variant={viewMode === "timeline" ? "default" : "outline"}
                size="sm"
                className="flex-1 gap-1"
                onClick={() => setViewMode("timeline")}
              >
                <Activity className="h-4 w-4" />
                Zaman Çizelgesi
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={() => setShowCharts(!showCharts)}
            >
              <BarChart3 className="h-4 w-4" />
              {showCharts ? "Grafikleri Gizle" : "Grafikleri Göster"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Grafikler ve İstatistikler */}
      {showCharts && selectedStudent && totalRecords > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Özet Kartı */}
          <HistorySummaryCard
            studentName={selectedStudent.text}
            className={classes.find(c => c.value === selectedClass)?.text || ""}
            totalReferrals={referrals.length}
            totalDiscipline={disciplineRecords.length}
            lastActivityDate={chartData.lastActivity}
          />
          
          {/* Risk Göstergesi */}
          <RiskIndicator
            referralCount={referrals.length}
            disciplineCount={disciplineRecords.length}
          />
          
          {/* Yönlendirme Nedenleri */}
          <ReferralReasonsChart data={chartData.referralReasons} />
          
          {/* Ceza Türleri */}
          <PenaltyTypesChart data={chartData.penaltyTypes} />
        </div>
      )}

      {/* Ek Grafikler */}
      {showCharts && selectedStudent && totalRecords > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          <MonthlyActivityChart data={chartData.monthlyActivity} />
          <TeacherReferralsChart data={chartData.teacherReferrals} />
          <ActivityTimeline activities={chartData.activities} />
        </div>
      )}

      {/* Filtre ve Sıralama Toolbar */}
      {(selectedStudent || searchQuery) && !loadingHistory && totalRecords > 0 && viewMode === "list" && (
        <Card className="bg-white/80 backdrop-blur shadow-sm">
          <CardContent className="py-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-slate-500" />
                <span className="text-sm font-medium text-slate-700">Filtre:</span>
                <Select value={filterType} onValueChange={(v) => setFilterType(v as FilterType)}>
                  <SelectTrigger className="h-8 w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tümü</SelectItem>
                    <SelectItem value="referral">Yönlendirmeler</SelectItem>
                    <SelectItem value="discipline">Disiplin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-px h-6 bg-slate-200" />
              <div className="flex items-center gap-2">
                <ArrowUpDown className="h-4 w-4 text-slate-500" />
                <span className="text-sm font-medium text-slate-700">Sırala:</span>
                <Select value={sortField} onValueChange={(v) => setSortField(v as SortField)}>
                  <SelectTrigger className="h-8 w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date">Tarih</SelectItem>
                    <SelectItem value="type">Tür</SelectItem>
                    <SelectItem value="reason">Neden</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2"
                  onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                >
                  {sortOrder === "asc" ? "↑" : "↓"}
                </Button>
              </div>
              <div className="ml-auto text-sm text-slate-500">
                {totalRecords} kayıt bulundu
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Kayıtlar - Liste Görünümü */}
      {viewMode === "list" && (selectedStudent || searchQuery) && !loadingHistory && (
        <div className="space-y-4">
          {/* Yönlendirme Kayıtları */}
          {(filterType === "all" || filterType === "referral") && (
            <Card className="bg-white/80 backdrop-blur shadow-sm">
              <CardHeader className="pb-3">
                <button 
                  onClick={() => setShowReferrals(!showReferrals)}
                  className="w-full flex items-center justify-between"
                >
                  <CardTitle className="text-base font-semibold text-blue-800 flex items-center gap-2">
                    <div className="p-1.5 bg-blue-100 rounded-lg">
                      <AlertTriangle className="h-4 w-4 text-blue-600" />
                    </div>
                    Yönlendirme Kayıtları
                    <Badge className="bg-blue-600 text-white ml-2">{referrals.length}</Badge>
                  </CardTitle>
                  {showReferrals ? (
                    <ChevronUp className="h-5 w-5 text-slate-400" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-slate-400" />
                  )}
                </button>
              </CardHeader>
              {showReferrals && (
                <CardContent>
                  {referrals.length === 0 ? (
                    <div className="text-center py-8 text-slate-400">
                      <FileText className="h-12 w-12 mx-auto mb-2 opacity-30" />
                      <p>Yönlendirme kaydı bulunamadı</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {referrals.map((record) => (
                        <div
                          key={record.id}
                          className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100 hover:border-blue-300 hover:shadow-md transition-all group"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge className="bg-blue-600 text-white">
                                  {record.reason}
                                </Badge>
                                <span className="text-xs text-slate-500 px-2 py-0.5 bg-white rounded-full">
                                  {record.classDisplay}
                                </span>
                              </div>
                              <div className="mt-3 flex items-center gap-4 text-sm text-slate-600">
                                <span className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-lg">
                                  <User className="h-3.5 w-3.5 text-blue-500" />
                                  {record.teacherName}
                                </span>
                                <span className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-lg">
                                  <Calendar className="h-3.5 w-3.5 text-blue-500" />
                                  {formatDateTime(record.date)}
                                </span>
                              </div>
                              {record.notes && (
                                <p className="mt-3 text-sm text-slate-600 bg-white p-3 rounded-lg border border-slate-100">
                                  <span className="font-medium text-slate-700">Not: </span>
                                  {record.notes}
                                </p>
                              )}
                            </div>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 text-red-500 border-red-200 hover:bg-red-50 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => handleDeleteReferral(record.id)}
                              disabled={deletingId === record.id}
                            >
                              {deletingId === record.id ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          )}

          {/* Disiplin Kayıtları */}
          {(filterType === "all" || filterType === "discipline") && (
            <Card className="bg-white/80 backdrop-blur shadow-sm">
              <CardHeader className="pb-3">
                <button 
                  onClick={() => setShowDiscipline(!showDiscipline)}
                  className="w-full flex items-center justify-between"
                >
                  <CardTitle className="text-base font-semibold text-orange-800 flex items-center gap-2">
                    <div className="p-1.5 bg-orange-100 rounded-lg">
                      <Gavel className="h-4 w-4 text-orange-600" />
                    </div>
                    Disiplin Kayıtları
                    <Badge className="bg-orange-600 text-white ml-2">{disciplineRecords.length}</Badge>
                  </CardTitle>
                  {showDiscipline ? (
                    <ChevronUp className="h-5 w-5 text-slate-400" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-slate-400" />
                  )}
                </button>
              </CardHeader>
              {showDiscipline && (
                <CardContent>
                  {disciplineRecords.length === 0 ? (
                    <div className="text-center py-8 text-slate-400">
                      <Gavel className="h-12 w-12 mx-auto mb-2 opacity-30" />
                      <p>Disiplin kaydı bulunamadı</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {disciplineRecords.map((record) => (
                        <div
                          key={record.id}
                          className="p-4 bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl border border-orange-100 hover:border-orange-300 hover:shadow-md transition-all group"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge className="bg-orange-600 text-white flex items-center gap-1">
                                  <ShieldAlert className="h-3 w-3" />
                                  {record.penalty_type}
                                </Badge>
                                <Badge variant="outline" className="bg-white">
                                  {record.reason}
                                </Badge>
                              </div>
                              <div className="mt-3 flex items-center gap-4 text-sm text-slate-600">
                                <span className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-lg">
                                  <GraduationCap className="h-3.5 w-3.5 text-orange-500" />
                                  {record.class_display}
                                </span>
                                <span className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-lg">
                                  <Calendar className="h-3.5 w-3.5 text-orange-500" />
                                  Olay: {record.event_date ? new Date(record.event_date).toLocaleDateString('tr-TR') : '-'}
                                </span>
                              </div>
                              <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Kayıt: {formatDateTime(record.created_at)}
                              </p>
                              {record.notes && (
                                <p className="mt-3 text-sm text-slate-600 bg-white p-3 rounded-lg border border-slate-100">
                                  <span className="font-medium text-slate-700">Not: </span>
                                  {record.notes}
                                </p>
                              )}
                            </div>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 text-red-500 border-red-200 hover:bg-red-50 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => handleDeleteDiscipline(record.id)}
                              disabled={deletingId === record.id}
                            >
                              {deletingId === record.id ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          )}
        </div>
      )}

      {/* Zaman Çizelgesi Görünümü */}
      {viewMode === "timeline" && (selectedStudent || searchQuery) && !loadingHistory && totalRecords > 0 && (
        <Card className="bg-white/80 backdrop-blur shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
              <Activity className="h-5 w-5 text-indigo-600" />
              Tüm Aktiviteler - Zaman Çizelgesi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative space-y-4">
              {chartData.activities.map((activity, index) => (
                <div key={activity.id} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-4 h-4 rounded-full border-2 ${
                        activity.type === "referral" 
                          ? "bg-blue-500 border-blue-300" 
                          : "bg-orange-500 border-orange-300"
                      }`}
                    />
                    {index < chartData.activities.length - 1 && (
                      <div className="w-0.5 h-full bg-slate-200 mt-2" />
                    )}
                  </div>
                  <div className={`flex-1 pb-6 p-4 rounded-xl ${
                    activity.type === "referral" 
                      ? "bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100" 
                      : "bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-100"
                  }`}>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge
                        className={`${
                          activity.type === "referral" 
                            ? "bg-blue-600 text-white" 
                            : "bg-orange-600 text-white"
                        }`}
                      >
                        {activity.type === "referral" ? "Yönlendirme" : "Disiplin"}
                      </Badge>
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {activity.date}
                      </span>
                    </div>
                    <p className="font-medium text-slate-800">{activity.title}</p>
                    <p className="text-sm text-slate-600 mt-1">{activity.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Yükleniyor */}
      {loadingHistory && (
        <Card className="bg-white/80 backdrop-blur shadow-sm">
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center">
              <RefreshCw className="h-8 w-8 animate-spin text-indigo-600 mb-4" />
              <p className="text-slate-600">Kayıtlar yükleniyor...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Başlangıç Mesajı */}
      {!selectedStudent && !searchQuery && !loadingHistory && (
        <Card className="bg-white/80 backdrop-blur shadow-sm">
          <CardContent className="py-16">
            <div className="flex flex-col items-center justify-center text-slate-400">
              <div className="p-4 bg-indigo-100 rounded-2xl mb-4">
                <History className="h-12 w-12 text-indigo-500" />
              </div>
              <p className="text-xl font-semibold text-slate-600">Öğrenci Geçmişi</p>
              <p className="text-sm mt-2 text-center max-w-md">
                Kayıtları görüntülemek için bir öğrenci seçin veya isimle arama yapın.
                Tüm yönlendirme ve disiplin kayıtlarını detaylı olarak inceleyebilirsiniz.
              </p>
              <div className="flex gap-4 mt-6">
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <span>Yönlendirmeler</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 rounded-full bg-orange-500" />
                  <span>Disiplin Kayıtları</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
