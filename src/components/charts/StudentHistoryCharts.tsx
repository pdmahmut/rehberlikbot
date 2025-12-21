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
  LineChart,
  Line,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  History,
  AlertTriangle,
  Gavel,
  Calendar,
  TrendingUp,
  User,
  FileText,
  Clock,
  Shield,
  Target,
  Activity,
} from "lucide-react";

const COLORS = [
  "#3b82f6",
  "#f97316",
  "#22c55e",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#eab308",
  "#ec4899",
];

// Özet istatistik kartı
export function HistorySummaryCard({
  studentName,
  className,
  totalReferrals,
  totalDiscipline,
  lastActivityDate,
}: {
  studentName: string;
  className: string;
  totalReferrals: number;
  totalDiscipline: number;
  lastActivityDate?: string;
}) {
  const total = totalReferrals + totalDiscipline;
  const riskLevel = total > 5 ? "high" : total > 2 ? "medium" : "low";
  
  const riskColors = {
    low: "from-emerald-500 to-green-500",
    medium: "from-amber-500 to-orange-500",
    high: "from-red-500 to-rose-500",
  };
  
  const riskLabels = {
    low: "Düşük Risk",
    medium: "Orta Risk",
    high: "Yüksek Risk",
  };

  return (
    <Card className={`bg-gradient-to-br ${riskColors[riskLevel]} text-white border-0 shadow-lg`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <div className="p-2 bg-white/20 rounded-lg">
            <User className="h-5 w-5" />
          </div>
          {studentName}
        </CardTitle>
        <p className="text-white/80 text-sm">{className}</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-2 bg-white/10 rounded-xl backdrop-blur-sm">
            <p className="text-2xl font-bold">{totalReferrals}</p>
            <p className="text-xs text-white/80">Yönlendirme</p>
          </div>
          <div className="text-center p-2 bg-white/10 rounded-xl backdrop-blur-sm">
            <p className="text-2xl font-bold">{totalDiscipline}</p>
            <p className="text-xs text-white/80">Disiplin</p>
          </div>
          <div className="text-center p-2 bg-white/10 rounded-xl backdrop-blur-sm">
            <p className="text-2xl font-bold">{total}</p>
            <p className="text-xs text-white/80">Toplam</p>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span className="text-sm font-medium">{riskLabels[riskLevel]}</span>
          </div>
          {lastActivityDate && (
            <div className="flex items-center gap-1 text-xs text-white/70">
              <Clock className="h-3 w-3" />
              Son: {lastActivityDate}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Yönlendirme nedenleri dağılımı
export function ReferralReasonsChart({
  data,
}: {
  data: { reason: string; count: number }[];
}) {
  if (data.length === 0) {
    return (
      <Card className="bg-white/80 backdrop-blur border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-700">
            <AlertTriangle className="h-4 w-4 text-blue-500" />
            Yönlendirme Nedenleri
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-40 flex items-center justify-center text-slate-400 text-sm">
            Veri yok
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/80 backdrop-blur border-slate-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-700">
          <AlertTriangle className="h-4 w-4 text-blue-500" />
          Yönlendirme Nedenleri
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={70}
                paddingAngle={3}
                dataKey="count"
                nameKey="reason"
              >
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
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
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
              />
              <span className="text-slate-600 truncate">{item.reason}</span>
              <span className="text-slate-900 font-medium ml-auto">{item.count}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Ceza türleri dağılımı
export function PenaltyTypesChart({
  data,
}: {
  data: { type: string; count: number }[];
}) {
  if (data.length === 0) {
    return (
      <Card className="bg-white/80 backdrop-blur border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-700">
            <Gavel className="h-4 w-4 text-orange-500" />
            Ceza Türleri
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-40 flex items-center justify-center text-slate-400 text-sm">
            Veri yok
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/80 backdrop-blur border-slate-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-700">
          <Gavel className="h-4 w-4 text-orange-500" />
          Ceza Türleri
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis
                dataKey="type"
                type="category"
                tick={{ fontSize: 10 }}
                width={100}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "white",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Bar dataKey="count" fill="#f97316" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// Aylık aktivite trendi
export function MonthlyActivityChart({
  data,
}: {
  data: { month: string; referrals: number; discipline: number }[];
}) {
  if (data.length === 0) {
    return (
      <Card className="bg-white/80 backdrop-blur border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-700">
            <TrendingUp className="h-4 w-4 text-violet-500" />
            Aylık Aktivite
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-40 flex items-center justify-center text-slate-400 text-sm">
            Veri yok
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/80 backdrop-blur border-slate-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-700">
          <TrendingUp className="h-4 w-4 text-violet-500" />
          Aylık Aktivite
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorReferrals" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorDiscipline" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
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
              <Legend wrapperStyle={{ fontSize: "11px" }} />
              <Area
                type="monotone"
                dataKey="referrals"
                stroke="#3b82f6"
                fillOpacity={1}
                fill="url(#colorReferrals)"
                name="Yönlendirme"
              />
              <Area
                type="monotone"
                dataKey="discipline"
                stroke="#f97316"
                fillOpacity={1}
                fill="url(#colorDiscipline)"
                name="Disiplin"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// Öğretmen bazlı yönlendirme
export function TeacherReferralsChart({
  data,
}: {
  data: { teacher: string; count: number }[];
}) {
  if (data.length === 0) {
    return (
      <Card className="bg-white/80 backdrop-blur border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-700">
            <User className="h-4 w-4 text-cyan-500" />
            Öğretmen Bazlı
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-40 flex items-center justify-center text-slate-400 text-sm">
            Veri yok
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/80 backdrop-blur border-slate-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-700">
          <User className="h-4 w-4 text-cyan-500" />
          Öğretmen Bazlı Yönlendirme
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {data.slice(0, 5).map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-600 truncate">{item.teacher}</span>
                  <span className="text-slate-900 font-medium">{item.count}</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
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

// Zaman çizelgesi
export function ActivityTimeline({
  activities,
}: {
  activities: {
    id: string;
    type: "referral" | "discipline";
    date: string;
    title: string;
    description: string;
  }[];
}) {
  if (activities.length === 0) {
    return (
      <Card className="bg-white/80 backdrop-blur border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-700">
            <Activity className="h-4 w-4 text-indigo-500" />
            Zaman Çizelgesi
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-32 flex items-center justify-center text-slate-400 text-sm">
            Aktivite yok
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/80 backdrop-blur border-slate-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-700">
          <Activity className="h-4 w-4 text-indigo-500" />
          Zaman Çizelgesi
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative space-y-3 max-h-64 overflow-y-auto pr-2">
          {activities.slice(0, 10).map((activity, index) => (
            <div key={activity.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={`w-3 h-3 rounded-full ${
                    activity.type === "referral" ? "bg-blue-500" : "bg-orange-500"
                  }`}
                />
                {index < activities.length - 1 && (
                  <div className="w-0.5 h-full bg-slate-200 mt-1" />
                )}
              </div>
              <div className="flex-1 pb-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      activity.type === "referral"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-orange-100 text-orange-700"
                    }`}
                  >
                    {activity.type === "referral" ? "Yönlendirme" : "Disiplin"}
                  </span>
                  <span className="text-xs text-slate-400">{activity.date}</span>
                </div>
                <p className="text-sm font-medium text-slate-800 mt-1">
                  {activity.title}
                </p>
                <p className="text-xs text-slate-500 truncate">{activity.description}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Mini stat kartı
export function HistoryMiniStat({
  title,
  value,
  icon: Icon,
  color,
  trend,
}: {
  title: string;
  value: number | string;
  icon: React.ElementType;
  color: string;
  trend?: { value: number; isPositive: boolean };
}) {
  return (
    <div className={`p-4 rounded-xl bg-gradient-to-br ${color} border shadow-sm`}>
      <div className="flex items-center justify-between">
        <div className="p-2 bg-white/80 rounded-lg">
          <Icon className="h-5 w-5" />
        </div>
        {trend && (
          <span
            className={`text-xs font-medium ${
              trend.isPositive ? "text-red-600" : "text-green-600"
            }`}
          >
            {trend.isPositive ? "+" : "-"}{trend.value}%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold mt-2">{value}</p>
      <p className="text-xs text-slate-600 mt-0.5">{title}</p>
    </div>
  );
}

// Risk seviyesi göstergesi
export function RiskIndicator({
  referralCount,
  disciplineCount,
}: {
  referralCount: number;
  disciplineCount: number;
}) {
  const total = referralCount + disciplineCount;
  const riskScore = Math.min(100, (total / 10) * 100);
  const riskLevel = riskScore > 60 ? "Yüksek" : riskScore > 30 ? "Orta" : "Düşük";
  const riskColor = riskScore > 60 ? "#ef4444" : riskScore > 30 ? "#f97316" : "#22c55e";

  return (
    <Card className="bg-white/80 backdrop-blur border-slate-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-700">
          <Target className="h-4 w-4 text-rose-500" />
          Risk Değerlendirmesi
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <div className="relative w-20 h-20">
            <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
              <circle
                cx="18"
                cy="18"
                r="15.5"
                fill="none"
                stroke="#e5e7eb"
                strokeWidth="3"
              />
              <circle
                cx="18"
                cy="18"
                r="15.5"
                fill="none"
                stroke={riskColor}
                strokeWidth="3"
                strokeDasharray={`${riskScore} 100`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-lg font-bold" style={{ color: riskColor }}>
                {Math.round(riskScore)}
              </span>
            </div>
          </div>
          <div>
            <p className="text-xl font-bold" style={{ color: riskColor }}>
              {riskLevel} Risk
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Toplam {total} kayıt üzerinden hesaplandı
            </p>
            <div className="flex gap-2 mt-2">
              <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                {referralCount} yönlendirme
              </span>
              <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full">
                {disciplineCount} disiplin
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
