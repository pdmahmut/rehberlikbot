"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { 
  Users, 
  UserCheck, 
  RefreshCw, 
  Filter, 
  X, 
  Search,
  TrendingUp,
  Calendar,
  Award,
  ChevronRight,
  BarChart3,
  GraduationCap,
  Clock,
  FileText
} from "lucide-react";
import { toast } from "sonner";
import { usePanelData } from "../hooks";
import { StatsResponse } from "../types";
import { ClickableStudent } from "@/components/ClickableStudent";
import { TeacherDashboard, TeacherSummaryCard, TeacherRankingList } from "@/components/charts/TeacherCharts";

// Öğretmen Seçim Kartı
function TeacherSelectCard({ 
  teacher, 
  isSelected, 
  onClick, 
  count,
  rank
}: { 
  teacher: { value: string; label: string }; 
  isSelected: boolean; 
  onClick: () => void;
  count: number;
  rank: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        relative w-full p-4 rounded-xl border-2 text-left transition-all duration-300
        ${isSelected 
          ? 'border-violet-500 bg-gradient-to-br from-violet-50 to-purple-50 shadow-lg shadow-violet-500/10 scale-[1.02]' 
          : 'border-slate-200 bg-white hover:border-violet-300 hover:shadow-md'
        }
      `}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`
            w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm
            ${isSelected 
              ? 'bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg' 
              : 'bg-slate-100 text-slate-600'
            }
          `}>
            {rank <= 3 ? (
              rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'
            ) : (
              `#${rank}`
            )}
          </div>
          <div>
            <h3 className={`font-semibold ${isSelected ? 'text-violet-700' : 'text-slate-800'}`}>
              {teacher.label}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">{count} yönlendirme</p>
          </div>
        </div>
        {isSelected && (
          <div className="p-1.5 rounded-full bg-violet-500">
            <ChevronRight className="h-4 w-4 text-white" />
          </div>
        )}
      </div>
      
      {/* Progress bar */}
      <div className="mt-3 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all duration-500 ${
            isSelected 
              ? 'bg-gradient-to-r from-violet-500 to-purple-500' 
              : 'bg-slate-300'
          }`}
          style={{ width: `${Math.min((count / 50) * 100, 100)}%` }}
        />
      </div>
    </button>
  );
}

// Sınıf Seçim Kartı
function ClassSelectCard({ 
  classItem, 
  isSelected, 
  onClick, 
  count 
}: { 
  classItem: { value: string; text: string }; 
  isSelected: boolean; 
  onClick: () => void;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        relative p-3 rounded-xl border-2 text-left transition-all duration-300
        ${isSelected 
          ? 'border-cyan-500 bg-gradient-to-br from-cyan-50 to-blue-50 shadow-lg shadow-cyan-500/10' 
          : 'border-slate-200 bg-white hover:border-cyan-300 hover:shadow-md'
        }
      `}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`
            p-2 rounded-lg
            ${isSelected 
              ? 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white' 
              : 'bg-slate-100 text-slate-500'
            }
          `}>
            <GraduationCap className="h-4 w-4" />
          </div>
          <span className={`font-medium text-sm ${isSelected ? 'text-cyan-700' : 'text-slate-700'}`}>
            {classItem.text}
          </span>
        </div>
        <span className={`text-xs font-bold px-2 py-1 rounded-full ${
          isSelected 
            ? 'bg-cyan-500 text-white' 
            : 'bg-slate-100 text-slate-600'
        }`}>
          {count}
        </span>
      </div>
    </button>
  );
}

