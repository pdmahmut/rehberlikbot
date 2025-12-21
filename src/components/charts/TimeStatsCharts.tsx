"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
  RadialBarChart,
  RadialBar,
  ComposedChart,
  Line,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatsResponse, TimeFilter } from "@/app/panel/types";
import { TrendingUp, TrendingDown, Minus, Clock, Users, BookOpen, Award } from "lucide-react";

// Renk paleti
const COLORS = {
  primary: "#3b82f6",
  secondary: "#10b981",
  tertiary: "#f59e0b",
  quaternary: "#8b5cf6",
  danger: "#ef4444",
  pink: "#ec4899",
  cyan: "#06b6d4",
  lime: "#84cc16",
};

const PIE_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
];

interface TimeStatsChartsProps {
  stats: StatsResponse | null;
  loading?: boolean;
  timeFilter: TimeFilter;
  customDate?: string;
}

// Özel Tooltip
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl shadow-xl p-4 animate-in fade-in-0 zoom-in-95 duration-200">
        <p className="text-sm font-semibold text-slate-800 mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-slate-600">{entry.name}:</span>
            <span className="font-bold text-slate-900">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

// Radial Progress Card
function RadialProgressCard({ 
  title, 
  value, 
  maxValue, 
  icon: Icon, 
  color,
  subtitle 
}: { 
  title: string; 
  value: number; 
  maxValue: number; 
  icon: any;
  color: string;
  subtitle: string;
}) {
  const percentage = maxValue > 0 ? Math.round((value / maxValue) * 100) : 0;
  const data = [{ name: title, value: percentage, fill: color }];

  return (
    <Card className="bg-white/80 backdrop-blur border-0 shadow-lg hover:shadow-xl transition-all duration-300">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div 
              className="p-2 rounded-lg" 
              style={{ backgroundColor: `${color}15` }}
            >
              <Icon className="h-4 w-4" style={{ color }} />
            </div>
            <span className="text-sm font-medium text-slate-600">{title}</span>
          </div>
          <span className="text-2xl font-bold" style={{ color }}>{value}</span>
        </div>
        <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden">
          <div 
            className="absolute h-full rounded-full transition-all duration-1000 ease-out"
            style={{ 
              width: `${percentage}%`, 
              background: `linear-gradient(90deg, ${color}, ${color}dd)` 
            }}
          />
        </div>
        <p className="text-xs text-slate-500 mt-2">{subtitle}</p>
      </CardContent>
    </Card>
  );
}

