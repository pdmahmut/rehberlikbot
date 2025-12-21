"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  CalendarDays, 
  AlertTriangle, 
  Users, 
  X, 
  BarChart3, 
  RefreshCw,
  Download,
  Filter,
  TrendingUp,
  TrendingDown,
  Minus,
  PieChart,
  Target,
  Sparkles,
  ChevronRight,
  Clock,
  FileText,
  Share2,
  Copy,
  Printer,
  Eye,
  Activity
} from "lucide-react";
import { toast } from "sonner";
import { usePanelData } from "../hooks";
import { YONLENDIRME_NEDENLERI } from "@/types";
import { TimeFilter, StatsResponse } from "../types";
import { ClickableStudent } from "@/components/ClickableStudent";
import { 
  ReasonPieChart, 
  ReasonBarChart, 
  TopReasonsCard,
  TrendIndicator
} from "@/components/charts/ReasonCharts";

// Renk paleti
const CARD_COLORS = [
  { bg: "from-red-500 to-rose-600", light: "bg-red-50 border-red-200", text: "text-red-700", badge: "bg-red-100 text-red-700" },
  { bg: "from-orange-500 to-amber-600", light: "bg-orange-50 border-orange-200", text: "text-orange-700", badge: "bg-orange-100 text-orange-700" },
  { bg: "from-yellow-500 to-lime-600", light: "bg-yellow-50 border-yellow-200", text: "text-yellow-700", badge: "bg-yellow-100 text-yellow-700" },
  { bg: "from-green-500 to-emerald-600", light: "bg-green-50 border-green-200", text: "text-green-700", badge: "bg-green-100 text-green-700" },
  { bg: "from-teal-500 to-cyan-600", light: "bg-teal-50 border-teal-200", text: "text-teal-700", badge: "bg-teal-100 text-teal-700" },
  { bg: "from-blue-500 to-indigo-600", light: "bg-blue-50 border-blue-200", text: "text-blue-700", badge: "bg-blue-100 text-blue-700" },
  { bg: "from-violet-500 to-purple-600", light: "bg-violet-50 border-violet-200", text: "text-violet-700", badge: "bg-violet-100 text-violet-700" },
  { bg: "from-pink-500 to-fuchsia-600", light: "bg-pink-50 border-pink-200", text: "text-pink-700", badge: "bg-pink-100 text-pink-700" },
  { bg: "from-slate-500 to-gray-600", light: "bg-slate-50 border-slate-200", text: "text-slate-700", badge: "bg-slate-100 text-slate-700" },
];