export default function OgretmenPage() {
  const { stats, loadingStats, statsError, teachers, classes, loadingFilters, fetchStats, getClassDisplayText } = usePanelData();
  const [selectedTeacher, setSelectedTeacher] = useState<string>("");
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [filteredStats, setFilteredStats] = useState<StatsResponse | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"cards" | "list">("cards");

  // Öğretmen sıralaması
  const teacherRanking = useMemo(() => {
    if (!stats?.byTeacher) return {};
    const sorted = Object.entries(stats.byTeacher).sort((a, b) => b[1] - a[1]);
    const ranking: Record<string, number> = {};
    sorted.forEach(([name], index) => {
      ranking[name] = index + 1;
    });
    return ranking;
  }, [stats]);

  // Filtrelenmiş öğretmenler
  const filteredTeachers = useMemo(() => {
    if (!searchQuery.trim()) return teachers;
    const query = searchQuery.toLowerCase();
    return teachers.filter(t => t.label.toLowerCase().includes(query));
  }, [teachers, searchQuery]);

  const handleTeacherChange = async (value: string) => {
    setSelectedTeacher(value);
    if (value) {
      const teacherLabel = teachers.find(t => t.value === value)?.label;
      toast.success(`${teacherLabel} seçildi`, { icon: '👨‍🏫' });
    }
    const result = await fetchStats(value, getClassDisplayText(selectedClass));
    if (result) setFilteredStats(result);
  };

  const handleClassChange = async (value: string) => {
    setSelectedClass(value);
    const classText = classes.find(c => c.value === value)?.text || value;
    if (value) {
      toast.success(`${classText} seçildi`, { icon: '🎓' });
    }
    const result = await fetchStats(selectedTeacher || undefined, classText);
    if (result) setFilteredStats(result);
  };

  const clearFilters = async () => {
    setSelectedTeacher("");
    setSelectedClass("");
    setSearchQuery("");
    toast.info("Filtreler temizlendi");
    const result = await fetchStats();
    if (result) setFilteredStats(result);
  };

  const handleRefresh = async () => {
    toast.loading("Veriler yenileniyor...", { id: "refresh" });
    try {
      const result = await fetchStats(selectedTeacher || undefined, getClassDisplayText(selectedClass) || undefined, undefined, undefined, false);
      if (result) {
        setFilteredStats(result);
        toast.success("İstatistikler güncellendi", { id: "refresh" });
      } else {
        toast.error("Güncelleme başarısız", { id: "refresh" });
      }
    } catch {
      toast.error("Veriler yenilenemedi", { id: "refresh" });
    }
  };

  const displayStats = filteredStats || stats;
  const selectedTeacherLabel = teachers.find(t => t.value === selectedTeacher)?.label;

  // Öğrenci listesi - allStudents kullan (tarih bilgisi var)
  const studentList = useMemo(() => {
    // allStudents varsa onu kullan (tarih bilgisi içerir)
    if (displayStats?.allStudents && displayStats.allStudents.length > 0) {
      return displayStats.allStudents;
    }
    // Fallback: todayStudents (tarihsiz)
    return (displayStats?.todayStudents || []).map(s => ({
      ...s,
      date: new Date().toISOString().slice(0, 10)
    }));
  }, [displayStats]);

  return (
    <div className="space-y-6">
      {/* Modern Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 p-6 text-white shadow-xl">
        <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,transparent,rgba(255,255,255,0.5))]" />
        
        {/* Animated Background Elements */}
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-teal-300/20 blur-3xl animate-float-slow" />
        <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-cyan-300/20 blur-3xl animate-float-reverse" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-emerald-400/10 blur-3xl animate-pulse-glow" />
        
        {/* Floating Particles */}
        <div className="absolute top-10 right-20 h-2 w-2 rounded-full bg-teal-200/60 animate-float animation-delay-100" />
        <div className="absolute top-20 right-40 h-1.5 w-1.5 rounded-full bg-cyan-200/60 animate-float animation-delay-300" />
        <div className="absolute bottom-16 left-32 h-2 w-2 rounded-full bg-emerald-200/60 animate-float animation-delay-500" />
        <div className="absolute top-1/3 left-1/4 h-1 w-1 rounded-full bg-white/40 animate-sparkle animation-delay-200" />
        <div className="absolute bottom-1/3 right-1/4 h-1.5 w-1.5 rounded-full bg-teal-300/50 animate-sparkle animation-delay-700" />
        
        <div className="relative">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                <UserCheck className="h-7 w-7" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Öğretmen & Sınıf Analizi</h1>
                <p className="text-emerald-100">Öğretmen ve sınıf bazlı detaylı istatistikler</p>
              </div>
            </div>
            
            {/* Hızlı İstatistikler */}
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2 rounded-lg bg-white/10 backdrop-blur-sm px-4 py-2">
                <Users className="h-5 w-5 text-emerald-200" />
                <div>
                  <p className="text-xs text-emerald-200">Öğretmen</p>
                  <p className="text-lg font-bold">{teachers.length}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-white/10 backdrop-blur-sm px-4 py-2">
                <GraduationCap className="h-5 w-5 text-cyan-200" />
                <div>
                  <p className="text-xs text-emerald-200">Sınıf</p>
                  <p className="text-lg font-bold">{classes.length}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-white/10 backdrop-blur-sm px-4 py-2">
                <TrendingUp className="h-5 w-5 text-yellow-300" />
                <div>
                  <p className="text-xs text-emerald-200">Bu Hafta</p>
                  <p className="text-lg font-bold">{stats?.weekCount ?? 0}</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Alt bilgi çubuğu */}
          <div className="mt-4 pt-4 border-t border-white/20 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-4 text-sm text-emerald-200">
              {stats?.topTeacher && (
                <span className="flex items-center gap-1">
                  <Award className="h-4 w-4 text-yellow-300" />
                  En Aktif: <strong className="text-white">{stats.topTeacher.name}</strong>
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={clearFilters}
                disabled={!selectedTeacher && !selectedClass}
                className="bg-white/10 hover:bg-white/20 text-white border-0"
              >
                <X className="h-4 w-4 mr-2" />
                Temizle
              </Button>
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={handleRefresh} 
                disabled={loadingStats}
                className="bg-white/10 hover:bg-white/20 text-white border-0"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loadingStats ? "animate-spin" : ""}`} />
                Yenile
              </Button>
            </div>
          </div>
        </div>
      </div>

      {statsError && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          {statsError}
        </div>
      )}

      {/* Özet Kartlar */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-gradient-to-br from-violet-500 to-purple-600 text-white border-0 shadow-xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-violet-200 text-xs font-medium">Toplam Öğretmen</p>
                <p className="text-3xl font-bold mt-1">{teachers.length}</p>
              </div>
              <div className="p-3 bg-white/20 rounded-xl">
                <Users className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-cyan-500 to-blue-600 text-white border-0 shadow-xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-cyan-200 text-xs font-medium">Toplam Sınıf</p>
                <p className="text-3xl font-bold mt-1">{classes.length}</p>
              </div>
              <div className="p-3 bg-white/20 rounded-xl">
                <GraduationCap className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white border-0 shadow-xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-200 text-xs font-medium">Bu Hafta</p>
                <p className="text-3xl font-bold mt-1">{displayStats?.weekCount ?? 0}</p>
              </div>
              <div className="p-3 bg-white/20 rounded-xl">
                <Calendar className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500 to-orange-600 text-white border-0 shadow-xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-amber-200 text-xs font-medium">En Aktif</p>
                <p className="text-lg font-bold mt-1 truncate">{displayStats?.topTeacher?.name ?? "-"}</p>
              </div>
              <div className="p-3 bg-white/20 rounded-xl">
                <Award className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Öğretmen Seçimi */}
      <Card className="bg-white/80 backdrop-blur border-0 shadow-lg overflow-hidden">
        <CardHeader className="border-b bg-gradient-to-r from-violet-50 to-purple-50 pb-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600">
                <UserCheck className="h-3.5 w-3.5 text-white" />
              </div>
              Öğretmen Seçin
              <span className="ml-2 px-2 py-0.5 rounded-full bg-violet-100 text-xs font-medium text-violet-600">
                {filteredTeachers.length} öğretmen
              </span>
            </CardTitle>
            
            {/* Arama */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Öğretmen ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent w-full md:w-64 transition-all"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 max-h-[320px] overflow-y-auto">
            {filteredTeachers.map((teacher) => (
              <TeacherSelectCard
                key={teacher.value}
                teacher={teacher}
                isSelected={selectedTeacher === teacher.value}
                onClick={() => handleTeacherChange(selectedTeacher === teacher.value ? "" : teacher.value)}
                count={stats?.byTeacher?.[teacher.label] || 0}
                rank={teacherRanking[teacher.label] || 999}
              />
            ))}
          </div>
          
          {filteredTeachers.length === 0 && (
            <div className="py-8 text-center">
              <Search className="h-12 w-12 mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500">"{searchQuery}" ile eşleşen öğretmen bulunamadı</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sınıf Seçimi */}
      <Card className="bg-white/80 backdrop-blur border-0 shadow-lg overflow-hidden">
        <CardHeader className="border-b bg-gradient-to-r from-cyan-50 to-blue-50 pb-4">
          <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600">
              <GraduationCap className="h-3.5 w-3.5 text-white" />
            </div>
            Sınıf Filtresi
            <span className="ml-2 px-2 py-0.5 rounded-full bg-cyan-100 text-xs font-medium text-cyan-600">
              {classes.length} sınıf
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid gap-2 grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 max-h-[200px] overflow-y-auto">
            {classes.map((classItem) => (
              <ClassSelectCard
                key={classItem.value}
                classItem={classItem}
                isSelected={selectedClass === classItem.value}
                onClick={() => handleClassChange(selectedClass === classItem.value ? "" : classItem.value)}
                count={stats?.byClass?.[classItem.text] || 0}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Aktif Filtreler */}
      {(selectedTeacher || selectedClass) && (
        <div className="flex flex-wrap items-center gap-2 p-4 bg-gradient-to-r from-slate-50 to-slate-100 rounded-xl border border-slate-200">
          <div className="flex items-center gap-1.5 text-sm text-slate-600">
            <Filter className="h-4 w-4 text-slate-400" />
            <span className="font-medium">Aktif filtreler:</span>
          </div>
          {selectedTeacher && (
            <span className="inline-flex items-center gap-1.5 bg-gradient-to-r from-violet-100 to-purple-100 text-violet-700 px-3 py-1.5 rounded-full border border-violet-200 shadow-sm">
              <UserCheck className="h-3.5 w-3.5" />
              <span className="font-medium">{selectedTeacherLabel}</span>
              <button
                onClick={() => handleTeacherChange("")}
                className="ml-1 p-0.5 hover:bg-violet-200 rounded-full transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          )}
          {selectedClass && (
            <span className="inline-flex items-center gap-1.5 bg-gradient-to-r from-cyan-100 to-blue-100 text-cyan-700 px-3 py-1.5 rounded-full border border-cyan-200 shadow-sm">
              <GraduationCap className="h-3.5 w-3.5" />
              <span className="font-medium">{classes.find(c => c.value === selectedClass)?.text}</span>
              <button
                onClick={() => handleClassChange("")}
                className="ml-1 p-0.5 hover:bg-cyan-200 rounded-full transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          )}
        </div>
      )}

      {/* Seçili Öğretmen Dashboard */}
      {selectedTeacher && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-violet-600" />
            {selectedTeacherLabel} - Detaylı Analiz
          </h2>
          <TeacherDashboard 
            stats={displayStats} 
            loading={loadingStats}
            teacherName={selectedTeacherLabel}
          />
        </div>
      )}

      {/* Genel İstatistikler (Öğretmen seçilmemişse) */}
      {!selectedTeacher && (
        <TeacherDashboard 
          stats={displayStats} 
          loading={loadingStats}
        />
      )}

      {/* Öğrenci Listesi */}
      {studentList.length > 0 && (
        <Card className="bg-white/80 backdrop-blur border-0 shadow-lg overflow-hidden">
          <CardHeader className="border-b bg-gradient-to-r from-violet-50 to-purple-50 pb-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600">
                  <Users className="h-3.5 w-3.5 text-white" />
                </div>
                {selectedTeacherLabel ? `${selectedTeacherLabel} - Yönlendirilen Öğrenciler` : 'Tüm Yönlendirmeler'}
                <span className="ml-2 px-2 py-0.5 rounded-full bg-violet-100 text-xs font-medium text-violet-600">
                  {studentList.length} kayıt
                </span>
              </CardTitle>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Clock className="h-3.5 w-3.5" />
                <span>En yeni kayıtlar üstte</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[500px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-slate-500 bg-slate-50/80 sticky top-0 backdrop-blur z-10">
                  <tr>
                    <th className="text-left py-3 px-4 font-medium w-12">#</th>
                    <th className="text-left py-3 px-4 font-medium">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-violet-500" />
                        Tarih
                      </div>
                    </th>
                    <th className="text-left py-3 px-4 font-medium">Öğrenci</th>
                    <th className="text-left py-3 px-4 font-medium">Sınıf</th>
                    <th className="text-left py-3 px-4 font-medium">
                      <div className="flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5 text-amber-500" />
                        Yönlendirme Nedeni
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {studentList.map((s, idx) => {
                    // Tarih formatla
                    const dateObj = new Date(s.date);
                    const formattedDate = dateObj.toLocaleDateString('tr-TR', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric'
                    });
                    const isToday = s.date === new Date().toISOString().slice(0, 10);
                    const isThisWeek = (new Date().getTime() - dateObj.getTime()) < 7 * 24 * 60 * 60 * 1000;
                    
                    return (
                      <tr key={`${s.student_name}-${s.date}-${idx}`} className="hover:bg-violet-50/50 transition-colors group">
                        <td className="py-3 px-4 text-slate-400 text-xs font-medium">
                          <span className="w-6 h-6 inline-flex items-center justify-center rounded-full bg-slate-100 group-hover:bg-violet-100 transition-colors">
                            {idx + 1}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${
                              isToday 
                                ? 'bg-gradient-to-r from-emerald-100 to-green-100 text-emerald-700 border border-emerald-200' 
                                : isThisWeek
                                  ? 'bg-gradient-to-r from-blue-50 to-cyan-50 text-blue-700 border border-blue-200'
                                  : 'bg-slate-100 text-slate-600'
                            }`}>
                              <Calendar className="h-3 w-3" />
                              {formattedDate}
                            </span>
                            {isToday && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500 text-white animate-pulse">
                                BUGÜN
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <ClickableStudent studentName={s.student_name} classDisplay={s.class_display} />
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center px-2 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-medium">
                            {s.class_display}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="max-w-xs">
                            {s.reason ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gradient-to-r from-amber-50 to-orange-50 text-amber-800 text-xs border border-amber-200">
                                <FileText className="h-3 w-3 text-amber-500 flex-shrink-0" />
                                <span className="truncate">{s.reason}</span>
                              </span>
                            ) : (
                              <span className="text-slate-400 italic text-xs">Belirtilmemiş</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Veri yok durumu */}
      {!loadingStats && studentList.length === 0 && (selectedTeacher || selectedClass) && (
        <Card className="bg-white/80 backdrop-blur border-0 shadow-lg">
          <CardContent className="py-12">
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                <Users className="h-10 w-10 text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-700 mb-2">Veri Bulunamadı</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                Seçili filtreler için yönlendirme kaydı bulunmuyor. Farklı filtreler seçmeyi deneyin.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}