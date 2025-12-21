"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  CalendarDays, 
  TrendingUp, 
  TrendingDown,
  UserCheck, 
  RefreshCw, 
  BarChart3, 
  Clock, 
  ChevronDown, 
  ChevronUp, 
  Sparkles, 
  Activity, 
  Target, 
  Users,
  GraduationCap,
  AlertCircle,
  CheckCircle2,
  Zap,
  Award,
  Flame,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  BookOpen,
  MessageSquare,
  FileText,
  Bell,
  ChevronRight,
  MoreHorizontal,
  Eye,
  Star,
  Trophy,
  Medal,
  Crown,
  Brain
} from "lucide-react";
import { toast } from "sonner";
import { usePanelData } from "./hooks";
import { ClickableStudent } from "@/components/ClickableStudent";
import { DashboardCharts } from "@/components/charts/DashboardCharts";
import { 
  NotificationPermissionBanner, 
  NotificationStatus, 
  useNewReferralNotification 
} from "@/components/NotificationSystem";
import Link from "next/link";

// Canlı Saat Komponenti - Geliştirilmiş
function LiveClock() {
  const [time, setTime] = useState<Date | null>(null);

  useEffect(() => {
    setTime(new Date());
    const interval = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!time) {
    return (
      <div className="flex items-center gap-2 animate-pulse">
        <div className="h-10 w-20 bg-slate-200 rounded-lg"></div>
        <div className="h-10 w-20 bg-slate-200 rounded-lg"></div>
      </div>
    );
  }

  const hours = time.getHours().toString().padStart(2, '0');
  const minutes = time.getMinutes().toString().padStart(2, '0');
  const seconds = time.getSeconds().toString().padStart(2, '0');
  const greeting = time.getHours() < 12 ? "Günaydın" : time.getHours() < 18 ? "İyi Günler" : "İyi Akşamlar";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-2xl">👋</span>
        <span className="text-lg font-medium text-slate-700">{greeting}!</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="flex items-center gap-1 font-mono">
          <span className="bg-gradient-to-br from-slate-800 to-slate-900 text-white px-3 py-2 rounded-lg text-2xl font-bold shadow-lg">
            {hours}
          </span>
          <span className="text-slate-400 text-2xl animate-pulse font-bold">:</span>
          <span className="bg-gradient-to-br from-slate-800 to-slate-900 text-white px-3 py-2 rounded-lg text-2xl font-bold shadow-lg">
            {minutes}
          </span>
          <span className="text-slate-400 text-2xl animate-pulse font-bold">:</span>
          <span className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white px-3 py-2 rounded-lg text-2xl font-bold shadow-lg animate-pulse">
            {seconds}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Calendar className="h-4 w-4" />
        <span>
          {time.toLocaleDateString('tr-TR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}
        </span>
      </div>
    </div>
  );
}

// Stat Kartı Komponenti - Modern & Animated
function StatCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend, 
  trendValue,
  gradient,
  delay = 0
}: { 
  title: string;
  value: number | string;
  subtitle: string;
  icon: React.ElementType;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  gradient: string;
  delay?: number;
}) {
  const [displayValue, setDisplayValue] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const numericValue = typeof value === 'number' ? value : parseInt(value.toString()) || 0;

  // Number counter animation
  useEffect(() => {
    setIsVisible(true);
    if (typeof value === 'number' || !isNaN(parseInt(value.toString()))) {
      const duration = 1500;
      const steps = 30;
      const stepValue = numericValue / steps;
      let current = 0;
      const timer = setInterval(() => {
        current += stepValue;
        if (current >= numericValue) {
          setDisplayValue(numericValue);
          clearInterval(timer);
        } else {
          setDisplayValue(Math.floor(current));
        }
      }, duration / steps);
      return () => clearInterval(timer);
    }
  }, [numericValue, value]);

  return (
    <Card className={`relative overflow-hidden border-0 shadow-lg hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 group cursor-default`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Gradient Background */}
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-5 group-hover:opacity-15 transition-opacity duration-500`} />
      
      {/* Floating Orbs */}
      <div className={`absolute -top-10 -right-10 w-24 h-24 rounded-full bg-gradient-to-br ${gradient} opacity-10 blur-2xl group-hover:opacity-20 transition-opacity animate-float-slow`} />
      <div className={`absolute -bottom-8 -left-8 w-20 h-20 rounded-full bg-gradient-to-br ${gradient} opacity-10 blur-2xl group-hover:opacity-20 transition-opacity animate-float-reverse`} />
      
      {/* Sparkle Particles */}
      <div className="absolute top-3 right-16 h-1 w-1 rounded-full bg-slate-300/60 animate-sparkle animation-delay-100 group-hover:bg-slate-400" />
      <div className="absolute bottom-4 left-20 h-1 w-1 rounded-full bg-slate-300/60 animate-sparkle animation-delay-500 group-hover:bg-slate-400" />
      
      <CardContent className="p-5 relative">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-500 flex items-center gap-2">
              {title}
              <span className="flex h-1.5 w-1.5">
                <span className={`animate-ping absolute inline-flex h-1.5 w-1.5 rounded-full opacity-75 bg-gradient-to-r ${gradient}`}></span>
                <span className={`relative inline-flex rounded-full h-1.5 w-1.5 bg-gradient-to-r ${gradient}`}></span>
              </span>
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-slate-800 tabular-nums group-hover:scale-105 transition-transform origin-left">
                {typeof value === 'string' && value === '...' ? '...' : displayValue}
              </span>
              {trend && trendValue && (
                <span className={`flex items-center text-xs font-medium px-1.5 py-0.5 rounded-full ${
                  trend === "up" ? "text-emerald-700 bg-emerald-100" : trend === "down" ? "text-red-600 bg-red-100" : "text-slate-500 bg-slate-100"
                }`}>
                  {trend === "up" ? <ArrowUpRight className="h-3 w-3" /> : trend === "down" ? <ArrowDownRight className="h-3 w-3" /> : null}
                  {trendValue}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">{subtitle}</p>
          </div>
          <div className={`p-3 rounded-xl bg-gradient-to-br ${gradient} shadow-lg group-hover:shadow-xl group-hover:scale-110 transition-all duration-300`}>
            <Icon className="h-5 w-5 text-white group-hover:animate-bounce-subtle" />
          </div>
        </div>
        
        {/* Mini Progress Bar */}
        <div className="mt-3 h-1 rounded-full bg-slate-100 overflow-hidden">
          <div 
            className={`h-full rounded-full bg-gradient-to-r ${gradient} transition-all duration-1000 ease-out`}
            style={{ width: isVisible ? '100%' : '0%' }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

// Hızlı Eylem Kartı - Modern & Interactive
function QuickActionCard({ 
  title, 
  description, 
  icon: Icon, 
  href, 
  color 
}: { 
  title: string; 
  description: string; 
  icon: React.ElementType; 
  href: string; 
  color: string;
}) {
  return (
    <Link href={href}>
      <Card className="group cursor-pointer border border-slate-200 hover:border-transparent hover:shadow-lg transition-all duration-300 hover:-translate-y-1 bg-white relative overflow-hidden">
        {/* Hover Glow Effect */}
        <div className={`absolute inset-0 bg-gradient-to-r ${color} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />
        
        {/* Animated Border */}
        <div className={`absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
          style={{ 
            background: `linear-gradient(90deg, transparent, rgba(99, 102, 241, 0.1), transparent)`,
            backgroundSize: '200% 100%',
            animation: 'shimmer 2s infinite'
          }} 
        />
        
        <CardContent className="p-4 flex items-center gap-4 relative">
          <div className={`p-2.5 rounded-xl bg-gradient-to-br ${color} shadow-sm group-hover:shadow-lg group-hover:scale-110 transition-all duration-300`}>
            <Icon className="h-5 w-5 text-white group-hover:animate-bounce-subtle" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-slate-800 group-hover:text-slate-900 transition-colors">{title}</p>
            <p className="text-xs text-slate-400 truncate group-hover:text-slate-500 transition-colors">{description}</p>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-1 h-1 rounded-full bg-slate-300 group-hover:bg-indigo-400 transition-colors" />
            <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-2 transition-all duration-300" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

// En Aktif Öğretmen Podium - Animated & Live
function TopTeachersPodium({ byTeacher }: { byTeacher?: Record<string, number> }) {
  const [animatedCounts, setAnimatedCounts] = useState<Record<string, number>>({});
  
  const topTeachers = useMemo(() => {
    if (!byTeacher) return [];
    return Object.entries(byTeacher)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count], index) => ({ name, count, rank: index + 1 }));
  }, [byTeacher]);

  // Animate counts
  useEffect(() => {
    topTeachers.forEach((teacher, index) => {
      setTimeout(() => {
        const duration = 1000;
        const steps = 20;
        const stepValue = teacher.count / steps;
        let current = 0;
        const timer = setInterval(() => {
          current += stepValue;
          if (current >= teacher.count) {
            setAnimatedCounts(prev => ({ ...prev, [teacher.name]: teacher.count }));
            clearInterval(timer);
          } else {
            setAnimatedCounts(prev => ({ ...prev, [teacher.name]: Math.floor(current) }));
          }
        }, duration / steps);
      }, index * 200);
    });
  }, [topTeachers]);

  if (topTeachers.length === 0) {
    return (
      <Card className="bg-white border-0 shadow-lg relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-50 to-orange-50 opacity-50" />
        <CardHeader className="pb-2 relative">
          <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500 animate-bounce-subtle" />
            En Aktif Öğretmenler
          </CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center text-slate-400 text-sm relative">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-100 mb-3">
            <Trophy className="h-6 w-6 text-amber-400" />
          </div>
          <p>Henüz veri yok</p>
        </CardContent>
      </Card>
    );
  }

  const rankIcons = [Crown, Medal, Award];
  const rankColors = [
    "from-amber-400 to-yellow-500",
    "from-slate-300 to-slate-400",
    "from-orange-400 to-amber-600"
  ];
  const rankBgColors = [
    "bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200 hover:from-amber-100 hover:to-yellow-100",
    "bg-gradient-to-r from-slate-50 to-gray-50 border-slate-200 hover:from-slate-100 hover:to-gray-100",
    "bg-gradient-to-r from-orange-50 to-amber-50 border-orange-200 hover:from-orange-100 hover:to-amber-100"
  ];
  const rankGlowColors = [
    "group-hover:shadow-amber-200/50",
    "group-hover:shadow-slate-200/50",
    "group-hover:shadow-orange-200/50"
  ];

  return (
    <Card className="bg-white border-0 shadow-lg overflow-hidden relative">
      {/* Background Decorations */}
      <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-amber-100/50 blur-2xl" />
      <div className="absolute -bottom-8 -left-8 w-24 h-24 rounded-full bg-orange-100/50 blur-2xl" />
      
      <CardHeader className="pb-3 border-b border-slate-100 bg-gradient-to-r from-amber-50 via-yellow-50 to-orange-50 relative">
        <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
          <div className="relative">
            <Trophy className="h-4 w-4 text-amber-500" />
            <div className="absolute inset-0 animate-ping">
              <Trophy className="h-4 w-4 text-amber-400 opacity-40" />
            </div>
          </div>
          En Aktif Öğretmenler
          <div className="ml-auto flex items-center gap-2">
            <span className="flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-700 border-amber-200">
              Bu Ay
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-3 relative">
        {topTeachers.map((teacher, index) => {
          const RankIcon = rankIcons[index];
          return (
            <div 
              key={teacher.name}
              className={`group flex items-center gap-3 p-3 rounded-xl border ${rankBgColors[index]} transition-all duration-300 hover:shadow-lg ${rankGlowColors[index]} hover:-translate-x-1 cursor-default`}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className={`relative p-2 rounded-lg bg-gradient-to-br ${rankColors[index]} shadow-md group-hover:shadow-lg group-hover:scale-110 transition-all duration-300`}>
                <RankIcon className="h-4 w-4 text-white" />
                {index === 0 && (
                  <div className="absolute -top-1 -right-1">
                    <Sparkles className="h-3 w-3 text-yellow-400 animate-sparkle" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-800 truncate group-hover:text-slate-900 transition-colors">{teacher.name}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-xs text-slate-400">#{teacher.rank}</span>
                  <div className="flex gap-0.5">
                    {[...Array(3 - index)].map((_, i) => (
                      <Star key={i} className="h-2.5 w-2.5 text-amber-400 fill-amber-400" />
                    ))}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-slate-800 tabular-nums group-hover:scale-110 transition-transform origin-right">
                  {animatedCounts[teacher.name] ?? 0}
                </p>
                <p className="text-[10px] text-slate-400">yönlendirme</p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// Son Aktiviteler - Animated & Live
function RecentActivities({ todayStudents }: { todayStudents?: Array<{ student_name: string; class_display: string; reason?: string }> }) {
  const [visibleItems, setVisibleItems] = useState<number[]>([]);

  // Staggered entry animation
  useEffect(() => {
    if (todayStudents && todayStudents.length > 0) {
      todayStudents.slice(0, 10).forEach((_, idx) => {
        setTimeout(() => {
          setVisibleItems(prev => [...prev, idx]);
        }, idx * 100);
      });
    }
  }, [todayStudents]);

  if (!todayStudents || todayStudents.length === 0) {
    return (
      <Card className="bg-white border-0 shadow-lg relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-indigo-50 opacity-50" />
        <div className="absolute -top-16 -right-16 w-32 h-32 rounded-full bg-blue-100/50 blur-2xl animate-float-slow" />
        
        <CardHeader className="pb-2 relative">
          <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
            <Activity className="h-4 w-4 text-blue-500" />
            Bugünkü Yönlendirmeler
            <span className="ml-auto flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center relative">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 mb-3 animate-bounce-subtle">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
          </div>
          <p className="text-slate-600 text-sm font-medium">Bugün henüz yönlendirme yapılmadı</p>
          <p className="text-xs text-slate-400 mt-1">Güzel bir gün! 🎉</p>
          <div className="mt-4 flex justify-center gap-1">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="w-2 h-2 rounded-full bg-emerald-300 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white border-0 shadow-lg relative overflow-hidden">
      {/* Background Decorations */}
      <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-blue-100/30 blur-2xl" />
      <div className="absolute -bottom-8 -left-8 w-24 h-24 rounded-full bg-indigo-100/30 blur-2xl" />
      
      <CardHeader className="pb-3 border-b border-slate-100 bg-gradient-to-r from-blue-50 via-indigo-50 to-violet-50 relative">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
            <div className="relative">
              <Activity className="h-4 w-4 text-blue-500" />
              <div className="absolute inset-0 animate-ping opacity-50">
                <Activity className="h-4 w-4 text-blue-400" />
              </div>
            </div>
            Bugünkü Yönlendirmeler
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            <Badge className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white hover:from-blue-600 hover:to-indigo-600 border-0 shadow-sm">
              {todayStudents.length} Öğrenci
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 relative">
        <div className="max-h-[320px] overflow-y-auto">
          {todayStudents.slice(0, 10).map((student, idx) => (
            <div 
              key={`${student.student_name}-${idx}`}
              className={`group flex items-center gap-3 px-4 py-3 border-b border-slate-50 last:border-0 hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-indigo-50/50 transition-all duration-300 cursor-default ${
                visibleItems.includes(idx) ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'
              }`}
              style={{ transition: 'all 0.3s ease-out' }}
            >
              <div className="relative">
                <div className="flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-xs font-bold shadow-md group-hover:shadow-lg group-hover:scale-110 transition-all duration-300">
                  {idx + 1}
                </div>
                {idx === 0 && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full border-2 border-white animate-pulse" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <ClickableStudent studentName={student.student_name} classDisplay={student.class_display} />
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-slate-200 text-slate-500">
                    {student.class_display}
                  </Badge>
                  {student.reason && (
                    <span className="text-xs text-slate-400 truncate flex items-center gap-1">
                      <span className="w-1 h-1 rounded-full bg-slate-300" />
                      {student.reason}
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
            </div>
          ))}
        </div>
        {todayStudents.length > 10 && (
          <Link 
            href="/panel/ogrenci-listesi" 
            className="group flex items-center justify-center gap-2 py-3 text-sm text-blue-600 hover:text-blue-700 bg-gradient-to-r from-transparent via-blue-50/50 to-transparent hover:from-blue-50 hover:via-blue-100 hover:to-blue-50 transition-all border-t border-slate-100"
          >
            <Eye className="h-4 w-4 group-hover:scale-110 transition-transform" />
            <span>Tümünü Gör</span>
            <Badge className="bg-blue-100 text-blue-700 text-[10px] group-hover:bg-blue-200 transition-colors">
              +{todayStudents.length - 10}
            </Badge>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

// Performans Özeti Widget
function PerformanceSummary({ stats }: { stats: any }) {
  const weeklyAverage = useMemo(() => {
    if (!stats?.weekCount) return 0;
    const today = new Date().getDay();
    const daysPassed = today === 0 ? 7 : today;
    return Math.round(stats.weekCount / daysPassed * 10) / 10;
  }, [stats]);

  const monthlyAverage = useMemo(() => {
    if (!stats?.monthCount) return 0;
    const today = new Date().getDate();
    return Math.round(stats.monthCount / today * 10) / 10;
  }, [stats]);

  const performanceLevel = useMemo(() => {
    const todayCount = stats?.todayCount ?? 0;
    if (todayCount === 0) return { label: "Sakin", color: "text-emerald-600", bg: "bg-emerald-100" };
    if (todayCount <= weeklyAverage) return { label: "Normal", color: "text-blue-600", bg: "bg-blue-100" };
    if (todayCount <= weeklyAverage * 1.5) return { label: "Yoğun", color: "text-amber-600", bg: "bg-amber-100" };
    return { label: "Çok Yoğun", color: "text-red-600", bg: "bg-red-100" };
  }, [stats, weeklyAverage]);

  return (
    <Card className="bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 border-0 shadow-xl text-white overflow-hidden relative">
      <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,transparent,rgba(255,255,255,0.5))]" />
      <div className="absolute -top-20 -right-20 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
      <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
      
      <CardContent className="p-5 relative">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-sm text-white/70 font-medium">Günlük Durum</p>
            <div className="flex items-center gap-2 mt-1">
              <Flame className="h-5 w-5 text-amber-300" />
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${performanceLevel.bg} ${performanceLevel.color}`}>
                {performanceLevel.label}
              </span>
            </div>
          </div>
          <div className="p-2 rounded-lg bg-white/20 backdrop-blur-sm">
            <Zap className="h-5 w-5" />
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-white/60">Haftalık Ort.</p>
            <p className="text-2xl font-bold">{weeklyAverage}</p>
            <p className="text-[10px] text-white/50">yönlendirme/gün</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-white/60">Aylık Ort.</p>
            <p className="text-2xl font-bold">{monthlyAverage}</p>
            <p className="text-[10px] text-white/50">yönlendirme/gün</p>
          </div>
        </div>
        
        <div className="mt-4 pt-3 border-t border-white/20">
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/60">Bugün vs Ortalama</span>
            <span className="font-medium">
              {stats?.todayCount ?? 0} / {weeklyAverage}
            </span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-white/20 overflow-hidden">
            <div 
              className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-400 transition-all duration-500"
              style={{ width: `${Math.min((stats?.todayCount ?? 0) / (weeklyAverage || 1) * 100, 100)}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Neden Dağılımı Mini Widget
function ReasonsMiniWidget({ byReason }: { byReason?: Record<string, number> }) {
  const [animatedWidths, setAnimatedWidths] = useState<Record<string, number>>({});
  const [isVisible, setIsVisible] = useState(false);

  const topReasons = useMemo(() => {
    if (!byReason) return [];
    const total = Object.values(byReason).reduce((a, b) => a + b, 0);
    return Object.entries(byReason)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({
        name: name.length > 25 ? name.slice(0, 25) + "..." : name,
        count,
        percentage: Math.round(count / total * 100)
      }));
  }, [byReason]);

  const colors = [
    "from-blue-500 to-blue-600",
    "from-emerald-500 to-emerald-600",
    "from-amber-500 to-amber-600",
    "from-violet-500 to-violet-600",
    "from-rose-500 to-rose-600"
  ];

  // Animate progress bars
  useEffect(() => {
    if (topReasons.length === 0) return;
    setIsVisible(true);
    setAnimatedWidths({});
    topReasons.forEach((reason, idx) => {
      setTimeout(() => {
        setAnimatedWidths(prev => ({ ...prev, [reason.name]: reason.percentage }));
      }, idx * 150);
    });
  }, [topReasons]);

  if (topReasons.length === 0) {
    return null;
  }

  return (
    <Card className="bg-white border-0 shadow-lg relative overflow-hidden group">
      {/* Background Decorations */}
      <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-amber-100/30 blur-2xl animate-float-slow" />
      <div className="absolute -bottom-8 -left-8 w-24 h-24 rounded-full bg-orange-100/30 blur-2xl animate-float-reverse" />
      
      <CardHeader className="pb-3 border-b border-slate-100 bg-gradient-to-r from-amber-50 via-orange-50 to-yellow-50 relative">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
            <div className="relative">
              <Target className="h-4 w-4 text-amber-500" />
              <div className="absolute inset-0 animate-ping opacity-30">
                <Target className="h-4 w-4 text-amber-400" />
              </div>
            </div>
            En Sık Nedenler
            <span className="flex h-2 w-2 ml-1">
              <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
          </CardTitle>
          <Link href="/panel/nedenler" className="group/link flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 bg-white/50 px-2 py-1 rounded-full hover:bg-blue-50 transition-all">
            Detay 
            <ChevronRight className="h-3 w-3 group-hover/link:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-3 relative">
        {topReasons.map((reason, idx) => (
          <div 
            key={reason.name} 
            className={`group/item space-y-1.5 p-2 -mx-2 rounded-lg hover:bg-slate-50 transition-all cursor-default ${
              isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2'
            }`}
            style={{ transitionDelay: `${idx * 100}ms`, transition: 'all 0.3s ease-out' }}
          >
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 truncate flex-1 pr-2 group-hover/item:text-slate-800 transition-colors flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full bg-gradient-to-r ${colors[idx]}`} />
                {reason.name}
              </span>
              <span className="text-slate-800 font-bold tabular-nums group-hover/item:scale-110 transition-transform">
                {reason.count}
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden shadow-inner">
              <div 
                className={`h-full rounded-full bg-gradient-to-r ${colors[idx]} transition-all duration-700 ease-out relative overflow-hidden`}
                style={{ width: `${animatedWidths[reason.name] ?? 0}%` }}
              >
                {/* Shimmer Effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
              </div>
            </div>
            <div className="flex justify-end">
              <span className="text-[10px] text-slate-400 tabular-nums">{reason.percentage}%</span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function PanelOzetPage() {
  const { stats, loadingStats, statsError, fetchStats } = usePanelData();
  const [showCharts, setShowCharts] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Yeni yönlendirme bildirimleri
  const latestStudent = stats?.todayStudents?.[0] 
    ? { 
        name: stats.todayStudents[0].student_name, 
        reason: stats.todayStudents[0].reason || "Belirtilmemiş",
        class: stats.todayStudents[0].class_display 
      } 
    : null;
  
  useNewReferralNotification(stats?.totalCount ?? 0, latestStudent);

  const handleRefresh = async () => {
    setRefreshing(true);
    toast.loading("İstatistikler yenileniyor...", { id: "refresh" });
    const result = await fetchStats();
    if (result) {
      toast.success("İstatistikler güncellendi!", { id: "refresh" });
    } else {
      toast.error("İstatistikler güncellenemedi", { id: "refresh" });
    }
    setRefreshing(false);
  };

  // Trend hesaplama
  const getTrend = (current: number, average: number): { direction: "up" | "down" | "neutral"; value: string } => {
    if (average === 0) return { direction: "neutral", value: "" };
    const diff = ((current - average) / average * 100).toFixed(0);
    const num = parseInt(diff);
    if (num > 0) return { direction: "up", value: `+${diff}%` };
    if (num < 0) return { direction: "down", value: `${diff}%` };
    return { direction: "neutral", value: "0%" };
  };

  const weeklyAvg = stats?.weekCount ? Math.round(stats.weekCount / 5) : 0;
  const todayTrend = getTrend(stats?.todayCount ?? 0, weeklyAvg);

  return (
    <div className="space-y-6">
      {/* Bildirim İzni Banneri */}
      <NotificationPermissionBanner />

      {/* Modern Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 via-slate-900 to-zinc-900 p-6 text-white shadow-xl">
        <div className="absolute inset-0 bg-grid-white/5 [mask-image:linear-gradient(0deg,transparent,rgba(255,255,255,0.3))]" />
        
        {/* Animated Background Elements */}
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl animate-float-slow" />
        <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-violet-500/20 blur-3xl animate-float-reverse" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-indigo-500/10 blur-3xl animate-pulse-glow" />
        
        {/* Floating Particles */}
        <div className="absolute top-10 right-20 h-2 w-2 rounded-full bg-blue-400/60 animate-float animation-delay-100" />
        <div className="absolute top-20 right-40 h-1.5 w-1.5 rounded-full bg-violet-400/60 animate-float animation-delay-300" />
        <div className="absolute bottom-16 left-32 h-2 w-2 rounded-full bg-cyan-400/60 animate-float animation-delay-500" />
        <div className="absolute top-1/3 left-1/4 h-1 w-1 rounded-full bg-white/40 animate-sparkle animation-delay-200" />
        <div className="absolute bottom-1/3 right-1/4 h-1.5 w-1.5 rounded-full bg-amber-400/50 animate-sparkle animation-delay-700" />
        
        <div className="relative">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-violet-600 shadow-lg shadow-blue-500/30">
                  <Brain className="h-8 w-8" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-slate-900 flex items-center justify-center">
                  <CheckCircle2 className="h-3 w-3 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Rehberlik Paneli</h1>
                <p className="text-slate-400 text-sm">Günlük yönlendirme özeti ve istatistikler</p>
              </div>
            </div>
            
            {/* Hızlı İstatistikler */}
            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-2 rounded-xl bg-white/10 backdrop-blur-sm px-4 py-2.5 hover:bg-white/15 transition-all duration-300 border border-white/10">
                <div className="p-1.5 rounded-lg bg-blue-500/20">
                  <Target className="h-4 w-4 text-blue-400" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Bugün</p>
                  <p className="text-xl font-bold">{stats?.todayCount ?? 0}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-white/10 backdrop-blur-sm px-4 py-2.5 hover:bg-white/15 transition-all duration-300 border border-white/10">
                <div className="p-1.5 rounded-lg bg-emerald-500/20">
                  <TrendingUp className="h-4 w-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Hafta</p>
                  <p className="text-xl font-bold">{stats?.weekCount ?? 0}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-white/10 backdrop-blur-sm px-4 py-2.5 hover:bg-white/15 transition-all duration-300 border border-white/10">
                <div className="p-1.5 rounded-lg bg-amber-500/20">
                  <Sparkles className="h-4 w-4 text-amber-400" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Toplam</p>
                  <p className="text-xl font-bold">{stats?.totalCount ?? 0}</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Alt bilgi çubuğu */}
          <div className="mt-5 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-4 text-sm text-slate-400">
              <NotificationStatus />
              {stats?.topTeacher && (
                <span className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-lg">
                  <Trophy className="h-4 w-4 text-amber-400" />
                  <span>En Aktif:</span>
                  <strong className="text-white">{stats.topTeacher.name}</strong>
                  <Badge className="bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border-0 text-[10px]">
                    {stats.topTeacher.count}
                  </Badge>
                </span>
              )}
            </div>
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={handleRefresh} 
              disabled={loadingStats || refreshing}
              className="bg-white/10 hover:bg-white/20 text-white border-0 backdrop-blur-sm"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
              Yenile
            </Button>
          </div>
        </div>
      </div>

      {statsError && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <p className="text-sm">{statsError}</p>
        </div>
      )}

      {/* İstatistik Kartları */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Bugün"
          value={loadingStats ? "..." : stats?.todayCount ?? 0}
          subtitle="yönlendirme yapıldı"
          icon={CalendarDays}
          trend={todayTrend.direction}
          trendValue={todayTrend.value}
          gradient="from-blue-500 to-indigo-600"
        />
        <StatCard
          title="Bu Hafta"
          value={loadingStats ? "..." : stats?.weekCount ?? 0}
          subtitle="toplam yönlendirme"
          icon={TrendingUp}
          gradient="from-emerald-500 to-teal-600"
        />
        <StatCard
          title="Bu Ay"
          value={loadingStats ? "..." : stats?.monthCount ?? 0}
          subtitle="aylık toplam"
          icon={BarChart3}
          gradient="from-amber-500 to-orange-600"
        />
        <StatCard
          title="Tüm Zamanlar"
          value={loadingStats ? "..." : stats?.totalCount ?? 0}
          subtitle="toplam kayıt"
          icon={Star}
          gradient="from-violet-500 to-purple-600"
        />
      </div>

      {/* 3 Sütunlu Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Sol Sütun - Saat ve Hızlı Erişim */}
        <div className="space-y-4">
          {/* Saat Kartı */}
          <Card className="bg-white border-0 shadow-lg overflow-hidden">
            <CardHeader className="pb-2 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-blue-50">
              <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-500" />
                Sunucu Zamanı
                <span className="ml-auto flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <LiveClock />
            </CardContent>
          </Card>

          {/* Hızlı Erişim - Modern */}
          <Card className="bg-white border-0 shadow-lg relative overflow-hidden group">
            {/* Background Decorations */}
            <div className="absolute -top-12 -right-12 w-24 h-24 rounded-full bg-amber-100/50 blur-2xl animate-float-slow" />
            <div className="absolute -bottom-8 -left-8 w-20 h-20 rounded-full bg-orange-100/50 blur-2xl animate-float-reverse" />
            
            <CardHeader className="pb-2 relative">
              <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <div className="relative">
                  <Zap className="h-4 w-4 text-amber-500" />
                  <div className="absolute inset-0 animate-ping opacity-30">
                    <Zap className="h-4 w-4 text-amber-400" />
                  </div>
                </div>
                Hızlı Erişim
                <span className="ml-auto flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 relative">
              <QuickActionCard 
                title="Belge Oluştur" 
                description="Yeni belge hazırla"
                icon={FileText}
                href="/panel/belge"
                color="from-violet-500 to-purple-600"
              />
              <QuickActionCard 
                title="Öğrenci Listesi" 
                description="Tüm öğrencileri görüntüle"
                icon={GraduationCap}
                href="/panel/ogrenci-listesi"
                color="from-cyan-500 to-blue-600"
              />
              <QuickActionCard 
                title="Telegram" 
                description="Bildirimleri yönet"
                icon={Bell}
                href="/panel/telegram"
                color="from-sky-500 to-cyan-600"
              />
            </CardContent>
          </Card>

          {/* En Aktif Öğretmenler - Yerler değiştirildi */}
          <TopTeachersPodium byTeacher={stats?.byTeacher} />
        </div>

        {/* Orta Sütun - Son Aktiviteler */}
        <div className="space-y-4">
          <RecentActivities todayStudents={stats?.todayStudents} />
          <ReasonsMiniWidget byReason={stats?.byReason} />
        </div>

        {/* Sağ Sütun - Günlük Durum (Yerler değiştirildi) */}
        <div className="space-y-4">
          {/* Performans Widget - Live & Animated */}
          <PerformanceSummary stats={stats} />
          
          {/* Ek Bilgi Kartı - Modern & Animated */}
          <Card className="bg-gradient-to-br from-slate-800 via-slate-850 to-slate-900 border-0 shadow-xl text-white overflow-hidden relative group">
            {/* Background Grid */}
            <div className="absolute inset-0 bg-grid-white/5 [mask-image:linear-gradient(0deg,transparent,rgba(255,255,255,0.3))]" />
            
            {/* Animated Background Orbs */}
            <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-blue-500/10 blur-2xl animate-float-slow" />
            <div className="absolute -bottom-12 -left-12 w-28 h-28 rounded-full bg-violet-500/10 blur-2xl animate-float-reverse" />
            
            {/* Sparkle Particles */}
            <div className="absolute top-4 right-8 h-1 w-1 rounded-full bg-white/40 animate-sparkle animation-delay-100" />
            <div className="absolute bottom-8 left-12 h-1 w-1 rounded-full bg-blue-300/40 animate-sparkle animation-delay-500" />
            
            <CardContent className="p-5 relative">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-white/20 to-white/10 backdrop-blur-sm group-hover:scale-110 transition-transform duration-300 shadow-lg">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold flex items-center gap-2">
                    Öğrenci Takip
                    <span className="flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">Rehberlik ve yönlendirme sistemi</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/5 hover:bg-white/15 hover:border-white/10 transition-all duration-300 cursor-default group/stat">
                  <p className="text-2xl font-bold tabular-nums group-hover/stat:scale-110 transition-transform">{Object.keys(stats?.byClass || {}).length}</p>
                  <p className="text-xs text-slate-400 flex items-center justify-center gap-1">
                    <GraduationCap className="h-3 w-3" />
                    Aktif Sınıf
                  </p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/5 hover:bg-white/15 hover:border-white/10 transition-all duration-300 cursor-default group/stat">
                  <p className="text-2xl font-bold tabular-nums group-hover/stat:scale-110 transition-transform">{Object.keys(stats?.byTeacher || {}).length}</p>
                  <p className="text-xs text-slate-400 flex items-center justify-center gap-1">
                    <Users className="h-3 w-3" />
                    Öğretmen
                  </p>
                </div>
              </div>
              
              {/* Mini Progress Footer */}
              <div className="mt-4 pt-3 border-t border-white/10">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Sistem Durumu</span>
                  <span className="flex items-center gap-1 text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Aktif
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Grafikler Bölümü - Modern */}
      <div className="space-y-4">
        <Card className="bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 border-0 shadow-xl overflow-hidden relative">
          {/* Background Decorations */}
          <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,transparent,rgba(255,255,255,0.3))]" />
          <div className="absolute -top-24 -right-24 w-48 h-48 rounded-full bg-white/10 blur-3xl animate-float-slow" />
          <div className="absolute -bottom-24 -left-24 w-48 h-48 rounded-full bg-white/10 blur-3xl animate-float-reverse" />
          
          {/* Sparkle Particles */}
          <div className="absolute top-6 right-20 h-1.5 w-1.5 rounded-full bg-white/60 animate-sparkle animation-delay-100" />
          <div className="absolute top-12 right-40 h-1 w-1 rounded-full bg-violet-200/60 animate-sparkle animation-delay-300" />
          <div className="absolute bottom-8 left-32 h-1.5 w-1.5 rounded-full bg-indigo-200/60 animate-sparkle animation-delay-500" />
          
          <CardContent className="p-4 relative">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-white/20 backdrop-blur-sm shadow-lg">
                  <BarChart3 className="h-6 w-6 text-white" />
                </div>
                <div className="text-white">
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    İstatistik Grafikleri
                    <span className="flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                  </h2>
                  <p className="text-sm text-white/70">Detaylı analiz ve görselleştirmeler</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-white/20 text-white border-0 hover:bg-white/30">
                  <Activity className="h-3 w-3 mr-1" />
                  5 Grafik
                </Badge>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowCharts(!showCharts)}
                  className="bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-sm"
                >
                  {showCharts ? (
                    <>
                      <ChevronUp className="h-4 w-4 mr-2" /> Gizle
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4 mr-2" /> Göster
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {showCharts && (
          <DashboardCharts stats={stats} loading={loadingStats} />
        )}
      </div>
    </div>
  );
}
