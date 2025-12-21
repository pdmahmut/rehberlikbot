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
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatsResponse } from "@/app/panel/types";
import { 
  TrendingUp, 
  Users, 
  BookOpen, 
  Award, 
  Calendar,
  Target,
  Activity,
  BarChart3
} from "lucide-react";

// Renk paleti
const COLORS = {
  primary: "#8b5cf6",
  secondary: "#06b6d4",
  tertiary: "#f59e0b",
  quaternary: "#10b981",
  danger: "#ef4444",
  pink: "#ec4899",
};

const PIE_COLORS = [
  "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444",
  "#ec4899", "#3b82f6", "#84cc16", "#f97316", "#6366f1",
];

const GRADIENT_COLORS = [
  { start: "#8b5cf6", end: "#6366f1" },
  { start: "#06b6d4", end: "#0891b2" },
  { start: "#10b981", end: "#059669" },
  { start: "#f59e0b", end: "#d97706" },
  { start: "#ef4444", end: "#dc2626" },
];

interface TeacherChartsProps {
  stats: StatsResponse | null;
  loading?: boolean;
  teacherName?: string;
}

// Öğretmen Özet Kartı
export function TeacherSummaryCard({ 
  stats, 
  loading, 
  teacherName 
}: TeacherChartsProps) {
  const teacherStats = useMemo(() => {
    if (!stats || !teacherName) return null;
    
    const count = stats.byTeacher?.[teacherName] || 0;
    const allTeachers = Object.entries(stats.byTeacher || {}).sort((a, b) => b[1] - a[1]);
    const rank = allTeachers.findIndex(([name]) => name === teacherName) + 1;
    const totalTeachers = allTeachers.length;
    
    // Günlük ortalama hesapla
    const todayReferrals = stats.todayStudents?.length || 0;
    
    return {
      totalReferrals: count,
      rank,
      totalTeachers,
      todayReferrals,
      percentile: totalTeachers > 0 ? Math.round(((totalTeachers - rank + 1) / totalTeachers) * 100) : 0,
    };
  }, [stats, teacherName]);

  if (loading || !teacherStats) {
    return (
      <Card className="bg-gradient-to-br from-violet-500 to-purple-600 text-white border-0 shadow-xl">
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-32">
            <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-600 text-white border-0 shadow-xl overflow-hidden relative">
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-12 -translate-x-12" />
      
      <CardContent className="p-6 relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-violet-200 text-sm font-medium">Seçili Öğretmen</p>
            <h2 className="text-2xl font-bold mt-1">{teacherName}</h2>
          </div>
          <div className="p-3 bg-white/20 rounded-xl backdrop-blur">
            <Award className="h-6 w-6" />
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="text-center p-3 bg-white/10 rounded-xl backdrop-blur">
            <div className="text-3xl font-bold">{teacherStats.totalReferrals}</div>
            <div className="text-xs text-violet-200 mt-1">Toplam</div>
          </div>
          <div className="text-center p-3 bg-white/10 rounded-xl backdrop-blur">
            <div className="text-3xl font-bold">#{teacherStats.rank}</div>
            <div className="text-xs text-violet-200 mt-1">Sıralama</div>
          </div>
          <div className="text-center p-3 bg-white/10 rounded-xl backdrop-blur">
            <div className="text-3xl font-bold">%{teacherStats.percentile}</div>
            <div className="text-xs text-violet-200 mt-1">Yüzdelik</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Öğretmen Neden Dağılımı
export function TeacherReasonChart({ stats, loading, teacherName }: TeacherChartsProps) {
  const data = useMemo(() => {
    if (!stats?.byReason) return [];
    return Object.entries(stats.byReason)
      .map(([name, value]) => ({ 
        name: name.length > 20 ? name.slice(0, 20) + "..." : name, 
        value, 
        fullName: name 
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [stats]);

  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (loading) {
    return (
      <Card className="bg-white/80 backdrop-blur border-0 shadow-lg">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-700">Yönlendirme Nedenleri</CardTitle>
        </CardHeader>
        <CardContent className="h-[280px] flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card className="bg-white/80 backdrop-blur border-0 shadow-lg">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-700">Yönlendirme Nedenleri</CardTitle>
        </CardHeader>
        <CardContent className="h-[280px] flex items-center justify-center">
          <div className="text-center">
            <BookOpen className="h-12 w-12 mx-auto text-slate-300 mb-2" />
            <p className="text-slate-500 text-sm">Veri bulunamadı</p>
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
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600">
              <BookOpen className="h-3.5 w-3.5 text-white" />
            </div>
            Yönlendirme Nedenleri
          </CardTitle>
          <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
            Toplam: {total}
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <defs>
              {PIE_COLORS.map((color, index) => (
                <linearGradient key={index} id={`pieGradient${index}`} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={1} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.7} />
                </linearGradient>
              ))}
            </defs>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={85}
              paddingAngle={3}
              dataKey="value"
              animationBegin={0}
              animationDuration={800}
            >
              {data.map((_, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={`url(#pieGradient${index})`}
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
                    <div className="bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl shadow-xl p-3">
                      <p className="text-sm font-medium text-slate-700 max-w-[180px]">{data.fullName}</p>
                      <p className="text-lg font-bold text-violet-600">{data.value} <span className="text-sm text-slate-500">(%{percentage})</span></p>
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
              wrapperStyle={{ paddingLeft: 10 }}
              formatter={(value) => <span className="text-xs text-slate-600">{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// Sınıf Bazlı Dağılım
export function TeacherClassChart({ stats, loading }: TeacherChartsProps) {
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

  if (loading || data.length === 0) {
    return null;
  }

  return (
    <Card className="bg-white/80 backdrop-blur border-0 shadow-lg hover:shadow-xl transition-all duration-300">
      <CardHeader className="pb-0">
        <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600">
            <Users className="h-3.5 w-3.5 text-white" />
          </div>
          Sınıf Dağılımı
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} layout="vertical" margin={{ left: 0, right: 20 }}>
            <defs>
              <linearGradient id="classBarGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#06b6d4" />
                <stop offset="100%" stopColor="#3b82f6" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
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
                    <div className="bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl shadow-xl p-3">
                      <p className="text-sm font-medium text-slate-700">{data.fullName}</p>
                      <p className="text-lg font-bold text-cyan-600">{data.value} yönlendirme</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar 
              dataKey="value" 
              fill="url(#classBarGradient)" 
              radius={[0, 6, 6, 0]}
              animationDuration={800}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// Haftalık Aktivite Grafiği
export function TeacherActivityChart({ stats, loading }: TeacherChartsProps) {
  const data = useMemo(() => {
    if (!stats?.allStudents) return [];
    
    const today = new Date();
    const days: { date: string; label: string; count: number }[] = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateStr = date.toISOString().slice(0, 10);
      const dayName = date.toLocaleDateString('tr-TR', { weekday: 'short' });
      days.push({ date: dateStr, label: dayName, count: 0 });
    }
    
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
          <CardTitle className="text-sm font-medium text-slate-700">Haftalık Aktivite</CardTitle>
        </CardHeader>
        <CardContent className="h-[200px] flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </CardContent>
      </Card>
    );
  }

  const maxCount = Math.max(...data.map(d => d.count), 1);
  const totalWeek = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <Card className="bg-white/80 backdrop-blur border-0 shadow-lg hover:shadow-xl transition-all duration-300">
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600">
              <Activity className="h-3.5 w-3.5 text-white" />
            </div>
            Son 7 Gün Aktivitesi
          </CardTitle>
          <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
            {totalWeek} yönlendirme
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="activityGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip 
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl shadow-xl p-3">
                      <p className="text-lg font-bold text-emerald-600">{payload[0].value} yönlendirme</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Area 
              type="monotone" 
              dataKey="count" 
              stroke="#10b981" 
              strokeWidth={3}
              fill="url(#activityGradient)"
              dot={{ fill: "#10b981", strokeWidth: 2, stroke: "#fff", r: 4 }}
              activeDot={{ r: 6, stroke: "#10b981", strokeWidth: 2, fill: "#fff" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// Performans Radar Grafiği
export function TeacherPerformanceRadar({ stats, loading, teacherName }: TeacherChartsProps) {
  const data = useMemo(() => {
    if (!stats || !teacherName) return [];
    
    const total = stats.byTeacher?.[teacherName] || 0;
    const allCounts = Object.values(stats.byTeacher || {});
    const maxCount = Math.max(...allCounts, 1);
    const avgCount = allCounts.length > 0 ? allCounts.reduce((a, b) => a + b, 0) / allCounts.length : 0;
    
    // Performans metrikleri
    return [
      { subject: 'Toplam', value: Math.min((total / maxCount) * 100, 100), fullMark: 100 },
      { subject: 'Bugün', value: Math.min(((stats.todayCount || 0) / Math.max(total, 1)) * 100, 100), fullMark: 100 },
      { subject: 'Hafta', value: Math.min(((stats.weekCount || 0) / Math.max(total, 1)) * 100, 100), fullMark: 100 },
      { subject: 'Ortalama', value: avgCount > 0 ? Math.min((total / avgCount) * 50, 100) : 50, fullMark: 100 },
      { subject: 'Aktiflik', value: total > 0 ? Math.min((stats.todayStudents?.length || 0) / total * 100 + 30, 100) : 30, fullMark: 100 },
    ];
  }, [stats, teacherName]);

  if (loading || data.length === 0 || !teacherName) {
    return null;
  }

  return (
    <Card className="bg-white/80 backdrop-blur border-0 shadow-lg hover:shadow-xl transition-all duration-300">
      <CardHeader className="pb-0">
        <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600">
            <Target className="h-3.5 w-3.5 text-white" />
          </div>
          Performans Analizi
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        <ResponsiveContainer width="100%" height={220}>
          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
            <PolarGrid stroke="#e2e8f0" />
            <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: "#64748b" }} />
            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
            <Radar
              name="Performans"
              dataKey="value"
              stroke="#f59e0b"
              fill="#f59e0b"
              fillOpacity={0.3}
              strokeWidth={2}
            />
            <Tooltip 
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl shadow-xl p-3">
                      <p className="text-sm font-medium text-slate-700">{payload[0].payload.subject}</p>
                      <p className="text-lg font-bold text-amber-600">%{Math.round(payload[0].value as number)}</p>
                    </div>
                  );
                }
                return null;
              }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// Öğretmen Sıralaması
export function TeacherRankingList({ stats, loading, teacherName }: TeacherChartsProps) {
  const data = useMemo(() => {
    if (!stats?.byTeacher) return [];
    return Object.entries(stats.byTeacher)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [stats]);

  const maxValue = data.length > 0 ? data[0].value : 1;

  if (loading || data.length === 0) {
    return null;
  }

  return (
    <Card className="bg-white/80 backdrop-blur border-0 shadow-lg hover:shadow-xl transition-all duration-300">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-pink-500 to-rose-600">
            <BarChart3 className="h-3.5 w-3.5 text-white" />
          </div>
          Öğretmen Sıralaması
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-2">
          {data.map((teacher, index) => {
            const isSelected = teacher.name === teacherName;
            const percentage = (teacher.value / maxValue) * 100;
            
            return (
              <div 
                key={teacher.name} 
                className={`group relative p-2.5 rounded-xl transition-all duration-200 ${
                  isSelected 
                    ? 'bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200 shadow-sm' 
                    : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                    index === 0 ? 'bg-gradient-to-br from-amber-400 to-yellow-500 text-white' :
                    index === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-400 text-white' :
                    index === 2 ? 'bg-gradient-to-br from-amber-600 to-amber-700 text-white' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-sm font-medium truncate ${isSelected ? 'text-violet-700' : 'text-slate-700'}`}>
                        {teacher.name}
                      </span>
                      <span className={`text-sm font-bold ${isSelected ? 'text-violet-600' : 'text-slate-600'}`}>
                        {teacher.value}
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          isSelected 
                            ? 'bg-gradient-to-r from-violet-500 to-purple-500' 
                            : 'bg-gradient-to-r from-slate-300 to-slate-400'
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// Ana Export
export function TeacherDashboard({ stats, loading, teacherName }: TeacherChartsProps) {
  return (
    <div className="space-y-4">
      {teacherName && (
        <TeacherSummaryCard stats={stats} loading={loading} teacherName={teacherName} />
      )}
      
      <div className="grid gap-4 lg:grid-cols-2">
        <TeacherReasonChart stats={stats} loading={loading} teacherName={teacherName} />
        <TeacherClassChart stats={stats} loading={loading} teacherName={teacherName} />
      </div>
      
      <div className="grid gap-4 lg:grid-cols-2">
        <TeacherActivityChart stats={stats} loading={loading} teacherName={teacherName} />
        {teacherName && (
          <TeacherPerformanceRadar stats={stats} loading={loading} teacherName={teacherName} />
        )}
      </div>
      
      <TeacherRankingList stats={stats} loading={loading} teacherName={teacherName} />
    </div>
  );
}
