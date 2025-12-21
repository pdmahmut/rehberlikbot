"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area } from 'recharts';

// Renk paleti
const COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1', '#14b8a6'];
const REASON_COLORS: Record<string, string> = {
  'Devamsızlık': '#ef4444',
  'Ders Başarısızlığı': '#3b82f6',
  'Davranış Problemi': '#f59e0b',
  'Sosyal Uyum': '#8b5cf6',
  'Aile Görüşmesi': '#10b981',
  'default': '#6b7280'
};

interface StudentSummaryCardProps {
  totalReferrals: number;
  topReason: { name: string; count: number } | null;
  teacherCount: number;
  lastReferralDate?: string;
}

// Özet Kartı
export function StudentSummaryCard({ totalReferrals, topReason, teacherCount, lastReferralDate }: StudentSummaryCardProps) {
  const getRiskLevel = () => {
    if (totalReferrals === 0) return { level: 'Düşük', color: 'from-emerald-500 to-green-600', bg: 'bg-emerald-50' };
    if (totalReferrals <= 2) return { level: 'Normal', color: 'from-blue-500 to-cyan-600', bg: 'bg-blue-50' };
    if (totalReferrals <= 5) return { level: 'Orta', color: 'from-amber-500 to-orange-600', bg: 'bg-amber-50' };
    return { level: 'Yüksek', color: 'from-red-500 to-rose-600', bg: 'bg-red-50' };
  };

  const risk = getRiskLevel();

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${risk.color} p-6 text-white shadow-xl`}>
      <div className="absolute top-0 right-0 -mt-4 -mr-4 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
      <div className="absolute bottom-0 left-0 -mb-8 -ml-8 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-white/80 text-sm font-medium">Risk Seviyesi</p>
            <p className="text-3xl font-bold mt-1">{risk.level}</p>
          </div>
          <div className="text-right">
            <p className="text-6xl font-black opacity-20 absolute -top-2 -right-2">{totalReferrals}</p>
            <div className="relative">
              <p className="text-4xl font-bold">{totalReferrals}</p>
              <p className="text-white/80 text-xs">Yönlendirme</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-6">
          <div className="bg-white/20 rounded-xl p-3 backdrop-blur">
            <p className="text-white/70 text-xs">En Sık Neden</p>
            <p className="font-semibold text-sm mt-1 truncate">
              {topReason?.name || '-'}
            </p>
          </div>
          <div className="bg-white/20 rounded-xl p-3 backdrop-blur">
            <p className="text-white/70 text-xs">Öğretmen Sayısı</p>
            <p className="font-semibold text-sm mt-1">{teacherCount} öğretmen</p>
          </div>
        </div>

        {lastReferralDate && (
          <div className="mt-4 pt-4 border-t border-white/20">
            <p className="text-white/70 text-xs">Son Yönlendirme</p>
            <p className="font-medium text-sm">{lastReferralDate}</p>
          </div>
        )}
      </div>
    </div>
  );
}

interface ReasonDistributionChartProps {
  data: Record<string, number>;
  loading?: boolean;
}

// Neden Dağılımı Pie Chart
export function ReasonDistributionChart({ data, loading }: ReasonDistributionChartProps) {
  if (loading) {
    return (
      <div className="h-[200px] flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-violet-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const chartData = Object.entries(data).map(([name, value]) => ({
    name,
    value,
    color: REASON_COLORS[name] || REASON_COLORS.default
  }));

  if (chartData.length === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center text-slate-400 text-sm">
        Veri bulunamadı
      </div>
    );
  }

  return (
    <div className="h-[200px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => [`${value} kez`]}
            contentStyle={{
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              borderRadius: '12px',
              border: 'none',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
              padding: '12px'
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap justify-center gap-2 mt-2">
        {chartData.map((entry, index) => (
          <div key={index} className="flex items-center gap-1.5 text-xs">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-slate-600">{entry.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface TeacherDistributionChartProps {
  data: Record<string, number>;
  loading?: boolean;
}

// Öğretmen Dağılımı Bar Chart
export function TeacherDistributionChart({ data, loading }: TeacherDistributionChartProps) {
  if (loading) {
    return (
      <div className="h-[200px] flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-cyan-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const chartData = Object.entries(data)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, value]) => ({
      name: name.length > 15 ? name.substring(0, 15) + '...' : name,
      fullName: name,
      value
    }));

  if (chartData.length === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center text-slate-400 text-sm">
        Veri bulunamadı
      </div>
    );
  }

  return (
    <div className="h-[200px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11 }} />
          <YAxis 
            type="category" 
            dataKey="name" 
            tick={{ fontSize: 11 }} 
            width={100}
          />
          <Tooltip
            formatter={(value) => [`${value} yönlendirme`]}
            labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
            contentStyle={{
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              borderRadius: '12px',
              border: 'none',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
              padding: '12px'
            }}
          />
          <Bar dataKey="value" fill="url(#teacherGradient)" radius={[0, 4, 4, 0]} />
          <defs>
            <linearGradient id="teacherGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#06b6d4" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface TimelineData {
  date: string;
  count: number;
}

interface ReferralTimelineProps {
  referrals: Array<{ date: string }>;
  loading?: boolean;
}

// Zaman Çizelgesi
export function ReferralTimeline({ referrals, loading }: ReferralTimelineProps) {
  if (loading) {
    return (
      <div className="h-[150px] flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  // Son 30 günü grupla
  const last30Days: TimelineData[] = [];
  const today = new Date();
  
  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().slice(0, 10);
    const count = referrals.filter(r => r.date.slice(0, 10) === dateStr).length;
    last30Days.push({
      date: date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' }),
      count
    });
  }

  const hasData = last30Days.some(d => d.count > 0);

  if (!hasData) {
    return (
      <div className="h-[150px] flex items-center justify-center text-slate-400 text-sm">
        Son 30 günde yönlendirme yok
      </div>
    );
  }

  return (
    <div className="h-[150px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={last30Days} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="timelineGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 9 }} 
            interval={6}
            axisLine={false}
          />
          <YAxis tick={{ fontSize: 10 }} axisLine={false} />
          <Tooltip
            formatter={(value) => [`${value} yönlendirme`, 'Sayı']}
            contentStyle={{
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              borderRadius: '12px',
              border: 'none',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
              padding: '12px'
            }}
          />
          <Area 
            type="monotone" 
            dataKey="count" 
            stroke="#10b981" 
            strokeWidth={2}
            fill="url(#timelineGradient)" 
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// Mini İstatistik Kartı
interface MiniStatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

export function MiniStatCard({ title, value, icon, color, bgColor }: MiniStatCardProps) {
  return (
    <div className={`${bgColor} rounded-xl p-4 border border-slate-100`}>
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-xl ${color}`}>
          {icon}
        </div>
        <div>
          <p className="text-xs text-slate-500 font-medium">{title}</p>
          <p className="text-lg font-bold text-slate-800 mt-0.5">{value}</p>
        </div>
      </div>
    </div>
  );
}

// Öğrenci Dashboard Export
export const StudentDashboard = {
  SummaryCard: StudentSummaryCard,
  ReasonChart: ReasonDistributionChart,
  TeacherChart: TeacherDistributionChart,
  Timeline: ReferralTimeline,
  MiniStat: MiniStatCard
};
