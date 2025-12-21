"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatsResponse } from "@/app/panel/types";
import { 
  RefreshCw, 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  PieChartIcon, 
  Activity, 
  Users, 
  Target,
  Sparkles,
  Eye,
  EyeOff,
  Download,
  Maximize2,
  Calendar,
  Clock,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  GraduationCap,
  ChevronRight,
  LayoutGrid,
  LineChart
} from "lucide-react";

// Renk paleti
const COLORS = [
  "#3b82f6", // blue
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#84cc16", // lime
  "#f97316", // orange
  "#6366f1", // indigo
];

const GRADIENT_COLORS = {
  blue: { start: "#3b82f6", end: "#1d4ed8" },
  emerald: { start: "#10b981", end: "#059669" },
  amber: { start: "#f59e0b", end: "#d97706" },
  violet: { start: "#8b5cf6", end: "#7c3aed" },
  rose: { start: "#f43f5e", end: "#e11d48" },
  cyan: { start: "#06b6d4", end: "#0891b2" },
};

interface DashboardChartsProps {
  stats: StatsResponse | null;
  loading?: boolean;
}

// Modern Tooltip
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/95 backdrop-blur-xl border border-slate-200 rounded-xl shadow-2xl p-4 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100">
          <div className="w-2 h-2 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 animate-pulse" />
          <p className="text-sm font-semibold text-slate-800">{label}</p>
        </div>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center justify-between gap-4 text-sm">
            <span className="text-slate-600 flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: entry.color }} />
              {entry.name}
            </span>
            <span className="font-bold text-slate-800">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

// Loading Skeleton
const ChartSkeleton = ({ height = 300 }: { height?: number }) => (
  <div className="relative overflow-hidden" style={{ height }}>
    <div className="absolute inset-0 bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100 animate-pulse" />
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <RefreshCw className="h-8 w-8 text-slate-300 animate-spin" />
        <span className="text-sm text-slate-400">Veriler yükleniyor...</span>
      </div>
    </div>
    {/* Shimmer Effect */}
    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent animate-shimmer" />
  </div>
);

// Empty State
const EmptyState = ({ title }: { title: string }) => (
  <div className="h-[200px] flex flex-col items-center justify-center text-center">
    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center mb-4 animate-bounce-subtle">
      <BarChart3 className="h-8 w-8 text-slate-300" />
    </div>
    <p className="text-slate-500 text-sm font-medium">{title}</p>
    <p className="text-xs text-slate-400 mt-1">Veriler oluştukça burada görünecek</p>
  </div>
);

// Live Indicator
const LiveIndicator = () => (
  <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-50 border border-emerald-200">
    <span className="relative flex h-2 w-2">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
    </span>
    <span className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wider">Live</span>
  </div>
);

