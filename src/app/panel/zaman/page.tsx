"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  CalendarDays, 
  RefreshCw, 
  Clock, 
  CalendarRange, 
  CalendarCheck, 
  Layers,
  ChevronRight,
  Search,
  Filter,
  Users,
  TrendingUp,
  Sparkles,
  Activity,
  BarChart3
} from "lucide-react";
import { toast } from "sonner";
import { usePanelData } from "../hooks";
import { TimeFilter, StatsResponse } from "../types";
import { ClickableStudent } from "@/components/ClickableStudent";
import { TimeStatsCharts } from "@/components/charts/TimeStatsCharts";

// Zaman filtre kartı
function TimeFilterCard({ 
  icon: Icon, 
  label, 
  value, 
  isActive, 
  onClick,
  color,
  count
}: { 
  icon: any; 
  label: string; 
  value: TimeFilter; 
  isActive: boolean; 
  onClick: () => void;
  color: string;
  count?: number;
}) {
  const colorMap: Record<string, { gradient: string; bg: string; border: string; text: string }> = {
    blue: { 
      gradient: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', 
      bg: 'linear-gradient(to bottom right, #eff6ff, #dbeafe)',
      border: '#3b82f6',
      text: '#1d4ed8'
    },
    emerald: { 
      gradient: 'linear-gradient(135deg, #10b981, #059669)', 
      bg: 'linear-gradient(to bottom right, #ecfdf5, #d1fae5)',
      border: '#10b981',
      text: '#059669'
    },
    amber: { 
      gradient: 'linear-gradient(135deg, #f59e0b, #d97706)', 
      bg: 'linear-gradient(to bottom right, #fffbeb, #fef3c7)',
      border: '#f59e0b',
      text: '#d97706'
    },
    violet: { 
      gradient: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', 
      bg: 'linear-gradient(to bottom right, #f5f3ff, #ede9fe)',
      border: '#8b5cf6',
      text: '#7c3aed'
    },
  };

  const colors = colorMap[color] || colorMap.blue;

  return (
    <button
      onClick={onClick}
      className={`
        relative flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all duration-300
        ${isActive 
          ? 'shadow-lg scale-[1.02]' 
          : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md'
        }
      `}
      style={isActive ? { 
        borderColor: colors.border,
        background: colors.bg
      } : {}}
    >
      <div 
        className={`p-2 rounded-lg mb-2 transition-all duration-300 ${
          isActive 
            ? 'shadow-md' 
            : 'bg-slate-100'
        }`}
        style={isActive ? { background: colors.gradient } : {}}
      >
        <Icon className={`h-5 w-5 ${isActive ? 'text-white' : 'text-slate-500'}`} />
      </div>
      <span className={`text-sm font-medium ${isActive ? 'text-slate-800' : 'text-slate-600'}`}>
        {label}
      </span>
      {count !== undefined && (
        <span 
          className={`mt-1 text-lg font-bold ${isActive ? '' : 'text-slate-800'}`}
          style={isActive ? { color: colors.text } : {}}
        >
          {count}
        </span>
      )}
      {isActive && (
        <div 
          className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full"
          style={{ background: colors.border }}
        />
      )}
    </button>
  );
}

