"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  PieChart, Pie, Cell, ResponsiveContainer, 
  BarChart, Bar, XAxis, YAxis, Tooltip, 
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  Legend,
  AreaChart, Area
} from "recharts";
import { 
  TrendingUp, 
  TrendingDown, 
  Minus,
  AlertTriangle,
  Target,
  Activity
} from "lucide-react";

// Renk paleti
const COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6", 
  "#3b82f6", "#8b5cf6", "#ec4899", "#64748b"
];

const GRADIENT_COLORS = [
  { start: "#fee2e2", end: "#ef4444" },
  { start: "#ffedd5", end: "#f97316" },
  { start: "#fef9c3", end: "#eab308" },
  { start: "#dcfce7", end: "#22c55e" },
  { start: "#ccfbf1", end: "#14b8a6" },
  { start: "#dbeafe", end: "#3b82f6" },
  { start: "#ede9fe", end: "#8b5cf6" },
  { start: "#fce7f3", end: "#ec4899" },
  { start: "#f1f5f9", end: "#64748b" },
];

interface ReasonData {
  name: string;
  value: number;
  percentage: number;
  color: string;
  [key: string]: string | number;
}

interface TrendData {
  period: string;
  [key: string]: string | number;
}

// ==================== PASTA GRAFİĞİ ====================
interface ReasonPieChartProps {
  data: ReasonData[];
  title?: string;
}