// Haftalık Trend Chart
export function WeeklyTrendChart({ stats, loading, timeFilter }: TimeStatsChartsProps) {
  const data = useMemo(() => {
    if (!stats?.allStudents) return [];
    
    const today = new Date();
    const days: { date: string; label: string; shortLabel: string; count: number; fullDate: string }[] = [];
    
    // Son 7 gün
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateStr = date.toISOString().slice(0, 10);
      const dayName = date.toLocaleDateString('tr-TR', { weekday: 'short' });
      const fullDate = date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
      days.push({ 
        date: dateStr, 
        label: fullDate, 
        shortLabel: dayName,
        count: 0,
        fullDate: date.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })
      });
    }
    
    // Sayıları hesapla
    stats.allStudents.forEach(student => {
      const day = days.find(d => d.date === student.date);
      if (day) day.count++;
    });
    
    return days;
  }, [stats]);

  if (loading) {
    return (
      <Card className="bg-white/80 backdrop-blur border-0 shadow-lg">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-700">Haftalık Trend</CardTitle>
        </CardHeader>
        <CardContent className="h-[280px] flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-slate-500">Yükleniyor...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const maxCount = Math.max(...data.map(d => d.count), 1);
  const totalWeek = data.reduce((sum, d) => sum + d.count, 0);
  const avgDay = Math.round(totalWeek / 7 * 10) / 10;

  return (
    <Card className="bg-white/80 backdrop-blur border-0 shadow-lg hover:shadow-xl transition-all duration-300">
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600">
              <TrendingUp className="h-3.5 w-3.5 text-white" />
            </div>
            Son 7 Gün Trendi
          </CardTitle>
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1 bg-blue-50 px-2 py-1 rounded-full">
              <span className="text-blue-600">Toplam:</span>
              <span className="font-bold text-blue-700">{totalWeek}</span>
            </div>
            <div className="flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded-full">
              <span className="text-emerald-600">Ort:</span>
              <span className="font-bold text-emerald-700">{avgDay}/gün</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorTrend" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis 
              dataKey="label" 
              tick={{ fontSize: 11, fill: "#64748b" }} 
              axisLine={{ stroke: "#e2e8f0" }}
              tickLine={false}
            />
            <YAxis 
              tick={{ fontSize: 11, fill: "#64748b" }} 
              allowDecimals={false} 
              axisLine={false}
              tickLine={false}
            />
            <Tooltip 
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl shadow-xl p-3 animate-in fade-in-0 zoom-in-95">
                      <p className="text-sm font-medium text-slate-700">{data.fullDate}</p>
                      <p className="text-lg font-bold text-blue-600">{data.count} yönlendirme</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Area 
              type="monotone" 
              dataKey="count" 
              name="Yönlendirme"
              stroke="#3b82f6" 
              strokeWidth={3}
              fill="url(#colorTrend)"
              dot={{ fill: "#3b82f6", strokeWidth: 2, stroke: "#fff", r: 4 }}
              activeDot={{ r: 6, stroke: "#3b82f6", strokeWidth: 2, fill: "#fff" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// Neden Dağılımı Pasta Grafiği
export function ReasonDistributionChart({ stats, loading, timeFilter }: TimeStatsChartsProps) {
  const data = useMemo(() => {
    const reasonData = timeFilter === "today" ? stats?.byReasonToday 
      : timeFilter === "week" ? stats?.byReasonWeek 
      : timeFilter === "month" ? stats?.byReasonMonth 
      : stats?.byReason;
    
    if (!reasonData) return [];
    return Object.entries(reasonData)
      .map(([name, value]) => ({ 
        name: name.length > 25 ? name.slice(0, 25) + "..." : name, 
        value, 
        fullName: name 
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [stats, timeFilter]);

  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (loading) {
    return (
      <Card className="bg-white/80 backdrop-blur border-0 shadow-lg">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-700">Neden Dağılımı</CardTitle>
        </CardHeader>
        <CardContent className="h-[280px] flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-slate-500">Yükleniyor...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card className="bg-white/80 backdrop-blur border-0 shadow-lg">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-700">Neden Dağılımı</CardTitle>
        </CardHeader>
        <CardContent className="h-[280px] flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-slate-100 flex items-center justify-center">
              <BookOpen className="h-8 w-8 text-slate-400" />
            </div>
            <p className="text-slate-500 text-sm">Bu dönemde veri yok</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/80 backdrop-blur border-0 shadow-lg hover:shadow-xl transition-all duration-300">
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600">
              <BookOpen className="h-3.5 w-3.5 text-white" />
            </div>
            Yönlendirme Nedenleri
          </CardTitle>
          <div className="bg-slate-100 px-2 py-1 rounded-full">
            <span className="text-xs font-medium text-slate-600">Toplam: {total}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={3}
              dataKey="value"
              animationBegin={0}
              animationDuration={800}
            >
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={PIE_COLORS[index % PIE_COLORS.length]}
                  stroke="white"
                  strokeWidth={2}
                />
              ))}
            </Pie>
            <Tooltip 
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  const percentage = total > 0 ? Math.round((data.value / total) * 100) : 0;
                  return (
                    <div className="bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl shadow-xl p-3 animate-in fade-in-0 zoom-in-95">
                      <p className="text-sm font-medium text-slate-700 max-w-[200px]">{data.fullName}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-lg font-bold" style={{ color: PIE_COLORS[data.index || 0] }}>
                          {data.value}
                        </span>
                        <span className="text-sm text-slate-500">(%{percentage})</span>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend 
              layout="vertical" 
              align="right" 
              verticalAlign="middle"
              wrapperStyle={{ paddingLeft: 20 }}
              formatter={(value) => (
                <span className="text-xs text-slate-600">{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// Sınıf Bazlı Bar Chart
export function ClassDistributionChart({ stats, loading }: TimeStatsChartsProps) {
  const data = useMemo(() => {
    if (!stats?.byClass) return [];
    return Object.entries(stats.byClass)
      .map(([name, value]) => ({ 
        name: name.replace(" / ", "/").replace(" Sınıf", ""), 
        value,
        fullName: name
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [stats]);

  if (loading) {
    return (
      <Card className="bg-white/80 backdrop-blur border-0 shadow-lg">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-700">Sınıf Dağılımı</CardTitle>
        </CardHeader>
        <CardContent className="h-[280px] flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-slate-500">Yükleniyor...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card className="bg-white/80 backdrop-blur border-0 shadow-lg">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-700">Sınıf Dağılımı</CardTitle>
        </CardHeader>
        <CardContent className="h-[280px] flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-slate-100 flex items-center justify-center">
              <Users className="h-8 w-8 text-slate-400" />
            </div>
            <p className="text-slate-500 text-sm">Bu dönemde veri yok</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/80 backdrop-blur border-0 shadow-lg hover:shadow-xl transition-all duration-300">
      <CardHeader className="pb-0">
        <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600">
            <Users className="h-3.5 w-3.5 text-white" />
          </div>
          En Çok Yönlendirme Yapılan Sınıflar
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} layout="vertical" margin={{ left: 0, right: 20 }}>
            <defs>
              <linearGradient id="barGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#f97316" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
            <XAxis 
              type="number" 
              tick={{ fontSize: 11, fill: "#64748b" }} 
              axisLine={{ stroke: "#e2e8f0" }}
              tickLine={false}
            />
            <YAxis 
              type="category" 
              dataKey="name" 
              width={70} 
              tick={{ fontSize: 11, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip 
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl shadow-xl p-3 animate-in fade-in-0 zoom-in-95">
                      <p className="text-sm font-medium text-slate-700">{data.fullName}</p>
                      <p className="text-lg font-bold text-amber-600">{data.value} yönlendirme</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar 
              dataKey="value" 
              name="Yönlendirme"
              fill="url(#barGradient)" 
              radius={[0, 6, 6, 0]}
              animationDuration={800}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// Öğretmen Performans Chart
export function TeacherPerformanceChart({ stats, loading }: TimeStatsChartsProps) {
  const data = useMemo(() => {
    if (!stats?.byTeacher) return [];
    return Object.entries(stats.byTeacher)
      .map(([name, value]) => ({ 
        name: name.split(" ").slice(0, 2).join(" "), 
        value,
        fullName: name 
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [stats]);

  if (loading || data.length === 0) {
    return null;
  }

  const maxValue = Math.max(...data.map(d => d.value));

  return (
    <Card className="bg-white/80 backdrop-blur border-0 shadow-lg hover:shadow-xl transition-all duration-300">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600">
            <Award className="h-3.5 w-3.5 text-white" />
          </div>
          Öğretmen Aktivitesi
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {data.map((teacher, index) => {
            const percentage = (teacher.value / maxValue) * 100;
            const colors = [
              "from-violet-500 to-purple-600",
              "from-blue-500 to-indigo-600",
              "from-emerald-500 to-teal-600",
              "from-amber-500 to-orange-600",
              "from-pink-500 to-rose-600",
              "from-cyan-500 to-sky-600",
            ];
            return (
              <div key={teacher.name} className="group">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${colors[index]} flex items-center justify-center text-white text-xs font-bold`}>
                      {index + 1}
                    </div>
                    <span className="text-sm text-slate-700 group-hover:text-slate-900 transition-colors">
                      {teacher.fullName}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-slate-800">{teacher.value}</span>
                </div>
                <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden ml-8">
                  <div 
                    className={`absolute h-full rounded-full bg-gradient-to-r ${colors[index]} transition-all duration-700 ease-out`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// Ana Summary Stats
export function TimeSummaryStats({ 
  stats, 
  loading, 
  timeFilter 
}: TimeStatsChartsProps) {
  const currentValue = useMemo(() => {
    if (!stats) return 0;
    switch (timeFilter) {
      case "today": return stats.todayCount;
      case "week": return stats.weekCount;
      case "month": return stats.monthCount ?? 0;
      default: return stats.totalCount ?? 0;
    }
  }, [stats, timeFilter]);

  const previousValue = useMemo(() => {
    if (!stats) return 0;
    // Basit karşılaştırma: önceki dönemin tahmini değeri
    switch (timeFilter) {
      case "today": return Math.round(stats.weekCount / 7);
      case "week": return Math.round((stats.monthCount ?? 0) / 4);
      case "month": return Math.round((stats.totalCount ?? 0) / 12);
      default: return 0;
    }
  }, [stats, timeFilter]);

  const trend = previousValue > 0 
    ? Math.round(((currentValue - previousValue) / previousValue) * 100) 
    : 0;

  const TrendIcon = trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus;
  const trendColor = trend > 0 ? "text-emerald-600" : trend < 0 ? "text-red-500" : "text-slate-500";
  const trendBg = trend > 0 ? "bg-emerald-50" : trend < 0 ? "bg-red-50" : "bg-slate-50";

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <RadialProgressCard
        title="Seçili Dönem"
        value={currentValue}
        maxValue={stats?.totalCount ?? currentValue}
        icon={Clock}
        color={COLORS.primary}
        subtitle={`${timeFilter === "today" ? "Bugün" : timeFilter === "week" ? "Bu hafta" : timeFilter === "month" ? "Bu ay" : "Tüm zamanlar"} toplam`}
      />
      <RadialProgressCard
        title="Günlük Ortalama"
        value={timeFilter === "week" 
          ? Math.round((stats?.weekCount ?? 0) / 7 * 10) / 10
          : timeFilter === "month"
          ? Math.round((stats?.monthCount ?? 0) / 30 * 10) / 10
          : stats?.todayCount ?? 0}
        maxValue={Math.max(stats?.todayCount ?? 0, Math.round((stats?.weekCount ?? 0) / 7))}
        icon={TrendingUp}
        color={COLORS.secondary}
        subtitle="yönlendirme/gün"
      />
      <RadialProgressCard
        title="Bu Hafta"
        value={stats?.weekCount ?? 0}
        maxValue={stats?.monthCount ?? stats?.weekCount ?? 0}
        icon={Users}
        color={COLORS.tertiary}
        subtitle="haftalık toplam"
      />
      <Card className="bg-white/80 backdrop-blur border-0 shadow-lg hover:shadow-xl transition-all duration-300">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-violet-50">
                <Award className="h-4 w-4 text-violet-600" />
              </div>
              <span className="text-sm font-medium text-slate-600">En Aktif</span>
            </div>
          </div>
          <div className="text-lg font-bold text-slate-900 truncate">
            {loading ? "…" : stats?.topTeacher?.name ?? "Henüz veri yok"}
          </div>
          {stats?.topTeacher && (
            <div className="flex items-center gap-2 mt-2">
              <span className={`text-xs px-2 py-0.5 rounded-full ${trendBg} ${trendColor} font-medium flex items-center gap-1`}>
                <TrendIcon className="h-3 w-3" />
                {stats.topTeacher.count} yönlendirme
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Birleşik Export
export function TimeStatsCharts({ stats, loading, timeFilter, customDate }: TimeStatsChartsProps) {
  return (
    <div className="space-y-4">
      <TimeSummaryStats stats={stats} loading={loading} timeFilter={timeFilter} customDate={customDate} />
      
      <div className="grid gap-4 lg:grid-cols-2">
        <WeeklyTrendChart stats={stats} loading={loading} timeFilter={timeFilter} customDate={customDate} />
        <ReasonDistributionChart stats={stats} loading={loading} timeFilter={timeFilter} customDate={customDate} />
      </div>
      
      <div className="grid gap-4 lg:grid-cols-2">
        <ClassDistributionChart stats={stats} loading={loading} timeFilter={timeFilter} customDate={customDate} />
        <TeacherPerformanceChart stats={stats} loading={loading} timeFilter={timeFilter} customDate={customDate} />
      </div>
    </div>
  );
}
