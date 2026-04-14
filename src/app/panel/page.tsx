"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  CalendarDays, 
  Sparkles, 
  Users,
  AlertCircle,
  Clock, 
  ChevronRight,
  Eye,
  ArrowUpRight,
  ArrowDownRight,
  CheckSquare,
  Circle,
  Flag,
  Loader2,
  Calendar,
  Flame,
  Zap,
  GraduationCap,
  BookOpen,
  CheckCircle2,
  MessageSquare,
  Bell,
  Phone,
  PhoneCall
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { usePanelData } from "./hooks";
import { ClickableStudent } from "@/components/ClickableStudent";
import { DashboardCharts } from "@/components/charts/DashboardCharts";
import { 
  NotificationPermissionBanner, 
  NotificationStatus, 
  useNewReferralNotification 
} from "@/components/NotificationSystem";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Appointment, PARTICIPANT_TYPES, APPOINTMENT_LOCATIONS } from "@/types";

type ReferralConvertibleStudent = {
  student_name: string;
  class_display: string;
  reason?: string;
  teacher_name?: string;
};

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

// Yönlendirme Listesi Modal Komponenti


// Stat Kartı Komponenti - Modern & Animated
function StatCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend, 
  trendValue,
  gradient,
  delay = 0,
  onClick
}: { 
  title: string;
  value: number | string;
  subtitle: string;
  icon: React.ElementType;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  gradient: string;
  delay?: number;
  onClick?: () => void;
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
    <Card 
      className={`relative overflow-hidden border-0 shadow-lg hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 group ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
      style={{ animationDelay: `${delay}ms` }}
      onClick={onClick}
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
        
        {/* Click Hint */}
        {onClick && (
          <div className="mt-2 flex items-center gap-1 text-xs text-slate-400 group-hover:text-slate-600 transition-colors">
            <Eye className="h-3 w-3" />
            <span>Detayları görmek için tıklayın</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}




// Yapılacaklar Widget
function TasksWidget() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const { data, error } = await supabase
          .from('tasks')
          .select('*')
          .eq('status', 'pending')
          .order('due_date', { ascending: true })
          .limit(5);
        if (!error) setTasks(data || []);
      } catch (err) {
        console.error("Görevler yüklenirken hata:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchTasks();
  }, []);

  const today = new Date().toISOString().split('T')[0];

  if (loading) {
    return (
      <Card className="bg-white border-0 shadow-lg relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-50 to-orange-50 opacity-50" />
        <div className="absolute -top-16 -right-16 w-32 h-32 rounded-full bg-amber-100/50 blur-2xl animate-float-slow" />
        <CardContent className="p-4 flex items-center justify-center py-8 relative">
          <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Link href="/panel/yapilacaklar">
      <Card className="bg-gradient-to-br from-amber-500 via-orange-500 to-yellow-600 border-0 shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden group cursor-pointer text-white relative">
        {/* Background Decorations */}
        <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,transparent,rgba(255,255,255,0.5))]" />
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
        <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-white/10 rounded-full blur-2xl" />

        <CardHeader className="pb-3 relative">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-white flex items-center gap-2">
              <div className="relative">
                <CheckSquare className="h-4 w-4 text-white" />
                <div className="absolute inset-0 animate-ping opacity-50">
                  <CheckSquare className="h-4 w-4 text-amber-300" />
                </div>
              </div>
              Yapılacaklar
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-amber-300 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400"></span>
              </span>
              <Badge className="bg-white/20 text-white hover:bg-white/30 border-0 shadow-sm backdrop-blur-sm">
                {tasks.length} bekliyor
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 relative">
          {tasks.length === 0 ? (
            <div className="text-center py-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm mb-3 animate-bounce-subtle">
                <Sparkles className="h-6 w-6 text-amber-200" />
              </div>
              <p className="text-white/90 text-sm font-medium">Bekleyen görev yok</p>
              <p className="text-white/70 text-xs mt-1">Harika! 🎉</p>
            </div>
          ) : (
            tasks.slice(0, 4).map((task: any, idx: number) => {
              const overdue = task.due_date && task.due_date < today;
              return (
                <div
                  key={task.id}
                  className={`flex items-start gap-3 p-3 rounded-lg bg-white/10 backdrop-blur-sm group-hover:bg-white/20 transition-all duration-300 ${
                    overdue ? 'ring-1 ring-red-300/50' : ''
                  }`}
                  style={{ animationDelay: `${idx * 100}ms` }}
                >
                  <div className={`flex-shrink-0 mt-0.5 ${overdue ? 'animate-pulse' : ''}`}>
                    {overdue ? (
                      <AlertCircle className="h-4 w-4 text-red-300" />
                    ) : task.priority === 'urgent' ? (
                      <Flag className="h-4 w-4 text-red-300" />
                    ) : (
                      <Circle className="h-4 w-4 text-amber-200" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white truncate group-hover:text-amber-100 transition-colors">
                      {task.title}
                    </p>
                    {task.due_date && (
                      <p className={`text-[10px] mt-1 flex items-center gap-1 ${
                        overdue ? 'text-red-200 font-semibold' : 'text-white/70'
                      }`}>
                        <Clock className="h-3 w-3" />
                        {overdue ? 'Gecikmiş' : task.due_date === today ? 'Bugün' : task.due_date}
                      </p>
                    )}
                  </div>
                  {task.priority === 'urgent' && !overdue && (
                    <div className="flex-shrink-0">
                      <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                    </div>
                  )}
                </div>
              );
            })
          )}
          {tasks.length > 4 && (
            <div className="text-center pt-2">
              <p className="text-xs text-amber-200 font-medium">+{tasks.length - 4} daha var</p>
              <ChevronRight className="h-4 w-4 text-amber-200 mx-auto mt-1 group-hover:translate-x-1 transition-transform" />
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

// Bugünkü Randevular Widget
function TodayAppointmentsWidget() {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAppointments = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const res = await fetch(`/api/appointments?date=${today}`);
        if (res.ok) {
          const data = await res.json();
          setAppointments(data.appointments || []);
        }
      } catch (err) {
        console.error("Randevular yüklenirken hata:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAppointments();
  }, []);

  const participantTypeLabel: Record<string, string> = {
    student: 'Öğrenci',
    parent: 'Veli',
    teacher: 'Öğretmen',
    other: 'Diğer',
  };

  const statusColor: Record<string, string> = {
    planned: 'bg-blue-400',
    completed: 'bg-green-400',
    cancelled: 'bg-red-400',
    no_show: 'bg-slate-400',
  };

  if (loading) {
    return (
      <Card className="bg-white border-0 shadow-lg overflow-hidden">
        <CardContent className="p-4 flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Link href="/panel/takvim">
      <Card className="bg-gradient-to-br from-indigo-500 via-blue-500 to-cyan-500 border-0 shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden group cursor-pointer text-white relative">
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
        <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-white/10 rounded-full blur-2xl" />

        <CardHeader className="pb-3 relative">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-white flex items-center gap-2">
              <Calendar className="h-4 w-4 text-white" />
              Bugünkü Randevular
            </CardTitle>
            <Badge className="bg-white/20 text-white hover:bg-white/30 border-0 shadow-sm backdrop-blur-sm">
              {appointments.length} randevu
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-2 relative">
          {appointments.length === 0 ? (
            <div className="text-center py-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm mb-3">
                <Calendar className="h-6 w-6 text-indigo-200" />
              </div>
              <p className="text-white/90 text-sm font-medium">Bugün randevu yok</p>
            </div>
          ) : (
            appointments.slice(0, 4).map((apt: any) => (
              <div
                key={apt.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-white/10 backdrop-blur-sm group-hover:bg-white/20 transition-all duration-300"
              >
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${statusColor[apt.status] || 'bg-white/50'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white truncate">{apt.participant_name}</p>
                  <p className="text-[10px] text-white/70 mt-0.5 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {apt.start_time?.slice(0, 5)}
                    {apt.participant_type && ` · ${participantTypeLabel[apt.participant_type] || apt.participant_type}`}
                  </p>
                </div>
              </div>
            ))
          )}
          {appointments.length > 4 && (
            <div className="text-center pt-2">
              <p className="text-xs text-indigo-200 font-medium">+{appointments.length - 4} daha var</p>
              <ChevronRight className="h-4 w-4 text-indigo-200 mx-auto mt-1 group-hover:translate-x-1 transition-transform" />
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
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

function UpcomingAppointmentsWidget() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeCard, setActiveCard] = useState<string | null>(null);
  const [weekSummary, setWeekSummary] = useState({
    total: 0,
    completed: 0,
    planned: 0,
    cancelled: 0
  });

  // Canlı saat güncellemesi
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchAppointments = async () => {
      try {
        const res = await fetch("/api/appointments?status=planned");
        if (res.ok) {
          const data = await res.json();
          const allAppointments = data.appointments || data || [];
          
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          const upcoming = allAppointments
            .filter((apt: Appointment) => new Date(apt.appointment_date) >= today)
            .sort((a: Appointment, b: Appointment) => {
              const dateCompare = new Date(a.appointment_date).getTime() - new Date(b.appointment_date).getTime();
              if (dateCompare !== 0) return dateCompare;
              return a.start_time.localeCompare(b.start_time);
            })
            .slice(0, 3);
          
          setAppointments(upcoming);
        }

        const allRes = await fetch("/api/appointments");
        if (allRes.ok) {
          const allData = await allRes.json();
          const allApts = allData.appointments || allData || [];
          
          const now = new Date();
          const startOfWeek = new Date(now);
          startOfWeek.setDate(now.getDate() - now.getDay() + 1);
          startOfWeek.setHours(0, 0, 0, 0);
          const endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(startOfWeek.getDate() + 6);
          endOfWeek.setHours(23, 59, 59, 999);
          
          const weekApts = allApts.filter((apt: Appointment) => {
            const aptDate = new Date(apt.appointment_date);
            return aptDate >= startOfWeek && aptDate <= endOfWeek;
          });
          
          setWeekSummary({
            total: weekApts.length,
            completed: weekApts.filter((a: Appointment) => a.status === 'attended').length,
            planned: weekApts.filter((a: Appointment) => a.status === 'planned').length,
            cancelled: weekApts.filter((a: Appointment) => a.status === 'cancelled' || a.status === 'not_attended').length
          });
        }
      } catch (error) {
        console.error("Randevular yüklenirken hata:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAppointments();
  }, []);

  // Kalan süre hesaplama
  const getTimeRemaining = (dateStr: string, timeStr: string) => {
    const aptDateTime = new Date(dateStr);
    const [hours, minutes] = timeStr.split(':').map(Number);
    aptDateTime.setHours(hours, minutes, 0, 0);
    
    const diff = aptDateTime.getTime() - currentTime.getTime();
    if (diff < 0) return { text: "Geçti", urgent: false, passed: true };
    
    const totalMinutes = Math.floor(diff / (1000 * 60));
    const totalHours = Math.floor(totalMinutes / 60);
    const days = Math.floor(totalHours / 24);
    const remainingHours = totalHours % 24;
    const remainingMinutes = totalMinutes % 60;
    
    if (days > 0) return { text: `${days}g ${remainingHours}s`, urgent: false, passed: false };
    if (totalHours > 0) return { text: `${totalHours}s ${remainingMinutes}dk`, urgent: totalHours < 2, passed: false };
    return { text: `${totalMinutes}dk`, urgent: true, passed: false };
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) return "Bugün";
    if (date.toDateString() === tomorrow.toDateString()) return "Yarın";
    return date.toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  const formatTime = (timeStr: string) => timeStr.slice(0, 5);

  const getParticipantIcon = (type: string) => {
    switch (type) {
      case 'student': return { icon: GraduationCap, color: 'from-blue-500 to-indigo-600', bg: 'bg-blue-100' };
      case 'parent': return { icon: Users, color: 'from-purple-500 to-pink-600', bg: 'bg-purple-100' };
      case 'teacher': return { icon: BookOpen, color: 'from-amber-500 to-orange-600', bg: 'bg-amber-100' };
      default: return { icon: Calendar, color: 'from-slate-500 to-slate-600', bg: 'bg-slate-100' };
    }
  };

  const getParticipantLabel = (type: string) => {
    switch (type) {
      case 'student': return 'Öğrenci';
      case 'parent': return 'Veli';
      case 'teacher': return 'Öğretmen';
      default: return 'Randevu';
    }
  };

  if (loading) {
    return (
      <Card className="bg-gradient-to-br from-slate-900 via-slate-800 to-zinc-900 border-0 shadow-2xl overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-500/20 to-cyan-500/20 animate-pulse" />
            <div className="space-y-2 flex-1">
              <div className="h-4 bg-white/10 rounded w-1/3 animate-pulse" />
              <div className="h-3 bg-white/5 rounded w-1/2 animate-pulse" />
            </div>
          </div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-white/5 rounded-2xl animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-slate-900 via-slate-800 to-zinc-900 border-0 shadow-2xl overflow-hidden relative group">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 bg-grid-white/5 [mask-image:linear-gradient(0deg,transparent,rgba(255,255,255,0.3))]" />
      <div className="absolute -top-32 -right-32 w-64 h-64 rounded-full bg-teal-500/20 blur-3xl animate-float-slow" />
      <div className="absolute -bottom-32 -left-32 w-64 h-64 rounded-full bg-cyan-500/20 blur-3xl animate-float-reverse" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-indigo-500/10 blur-3xl animate-pulse-glow" />
      
      {/* Floating Particles */}
      <div className="absolute top-10 right-20 h-2 w-2 rounded-full bg-teal-400/60 animate-float animation-delay-100" />
      <div className="absolute top-32 right-40 h-1.5 w-1.5 rounded-full bg-cyan-400/60 animate-float animation-delay-300" />
      <div className="absolute bottom-20 left-20 h-2 w-2 rounded-full bg-indigo-400/60 animate-float animation-delay-500" />
      <div className="absolute top-1/3 left-1/4 h-1 w-1 rounded-full bg-white/40 animate-sparkle" />
      <div className="absolute bottom-1/3 right-1/4 h-1.5 w-1.5 rounded-full bg-amber-400/50 animate-sparkle animation-delay-700" />
      
      {/* Header */}
      <CardHeader className="pb-4 relative border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-500 via-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-teal-500/30 group-hover:shadow-teal-500/50 transition-all duration-500">
                <Calendar className="h-7 w-7 text-white" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-slate-900 flex items-center justify-center animate-pulse">
                <span className="text-[10px] text-white font-bold">{appointments.length}</span>
              </div>
            </div>
            <div>
              <h3 className="text-xl font-bold text-white tracking-tight">Yaklaşan Randevular</h3>
              <p className="text-sm text-slate-400 flex items-center gap-2">
                <span className="flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                Canlı takip aktif
              </p>
            </div>
          </div>
          <Link href="/panel/takvim">
            <Button variant="ghost" size="sm" className="text-teal-400 hover:text-teal-300 hover:bg-white/10 gap-1 group/btn">
              <span>Tümünü Gör</span>
              <ChevronRight className="h-4 w-4 group-hover/btn:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      
      <CardContent className="p-5 relative space-y-5">
        {/* Hafta Özeti - Animated Stats */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Bu Hafta', value: weekSummary.total, color: 'from-slate-500 to-slate-600', icon: Calendar },
            { label: 'Bekliyor', value: weekSummary.planned, color: 'from-teal-500 to-cyan-600', icon: Clock },
            { label: 'Tamamlandı', value: weekSummary.completed, color: 'from-emerald-500 to-green-600', icon: CheckCircle2 },
            { label: 'İptal/Gelmedi', value: weekSummary.cancelled, color: 'from-red-500 to-rose-600', icon: AlertCircle }
          ].map((stat, idx) => (
            <div 
              key={stat.label}
              className="relative group/stat p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-300 cursor-default overflow-hidden"
              style={{ animationDelay: `${idx * 100}ms` }}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${stat.color} opacity-0 group-hover/stat:opacity-10 transition-opacity duration-300`} />
              <div className="relative">
                <stat.icon className="h-4 w-4 text-slate-500 mb-2 group-hover/stat:scale-110 transition-transform" />
                <p className="text-2xl font-bold text-white tabular-nums group-hover/stat:scale-105 transition-transform origin-left">
                  {stat.value}
                </p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Randevu Listesi */}
        {appointments.length === 0 ? (
          <div className="text-center py-10 relative">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-32 h-32 rounded-full bg-gradient-to-br from-teal-500/10 to-cyan-500/10 blur-2xl animate-pulse" />
            </div>
            <div className="relative">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-slate-700 to-slate-800 mb-4 border border-white/10 shadow-xl">
                <Calendar className="h-10 w-10 text-slate-400" />
              </div>
              <p className="text-lg font-medium text-white mb-2">Yaklaşan randevu yok</p>
              <p className="text-sm text-slate-500 mb-5">Yeni bir randevu planlamaya ne dersin?</p>
              <Link href="/panel/takvim">
                <Button className="bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-400 hover:to-cyan-500 text-white shadow-lg shadow-teal-500/25 hover:shadow-teal-500/40 transition-all duration-300 hover:scale-105">
                  <Calendar className="h-4 w-4 mr-2" />
                  Yeni Randevu Oluştur
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {appointments.map((apt, index) => {
              const isToday = new Date(apt.appointment_date).toDateString() === new Date().toDateString();
              const timeRemaining = getTimeRemaining(apt.appointment_date, apt.start_time);
              const participant = getParticipantIcon(apt.participant_type);
              const ParticipantIcon = participant.icon;
              const isActive = activeCard === apt.id;
              
              return (
                <Link href="/panel/takvim" key={apt.id}>
                  <div 
                    className={`group/card relative p-4 rounded-2xl border transition-all duration-500 cursor-pointer overflow-hidden
                      ${isToday 
                        ? 'bg-gradient-to-r from-teal-500/10 to-cyan-500/10 border-teal-500/30 hover:border-teal-400/50' 
                        : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                      }
                      ${isActive ? 'scale-[1.02] shadow-2xl' : 'hover:scale-[1.01]'}
                    `}
                    style={{ animationDelay: `${index * 150}ms` }}
                    onMouseEnter={() => setActiveCard(apt.id)}
                    onMouseLeave={() => setActiveCard(null)}
                  >
                    {/* Animated Background on Hover */}
                    <div className={`absolute inset-0 bg-gradient-to-r ${participant.color} opacity-0 group-hover/card:opacity-5 transition-opacity duration-500`} />
                    
                    {/* Urgent Pulse Effect */}
                    {timeRemaining.urgent && !timeRemaining.passed && (
                      <div className="absolute inset-0 rounded-2xl animate-pulse-border" />
                    )}
                    
                    <div className="relative flex items-center gap-4">
                      {/* Avatar/Icon */}
                      <div className="relative">
                        <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${participant.color} flex items-center justify-center shadow-lg transition-all duration-300 group-hover/card:scale-110 group-hover/card:rotate-3`}>
                          <ParticipantIcon className="h-7 w-7 text-white" />
                        </div>
                        {isToday && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 border-2 border-slate-900 animate-bounce">
                            <Sparkles className="h-2 w-2 text-white m-0.5" />
                          </div>
                        )}
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-white truncate group-hover/card:text-teal-300 transition-colors">
                            {apt.participant_name}
                          </p>
                          <Badge className={`${participant.bg} text-slate-700 border-0 text-[10px] px-2 py-0`}>
                            {getParticipantLabel(apt.participant_type)}
                          </Badge>
                          {isToday && (
                            <Badge className="bg-teal-500/20 text-teal-300 border-teal-500/30 text-[10px] px-2 py-0 animate-pulse">
                              Bugün
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-slate-400 truncate mb-2">{apt.participant_class}</p>
                        
                        {/* Time Info */}
                        <div className="flex items-center gap-4 text-xs">
                          <span className="flex items-center gap-1.5 text-slate-500">
                            <Calendar className="h-3.5 w-3.5" />
                            <span className="font-medium">{formatDate(apt.appointment_date)}</span>
                          </span>
                          <span className="flex items-center gap-1.5 text-slate-500">
                            <Clock className="h-3.5 w-3.5" />
                            <span className="font-medium">{formatTime(apt.start_time)}</span>
                          </span>
                          {apt.purpose && (
                            <span className="flex items-center gap-1.5 text-slate-500 truncate">
                              <MessageSquare className="h-3.5 w-3.5 flex-shrink-0" />
                              <span className="truncate">{apt.purpose}</span>
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* Time Remaining Badge */}
                      <div className="flex flex-col items-end gap-2">
                        <div className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-300
                          ${timeRemaining.passed 
                            ? 'bg-slate-500/20 text-slate-400'
                            : timeRemaining.urgent 
                              ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/30 animate-pulse' 
                              : 'bg-white/10 text-white'
                          }`}
                        >
                          {timeRemaining.passed ? '⏰ Geçti' : `⏱ ${timeRemaining.text}`}
                        </div>
                        <ChevronRight className="h-5 w-5 text-slate-600 group-hover/card:text-teal-400 group-hover/card:translate-x-1 transition-all duration-300" />
                      </div>
                    </div>
                    
                    {/* Progress Bar for Today's Appointments */}
                    {isToday && !timeRemaining.passed && (
                      <div className="mt-3 pt-3 border-t border-white/5">
                        <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                          <span>Randevuya kalan süre</span>
                          <span className="text-teal-400 font-medium">{timeRemaining.text}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <div 
                            className="h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 transition-all duration-1000 animate-shimmer relative"
                            style={{ 
                              width: `${Math.max(5, 100 - (parseInt(timeRemaining.text) / 60) * 100)}%` 
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
        
        {/* Quick Actions */}
        {appointments.length > 0 && (
          <div className="flex gap-2 pt-2">
            <Link href="/panel/takvim" className="flex-1">
              <Button variant="ghost" className="w-full bg-white/5 hover:bg-white/10 text-white border border-white/10 hover:border-white/20 transition-all duration-300">
                <Calendar className="h-4 w-4 mr-2" />
                Yeni Randevu
              </Button>
            </Link>
            <Link href="/panel/randevu/bildirimler" className="flex-1">
              <Button variant="ghost" className="w-full bg-white/5 hover:bg-white/10 text-white border border-white/10 hover:border-white/20 transition-all duration-300">
                <Bell className="h-4 w-4 mr-2" />
                Bildirim Gönder
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function PanelOzetPage() {
  const router = useRouter();
  const { stats, loadingStats, statsError, fetchStats } = usePanelData();
  const [showCharts, setShowCharts] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Sayfa yüklendiğinde randevular sayfasına yönlendir
  useEffect(() => {
    router.replace('/panel/takvim');
  }, [router]);

  // Modal state'leri - kaldırıldı
  // const [modalOpen, setModalOpen] = useState(false);
  // const [modalTitle, setModalTitle] = useState("");
  // const [modalStudents, setModalStudents] = useState<ReferralStudent[]>([]);
  // const [modalGradient, setModalGradient] = useState("from-blue-500 to-indigo-600");

  // Yeni yönlendirme bildirimleri
  const latestStudent = stats?.todayStudents?.[0] 
    ? { 
        name: stats.todayStudents[0].student_name, 
        reason: stats.todayStudents[0].reason || "Belirtilmemiş",
        class: stats.todayStudents[0].class_display 
      } 
    : null;
  
  useNewReferralNotification(stats?.totalCount ?? 0, latestStudent);

  // Tarihe göre öğrencileri filtrele - kaldırıldı
  // const filterStudentsByPeriod = (period: "today" | "week" | "month" | "all") => {
  //   if (!stats?.allStudents) return [];
  //
  //   const today = new Date();
  //   const todayStr = today.toISOString().slice(0, 10);
  //
  //   const startOfWeek = new Date(today);
  //   startOfWeek.setDate(today.getDate() - today.getDay() + 1);
  //   const weekStr = startOfWeek.toISOString().slice(0, 10);
  //
  //   const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  //   const monthStr = startOfMonth.toISOString().slice(0, 10);
  //
  //   switch (period) {
  //     case "today":
  //       return stats.allStudents.filter(s => s.date === todayStr);
  //     case "week":
  //       return stats.allStudents.filter(s => s.date >= weekStr && s.date <= todayStr);
  //     case "month":
  //       return stats.allStudents.filter(s => s.date >= monthStr && s.date <= todayStr);
  //     case "all":
  //       return stats.allStudents;
  //     default:
  //       return [];
  //   }
  // };

  // Kart tıklama işleyicileri - kaldırıldı
  // const handleStatCardClick = (period: "today" | "week" | "month" | "all", title: string, gradient: string) => {
  //   const students = filterStudentsByPeriod(period);
  //   setModalTitle(title);
  //   setModalStudents(students);
  //   setModalGradient(gradient);
  //   setModalOpen(true);
  // };

  // const handleConvertReferralToAppointment = (student: ReferralConvertibleStudent) => {
  //   const params = new URLSearchParams();
  //   params.set("studentName", student.student_name);
  //   if (student.class_display) params.set("classDisplay", student.class_display);
  //   if (student.reason) params.set("note", student.reason);
  //   if (student.teacher_name) params.set("teacherName", student.teacher_name);
  //   setModalOpen(false);
  //   router.push(`/panel/randevu?${params.toString()}`);
  // };

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
      {statsError && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <p className="text-sm">{statsError}</p>
        </div>
      )}

      {/* İstatistik Kartları */}
      {/* Kaldırıldı - İstatistik kartları artık gösterilmiyor */}

      {/* Referral List Modal - kaldırıldı */}
      {/* <ReferralListModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={modalTitle}
        students={modalStudents}
        gradient={modalGradient}
        onConvertToAppointment={handleConvertReferralToAppointment}
      /> */}

      {/* 2 Sütunlu Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Sol Sütun - Hızlı Erişim */}
        <div className="space-y-4">
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
              {/* Hızlı Erişim Kartları - Placeholder */}
            </CardContent>
          </Card>

          {/* Yapılacaklar Widget */}
          {/* <TasksWidget /> */}

          {/* Bugünkü Randevular Widget */}
          {/* <TodayAppointmentsWidget /> */}

        </div>

        {/* Sağ Sütun */}
      </div>

    </div>
  );
}