export function ReasonPieChart({ data, title = "Neden Dağılımı" }: ReasonPieChartProps) {
  const total = data.reduce((acc, item) => acc + item.value, 0);
  
  if (total === 0) {
    return (
      <Card className="bg-white/80 backdrop-blur border-slate-200/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-700">{title}</CardTitle>
        </CardHeader>
        <CardContent className="h-64 flex items-center justify-center text-slate-400">
          <div className="text-center">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Bu dönemde veri bulunamadı</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: ReasonData }> }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white px-3 py-2 shadow-lg rounded-lg border text-sm">
          <p className="font-medium text-slate-800">{data.name}</p>
          <p className="text-slate-600">{data.value} öğrenci</p>
          <p className="text-slate-500">%{data.percentage}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="bg-white/80 backdrop-blur border-slate-200/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <Target className="h-4 w-4 text-violet-600" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data as any[]}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={COLORS[index % COLORS.length]}
                    stroke="white"
                    strokeWidth={2}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 text-center">
          <p className="text-2xl font-bold text-slate-800">{total}</p>
          <p className="text-xs text-slate-500">Toplam Yönlendirme</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ==================== BAR CHART ====================
interface ReasonBarChartProps {
  data: ReasonData[];
  title?: string;
}

export function ReasonBarChart({ data, title = "Neden Sıralaması" }: ReasonBarChartProps) {
  const sortedData = [...data].sort((a, b) => b.value - a.value).slice(0, 8);
  
  if (sortedData.length === 0 || sortedData.every(d => d.value === 0)) {
    return (
      <Card className="bg-white/80 backdrop-blur border-slate-200/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-700">{title}</CardTitle>
        </CardHeader>
        <CardContent className="h-64 flex items-center justify-center text-slate-400">
          <div className="text-center">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Bu dönemde veri bulunamadı</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ value: number; payload: ReasonData }> }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white px-3 py-2 shadow-lg rounded-lg border text-sm">
          <p className="font-medium text-slate-800">{payload[0].payload.name}</p>
          <p className="text-violet-600">{payload[0].value} öğrenci</p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="bg-white/80 backdrop-blur border-slate-200/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <Activity className="h-4 w-4 text-violet-600" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sortedData} layout="vertical" margin={{ left: 0, right: 20 }}>
              <XAxis type="number" hide />
              <YAxis 
                type="category" 
                dataKey="name" 
                width={100}
                tick={{ fontSize: 10 }}
                tickFormatter={(value) => value.length > 15 ? value.substring(0, 15) + '...' : value}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar 
                dataKey="value" 
                radius={[0, 4, 4, 0]}
                fill="url(#barGradient)"
              >
                {sortedData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// ==================== RADAR CHART ====================
interface ReasonRadarChartProps {
  currentData: ReasonData[];
  previousData?: ReasonData[];
  title?: string;
}

export function ReasonRadarChart({ currentData, previousData, title = "Karşılaştırma" }: ReasonRadarChartProps) {
  const top6 = [...currentData].sort((a, b) => b.value - a.value).slice(0, 6);
  
  const radarData = top6.map(item => {
    const prevItem = previousData?.find(p => p.name === item.name);
    return {
      subject: item.name.length > 12 ? item.name.substring(0, 12) + '...' : item.name,
      current: item.value,
      previous: prevItem?.value || 0,
      fullName: item.name
    };
  });

  if (radarData.length === 0) {
    return null;
  }

  return (
    <Card className="bg-white/80 backdrop-blur border-slate-200/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-slate-700">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData}>
              <PolarGrid stroke="#e2e8f0" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9 }} />
              <PolarRadiusAxis tick={{ fontSize: 8 }} />
              <Radar
                name="Bu Dönem"
                dataKey="current"
                stroke="#8b5cf6"
                fill="#8b5cf6"
                fillOpacity={0.5}
              />
              {previousData && previousData.length > 0 && (
                <Radar
                  name="Önceki Dönem"
                  dataKey="previous"
                  stroke="#94a3b8"
                  fill="#94a3b8"
                  fillOpacity={0.3}
                />
              )}
              <Legend />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// ==================== TREND INDICATOR ====================
interface TrendIndicatorProps {
  current: number;
  previous: number;
  label: string;
}

export function TrendIndicator({ current, previous, label }: TrendIndicatorProps) {
  const diff = current - previous;
  const percentChange = previous > 0 ? Math.round((diff / previous) * 100) : 0;
  
  const isUp = diff > 0;
  const isDown = diff < 0;
  const isStable = diff === 0;

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-500">{label}:</span>
      {isUp && (
        <Badge className="bg-red-100 text-red-700 gap-1">
          <TrendingUp className="h-3 w-3" />
          +{percentChange}%
        </Badge>
      )}
      {isDown && (
        <Badge className="bg-green-100 text-green-700 gap-1">
          <TrendingDown className="h-3 w-3" />
          {percentChange}%
        </Badge>
      )}
      {isStable && (
        <Badge className="bg-slate-100 text-slate-700 gap-1">
          <Minus className="h-3 w-3" />
          Sabit
        </Badge>
      )}
    </div>
  );
}

// ==================== TOP REASONS CARD ====================
interface TopReasonsCardProps {
  data: ReasonData[];
  title?: string;
}

export function TopReasonsCard({ data, title = "En Çok Yönlendirme Nedenleri" }: TopReasonsCardProps) {
  const top5 = [...data].sort((a, b) => b.value - a.value).slice(0, 5);
  const maxValue = top5[0]?.value || 1;

  return (
    <Card className="bg-white/80 backdrop-blur border-slate-200/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-slate-700">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {top5.map((item, index) => (
          <div key={item.name} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold`}
                  style={{ backgroundColor: COLORS[index] }}>
                  {index + 1}
                </span>
                <span className="text-slate-700 truncate max-w-[150px]" title={item.name}>
                  {item.name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-800">{item.value}</span>
                <span className="text-slate-400">(%{item.percentage})</span>
              </div>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full transition-all duration-500"
                style={{ 
                  width: `${(item.value / maxValue) * 100}%`,
                  backgroundColor: COLORS[index]
                }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ==================== MONTHLY TREND CHART ====================
interface MonthlyTrendData {
  month: string;
  count: number;
}

interface MonthlyTrendChartProps {
  data: MonthlyTrendData[];
  title?: string;
}

export function MonthlyTrendChart({ data, title = "Aylık Trend" }: MonthlyTrendChartProps) {
  if (!data || data.length === 0) {
    return null;
  }

  return (
    <Card className="bg-white/80 backdrop-blur border-slate-200/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-violet-600" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorTrend" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
              />
              <Area 
                type="monotone" 
                dataKey="count" 
                stroke="#8b5cf6" 
                strokeWidth={2}
                fill="url(#colorTrend)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// ==================== COMPARISON CARD ====================
interface ComparisonCardProps {
  todayCount: number;
  weekCount: number;
  monthCount: number;
  totalCount: number;
  activeFilter: string;
}

export function ComparisonCard({ todayCount, weekCount, monthCount, totalCount, activeFilter }: ComparisonCardProps) {
  const items = [
    { key: "today", label: "Bugün", value: todayCount, color: "blue" },
    { key: "week", label: "Bu Hafta", value: weekCount, color: "emerald" },
    { key: "month", label: "Bu Ay", value: monthCount, color: "purple" },
    { key: "all", label: "Toplam", value: totalCount, color: "slate" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {items.map((item) => {
        const isActive = activeFilter === item.key;
        return (
          <div
            key={item.key}
            className={`relative overflow-hidden rounded-xl p-4 transition-all ${
              isActive 
                ? `bg-gradient-to-br from-${item.color}-500 to-${item.color}-600 text-white shadow-lg scale-105` 
                : `bg-${item.color}-50 text-${item.color}-900`
            }`}
          >
            {isActive && (
              <div className="absolute top-2 right-2">
                <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
              </div>
            )}
            <p className={`text-xs font-medium ${isActive ? 'text-white/80' : `text-${item.color}-600`}`}>
              {item.label}
            </p>
            <p className="text-2xl font-bold mt-1">{item.value}</p>
          </div>
        );
      })}
    </div>
  );
}