export default function NedenlerPage() {
  const { stats, loadingStats, fetchStats } = usePanelData();
  const [reasonTimeFilter, setReasonTimeFilter] = useState<TimeFilter>("all");
  const [reasonCustomDate, setReasonCustomDate] = useState<string>("");
  const [customDateStats, setCustomDateStats] = useState<StatsResponse | null>(null);
  const [loadingCustomStats, setLoadingCustomStats] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [reasonStudents, setReasonStudents] = useState<{ student_name: string; class_display: string; reason?: string; date?: string }[]>([]);
  const [viewMode, setViewMode] = useState<"cards" | "chart">("cards");

  const fetchCustomDateStats = async (date: string) => {
    if (!date) return;
    try {
      setLoadingCustomStats(true);
      toast.loading("Tarih verileri yükleniyor...", { id: "custom-date" });
      const res = await fetch(`/api/stats?from=${date}&to=${date}`);
      if (res.ok) {
        const json = await res.json();
        setCustomDateStats(json);
        toast.success(`${new Date(date).toLocaleDateString('tr-TR')} verileri yüklendi`, { id: "custom-date" });
      } else {
        toast.error("Veriler yüklenemedi", { id: "custom-date" });
      }
    } catch (error) {
      console.error("Custom date stats error:", error);
      toast.error("Veriler yüklenemedi", { id: "custom-date" });
    } finally {
      setLoadingCustomStats(false);
    }
  };

  const handleRefresh = async () => {
    toast.loading("İstatistikler yenileniyor...", { id: "refresh" });
    const result = await fetchStats();
    if (result) {
      toast.success("İstatistikler güncellendi", { id: "refresh" });
    } else {
      toast.error("İstatistikler güncellenemedi", { id: "refresh" });
    }
  };

  const handleReasonClick = (reason: string) => {
    if (selectedReason === reason) {
      setSelectedReason(null);
      setReasonStudents([]);
      return;
    }

    setSelectedReason(reason);
    toast.info(`"${reason}" nedeni seçildi`);
    
    const isCustom = reasonTimeFilter === "custom" && reasonCustomDate;
    const sourceStats = isCustom ? customDateStats : stats;
    
    if (!sourceStats?.allStudents) {
      setReasonStudents([]);
      return;
    }

    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    
    let fromDate = "";
    let toDate = todayStr;

    if (isCustom) {
      fromDate = reasonCustomDate;
      toDate = reasonCustomDate;
    } else if (reasonTimeFilter === "today") {
      fromDate = todayStr;
    } else if (reasonTimeFilter === "week") {
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay() + 1);
      fromDate = startOfWeek.toISOString().slice(0, 10);
    } else if (reasonTimeFilter === "month") {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      fromDate = startOfMonth.toISOString().slice(0, 10);
    }

    const filtered = sourceStats.allStudents.filter(s => {
      const matchReason = s.reason === reason;
      if (reasonTimeFilter === "all" && !isCustom) {
        return matchReason;
      }
      const matchDate = s.date >= fromDate && s.date <= toDate;
      return matchReason && matchDate;
    });

    setReasonStudents(filtered);
  };

  const isCustom = reasonTimeFilter === "custom" && reasonCustomDate;
  const sourceStats = isCustom ? customDateStats : stats;
  
  const getReasonData = () => {
    if (isCustom) return sourceStats?.byReason;
    if (reasonTimeFilter === "today") return stats?.byReasonToday;
    if (reasonTimeFilter === "week") return stats?.byReasonWeek;
    if (reasonTimeFilter === "month") return stats?.byReasonMonth;
    return stats?.byReason;
  };

  const getTotalForPeriod = () => {
    if (isCustom) return sourceStats?.totalCount;
    if (reasonTimeFilter === "today") return stats?.todayCount;
    if (reasonTimeFilter === "week") return stats?.weekCount;
    if (reasonTimeFilter === "month") return stats?.monthCount;
    return stats?.totalCount;
  };

  // Grafik için veri hazırla
  const chartData = useMemo(() => {
    const reasonData = getReasonData();
    const total = getTotalForPeriod() || 0;
    
    return YONLENDIRME_NEDENLERI.map((neden, idx) => {
      const count = reasonData?.[neden] ?? 0;
      const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
      return {
        name: neden,
        value: count,
        percentage,
        color: CARD_COLORS[idx % CARD_COLORS.length].bg
      };
    }).filter(d => d.value > 0);
  }, [stats, customDateStats, reasonTimeFilter, reasonCustomDate]);

  // Export fonksiyonu
  const exportToCSV = () => {
    const reasonData = getReasonData();
    const total = getTotalForPeriod() || 0;
    
    let csv = "Yönlendirme Nedeni,Sayı,Oran (%)\n";
    YONLENDIRME_NEDENLERI.forEach(neden => {
      const count = reasonData?.[neden] ?? 0;
      const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
      csv += `"${neden}",${count},${percentage}\n`;
    });
    csv += `\nToplam,${total},100\n`;
    
    const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `yonlendirme_nedenleri_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV dosyası indirildi");
  };

  // En yüksek nedenler
  const topReasons = useMemo(() => {
    return [...chartData].sort((a, b) => b.value - a.value).slice(0, 3);
  }, [chartData]);

  // Trend hesapla (haftalık vs aylık karşılaştırma)
  const weekToMonthTrend = useMemo(() => {
    const weekCount = stats?.weekCount || 0;
    const monthCount = stats?.monthCount || 0;
    const weeklyAvg = monthCount > 0 ? monthCount / 4 : 0;
    
    if (weeklyAvg === 0) return { diff: 0, percentage: 0, direction: "stable" as const };
    
    const diff = weekCount - weeklyAvg;
    const percentage = Math.round((diff / weeklyAvg) * 100);
    const direction = diff > 0 ? "up" as const : diff < 0 ? "down" as const : "stable" as const;
    
    return { diff, percentage, direction };
  }, [stats]);

  const periodLabels: Record<TimeFilter, string> = {
    today: "Bugün",
    week: "Bu Hafta",
    month: "Bu Ay",
    all: "Tüm Zamanlar",
    custom: reasonCustomDate ? new Date(reasonCustomDate).toLocaleDateString('tr-TR') : "Özel Tarih"
  };

  return (
    <div className="space-y-6">
      {/* Modern Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-red-600 p-6 text-white shadow-xl">
        <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,transparent,rgba(255,255,255,0.5))]" />
        
        {/* Animated Background Elements */}
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-yellow-300/20 blur-3xl animate-float-slow" />
        <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-red-400/20 blur-3xl animate-float-reverse" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-orange-300/10 blur-3xl animate-pulse-glow" />
        
        {/* Floating Particles */}
        <div className="absolute top-8 right-16 h-2 w-2 rounded-full bg-yellow-200/60 animate-float animation-delay-100" />
        <div className="absolute top-16 right-32 h-1.5 w-1.5 rounded-full bg-red-200/60 animate-float animation-delay-300" />
        <div className="absolute bottom-12 left-24 h-2 w-2 rounded-full bg-orange-200/60 animate-float animation-delay-500" />
        <div className="absolute top-1/3 left-1/5 h-1 w-1 rounded-full bg-white/40 animate-sparkle animation-delay-200" />
        <div className="absolute bottom-1/4 right-1/5 h-1.5 w-1.5 rounded-full bg-yellow-300/50 animate-sparkle animation-delay-700" />
        
        <div className="relative">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm shadow-lg">
                <Target className="h-7 w-7" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Yönlendirme Nedenleri</h1>
                <p className="text-amber-100">Neden bazlı detaylı analiz ve istatistikler</p>
              </div>
            </div>
            
            {/* Hızlı İstatistikler */}
            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-2 rounded-lg bg-white/10 backdrop-blur-sm px-3 py-2 border border-white/10 hover:bg-white/20 transition-all cursor-default">
                <Activity className="h-4 w-4 text-amber-200" />
                <div>
                  <p className="text-[10px] text-amber-200 uppercase tracking-wider">Neden</p>
                  <p className="text-lg font-bold leading-none">{YONLENDIRME_NEDENLERI.length}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-white/10 backdrop-blur-sm px-3 py-2 border border-white/10 hover:bg-white/20 transition-all cursor-default">
                <TrendingUp className="h-4 w-4 text-emerald-300" />
                <div>
                  <p className="text-[10px] text-amber-200 uppercase tracking-wider">Hafta</p>
                  <p className="text-lg font-bold leading-none">{stats?.weekCount ?? 0}</p>
                </div>
              </div>
              {topReasons[0] && (
                <div className="flex items-center gap-2 rounded-lg bg-white/10 backdrop-blur-sm px-3 py-2 border border-white/10 hover:bg-white/20 transition-all cursor-default">
                  <Sparkles className="h-4 w-4 text-yellow-300" />
                  <div>
                    <p className="text-[10px] text-amber-200 uppercase tracking-wider">En Sık</p>
                    <p className="text-sm font-semibold truncate max-w-[100px] leading-none" title={topReasons[0].name}>
                      {topReasons[0].name.split(" ")[0]}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Alt Bilgi Çubuğu - Aksiyon Butonları */}
          <div className="mt-4 pt-4 border-t border-white/20 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {/* Görünüm Değiştirme */}
              <div className="flex items-center bg-white/10 rounded-lg p-1">
                <button
                  onClick={() => setViewMode("cards")}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    viewMode === "cards" 
                      ? "bg-white text-amber-600 shadow-sm" 
                      : "text-white/80 hover:text-white"
                  }`}
                >
                  <BarChart3 className="h-3.5 w-3.5 inline mr-1" />
                  Kartlar
                </button>
                <button
                  onClick={() => setViewMode("chart")}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    viewMode === "chart" 
                      ? "bg-white text-amber-600 shadow-sm" 
                      : "text-white/80 hover:text-white"
                  }`}
                >
                  <PieChart className="h-3.5 w-3.5 inline mr-1" />
                  Grafik
                </button>
              </div>
              
              {/* Seçili Dönem Göstergesi */}
              <Badge className="bg-white/20 text-white border-0 hover:bg-white/30">
                <Clock className="h-3 w-3 mr-1" />
                {periodLabels[reasonTimeFilter]}
              </Badge>
            </div>
            
            <div className="flex items-center gap-2">
              {/* CSV Export */}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  const reasonData = getReasonData();
                  if (!reasonData) {
                    toast.error("Dışa aktarılacak veri yok");
                    return;
                  }
                  const csvContent = "Neden,Sayı\n" + 
                    Object.entries(reasonData)
                      .sort((a, b) => b[1] - a[1])
                      .map(([name, count]) => `"${name}",${count}`)
                      .join("\n");
                  const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `nedenler-${periodLabels[reasonTimeFilter]}-${new Date().toISOString().slice(0, 10)}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                  toast.success("CSV dosyası indirildi");
                }}
                className="bg-white/10 hover:bg-white/20 text-white border-0"
              >
                <Download className="h-4 w-4 mr-1" />
                CSV
              </Button>
              
              {/* Yenile */}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  fetchStats();
                  toast.success("Veriler yenilendi");
                }}
                disabled={loadingStats}
                className="bg-white/10 hover:bg-white/20 text-white border-0"
              >
                <RefreshCw className={`h-4 w-4 ${loadingStats ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Dönem Özeti Kartları */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { key: "today" as TimeFilter, label: "Bugün", value: stats?.todayCount ?? 0, gradient: "from-blue-500 to-blue-600", bgLight: "bg-blue-50", textColor: "text-blue-600" },
          { key: "week" as TimeFilter, label: "Bu Hafta", value: stats?.weekCount ?? 0, gradient: "from-emerald-500 to-emerald-600", bgLight: "bg-emerald-50", textColor: "text-emerald-600" },
          { key: "month" as TimeFilter, label: "Bu Ay", value: stats?.monthCount ?? 0, gradient: "from-purple-500 to-purple-600", bgLight: "bg-purple-50", textColor: "text-purple-600" },
          { key: "all" as TimeFilter, label: "Toplam", value: stats?.totalCount ?? 0, gradient: "from-slate-500 to-slate-600", bgLight: "bg-slate-50", textColor: "text-slate-600" },
        ].map((item) => {
          const isActive = reasonTimeFilter === item.key;
          return (
            <button
              key={item.key}
              onClick={() => {
                setReasonTimeFilter(item.key);
                setReasonCustomDate("");
                setSelectedReason(null);
                setReasonStudents([]);
              }}
              className={`relative overflow-hidden rounded-xl p-4 text-left transition-all duration-300 ${
                isActive 
                  ? `bg-gradient-to-br ${item.gradient} text-white shadow-lg scale-105 ring-2 ring-offset-2 ring-${item.textColor.replace('text-', '')}` 
                  : `${item.bgLight} hover:shadow-md hover:scale-102`
              }`}
            >
              {isActive && (
                <div className="absolute top-2 right-2">
                  <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                </div>
              )}
              <p className={`text-xs font-medium ${isActive ? 'text-white/80' : item.textColor}`}>
                {item.label}
              </p>
              <p className={`text-2xl font-bold mt-1 ${isActive ? 'text-white' : 'text-slate-800'}`}>
                {loadingStats ? "..." : item.value}
              </p>
            </button>
          );
        })}
      </div>

      {/* Filtre ve Eylemler */}
      <Card className="bg-white/80 backdrop-blur border-slate-200/50">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap gap-2 items-center">
              <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1">
                <Button 
                  variant={viewMode === "cards" ? "default" : "ghost"} 
                  size="sm"
                  className="h-8"
                  onClick={() => setViewMode("cards")}
                >
                  <BarChart3 className="h-4 w-4 mr-1" />
                  Kartlar
                </Button>
                <Button 
                  variant={viewMode === "chart" ? "default" : "ghost"} 
                  size="sm"
                  className="h-8"
                  onClick={() => setViewMode("chart")}
                >
                  <PieChart className="h-4 w-4 mr-1" />
                  Grafikler
                </Button>
              </div>
              
              <div className="h-6 w-px bg-slate-200 mx-2 hidden md:block" />
              
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-slate-400" />
                <input
                  type="date"
                  value={reasonCustomDate}
                  onChange={(e) => {
                    setReasonCustomDate(e.target.value);
                    if (e.target.value) {
                      setReasonTimeFilter("custom");
                      fetchCustomDateStats(e.target.value);
                      setSelectedReason(null);
                      setReasonStudents([]);
                    }
                  }}
                  className={`h-9 px-3 text-sm border rounded-lg bg-white transition-all ${
                    reasonTimeFilter === "custom" 
                      ? "border-orange-500 ring-2 ring-orange-200" 
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                />
                {reasonCustomDate && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => {
                      setReasonCustomDate("");
                      setReasonTimeFilter("all");
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={exportToCSV}
                className="gap-1.5"
              >
                <Download className="h-4 w-4" />
                CSV İndir
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRefresh} 
                disabled={loadingStats}
                className="gap-1.5"
              >
                <RefreshCw className={`h-4 w-4 ${loadingStats ? "animate-spin" : ""}`} />
                Yenile
              </Button>
            </div>
          </div>
          
          {/* Aktif Filtre Göstergesi */}
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
            <Filter className="h-4 w-4 text-slate-400" />
            <span className="text-sm text-slate-500">Aktif dönem:</span>
            <Badge className="bg-orange-100 text-orange-700">
              {periodLabels[reasonTimeFilter]}
            </Badge>
            {loadingCustomStats && (
              <RefreshCw className="h-3 w-3 animate-spin text-orange-500" />
            )}
            
            {/* Trend göstergesi */}
            {reasonTimeFilter === "week" && weekToMonthTrend.direction !== "stable" && (
              <div className="ml-auto flex items-center gap-1">
                {weekToMonthTrend.direction === "up" ? (
                  <Badge className="bg-red-100 text-red-700 gap-1">
                    <TrendingUp className="h-3 w-3" />
                    Aylık ortalamadan %{Math.abs(weekToMonthTrend.percentage)} fazla
                  </Badge>
                ) : (
                  <Badge className="bg-green-100 text-green-700 gap-1">
                    <TrendingDown className="h-3 w-3" />
                    Aylık ortalamadan %{Math.abs(weekToMonthTrend.percentage)} az
                  </Badge>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* İçerik - Kartlar veya Grafikler */}
      {viewMode === "cards" ? (
        /* Neden Kartları */
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {YONLENDIRME_NEDENLERI.map((neden, idx) => {
            const reasonData = getReasonData();
            const count = reasonData?.[neden] ?? 0;
            const totalForPeriod = getTotalForPeriod();
            const percentage = totalForPeriod && totalForPeriod > 0 
              ? Math.round((count / totalForPeriod) * 100) 
              : 0;
            const colorSet = CARD_COLORS[idx % CARD_COLORS.length];
            const isSelected = selectedReason === neden;
            const rank = chartData.findIndex(d => d.name === neden) + 1;

            return (
              <Card 
                key={neden} 
                className={`relative overflow-hidden transition-all duration-300 cursor-pointer ${
                  isSelected 
                    ? "ring-2 ring-offset-2 ring-orange-500 shadow-xl scale-[1.02]" 
                    : count > 0 
                      ? "hover:shadow-lg hover:scale-[1.01]" 
                      : "opacity-50"
                } ${colorSet.light}`}
                onClick={() => count > 0 && handleReasonClick(neden)}
              >
                {/* Sıralama rozeti */}
                {count > 0 && rank <= 3 && (
                  <div className={`absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                    rank === 1 ? "bg-yellow-500" : rank === 2 ? "bg-slate-400" : "bg-amber-600"
                  }`}>
                    {rank}
                  </div>
                )}
                
                <CardHeader className="pb-1">
                  <CardTitle className={`text-xs font-medium truncate flex items-center gap-2 ${colorSet.text}`} title={neden}>
                    <span className="truncate">{neden}</span>
                    {isSelected && (
                      <Badge className="bg-orange-500 text-white text-[10px]">Seçili</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end justify-between">
                    <div>
                      <div className={`text-3xl font-bold ${colorSet.text}`}>
                        {loadingStats || loadingCustomStats ? "…" : count}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">yönlendirme</div>
                    </div>
                    <div className="text-right">
                      <div className={`text-xl font-bold ${colorSet.text} opacity-70`}>
                        %{percentage}
                      </div>
                      <div className="text-[10px] text-slate-400">oran</div>
                    </div>
                  </div>
                  
                  {/* Progress bar */}
                  <div className="mt-3 h-2 bg-white/50 rounded-full overflow-hidden">
                    <div 
                      className={`h-full bg-gradient-to-r ${colorSet.bg} rounded-full transition-all duration-700`}
                      style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                  </div>
                  
                  {count > 0 && (
                    <div className="mt-2 flex items-center justify-center gap-1 text-[10px] text-slate-500">
                      <Eye className="h-3 w-3" />
                      Detay için tıklayın
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        /* Grafik Görünümü */
        <div className="grid gap-6 lg:grid-cols-2">
          <ReasonPieChart 
            data={chartData} 
            title={`${periodLabels[reasonTimeFilter]} - Neden Dağılımı`}
          />
          <ReasonBarChart 
            data={chartData} 
            title={`${periodLabels[reasonTimeFilter]} - Neden Sıralaması`}
          />
          <div className="lg:col-span-2">
            <TopReasonsCard 
              data={chartData} 
              title="En Çok Yönlendirme Nedenleri"
            />
          </div>
        </div>
      )}

      {/* Seçili Neden Öğrenci Listesi */}
      {selectedReason && (
        <Card className="bg-white/90 backdrop-blur border-orange-200 shadow-xl">
          <CardHeader className="pb-2 border-b border-orange-100">
            <CardTitle className="text-sm font-medium text-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-100">
                  <Users className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <span className="text-orange-700 font-semibold">{selectedReason}</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge className="bg-orange-100 text-orange-700">
                      {reasonStudents.length} öğrenci
                    </Badge>
                    <span className="text-xs text-slate-500">
                      {periodLabels[reasonTimeFilter]}
                    </span>
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1"
                onClick={() => {
                  setSelectedReason(null);
                  setReasonStudents([]);
                }}
              >
                <X className="h-4 w-4" />
                Kapat
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {reasonStudents.length === 0 ? (
              <div className="text-center py-8">
                <AlertTriangle className="h-10 w-10 mx-auto text-slate-300 mb-2" />
                <p className="text-sm text-slate-400">
                  Bu dönemde bu nedenle yönlendirilen öğrenci bulunamadı.
                </p>
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-slate-500 border-b sticky top-0 bg-white">
                    <tr>
                      <th className="text-left py-3 font-medium w-10">#</th>
                      <th className="text-left py-3 font-medium">Öğrenci</th>
                      <th className="text-left py-3 font-medium">Sınıf</th>
                      <th className="text-left py-3 font-medium">Tarih</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reasonStudents.map((s, idx) => (
                      <tr 
                        key={`${s.student_name}-${idx}`} 
                        className="hover:bg-orange-50/50 transition-colors"
                      >
                        <td className="py-3 text-slate-400 text-xs font-medium">{idx + 1}</td>
                        <td className="py-3">
                          <ClickableStudent studentName={s.student_name} classDisplay={s.class_display} />
                        </td>
                        <td className="py-3">
                          <Badge variant="outline" className="bg-slate-50">
                            {s.class_display}
                          </Badge>
                        </td>
                        <td className="py-3 text-slate-500 text-xs">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {s.date ? new Date(s.date).toLocaleDateString('tr-TR') : '-'}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Yardım Kartı */}
      <Card className="bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-amber-100">
              <Sparkles className="h-5 w-5 text-amber-600" />
            </div>
            <div className="text-sm">
              <p className="font-medium text-amber-800">İpuçları</p>
              <ul className="mt-1 space-y-1 text-amber-700 text-xs">
                <li className="flex items-center gap-1">
                  <ChevronRight className="h-3 w-3" />
                  Neden kartlarına tıklayarak o nedenle yönlendirilen öğrencileri görebilirsiniz
                </li>
                <li className="flex items-center gap-1">
                  <ChevronRight className="h-3 w-3" />
                  Dönem kartlarına tıklayarak farklı zaman dilimlerini filtreleyebilirsiniz
                </li>
                <li className="flex items-center gap-1">
                  <ChevronRight className="h-3 w-3" />
                  Grafik görünümünde verileri görsel olarak analiz edebilirsiniz
                </li>
                <li className="flex items-center gap-1">
                  <ChevronRight className="h-3 w-3" />
                  CSV İndir butonu ile verileri Excel'e aktarabilirsiniz
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
