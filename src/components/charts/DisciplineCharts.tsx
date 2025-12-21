"use client";

import React from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FileText,
  Users,
  Calendar,
  TrendingUp,
  AlertTriangle,
  Gavel,
  Scale,
  FileCheck,
  Clock,
  Target,
  Activity,
} from "lucide-react";

const COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
];

// Mini stat card bileşeni
export function DisciplineMiniStatCard({
  title,
  value,
  icon: Icon,
  color,
  subtitle,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  subtitle?: string;
}) {
  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-xl bg-gradient-to-br ${color} border shadow-sm`}
    >
      <div className="p-2 bg-white/80 rounded-lg">
        <Icon className="h-5 w-5 text-current" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-600 truncate">{title}</p>
        <p className="text-lg font-bold text-slate-900">{value}</p>
        {subtitle && (
          <p className="text-xs text-slate-500 truncate">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

// Özet istatistik kartı
export function DisciplineSummaryCard({
  totalDocuments,
  completedDocuments,
  pendingCases,
  thisMonthCases,
}: {
  totalDocuments: number;
  completedDocuments: number;
  pendingCases: number;
  thisMonthCases: number;
}) {
  const completionRate =
    totalDocuments > 0
      ? Math.round((completedDocuments / totalDocuments) * 100)
      : 0;

  return (
    <Card className="bg-gradient-to-br from-rose-500 via-red-500 to-orange-500 text-white border-0 shadow-lg">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <div className="p-2 bg-white/20 rounded-lg">
            <Gavel className="h-5 w-5" />
          </div>
          Disiplin İşlemleri Özeti
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-white/10 rounded-xl backdrop-blur-sm">
            <p className="text-3xl font-bold">{totalDocuments}</p>
            <p className="text-xs text-white/80">Toplam Belge</p>
          </div>
          <div className="text-center p-3 bg-white/10 rounded-xl backdrop-blur-sm">
            <p className="text-3xl font-bold">{completedDocuments}</p>
            <p className="text-xs text-white/80">Tamamlanan</p>
          </div>
          <div className="text-center p-3 bg-white/10 rounded-xl backdrop-blur-sm">
            <p className="text-3xl font-bold">{pendingCases}</p>
            <p className="text-xs text-white/80">Bekleyen</p>
          </div>
          <div className="text-center p-3 bg-white/10 rounded-xl backdrop-blur-sm">
            <p className="text-3xl font-bold">{thisMonthCases}</p>
            <p className="text-xs text-white/80">Bu Ay</p>
          </div>
        </div>
        <div className="mt-4">
          <div className="flex justify-between text-xs text-white/80 mb-1">
            <span>Tamamlanma Oranı</span>
            <span>{completionRate}%</span>
          </div>
          <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-500"
              style={{ width: `${completionRate}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Belge türlerine göre dağılım
export function DocumentTypeDistribution({
  data,
}: {
  data: { name: string; value: number; color: string }[];
}) {
  if (data.length === 0) {
    return (
      <Card className="bg-white/80 backdrop-blur border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-700">
            <FileText className="h-4 w-4 text-rose-500" />
            Belge Türü Dağılımı
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-40 flex items-center justify-center text-slate-400 text-sm">
            Henüz belge oluşturulmadı
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/80 backdrop-blur border-slate-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-700">
          <FileText className="h-4 w-4 text-rose-500" />
          Belge Türü Dağılımı
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={35}
                outerRadius={55}
                paddingAngle={3}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "white",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(value) => [value, "Adet"]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="grid grid-cols-2 gap-1 mt-2">
          {data.slice(0, 6).map((item, index) => (
            <div key={index} className="flex items-center gap-1.5 text-xs">
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: item.color || COLORS[index % COLORS.length] }}
              />
              <span className="text-slate-600 truncate">{item.name}</span>
              <span className="text-slate-900 font-medium ml-auto">{item.value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Ceza türlerine göre dağılım
export function PenaltyDistribution({
  data,
}: {
  data: { name: string; value: number }[];
}) {
  if (data.length === 0) {
    return (
      <Card className="bg-white/80 backdrop-blur border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-700">
            <Scale className="h-4 w-4 text-orange-500" />
            Ceza Dağılımı
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-40 flex items-center justify-center text-slate-400 text-sm">
            Henüz ceza kaydı yok
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/80 backdrop-blur border-slate-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-700">
          <Scale className="h-4 w-4 text-orange-500" />
          Ceza Dağılımı
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis
                dataKey="name"
                type="category"
                tick={{ fontSize: 10 }}
                width={80}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "white",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Bar dataKey="value" fill="#f97316" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// Aylık disiplin olayları trendi
export function MonthlyTrendChart({
  data,
}: {
  data: { month: string; cases: number; resolved: number }[];
}) {
  if (data.length === 0) {
    return (
      <Card className="bg-white/80 backdrop-blur border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-700">
            <TrendingUp className="h-4 w-4 text-blue-500" />
            Aylık Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-40 flex items-center justify-center text-slate-400 text-sm">
            Trend verisi yok
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/80 backdrop-blur border-slate-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-700">
          <TrendingUp className="h-4 w-4 text-blue-500" />
          Aylık Trend
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorCases" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorResolved" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "white",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Area
                type="monotone"
                dataKey="cases"
                stroke="#ef4444"
                fillOpacity={1}
                fill="url(#colorCases)"
                name="Olay"
              />
              <Area
                type="monotone"
                dataKey="resolved"
                stroke="#22c55e"
                fillOpacity={1}
                fill="url(#colorResolved)"
                name="Çözümlenen"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// Sınıflara göre disiplin olayları
export function ClassDistributionChart({
  data,
}: {
  data: { className: string; count: number }[];
}) {
  if (data.length === 0) {
    return (
      <Card className="bg-white/80 backdrop-blur border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-700">
            <Users className="h-4 w-4 text-violet-500" />
            Sınıf Dağılımı
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-40 flex items-center justify-center text-slate-400 text-sm">
            Sınıf verisi yok
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/80 backdrop-blur border-slate-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-700">
          <Users className="h-4 w-4 text-violet-500" />
          Sınıf Dağılımı
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="className" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "white",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// Olay nedeni dağılımı
export function ReasonDistributionChart({
  data,
}: {
  data: { reason: string; count: number }[];
}) {
  if (data.length === 0) {
    return (
      <Card className="bg-white/80 backdrop-blur border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-700">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Olay Nedenleri
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-40 flex items-center justify-center text-slate-400 text-sm">
            Neden verisi yok
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/80 backdrop-blur border-slate-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-700">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          Olay Nedenleri
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {data.slice(0, 5).map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-600 truncate">{item.reason}</span>
                  <span className="text-slate-900 font-medium">{item.count}</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${(item.count / Math.max(...data.map((d) => d.count))) * 100}%`,
                      backgroundColor: COLORS[index % COLORS.length],
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Belge durumu kartı
export function DocumentStatusCard({
  savedDocuments,
  totalDocuments,
}: {
  savedDocuments: Record<string, string>;
  totalDocuments: number;
}) {
  const completed = Object.values(savedDocuments).filter(
    (doc) => doc && doc.trim() !== ""
  ).length;
  const progress = totalDocuments > 0 ? (completed / totalDocuments) * 100 : 0;

  return (
    <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-emerald-800">
          <FileCheck className="h-4 w-4 text-emerald-600" />
          Belge Durumu
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <div className="relative w-16 h-16">
            <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
              <circle
                cx="18"
                cy="18"
                r="15.5"
                fill="none"
                stroke="#d1fae5"
                strokeWidth="3"
              />
              <circle
                cx="18"
                cy="18"
                r="15.5"
                fill="none"
                stroke="#10b981"
                strokeWidth="3"
                strokeDasharray={`${progress} 100`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-bold text-emerald-700">
                {Math.round(progress)}%
              </span>
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-emerald-900">
              {completed}/{totalDocuments}
            </p>
            <p className="text-xs text-emerald-600">Belge Tamamlandı</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Hızlı işlem kartları
export function QuickActionCard({
  title,
  description,
  icon: Icon,
  color,
  onClick,
  badge,
}: {
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
  onClick: () => void;
  badge?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full p-4 rounded-xl bg-gradient-to-br ${color} border shadow-sm hover:shadow-md transition-all text-left group`}
    >
      <div className="flex items-start gap-3">
        <div className="p-2 bg-white/80 rounded-lg group-hover:scale-110 transition-transform">
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-slate-900 truncate">{title}</h3>
            {badge && (
              <span className="px-2 py-0.5 text-xs font-medium bg-white/60 rounded-full">
                {badge}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-600 mt-0.5 truncate">{description}</p>
        </div>
      </div>
    </button>
  );
}

// Son işlemler listesi
export function RecentActivitiesList({
  activities,
}: {
  activities: {
    id: string;
    type: string;
    student: string;
    date: string;
    status: "completed" | "pending" | "in-progress";
  }[];
}) {
  if (activities.length === 0) {
    return (
      <Card className="bg-white/80 backdrop-blur border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-700">
            <Activity className="h-4 w-4 text-cyan-500" />
            Son İşlemler
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-32 flex items-center justify-center text-slate-400 text-sm">
            Henüz işlem yok
          </div>
        </CardContent>
      </Card>
    );
  }

  const statusColors = {
    completed: "bg-emerald-100 text-emerald-700",
    pending: "bg-amber-100 text-amber-700",
    "in-progress": "bg-blue-100 text-blue-700",
  };

  const statusLabels = {
    completed: "Tamamlandı",
    pending: "Bekliyor",
    "in-progress": "Devam Ediyor",
  };

  return (
    <Card className="bg-white/80 backdrop-blur border-slate-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-700">
          <Activity className="h-4 w-4 text-cyan-500" />
          Son İşlemler
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {activities.slice(0, 5).map((activity) => (
            <div
              key={activity.id}
              className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">
                  {activity.student}
                </p>
                <p className="text-xs text-slate-500 truncate">{activity.type}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">{activity.date}</span>
                <span
                  className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                    statusColors[activity.status]
                  }`}
                >
                  {statusLabels[activity.status]}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