export default function ZamanPage() {
  const { stats, loadingStats, fetchStats } = usePanelData();
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [filteredStats, setFilteredStats] = useState<StatsResponse | null>(null);
  const [timeCustomDate, setTimeCustomDate] = useState<string>("");
  const [timeCustomDateStats, setTimeCustomDateStats] = useState<StatsResponse | null>(null);
  const [loadingTimeCustomStats, setLoadingTimeCustomStats] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchTimeCustomDateStats = async (date: string) => {
    if (!date) return;
    const toastId = toast.loading("Tarih verileri yükleniyor...");
    try {
      setLoadingTimeCustomStats(true);
      const res = await fetch(`/api/stats?from=${date}&to=${date}`);
      if (res.ok) {
        const json = await res.json();
        setTimeCustomDateStats(json);
        setFilteredStats(json);
        toast.success(`${new Date(date).toLocaleDateString('tr-TR')} verileri yüklendi`, { id: toastId });
      } else {
        toast.error("Veriler yüklenemedi", { id: toastId });
      }
    } catch (error) {
      console.error("Time custom date stats error:", error);
      toast.error("Tarih verileri yüklenemedi", { id: toastId });
    } finally {
      setLoadingTimeCustomStats(false);
    }
  };

  const handleTimeFilterChange = async (filter: TimeFilter) => {
    setTimeFilter(filter);
    if (filter !== "custom") {
      setTimeCustomDate("");
      const filterLabels: Record<TimeFilter, string> = {
        today: "Bugün",
        week: "Bu Hafta",
        month: "Bu Ay",
        all: "Tümü",
        custom: ""
      };
      toast.info(`${filterLabels[filter]} filtresi seçildi`);
      const result = await fetchStats(undefined, undefined, filter);
      if (result) setFilteredStats(result);
    }
  };

  const handleRefresh = async () => {
    toast.loading("Veriler yenileniyor...", { id: "refresh" });
    try {
      const result = await fetchStats(undefined, undefined, timeFilter, undefined, false);
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

  const isCustom = timeFilter === "custom" && timeCustomDate;
  const displayStats = isCustom ? timeCustomDateStats : filteredStats || stats;

  // Öğrenci listesi filtreleme
  const studentList = useMemo(() => {
    const list = isCustom 
      ? timeCustomDateStats?.todayStudents 
      : displayStats?.todayStudents;
    
    if (!list) return [];
    if (!searchQuery.trim()) return list;
    
    const query = searchQuery.toLowerCase();
    return list.filter(s => 
      s.student_name.toLowerCase().includes(query) ||
      s.class_display.toLowerCase().includes(query) ||
      s.reason?.toLowerCase().includes(query)
    );
  }, [isCustom, timeCustomDateStats, displayStats, searchQuery]);

  // Günlük ortalama hesapla
  const dailyAverage = useMemo(() => {
    if (!stats?.totalCount || !stats?.monthCount) return 0;
    return Math.round(stats.monthCount / 30);
  }, [stats]);

  // En yoğun gün (varsayılan olarak bugün ile karşılaştırma)
  const todayVsAverage = useMemo(() => {
    const today = stats?.todayCount || 0;
    const avg = dailyAverage || 1;
    const diff = today - avg;
    const percentage = Math.round((diff / avg) * 100);
    return { diff, percentage, isAbove: diff > 0 };
  }, [stats, dailyAverage]);

  return (
    <div className="space-y-6">
      {/* Modern Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 p-6 text-white shadow-xl">
        <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,transparent,rgba(255,255,255,0.5))]" />
        
        {/* Animated Background Elements */}
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-blue-400/20 blur-3xl animate-float-slow" />
        <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-violet-400/20 blur-3xl animate-float-reverse" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-indigo-400/10 blur-3xl animate-pulse-glow" />
        
        {/* Floating Particles */}
        <div className="absolute top-10 right-20 h-2 w-2 rounded-full bg-blue-300/60 animate-float animation-delay-100" />
        <div className="absolute top-20 right-40 h-1.5 w-1.5 rounded-full bg-violet-300/60 animate-float animation-delay-300" />
        <div className="absolute bottom-16 left-32 h-2 w-2 rounded-full bg-cyan-300/60 animate-float animation-delay-500" />
        <div className="absolute top-1/3 left-1/4 h-1 w-1 rounded-full bg-white/40 animate-sparkle animation-delay-200" />
        <div className="absolute bottom-1/3 right-1/4 h-1.5 w-1.5 rounded-full bg-indigo-300/50 animate-sparkle animation-delay-700" />
        
        <div className="relative">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                <CalendarDays className="h-7 w-7" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Zaman Bazlı İstatistikler</h1>
                <p className="text-blue-200">Günlük, haftalık ve aylık yönlendirme analizi</p>
              </div>
            </div>
            
            {/* Hızlı İstatistikler */}
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2 rounded-lg bg-white/10 backdrop-blur-sm px-4 py-2">
                <Activity className="h-5 w-5 text-blue-200" />
                <div>
                  <p className="text-xs text-blue-200">Günlük Ort.</p>
                  <p className="text-lg font-bold">{dailyAverage}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-white/10 backdrop-blur-sm px-4 py-2">
                {todayVsAverage.isAbove ? (
                  <TrendingUp className="h-5 w-5 text-amber-300" />
                ) : (
                  <TrendingUp className="h-5 w-5 text-emerald-300 rotate-180" />
                )}
                <div>
                  <p className="text-xs text-blue-200">Bugün vs Ort.</p>
                  <p className="text-lg font-bold">
                    {todayVsAverage.isAbove ? "+" : ""}{todayVsAverage.percentage}%
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-white/10 backdrop-blur-sm px-4 py-2">
                <Sparkles className="h-5 w-5 text-yellow-300" />
                <div>
                  <p className="text-xs text-blue-200">Bu Ay Toplam</p>
                  <p className="text-lg font-bold">{stats?.monthCount ?? 0}</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Alt bilgi çubuğu */}
          <div className="mt-4 pt-4 border-t border-white/20 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-4 text-sm text-blue-200">
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                Bugün: <strong className="text-white">{stats?.todayCount ?? 0}</strong>
              </span>
              <span className="flex items-center gap-1">
                <CalendarRange className="h-4 w-4" />
                Bu Hafta: <strong className="text-white">{stats?.weekCount ?? 0}</strong>
              </span>
              <span className="flex items-center gap-1">
                <BarChart3 className="h-4 w-4" />
                Toplam: <strong className="text-white">{stats?.totalCount ?? 0}</strong>
              </span>
            </div>
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={handleRefresh} 
              disabled={loadingStats || loadingTimeCustomStats}
              className="bg-white/20 hover:bg-white/30 text-white border-0"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loadingStats || loadingTimeCustomStats ? "animate-spin" : ""}`} />
              Yenile
            </Button>
          </div>
        </div>
      </div>

      {/* Zaman Filtresi Kartları */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <TimeFilterCard
          icon={Clock}
          label="Bugün"
          value="today"
          isActive={timeFilter === "today"}
          onClick={() => handleTimeFilterChange("today")}
          color="blue"
          count={stats?.todayCount}
        />
        <TimeFilterCard
          icon={CalendarRange}
          label="Bu Hafta"
          value="week"
          isActive={timeFilter === "week"}
          onClick={() => handleTimeFilterChange("week")}
          color="emerald"
          count={stats?.weekCount}
        />
        <TimeFilterCard
          icon={CalendarCheck}
          label="Bu Ay"
          value="month"
          isActive={timeFilter === "month"}
          onClick={() => handleTimeFilterChange("month")}
          color="amber"
          count={stats?.monthCount}
        />
        <TimeFilterCard
          icon={Layers}
          label="Tümü"
          value="all"
          isActive={timeFilter === "all"}
          onClick={() => handleTimeFilterChange("all")}
          color="violet"
          count={stats?.totalCount}
        />
        <div className="col-span-2 md:col-span-1">
          <button
            onClick={() => {
              setTimeFilter("custom");
              if (timeCustomDate) {
                fetchTimeCustomDateStats(timeCustomDate);
              }
            }}
            className={`
              w-full h-full flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all duration-300
              ${timeFilter === "custom" 
                ? 'border-pink-500 bg-gradient-to-br from-pink-50 to-rose-100 shadow-lg' 
                : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md'
              }
            `}
          >
            <div className={`p-2 rounded-lg mb-2 ${timeFilter === "custom" ? 'bg-gradient-to-br from-pink-500 to-rose-600 shadow-md' : 'bg-slate-100'}`}>
              <CalendarDays className={`h-5 w-5 ${timeFilter === "custom" ? 'text-white' : 'text-slate-500'}`} />
            </div>
            <span className={`text-sm font-medium ${timeFilter === "custom" ? 'text-slate-800' : 'text-slate-600'}`}>
              Tarih Seç
            </span>
            {timeFilter === "custom" && (
              <input
                type="date"
                value={timeCustomDate}
                onChange={(e) => {
                  setTimeCustomDate(e.target.value);
                  if (e.target.value) {
                    fetchTimeCustomDateStats(e.target.value);
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                className="mt-2 px-2 py-1 text-xs border border-pink-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-pink-500 w-full"
              />
            )}
          </button>
        </div>
      </div>

      {/* Aktif Filtre Bilgisi */}
      <div className="flex items-center justify-between bg-gradient-to-r from-slate-50 to-slate-100 rounded-xl px-4 py-3 border">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Filter className="h-4 w-4" />
            <span>Aktif Filtre:</span>
          </div>
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white shadow-sm text-sm font-medium text-slate-700">
            {timeFilter === "today" && "📅 Bugün"}
            {timeFilter === "week" && "📆 Bu Hafta"}
            {timeFilter === "month" && "🗓️ Bu Ay"}
            {timeFilter === "all" && "📊 Tüm Zamanlar"}
            {timeFilter === "custom" && timeCustomDate && `📍 ${new Date(timeCustomDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}`}
            {timeFilter === "custom" && !timeCustomDate && "📅 Tarih Seçiniz"}
            <ChevronRight className="h-3 w-3 text-slate-400" />
          </span>
        </div>
        {(loadingStats || loadingTimeCustomStats) && (
          <div className="flex items-center gap-2 text-sm text-blue-600">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Yükleniyor...</span>
          </div>
        )}
      </div>

      {/* Grafikler */}
      <TimeStatsCharts 
        stats={displayStats} 
        loading={loadingStats || loadingTimeCustomStats}
        timeFilter={timeFilter}
        customDate={timeCustomDate}
      />

      {/* Öğrenci Listesi */}
      {studentList && studentList.length > 0 && (
        <Card className="bg-white/80 backdrop-blur border-0 shadow-lg overflow-hidden">
          <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-slate-100 pb-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-gradient-to-br from-slate-600 to-slate-800">
                  <Users className="h-3.5 w-3.5 text-white" />
                </div>
                {isCustom 
                  ? `${new Date(timeCustomDate).toLocaleDateString('tr-TR')} Tarihindeki Yönlendirmeler`
                  : "Seçili Dönemdeki Yönlendirmeler"
                }
                <span className="ml-2 px-2 py-0.5 rounded-full bg-slate-200 text-xs font-medium text-slate-600">
                  {studentList.length} öğrenci
                </span>
              </CardTitle>
              
              {/* Arama */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Öğrenci, sınıf veya neden ara..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full md:w-64 transition-all"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[400px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-slate-500 bg-slate-50/80 sticky top-0 backdrop-blur">
                  <tr>
                    <th className="text-left py-3 px-4 font-medium">#</th>
                    <th className="text-left py-3 px-4 font-medium">Öğrenci</th>
                    <th className="text-left py-3 px-4 font-medium">Sınıf</th>
                    <th className="text-left py-3 px-4 font-medium">Yönlendirme Nedeni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {studentList.map((s, idx) => (
                    <tr 
                      key={`${s.student_name}-${idx}`} 
                      className="hover:bg-blue-50/50 transition-colors group"
                    >
                      <td className="py-3 px-4 text-slate-400 text-xs font-medium">
                        <span className="w-6 h-6 inline-flex items-center justify-center rounded-full bg-slate-100 group-hover:bg-blue-100 transition-colors">
                          {idx + 1}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <ClickableStudent studentName={s.student_name} classDisplay={s.class_display} />
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-medium">
                          {s.class_display}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 text-xs max-w-xs truncate">
                        {s.reason || <span className="text-slate-400 italic">Belirtilmemiş</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Boş durum */}
            {searchQuery && studentList.length === 0 && (
              <div className="py-12 text-center">
                <Search className="h-12 w-12 mx-auto text-slate-300 mb-3" />
                <p className="text-slate-500">"{searchQuery}" ile eşleşen sonuç bulunamadı</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Veri yok durumu */}
      {!loadingStats && !loadingTimeCustomStats && (!studentList || studentList.length === 0) && !searchQuery && (
        <Card className="bg-white/80 backdrop-blur border-0 shadow-lg">
          <CardContent className="py-12">
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                <CalendarDays className="h-10 w-10 text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-700 mb-2">Veri Bulunamadı</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                Seçili dönemde yönlendirme kaydı bulunmuyor. Farklı bir tarih aralığı seçmeyi deneyin.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