// Yönlendirme Nedenleri Pasta Grafiği - Modern
export function ReasonsPieChart({ stats, loading }: DashboardChartsProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [animatedData, setAnimatedData] = useState<any[]>([]);

  const data = useMemo(() => {
    if (!stats?.byReason) return [];
    const total = Object.values(stats.byReason).reduce((a, b) => a + b, 0);
    return Object.entries(stats.byReason)
      .map(([name, value]) => ({ 
        name: name.length > 20 ? name.slice(0, 20) + "..." : name, 
        value, 
        fullName: name,
        percentage: Math.round((value / total) * 100)
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [stats]);

  // Animate data on load
  useEffect(() => {
    if (data.length > 0) {
      setAnimatedData([]);
      data.forEach((item, index) => {
        setTimeout(() => {
          setAnimatedData(prev => [...prev, item]);
        }, index * 100);
      });
    }
  }, [data]);

  const onPieEnter = useCallback((_: any, index: number) => {
    setActiveIndex(index);
  }, []);

  const onPieLeave = useCallback(() => {
    setActiveIndex(null);
  }, []);

  if (loading) {
    return (
      <Card className="bg-white border-0 shadow-lg relative overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
            <PieChartIcon className="h-4 w-4 text-violet-500" />
            Yönlendirme Nedenleri
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartSkeleton />
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card className="bg-white border-0 shadow-lg">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
            <PieChartIcon className="h-4 w-4 text-violet-500" />
            Yönlendirme Nedenleri
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState title="Henüz neden verisi yok" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white border-0 shadow-lg relative overflow-hidden group">
      {/* Background Decorations */}
      <div className="absolute -top-16 -right-16 w-32 h-32 rounded-full bg-violet-100/50 blur-2xl animate-float-slow" />
      <div className="absolute -bottom-12 -left-12 w-24 h-24 rounded-full bg-pink-100/50 blur-2xl animate-float-reverse" />
      
      <CardHeader className="pb-2 bg-gradient-to-r from-violet-50 via-purple-50 to-pink-50 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 shadow-sm">
              <PieChartIcon className="h-3.5 w-3.5 text-white" />
            </div>
            Yönlendirme Nedenleri
          </CardTitle>
          <div className="flex items-center gap-2">
            <LiveIndicator />
            <Badge className="bg-violet-100 text-violet-700 border-violet-200 text-[10px]">
              {data.length} Neden
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4 relative">
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <defs>
              {COLORS.map((color, index) => (
                <linearGradient key={`gradient-${index}`} id={`pieGradient-${index}`} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={1} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.7} />
                </linearGradient>
              ))}
            </defs>
            <Pie
              data={animatedData}
              cx="50%"
              cy="50%"
              innerRadius={65}
              outerRadius={activeIndex !== null ? 110 : 100}
              paddingAngle={3}
              dataKey="value"
              onMouseEnter={onPieEnter}
              onMouseLeave={onPieLeave}
              animationBegin={0}
              animationDuration={800}
              animationEasing="ease-out"
            >
              {animatedData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={`url(#pieGradient-${index % COLORS.length})`}
                  stroke="white"
                  strokeWidth={2}
                  style={{
                    filter: activeIndex === index ? 'drop-shadow(0 4px 12px rgba(0,0,0,0.15))' : 'none',
                    transform: activeIndex === index ? 'scale(1.05)' : 'scale(1)',
                    transformOrigin: 'center',
                    transition: 'all 0.3s ease-out'
                  }}
                />
              ))}
            </Pie>
            <Tooltip 
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-white/95 backdrop-blur-xl border border-slate-200 rounded-xl shadow-2xl p-4">
                      <p className="text-sm font-semibold text-slate-800 mb-1">{data.fullName}</p>
                      <div className="flex items-center gap-4">
                        <span className="text-2xl font-bold text-violet-600">{data.value}</span>
                        <Badge className="bg-violet-100 text-violet-700">{data.percentage}%</Badge>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        
        {/* Center Stats */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none" style={{ marginTop: '-10px' }}>
          <p className="text-3xl font-bold text-slate-800">{data.reduce((a, b) => a + b.value, 0)}</p>
          <p className="text-xs text-slate-500">Toplam</p>
        </div>

        {/* Legend */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          {data.slice(0, 4).map((item, index) => (
            <div 
              key={item.name}
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 transition-colors cursor-default"
              onMouseEnter={() => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
            >
              <div 
                className="w-3 h-3 rounded-full flex-shrink-0" 
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
              />
              <span className="text-xs text-slate-600 truncate">{item.name}</span>
              <span className="text-xs font-bold text-slate-800 ml-auto">{item.percentage}%</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Sınıf Bazlı Bar Grafiği - Modern
export function ClassBarChart({ stats, loading }: DashboardChartsProps) {
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);

  const data = useMemo(() => {
    if (!stats?.byClass) return [];
    return Object.entries(stats.byClass)
      .map(([name, value]) => ({ 
        name: name.replace(" / ", "/").replace(" Sınıf", ""), 
        value,
        fullName: name 
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [stats]);

  if (loading) {
    return (
      <Card className="bg-white border-0 shadow-lg">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-cyan-500" />
            Sınıf Bazlı Yönlendirmeler
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartSkeleton />
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card className="bg-white border-0 shadow-lg">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-cyan-500" />
            Sınıf Bazlı Yönlendirmeler
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState title="Henüz sınıf verisi yok" />
        </CardContent>
      </Card>
    );
  }

  const maxValue = Math.max(...data.map(d => d.value));

  return (
    <Card className="bg-white border-0 shadow-lg relative overflow-hidden group">
      {/* Background Decorations */}
      <div className="absolute -top-16 -right-16 w-32 h-32 rounded-full bg-cyan-100/50 blur-2xl animate-float-slow" />
      <div className="absolute -bottom-12 -left-12 w-24 h-24 rounded-full bg-blue-100/50 blur-2xl animate-float-reverse" />
      
      <CardHeader className="pb-2 bg-gradient-to-r from-cyan-50 via-sky-50 to-blue-50 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 shadow-sm">
              <GraduationCap className="h-3.5 w-3.5 text-white" />
            </div>
            Sınıf Bazlı Yönlendirmeler
          </CardTitle>
          <div className="flex items-center gap-2">
            <LiveIndicator />
            <Badge className="bg-cyan-100 text-cyan-700 border-cyan-200 text-[10px]">
              Top 10
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4 relative">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} layout="vertical" margin={{ left: 0, right: 20, top: 5, bottom: 5 }}>
            <defs>
              <linearGradient id="classBarGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#06b6d4" />
                <stop offset="100%" stopColor="#3b82f6" />
              </linearGradient>
              <linearGradient id="classBarGradientHover" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#0891b2" />
                <stop offset="100%" stopColor="#2563eb" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
            <XAxis 
              type="number" 
              tick={{ fontSize: 11, fill: "#64748b" }} 
              axisLine={{ stroke: '#e2e8f0' }}
              tickLine={{ stroke: '#e2e8f0' }}
            />
            <YAxis 
              type="category" 
              dataKey="name" 
              width={70} 
              tick={{ fontSize: 11, fill: "#64748b" }}
              axisLine={{ stroke: '#e2e8f0' }}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar 
              dataKey="value" 
              name="Yönlendirme"
              fill="url(#classBarGradient)"
              radius={[0, 8, 8, 0]}
              onMouseEnter={(_, index) => setHoveredBar(index)}
              onMouseLeave={() => setHoveredBar(null)}
              animationDuration={1000}
              animationEasing="ease-out"
            >
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`}
                  fill={hoveredBar === index ? "url(#classBarGradientHover)" : "url(#classBarGradient)"}
                  style={{
                    filter: hoveredBar === index ? 'drop-shadow(0 2px 8px rgba(6, 182, 212, 0.4))' : 'none',
                    transition: 'all 0.2s ease-out'
                  }}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        
        {/* Stats Footer */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-slate-500 flex items-center gap-1">
            <Activity className="h-3 w-3" />
            En yoğun: <strong className="text-slate-700">{data[0]?.name}</strong>
          </span>
          <span className="text-slate-500">
            Maks: <strong className="text-cyan-600">{maxValue}</strong>
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// Öğretmen Performans Grafiği - Modern
export function TeacherBarChart({ stats, loading }: DashboardChartsProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  
  const data = useMemo(() => {
    if (!stats?.byTeacher) return [];
    return Object.entries(stats.byTeacher)
      .map(([name, value]) => ({ 
        name: name.length > 12 ? name.split(" ")[0] + " " + (name.split(" ")[1]?.[0] || "") + "." : name, 
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
    <Card className="bg-white border-0 shadow-lg relative overflow-hidden">
      {/* Background Decorations */}
      <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full bg-emerald-100/30 blur-3xl animate-float-slow" />
      <div className="absolute -bottom-16 -left-16 w-32 h-32 rounded-full bg-teal-100/30 blur-3xl animate-float-reverse" />
      
      <CardHeader className="pb-2 bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 shadow-sm">
              <Users className="h-3.5 w-3.5 text-white" />
            </div>
            Öğretmen Performansı
          </CardTitle>
          <div className="flex items-center gap-2">
            <LiveIndicator />
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">
              {data.length} Öğretmen
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4 relative">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} margin={{ bottom: 65, top: 10, left: -20, right: 10 }}>
            <defs>
              <linearGradient id="teacherGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#059669" />
              </linearGradient>
              <linearGradient id="teacherGradientHover" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#34d399" />
                <stop offset="100%" stopColor="#10b981" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis 
              dataKey="name" 
              tick={{ fontSize: 10, fill: "#64748b" }}
              angle={-45}
              textAnchor="end"
              height={60}
              axisLine={{ stroke: '#e2e8f0' }}
              tickLine={false}
            />
            <YAxis 
              tick={{ fontSize: 11, fill: "#64748b" }} 
              axisLine={{ stroke: '#e2e8f0' }}
              tickLine={false}
            />
            <Tooltip 
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-white/95 backdrop-blur-xl border border-slate-200 rounded-xl shadow-2xl p-4">
                      <p className="text-sm font-semibold text-slate-800 mb-2">{data.fullName}</p>
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-emerald-100">
                          <TrendingUp className="h-4 w-4 text-emerald-600" />
                        </div>
                        <span className="text-2xl font-bold text-emerald-600">{data.value}</span>
                        <span className="text-xs text-slate-500">yönlendirme</span>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar 
              dataKey="value" 
              name="Yönlendirme"
              fill="url(#teacherGradient)"
              radius={[8, 8, 0, 0]}
              onMouseEnter={(_, index) => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              animationDuration={1000}
              animationEasing="ease-out"
            >
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`}
                  fill={hoveredIndex === index ? "url(#teacherGradientHover)" : "url(#teacherGradient)"}
                  style={{
                    filter: hoveredIndex === index ? 'drop-shadow(0 4px 12px rgba(16, 185, 129, 0.4))' : 'none',
                    transition: 'all 0.2s ease-out'
                  }}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// Haftalık Trend Grafiği - Modern
export function WeeklyTrendChart({ stats, loading }: DashboardChartsProps) {
  const [animationActive, setAnimationActive] = useState(false);

  const data = useMemo(() => {
    if (!stats?.allStudents) return [];
    
    const today = new Date();
    const days: { date: string; label: string; count: number; dayNum: number }[] = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateStr = date.toISOString().slice(0, 10);
      const dayName = date.toLocaleDateString('tr-TR', { weekday: 'short' });
      days.push({ date: dateStr, label: dayName, count: 0, dayNum: date.getDate() });
    }
    
    stats.allStudents.forEach(student => {
      const day = days.find(d => d.date === student.date);
      if (day) day.count++;
    });
    
    return days;
  }, [stats]);

  useEffect(() => {
    setAnimationActive(true);
  }, [data]);

  const maxCount = Math.max(...data.map(d => d.count), 1);
  const avgCount = data.length > 0 ? Math.round(data.reduce((a, b) => a + b.count, 0) / data.length) : 0;
  const todayCount = data[data.length - 1]?.count || 0;
  const yesterdayCount = data[data.length - 2]?.count || 0;
  const trend = todayCount >= yesterdayCount ? "up" : "down";

  if (loading) {
    return (
      <Card className="bg-white border-0 shadow-lg">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
            <LineChart className="h-4 w-4 text-violet-500" />
            Haftalık Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartSkeleton height={220} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white border-0 shadow-lg relative overflow-hidden">
      {/* Background Decorations */}
      <div className="absolute -top-16 -right-16 w-32 h-32 rounded-full bg-violet-100/50 blur-2xl animate-float-slow" />
      <div className="absolute -bottom-12 -left-12 w-24 h-24 rounded-full bg-purple-100/50 blur-2xl animate-float-reverse" />
      
      <CardHeader className="pb-2 bg-gradient-to-r from-violet-50 via-purple-50 to-fuchsia-50 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 shadow-sm">
              <LineChart className="h-3.5 w-3.5 text-white" />
            </div>
            Son 7 Gün Trendi
          </CardTitle>
          <div className="flex items-center gap-2">
            <LiveIndicator />
            <Badge className={`border-0 text-[10px] ${
              trend === "up" 
                ? "bg-emerald-100 text-emerald-700" 
                : "bg-rose-100 text-rose-700"
            }`}>
              {trend === "up" ? <ArrowUpRight className="h-3 w-3 mr-0.5" /> : <ArrowDownRight className="h-3 w-3 mr-0.5" />}
              {trend === "up" ? "Yükseliş" : "Düşüş"}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4 relative">
        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="text-center p-2 rounded-lg bg-violet-50 border border-violet-100">
            <p className="text-lg font-bold text-violet-600">{todayCount}</p>
            <p className="text-[10px] text-violet-500 uppercase tracking-wider">Bugün</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-slate-50 border border-slate-100">
            <p className="text-lg font-bold text-slate-600">{avgCount}</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Ortalama</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-purple-50 border border-purple-100">
            <p className="text-lg font-bold text-purple-600">{maxCount}</p>
            <p className="text-[10px] text-purple-500 uppercase tracking-wider">Maksimum</p>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4}/>
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis 
              dataKey="label" 
              tick={{ fontSize: 11, fill: "#64748b" }} 
              axisLine={{ stroke: '#e2e8f0' }}
              tickLine={false}
            />
            <YAxis 
              tick={{ fontSize: 11, fill: "#64748b" }} 
              allowDecimals={false}
              axisLine={{ stroke: '#e2e8f0' }}
              tickLine={false}
            />
            <Tooltip 
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-white/95 backdrop-blur-xl border border-slate-200 rounded-xl shadow-2xl p-3">
                      <p className="text-sm font-semibold text-slate-800">{label} ({data.dayNum})</p>
                      <p className="text-xl font-bold text-violet-600">{data.count} yönlendirme</p>
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
              stroke="#8b5cf6" 
              strokeWidth={3}
              fill="url(#trendGradient)"
              dot={{ fill: '#8b5cf6', strokeWidth: 2, stroke: '#fff', r: 4 }}
              activeDot={{ fill: '#7c3aed', strokeWidth: 3, stroke: '#fff', r: 6 }}
              animationDuration={1500}
              animationEasing="ease-out"
            />
            {/* Average Line */}
            <Line 
              type="monotone"
              dataKey={() => avgCount}
              stroke="#94a3b8"
              strokeWidth={1}
              strokeDasharray="5 5"
              dot={false}
              name="Ortalama"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// Dönem Karşılaştırma - Modern Radial
export function PeriodComparisonChart({ stats, loading }: DashboardChartsProps) {
  const data = useMemo(() => {
    if (!stats) return [];
    const maxVal = Math.max(stats.todayCount, stats.weekCount, stats.monthCount ?? 0, 1);
    return [
      { name: "Bugün", value: stats.todayCount, fill: "#3b82f6", percentage: Math.round((stats.todayCount / maxVal) * 100) },
      { name: "Bu Hafta", value: stats.weekCount, fill: "#10b981", percentage: Math.round((stats.weekCount / maxVal) * 100) },
      { name: "Bu Ay", value: stats.monthCount ?? 0, fill: "#f59e0b", percentage: Math.round(((stats.monthCount ?? 0) / maxVal) * 100) },
    ];
  }, [stats]);

  if (loading || !stats) {
    return (
      <Card className="bg-white border-0 shadow-lg">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-amber-500" />
            Dönem Karşılaştırması
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartSkeleton height={220} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white border-0 shadow-lg relative overflow-hidden">
      {/* Background Decorations */}
      <div className="absolute -top-16 -right-16 w-32 h-32 rounded-full bg-amber-100/50 blur-2xl animate-float-slow" />
      <div className="absolute -bottom-12 -left-12 w-24 h-24 rounded-full bg-orange-100/50 blur-2xl animate-float-reverse" />
      
      <CardHeader className="pb-2 bg-gradient-to-r from-amber-50 via-orange-50 to-yellow-50 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 shadow-sm">
              <BarChart3 className="h-3.5 w-3.5 text-white" />
            </div>
            Dönem Karşılaştırması
          </CardTitle>
          <LiveIndicator />
        </div>
      </CardHeader>
      <CardContent className="pt-4 relative">
        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {data.map((item, index) => (
            <div 
              key={item.name}
              className="relative overflow-hidden rounded-xl p-3 text-center border transition-all duration-300 hover:scale-105 cursor-default"
              style={{ 
                backgroundColor: `${item.fill}10`,
                borderColor: `${item.fill}30`
              }}
            >
              <div 
                className="absolute bottom-0 left-0 right-0 transition-all duration-1000"
                style={{ 
                  height: `${item.percentage}%`,
                  backgroundColor: `${item.fill}15`
                }}
              />
              <div className="relative">
                <p className="text-2xl font-bold" style={{ color: item.fill }}>{item.value}</p>
                <p className="text-[10px] uppercase tracking-wider text-slate-500">{item.name}</p>
              </div>
            </div>
          ))}
        </div>

        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              {data.map((item, index) => (
                <linearGradient key={`bar-${index}`} id={`periodGradient-${index}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={item.fill} stopOpacity={1} />
                  <stop offset="100%" stopColor={item.fill} stopOpacity={0.6} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis 
              dataKey="name" 
              tick={{ fontSize: 11, fill: "#64748b" }}
              axisLine={{ stroke: '#e2e8f0' }}
              tickLine={false}
            />
            <YAxis 
              tick={{ fontSize: 11, fill: "#64748b" }}
              axisLine={{ stroke: '#e2e8f0' }}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar 
              dataKey="value" 
              name="Yönlendirme" 
              radius={[8, 8, 0, 0]}
              animationDuration={1000}
              animationEasing="ease-out"
            >
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={`url(#periodGradient-${index})`}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// Ana Dashboard Export - Modern
export function DashboardCharts({ stats, loading }: DashboardChartsProps) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    setLastUpdate(new Date());
  }, [stats]);

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-gradient-to-r from-slate-50 via-white to-slate-50 border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg">
            <BarChart3 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800">Detaylı Analiz</h3>
            <p className="text-xs text-slate-500 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Son güncelleme: {lastUpdate.toLocaleTimeString('tr-TR')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <LiveIndicator />
          <div className="flex items-center bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-md transition-all ${viewMode === "grid" ? "bg-white shadow-sm text-indigo-600" : "text-slate-500 hover:text-slate-700"}`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-md transition-all ${viewMode === "list" ? "bg-white shadow-sm text-indigo-600" : "text-slate-500 hover:text-slate-700"}`}
            >
              <BarChart3 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {viewMode === "grid" ? (
        <>
          {/* İlk Satır - Trend ve Karşılaştırma */}
          <div className="grid gap-6 md:grid-cols-2">
            <WeeklyTrendChart stats={stats} loading={loading} />
            <PeriodComparisonChart stats={stats} loading={loading} />
          </div>
          
          {/* İkinci Satır - Pasta ve Bar */}
          <div className="grid gap-6 md:grid-cols-2">
            <ReasonsPieChart stats={stats} loading={loading} />
            <ClassBarChart stats={stats} loading={loading} />
          </div>
          
          {/* Üçüncü Satır - Öğretmen */}
          <TeacherBarChart stats={stats} loading={loading} />
        </>
      ) : (
        <div className="space-y-6">
          <WeeklyTrendChart stats={stats} loading={loading} />
          <PeriodComparisonChart stats={stats} loading={loading} />
          <ReasonsPieChart stats={stats} loading={loading} />
          <ClassBarChart stats={stats} loading={loading} />
          <TeacherBarChart stats={stats} loading={loading} />
        </div>
      )}
    </div>
  );
}
