"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  Plus, Send, X, Users, GraduationCap, FileText, Clock, 
  TrendingUp, Sparkles, Activity, CheckCircle2, AlertCircle,
  Calendar, Zap, RefreshCw, Download, Trash2, Eye, 
  Wifi, WifiOff, Bell, BellOff, History, ChevronDown, ChevronUp,
  BarChart3, Target, Award, Star, ArrowRight, Rocket,
  Heart, BookOpen, UserCheck, Timer
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "sonner";

import { SinifSube, Ogrenci, YonlendirilenOgrenci, YONLENDIRME_NEDENLERI } from "@/types";

const formSchema = z.object({
  ogretmenAdi: z.string().min(2, "Öğretmen adı en az 2 karakter olmalıdır"),
  sinifSube: z.string().min(1, "Sınıf/Şube seçimi zorunludur"),
  ogrenci: z.string().min(1, "Öğrenci seçimi zorunludur"),
  yonlendirmeNedenleri: z.array(z.string()).min(1, "En az bir yönlendirme nedeni seçilmelidir"),
  not: z.string().optional(),
});

// Activity tipini tanımla
interface Activity {
  id: string;
  type: 'add' | 'remove' | 'send';
  message: string;
  time: Date;
}

export default function RPDYonlendirme() {
  const [sinifSubeList, setSinifSubeList] = useState<SinifSube[]>([]);
  const [ogrenciList, setOgrenciList] = useState<Ogrenci[]>([]);
  const [yonlendirilenOgrenciler, setYonlendirilenOgrenciler] = useState<YonlendirilenOgrenci[]>([]);
  const [loading, setLoading] = useState(true);
  const [ogrenciLoading, setOgrenciLoading] = useState(false);
  const [sendingLoading, setSendingLoading] = useState(false);
  const [teacherOptions, setTeacherOptions] = useState<{ value: string; label: string; sinifSubeKey: string; sinifSubeDisplay: string }[]>([]);
  
  // Yeni state'ler - Live & Animasyonlar için
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isOnline, setIsOnline] = useState(true);
  const [showNotifications, setShowNotifications] = useState(true);
  const [animatedStats, setAnimatedStats] = useState({ students: 0, classes: 0, teachers: 0, today: 0 });
  const [recentActivity, setRecentActivity] = useState<Activity[]>([]);
  const [showActivityLog, setShowActivityLog] = useState(false);
  const [todayReferrals, setTodayReferrals] = useState(0);
  const [weeklyReferrals, setWeeklyReferrals] = useState(0);
  const [quickStats, setQuickStats] = useState({ pending: 0, sent: 0, success: 0 });
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [showReasonSearch, setShowReasonSearch] = useState(false);
  const [reasonSearch, setReasonSearch] = useState("");
  const [formProgress, setFormProgress] = useState(0);
  const [sessionStartTime] = useState(new Date());
  const [pulseAnimation, setPulseAnimation] = useState(false);
  const activityRef = useRef<HTMLDivElement>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      ogretmenAdi: "",
      sinifSube: "",
      ogrenci: "",
      yonlendirmeNedenleri: [],
      not: "",
    },
  });

  // Canlı saat güncellemesi
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Online/Offline durumu izleme
  useEffect(() => {
    const handleOnline = () => { setIsOnline(true); toast.success("🌐 Bağlantı sağlandı!"); };
    const handleOffline = () => { setIsOnline(false); toast.error("📡 Bağlantı kesildi!"); };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Form ilerleme hesaplama
  useEffect(() => {
    const values = form.getValues();
    let progress = 0;
    if (values.ogretmenAdi) progress += 25;
    if (values.sinifSube) progress += 25;
    if (values.ogrenci) progress += 25;
    if (values.yonlendirmeNedenleri.length > 0) progress += 25;
    setFormProgress(progress);
  }, [form.watch()]);

  // Animasyonlu istatistik sayacı
  useEffect(() => {
    if (!loading && sinifSubeList.length > 0) {
      const targetStats = {
        students: ogrenciList.length,
        classes: sinifSubeList.length,
        teachers: teacherOptions.length,
        today: yonlendirilenOgrenciler.length
      };
      
      const duration = 1500;
      const steps = 50;
      const interval = duration / steps;
      
      let step = 0;
      const timer = setInterval(() => {
        step++;
        const progress = step / steps;
        const easeOut = 1 - Math.pow(1 - progress, 3);
        
        setAnimatedStats({
          students: Math.round(targetStats.students * easeOut),
          classes: Math.round(targetStats.classes * easeOut),
          teachers: Math.round(targetStats.teachers * easeOut),
          today: Math.round(targetStats.today * easeOut)
        });
        
        if (step >= steps) clearInterval(timer);
      }, interval);
      
      return () => clearInterval(timer);
    }
  }, [loading, sinifSubeList.length, ogrenciList.length, teacherOptions.length, yonlendirilenOgrenciler.length]);

  // Pulse animasyonu tetikleme
  useEffect(() => {
    if (yonlendirilenOgrenciler.length > 0) {
      setPulseAnimation(true);
      const timer = setTimeout(() => setPulseAnimation(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [yonlendirilenOgrenciler.length]);

  // Activity log fonksiyonu
  const addActivity = useCallback((type: 'add' | 'remove' | 'send', message: string) => {
    const newActivity: Activity = {
      id: Date.now().toString(),
      type,
      message,
      time: new Date()
    };
    setRecentActivity(prev => [newActivity, ...prev.slice(0, 9)]);
    if (showNotifications) {
      if (type === 'add') toast.success(`✨ ${message}`);
      else if (type === 'send') toast.success(`🚀 ${message}`);
    }
  }, [showNotifications]);

  // Filtrelenmiş nedenler
  const filteredReasons = useMemo(() => {
    if (!reasonSearch) return YONLENDIRME_NEDENLERI;
    return YONLENDIRME_NEDENLERI.filter(neden => 
      neden.toLowerCase().includes(reasonSearch.toLowerCase())
    );
  }, [reasonSearch]);

  // Session süresi hesaplama
  const sessionDuration = useMemo(() => {
    const diff = currentTime.getTime() - sessionStartTime.getTime();
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, [currentTime, sessionStartTime]);

  // Veri yükle
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/data');
        const data = await response.json();
        setSinifSubeList(data.sinifSubeList);
        // load teachers
        const tRes = await fetch('/api/teachers');
        const tJson = await tRes.json();
        if (tJson && Array.isArray(tJson.teachers)) setTeacherOptions(tJson.teachers);
        setLoading(false);
      } catch (error) {
        console.error('Veri yüklenirken hata:', error);
        toast.error("Veri yüklenirken hata oluştu");
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Sınıf değiştiğinde öğrenci listesini güncelle
  const handleSinifChange = async (sinifSube: string) => {
    console.log('🔄 Sınıf değişti:', sinifSube);
    setOgrenciLoading(true);
    try {
      // URL encode yaparak # karakterinin düzgün gönderilmesini sağla
      const encodedSinifSube = encodeURIComponent(sinifSube);
      console.log('📤 API çağrısı:', `/api/students?sinifSube=${encodedSinifSube}`);
      const response = await fetch(`/api/students?sinifSube=${encodedSinifSube}`);
      const data = await response.json();
      console.log('📚 API Yanıtı:', Array.isArray(data) ? `${data.length} öğrenci` : typeof data, data);
      // API'den gelen verinin array olduğundan emin ol
      const ogrenciArray = Array.isArray(data) ? data : [];
      setOgrenciList(ogrenciArray);
      console.log('✅ Öğrenci listesi güncellendi:', ogrenciArray.length, 'öğrenci');
      form.setValue("ogrenci", ""); // Öğrenci seçimini sıfırla
    } catch (error) {
      console.error('❌ Öğrenci listesi yüklenirken hata:', error);
      toast.error("Öğrenci listesi yüklenirken hata oluştu");
      // Hata durumunda boş array ata
      setOgrenciList([]);
    } finally {
      setOgrenciLoading(false);
    }
  };

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    // If teachers data exists, enforce UI-level validation and auto class
    const t = teacherOptions.find(t => t.value === values.ogretmenAdi);
    if (t) {
      if (values.sinifSube !== t.sinifSubeKey) {
        toast.error(`Hatalı sınıf/şube seçtiniz. ${t.label} yalnızca ${t.sinifSubeDisplay} öğretmenidir.`);
        return;
      }
    }
    const sinifSubeText = sinifSubeList.find(s => s.value === values.sinifSube)?.text || "";
    const ogrenciAdi = ogrenciList.find(o => o.value === values.ogrenci)?.text || "";

    // Her seçilen neden için ayrı bir öğrenci entry'si oluştur
    const yeniOgrenciler: YonlendirilenOgrenci[] = values.yonlendirmeNedenleri.map(neden => ({
      id: `${Date.now()}-${Math.random()}-${neden}`,
      ogretmenAdi: values.ogretmenAdi,
      sinifSube: sinifSubeText,
      ogrenciAdi: ogrenciAdi,
      yonlendirmeNedeni: neden,
      not: values.not?.trim() ? values.not : undefined,
      tarih: new Date().toLocaleString('tr-TR'),
    }));

    setYonlendirilenOgrenciler(prev => [...prev, ...yeniOgrenciler]);
    
    // Activity log'a ekle
    addActivity('add', `${ogrenciAdi} listeye eklendi (${values.yonlendirmeNedenleri.length} neden)`);

    // Formu kısmen sıfırla (öğretmen adı ve öğrenci seçimi korunur)
    form.setValue("yonlendirmeNedenleri", []);
    form.setValue("not", "");

    toast.success(`${ogrenciAdi} ${values.yonlendirmeNedenleri.length} farklı nedenle başarıyla eklendi`);
  };

  const removeStudent = (id: string) => {
    const student = yonlendirilenOgrenciler.find(o => o.id === id);
    setYonlendirilenOgrenciler(prev => prev.filter(o => o.id !== id));
    if (student) {
      addActivity('remove', `${student.ogrenciAdi} listeden çıkarıldı`);
    }
    toast.success("Öğrenci listeden çıkarıldı");
  };

  // Tüm öğrencileri temizle
  const clearAllStudents = () => {
    if (yonlendirilenOgrenciler.length === 0) {
      toast.warning("Liste zaten boş");
      return;
    }
    const count = yonlendirilenOgrenciler.length;
    setYonlendirilenOgrenciler([]);
    addActivity('remove', `${count} öğrenci listeden temizlendi`);
    toast.success(`${count} öğrenci listeden temizlendi`);
  };

  // Listeyi JSON olarak indir
  const exportList = () => {
    if (yonlendirilenOgrenciler.length === 0) {
      toast.warning("İndirilecek öğrenci yok");
      return;
    }
    const data = JSON.stringify(yonlendirilenOgrenciler, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `yonlendirme-listesi-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Liste indirildi");
  };

  const sendToGuidance = async () => {
    if (yonlendirilenOgrenciler.length === 0) {
      toast.error("Yönlendirilecek öğrenci bulunmuyor");
      return;
    }

    // Çoklu gönderim engellemek için loading state'i kontrol et
    if (sendingLoading) {
      toast.warning("Gönderim devam ediyor, lütfen bekleyin...");
      return;
    }

    setSendingLoading(true);

    try {
      const response = await fetch('/api/send-guidance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ students: yonlendirilenOgrenciler }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        if (result.telegram && result.sheets) {
          toast.success("✅ Öğrenciler Telegram ve Google Sheets'e başarıyla gönderildi!");
        } else if (result.telegram || result.sheets) {
          toast.success("⚠️ Öğrenciler kısmen gönderildi. " + result.message);
        } else {
          toast.error("❌ Gönderim başarısız: " + result.message);
        }

        if (result.telegram || result.sheets) {
          setYonlendirilenOgrenciler([]);
          addActivity('send', `${yonlendirilenOgrenciler.length} öğrenci rehberliğe gönderildi`);
        }
      } else {
        toast.error("❌ Gönderim sırasında hata oluştu: " + (result.message || result.error));
      }
    } catch (error) {
      console.error('Gönderim hatası:', error);
      toast.error("❌ Gönderim sırasında hata oluştu");
    } finally {
      setSendingLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-100 flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-400/20 to-indigo-600/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-purple-400/20 to-pink-600/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        </div>
        <div className="text-center relative z-10">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-transparent bg-gradient-to-r from-blue-500 to-purple-500 mx-auto mb-6"></div>
            <div className="absolute inset-0 animate-spin rounded-full h-16 w-16 border-4 border-transparent bg-gradient-to-r from-transparent via-white to-transparent mx-auto" style={{ animationDuration: '1s' }}></div>
          </div>
          <p className="text-xl font-medium bg-gradient-to-r from-gray-700 to-blue-600 bg-clip-text text-transparent animate-pulse">Veriler yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-100 pb-20 md:pb-0 relative overflow-hidden">
      {/* Animated Background Elements - Enhanced */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-400/20 to-indigo-600/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-purple-400/20 to-pink-600/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-r from-emerald-400/10 to-blue-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
        {/* Yeni hareketli parçacıklar */}
        <div className="absolute top-20 left-20 w-3 h-3 bg-blue-400/30 rounded-full animate-float-slow"></div>
        <div className="absolute top-40 right-40 w-2 h-2 bg-purple-400/30 rounded-full animate-float-slow" style={{ animationDelay: '1s' }}></div>
        <div className="absolute bottom-40 left-1/3 w-4 h-4 bg-indigo-400/20 rounded-full animate-float-slow" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-1/3 right-1/4 w-2 h-2 bg-pink-400/30 rounded-full animate-float-slow" style={{ animationDelay: '0.5s' }}></div>
      </div>

      <div className="container mx-auto px-2 sm:px-3 md:px-4 py-3 md:py-8 max-w-7xl relative z-10">
        {/* Enhanced Header with Live Features */}
        <div className="text-center mb-4 md:mb-8 animate-fade-in">
          {/* Top Status Bar - Mobile Optimized */}
          <div className="flex items-center justify-center gap-1.5 sm:gap-2 md:gap-4 mb-3 md:mb-4 flex-wrap">
            {/* Live Indicator */}
            <div className="flex items-center gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 bg-white/80 backdrop-blur-sm rounded-full shadow-md border border-gray-100">
              <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
              <span className="text-[10px] sm:text-xs font-medium text-gray-600">{isOnline ? 'Çevrimiçi' : 'Çevrimdışı'}</span>
              {isOnline ? <Wifi className="w-3 h-3 text-green-500" /> : <WifiOff className="w-3 h-3 text-red-500" />}
            </div>
            
            {/* Live Clock */}
            <div className="flex items-center gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 bg-gradient-to-r from-blue-500/10 to-purple-500/10 backdrop-blur-sm rounded-full shadow-md border border-blue-100">
              <Clock className="w-3 h-3 text-blue-600 animate-pulse" />
              <span className="text-[10px] sm:text-xs font-mono font-bold text-blue-700">
                {currentTime.toLocaleTimeString('tr-TR')}
              </span>
            </div>

            {/* Session Timer - Hide on very small screens */}
            <div className="hidden xs:flex items-center gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 backdrop-blur-sm rounded-full shadow-md border border-emerald-100">
              <Timer className="w-3 h-3 text-emerald-600" />
              <span className="text-[10px] sm:text-xs font-mono font-medium text-emerald-700">{sessionDuration}</span>
            </div>

            {/* Notification Toggle - Simplified for mobile */}
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className={`flex items-center gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full shadow-md border transition-all duration-300 active:scale-95 ${
                showNotifications 
                  ? 'bg-amber-500/10 border-amber-100' 
                  : 'bg-gray-100 border-gray-200'
              }`}
            >
              {showNotifications ? (
                <Bell className="w-3 h-3 text-amber-600" />
              ) : (
                <BellOff className="w-3 h-3 text-gray-500" />
              )}
              <span className="text-[10px] sm:text-xs font-medium text-gray-600 hidden sm:inline">
                {showNotifications ? 'Açık' : 'Kapalı'}
              </span>
            </button>
          </div>

          {/* Main Title with Animation - Mobile Optimized */}
          <div className="flex items-center justify-center mb-2 md:mb-4 group">
            <div className="relative">
              <GraduationCap className="h-8 w-8 sm:h-10 sm:w-10 md:h-14 md:w-14 text-blue-600 mr-2 md:mr-3 group-hover:text-purple-600 hover:scale-110 transition-all duration-300 drop-shadow-lg" />
              <div className="absolute -top-1 -right-1 w-3 h-3 sm:w-4 sm:h-4 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full flex items-center justify-center shadow-lg animate-bounce">
                <Sparkles className="w-2 h-2 sm:w-2.5 sm:h-2.5 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl md:text-4xl font-bold bg-gradient-to-r from-gray-800 via-blue-800 to-purple-800 bg-clip-text text-transparent">
                RPD Yönlendirme
              </h1>
            </div>
          </div>
          <p className="text-xs sm:text-sm md:text-lg text-gray-600 px-2 hidden sm:block">Rehberlik ve Psikolojik Danışmanlık Servisi</p>
          
          {/* Form Progress Bar - Mobile Optimized */}
          <div className="max-w-xs sm:max-w-md mx-auto mt-3 sm:mt-4 px-2">
            <div className="flex items-center justify-between text-[10px] sm:text-xs text-gray-500 mb-1">
              <span>Form İlerlemesi</span>
              <span className="font-bold text-blue-600">{formProgress}%</span>
            </div>
            <div className="h-1.5 sm:h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${formProgress}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Quick Stats Cards - Mobile Optimized */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3 md:gap-4 mb-4 sm:mb-6 animate-fade-in px-1" style={{ animationDelay: '0.1s' }}>
          {/* Mevcut Öğrenciler */}
          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-3 sm:p-4 shadow-lg border border-gray-100 hover:shadow-xl active:scale-[0.98] transition-all duration-300 group">
            <div className="flex items-center justify-between">
              <div className="p-1.5 sm:p-2 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-lg group-hover:scale-110 transition-transform duration-300">
                <Users className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <div className="text-right">
                <div className="text-xl sm:text-2xl font-bold text-gray-800">{animatedStats.students}</div>
                <div className="text-[10px] sm:text-xs text-gray-500">Sınıfta</div>
              </div>
            </div>
            <div className="mt-2 h-1 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-purple-400 to-purple-600 rounded-full" style={{ width: '70%' }}></div>
            </div>
          </div>

          {/* Bekleyen Yönlendirmeler */}
          <div className={`bg-white/80 backdrop-blur-sm rounded-xl p-3 sm:p-4 shadow-lg border active:scale-[0.98] transition-all duration-300 group ${pulseAnimation ? 'ring-2 ring-emerald-400 animate-pulse-soft' : 'border-gray-100'}`}>
            <div className="flex items-center justify-between">
              <div className="p-1.5 sm:p-2 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg shadow-lg group-hover:scale-110 transition-transform duration-300">
                <Target className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <div className="text-right">
                <div className="text-xl sm:text-2xl font-bold text-emerald-600">{animatedStats.today}</div>
                <div className="text-[10px] sm:text-xs text-gray-500">Bekleyen</div>
              </div>
            </div>
            <div className="mt-2 h-1 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all duration-300" style={{ width: yonlendirilenOgrenciler.length > 0 ? '100%' : '0%' }}></div>
            </div>
          </div>
        </div>

        {/* Quick Actions Bar - Mobile Optimized */}
        <div className="flex items-center justify-center gap-1.5 sm:gap-2 mb-4 sm:mb-6 animate-fade-in px-1" style={{ animationDelay: '0.2s' }}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowActivityLog(!showActivityLog)}
            className="flex items-center gap-1.5 bg-white/80 backdrop-blur-sm hover:bg-blue-50 border-blue-200 text-blue-700 px-2 sm:px-3 h-9 sm:h-10 active:scale-95 transition-all text-xs sm:text-sm"
          >
            <History className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden xs:inline">Aktivite</span>
            {recentActivity.length > 0 && (
              <Badge className="bg-blue-500 text-white text-[10px] px-1 sm:px-1.5">{recentActivity.length}</Badge>
            )}
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={exportList}
            disabled={yonlendirilenOgrenciler.length === 0}
            className="flex items-center gap-1.5 bg-white/80 backdrop-blur-sm hover:bg-emerald-50 border-emerald-200 text-emerald-700 disabled:opacity-50 px-2 sm:px-3 h-9 sm:h-10 active:scale-95 transition-all text-xs sm:text-sm"
          >
            <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden xs:inline">Indir</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={clearAllStudents}
            disabled={yonlendirilenOgrenciler.length === 0}
            className="flex items-center gap-1.5 bg-white/80 backdrop-blur-sm hover:bg-red-50 border-red-200 text-red-700 disabled:opacity-50 px-2 sm:px-3 h-9 sm:h-10 active:scale-95 transition-all text-xs sm:text-sm"
          >
            <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden xs:inline">Temizle</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.reload()}
            className="flex items-center gap-1.5 bg-white/80 backdrop-blur-sm hover:bg-amber-50 border-amber-200 text-amber-700 px-2 sm:px-3 h-9 sm:h-10 active:scale-95 transition-all text-xs sm:text-sm"
          >
            <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Yenile</span>
          </Button>
        </div>

        {/* Activity Log Panel */}
        {showActivityLog && recentActivity.length > 0 && (
          <div ref={activityRef} className="mb-6 bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border border-gray-100 overflow-hidden animate-scale-in">
            <div className="p-4 bg-gradient-to-r from-blue-500 to-indigo-500 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5" />
                <span className="font-semibold">Son Aktiviteler</span>
              </div>
              <button onClick={() => setShowActivityLog(false)} className="p-1 hover:bg-white/20 rounded-full transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {recentActivity.map((activity, index) => (
                <div 
                  key={activity.id} 
                  className={`flex items-center gap-3 p-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${index === 0 ? 'bg-blue-50/50' : ''}`}
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <div className={`p-1.5 rounded-full ${
                    activity.type === 'add' ? 'bg-green-100 text-green-600' :
                    activity.type === 'remove' ? 'bg-red-100 text-red-600' :
                    'bg-blue-100 text-blue-600'
                  }`}>
                    {activity.type === 'add' ? <Plus className="w-3 h-3" /> :
                     activity.type === 'remove' ? <X className="w-3 h-3" /> :
                     <Send className="w-3 h-3" />}
                  </div>
                  <span className="flex-1 text-sm text-gray-700">{activity.message}</span>
                  <span className="text-xs text-gray-400">{activity.time.toLocaleTimeString('tr-TR')}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 md:gap-8 px-1">
          {/* Form Kartı - Mobile Enhanced */}
          <Card className="shadow-xl shadow-blue-500/10 backdrop-blur-sm bg-white/80 border-0 hover:shadow-2xl hover:shadow-blue-500/20 transition-all duration-500 group animate-slide-in-left">
            <CardHeader className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white rounded-t-lg p-3 sm:p-4 md:p-6 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
              {/* Animated dots */}
              <div className="absolute top-2 right-2 flex gap-1">
                <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white/30 rounded-full animate-pulse"></div>
                <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white/50 rounded-full animate-pulse" style={{ animationDelay: '0.3s' }}></div>
                <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white/70 rounded-full animate-pulse" style={{ animationDelay: '0.6s' }}></div>
              </div>
              <CardTitle className="flex items-center text-base sm:text-lg md:text-xl relative z-10">
                <div className="p-1.5 sm:p-2 bg-white/20 rounded-lg mr-2 sm:mr-3 group-hover:rotate-3 group-hover:scale-110 transition-all duration-300">
                  <FileText className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6" />
                </div>
                <span className="truncate">Öğrenci Yönlendirme</span>
                <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 ml-2 text-amber-300 animate-pulse" />
              </CardTitle>
              <CardDescription className="text-blue-100 text-xs sm:text-sm md:text-base flex items-center gap-2">
                <Rocket className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                <span className="truncate">Yönlendirme bilgilerini girin</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 md:p-6">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3 sm:space-y-4 md:space-y-6">
                  {/* Öğretmen Seçimi */}
                  <div className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
                  <FormField
                    control={form.control}
                    name="ogretmenAdi"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2 text-gray-700 font-medium text-sm sm:text-base">
                          <UserCheck className="w-4 h-4 text-blue-500" />
                          Öğretmen *
                        </FormLabel>
                        <FormControl>
                          <Select
                            onValueChange={(val) => {
                              console.log('👨‍🏫 Öğretmen değişti:', val);
                              field.onChange(val);
                              const t = teacherOptions.find(t => t.value === val);
                              if (t) {
                                console.log('🎯 Öğretmen bulundu:', t.label, '-> Sınıf:', t.sinifSubeDisplay);
                                // auto select class and fetch students
                                form.setValue('sinifSube', t.sinifSubeKey, { shouldValidate: true });
                                form.setValue('ogrenci', ''); // Öğrenci seçimini sıfırla
                                // Küçük bir delay ile öğrenci listesini yükle
                                setTimeout(() => {
                                  handleSinifChange(t.sinifSubeKey);
                                }, 100);
                              } else {
                                console.log('⚠️  Öğretmen bulunamadı, listeler temizleniyor');
                                // Öğretmen seçimi temizlenirse öğrenci listesini de temizle
                                setOgrenciList([]);
                                form.setValue('ogrenci', '');
                              }
                            }}
                            value={field.value}
                          >
                            <SelectTrigger className="border-2 border-gray-200 hover:border-blue-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all duration-300 bg-white/70 backdrop-blur-sm hover:bg-white/90 hover:shadow-md min-h-[48px] sm:min-h-[52px] px-3 sm:px-4 text-sm sm:text-base w-full rounded-xl active:scale-[0.99]">
                              <SelectValue placeholder="🧑‍🏫 Öğretmen seçin" />
                            </SelectTrigger>
                            <SelectContent className="max-h-[40vh]">
                              {teacherOptions.map(t => (
                                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  </div>

                  {/* Sınıf/Şube Seçimi */}
                  <div className="animate-fade-in" style={{ animationDelay: '0.15s' }}>
                  <FormField
                    control={form.control}
                    name="sinifSube"
                    render={({ field }) => {
                      const t = teacherOptions.find(t => t.value === form.getValues('ogretmenAdi'));
                      return (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2 text-gray-700 font-medium text-sm sm:text-base">
                            <BookOpen className="w-4 h-4 text-indigo-500" />
                            Sınıf *
                            {t && <Badge variant="secondary" className="text-[10px] sm:text-xs bg-indigo-100 text-indigo-700">Otomatik</Badge>}
                          </FormLabel>
                          <Select
                            onValueChange={(value) => { field.onChange(value); handleSinifChange(value); }}
                            value={field.value}
                            disabled={Boolean(t)}
                          >
                            <FormControl>
                              <SelectTrigger className={`border-2 border-gray-200 hover:border-indigo-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 transition-all duration-300 bg-white/70 backdrop-blur-sm hover:bg-white/90 hover:shadow-md min-h-[48px] sm:min-h-[52px] px-3 sm:px-4 text-sm sm:text-base w-full rounded-xl active:scale-[0.99] ${Boolean(t) ? 'bg-indigo-50/50 border-indigo-200' : ''}`}>
                                <SelectValue placeholder="🏫 Sınıf seçin" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="max-h-[40vh]">
                              {(t ? sinifSubeList.filter(s => s.value === t.sinifSubeKey) : sinifSubeList).map((sinif) => (
                                <SelectItem key={sinif.value} value={sinif.value}>
                                  {sinif.text}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />
                  </div>

                  {/* Öğrenci Seçimi */}
                  <div className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
                  <FormField
                    control={form.control}
                    name="ogrenci"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2 text-gray-700 font-medium text-sm sm:text-base">
                          <Users className="w-4 h-4 text-purple-500" />
                          Öğrenci *
                          {ogrenciList.length > 0 && (
                            <Badge variant="secondary" className="text-[10px] sm:text-xs bg-purple-100 text-purple-700">{ogrenciList.length}</Badge>
                          )}
                        </FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className={`border-2 border-gray-200 hover:border-purple-300 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/20 transition-all duration-300 bg-white/70 backdrop-blur-sm hover:bg-white/90 hover:shadow-md min-h-[48px] sm:min-h-[52px] px-3 sm:px-4 text-sm sm:text-base w-full rounded-xl active:scale-[0.99] ${ogrenciLoading ? 'animate-pulse' : ''}`}>
                              <SelectValue placeholder={ogrenciLoading ? "🔄 Yükleniyor..." : "👤 Öğrenci seçin"} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="max-h-[40vh]">
                            {ogrenciLoading ? (
                              <SelectItem value="loading" disabled>🔄 Yükleniyor...</SelectItem>
                            ) : (ogrenciList || []).length === 0 ? (
                              <SelectItem value="empty" disabled>📭 Bu sınıfta öğrenci bulunamadı</SelectItem>
                            ) : (
                              (ogrenciList || []).map((ogrenci) => (
                                <SelectItem key={ogrenci.value} value={ogrenci.value}>
                                  {ogrenci.text}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  </div>

                  {/* Yönlendirme Nedenleri */}
                  <div className="animate-fade-in" style={{ animationDelay: '0.25s' }}>
                  <FormField
                    control={form.control}
                    name="yonlendirmeNedenleri"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-gray-700 font-medium text-sm sm:text-base">
                            <Target className="w-4 h-4 text-emerald-500" />
                            Nedenler *
                          </div>
                          <div className="flex items-center gap-1.5 sm:gap-2">
                            {field.value?.length > 0 && (
                              <Badge className="bg-emerald-100 text-emerald-700 text-[10px] sm:text-xs">{field.value.length}</Badge>
                            )}
                            <button
                              type="button"
                              onClick={() => setShowReasonSearch(!showReasonSearch)}
                              className="p-1.5 hover:bg-gray-100 rounded-full transition-colors active:scale-95"
                            >
                              {showReasonSearch ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                            </button>
                          </div>
                        </FormLabel>
                        
                        {/* Search Box */}
                        {showReasonSearch && (
                          <div className="mb-2 animate-fade-in">
                            <input
                              type="text"
                              value={reasonSearch}
                              onChange={(e) => setReasonSearch(e.target.value)}
                              placeholder="🔍 Ara..."
                              className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                            />
                          </div>
                        )}
                        
                        <div className="grid grid-cols-1 gap-1.5 sm:gap-2 md:gap-3 border-2 border-gray-200 rounded-xl p-2.5 sm:p-3 md:p-4 bg-gradient-to-br from-white/50 to-gray-50/50 backdrop-blur-sm">
                          {filteredReasons.map((neden, index) => (
                            <label 
                              key={neden} 
                              className="flex items-center space-x-3 min-h-[44px] sm:min-h-[48px] group cursor-pointer animate-fade-in p-1.5 sm:p-2 rounded-lg hover:bg-emerald-50/50 active:bg-emerald-100/50 transition-colors"
                              style={{ animationDelay: `${index * 0.02}s` }}
                            >
                              <div className="relative flex-shrink-0">
                                <input
                                  type="checkbox"
                                  id={neden}
                                  checked={field.value?.includes(neden) || false}
                                  onChange={(e) => {
                                    const currentValues = field.value || [];
                                    if (e.target.checked) {
                                      field.onChange([...currentValues, neden]);
                                    } else {
                                      field.onChange(currentValues.filter(v => v !== neden));
                                    }
                                  }}
                                  className="absolute inset-0 w-6 h-6 sm:w-7 sm:h-7 opacity-0 cursor-pointer"
                                />
                                <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg border-2 transition-all duration-300 flex items-center justify-center ${field.value?.includes(neden)
                                    ? 'bg-gradient-to-br from-emerald-500 to-teal-600 border-emerald-500 shadow-lg shadow-emerald-500/30 scale-105'
                                    : 'border-gray-300 hover:border-emerald-400 hover:bg-emerald-50'
                                  }`}>
                                  {field.value?.includes(neden) && (
                                    <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white animate-in zoom-in-50 duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </div>
                              </div>
                              <span className={`text-sm sm:text-base font-medium leading-tight flex-1 transition-all duration-200 ${
                                field.value?.includes(neden) ? 'text-emerald-700' : 'group-hover:text-emerald-700'
                              }`}>
                                {neden}
                              </span>
                            </label>
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  </div>

                  {/* Not alanı */}
                  <div className="animate-fade-in" style={{ animationDelay: '0.3s' }}>
                  <FormField
                    control={form.control}
                    name="not"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2 text-gray-700 font-medium text-sm sm:text-base">
                          <FileText className="w-4 h-4 text-amber-500" />
                          Not (opsiyonel)
                        </FormLabel>
                        <FormControl>
                          <textarea
                            className="w-full min-h-[80px] sm:min-h-[100px] rounded-xl border-2 border-gray-200 hover:border-amber-300 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20 bg-white/70 backdrop-blur-sm hover:bg-white/90 px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base shadow-sm outline-none transition-all duration-300 resize-none hover:shadow-md"
                            placeholder="📝 Örn: Öğrenci sürekli ağlıyor..."
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  </div>

                  {/* Submit Button - Mobile Enhanced */}
                  <div className="animate-fade-in" style={{ animationDelay: '0.35s' }}>
                  <Button type="submit" className="w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 min-h-[52px] sm:min-h-[56px] text-sm sm:text-base font-semibold shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transform active:scale-[0.98] hover:scale-[1.01] transition-all duration-300 relative overflow-hidden group rounded-xl">
                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                    <div className="flex items-center justify-center gap-2 relative z-10">
                      <Plus className="h-5 w-5 group-hover:rotate-90 transition-transform duration-300" />
                      <span>Öğrenci Ekle</span>
                      <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                    </div>
                  </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Yönlendirilen Öğrenciler Listesi - Mobile Enhanced */}
          <Card className={`shadow-xl shadow-green-500/10 backdrop-blur-sm bg-white/80 border-0 hover:shadow-2xl hover:shadow-green-500/20 transition-all duration-500 group animate-slide-in-right ${pulseAnimation ? 'ring-2 ring-emerald-400' : ''}`}>
            <CardHeader className="bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 text-white rounded-t-lg p-3 sm:p-4 md:p-6 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
              {/* Live indicator */}
              <div className="absolute top-2 right-2 flex items-center gap-2">
                <div className="flex items-center gap-1 px-1.5 sm:px-2 py-0.5 bg-white/20 rounded-full text-[10px] sm:text-xs">
                  <Activity className="w-2.5 h-2.5 sm:w-3 sm:h-3 animate-pulse" />
                  <span>Live</span>
                </div>
              </div>
              <CardTitle className="flex items-center justify-between text-base sm:text-lg md:text-xl relative z-10">
                <div className="flex items-center">
                  <div className="p-1.5 sm:p-2 bg-white/20 rounded-lg mr-2 sm:mr-3 group-hover:scale-110 transition-transform duration-300">
                    <Users className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6" />
                  </div>
                  <span className="truncate">Yönlendirilenler</span>
                </div>
                <Badge variant="secondary" className={`bg-white text-green-600 text-sm sm:text-base px-2 sm:px-3 py-0.5 sm:py-1 shadow-lg shadow-green-500/20 border border-green-200 hover:shadow-xl hover:shadow-green-500/30 transition-all duration-300 ${yonlendirilenOgrenciler.length > 0 ? 'animate-pulse' : ''}`}>
                  {yonlendirilenOgrenciler.length}
                </Badge>
              </CardTitle>
              <CardDescription className="text-green-100 text-xs sm:text-sm md:text-base flex items-center gap-2">
                <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                <span className="truncate">Rehberliğe gönderilecekler</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 md:p-6">
              {yonlendirilenOgrenciler.length === 0 ? (
                <div className="text-center py-6 sm:py-8 md:py-12 text-gray-500">
                  <div className="relative inline-block mb-3 sm:mb-4">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center">
                      <Users className="h-8 w-8 sm:h-10 sm:w-10 text-gray-400 animate-pulse" />
                    </div>
                    <div className="absolute inset-0 w-16 h-16 sm:w-20 sm:h-20 mx-auto bg-gradient-to-r from-blue-400/20 to-purple-400/20 rounded-full blur-xl animate-pulse" style={{ animationDelay: '0.5s' }}></div>
                  </div>
                  <p className="text-sm sm:text-base font-medium text-gray-600 animate-fade-in">Henüz öğrenci yok</p>
                  <p className="text-xs sm:text-sm text-gray-400 mt-1 sm:mt-2">Forma ekleyince burada görünecek</p>
                  <div className="mt-3 sm:mt-4 flex items-center justify-center gap-2 text-[10px] sm:text-xs text-gray-400">
                    <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 text-amber-400" />
                    <span>Yukarıdan öğrenci ekleyin</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 sm:space-y-3">
                  {yonlendirilenOgrenciler.map((ogrenci, index) => (
                    <div
                      key={ogrenci.id}
                      className="flex items-start justify-between p-2.5 sm:p-4 bg-gradient-to-r from-gray-50 to-gray-100/50 rounded-xl border border-gray-100 gap-2 sm:gap-3 hover:shadow-md hover:border-emerald-200 active:scale-[0.99] transition-all duration-300 animate-fade-in group/item"
                      style={{ animationDelay: `${index * 0.05}s` }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center text-white font-bold text-xs sm:text-sm shadow-lg flex-shrink-0">
                            {ogrenci.ogrenciAdi.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-gray-800 text-xs sm:text-sm md:text-base truncate group-hover/item:text-emerald-700 transition-colors">{ogrenci.ogrenciAdi}</div>
                            <div className="text-[10px] sm:text-xs text-gray-500 flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 flex-shrink-0" />
                              <span className="truncate">{ogrenci.tarih}</span>
                            </div>
                          </div>
                        </div>
                        <div className="ml-9 sm:ml-10 space-y-0.5 sm:space-y-1">
                          <div className="text-[10px] sm:text-xs md:text-sm text-gray-600 flex items-center gap-1">
                            <BookOpen className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-indigo-500 flex-shrink-0" />
                            <span className="truncate">{ogrenci.sinifSube}</span>
                          </div>
                          <div className="text-[10px] sm:text-xs md:text-sm text-gray-600 flex items-center gap-1">
                            <UserCheck className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-blue-500 flex-shrink-0" />
                            <span className="truncate">{ogrenci.ogretmenAdi}</span>
                          </div>
                          <Badge variant="outline" className="mt-1 sm:mt-2 text-[10px] sm:text-xs bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200 text-blue-700 hover:from-blue-100 hover:to-purple-100 transition-all duration-300 shadow-sm">
                            <Target className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-0.5 sm:mr-1" />
                            <span className="truncate">{ogrenci.yonlendirmeNedeni}</span>
                          </Badge>
                          {ogrenci.not && (
                            <div className="text-[10px] sm:text-xs text-gray-500 mt-1 sm:mt-2 italic flex items-start gap-1 bg-amber-50 p-1.5 sm:p-2 rounded-lg border border-amber-100">
                              <FileText className="w-2.5 h-2.5 sm:w-3 sm:h-3 mt-0.5 text-amber-600 flex-shrink-0" />
                              <span className="line-clamp-2 sm:line-clamp-none">{ogrenci.not}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeStudent(ogrenci.id)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 active:bg-red-100 min-h-[40px] min-w-[40px] sm:min-h-[44px] sm:min-w-[44px] p-2 rounded-full active:scale-95 transition-all duration-200 group/btn flex-shrink-0"
                      >
                        <X className="h-4 w-4 sm:h-5 sm:w-5 group-hover/btn:rotate-90 transition-transform duration-200" />
                      </Button>
                    </div>
                  ))}
                  
                  {/* List Summary - Mobile Enhanced */}
                  <div className="mt-3 sm:mt-4 p-2.5 sm:p-3 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-100 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-emerald-700">
                      <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                      <span><strong>{yonlendirilenOgrenciler.length}</strong> öğrenci hazır</span>
                    </div>
                    <Rocket className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500 animate-bounce flex-shrink-0" />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sticky Gönder Butonu - Sadece öğrenci varsa görünür - Mobile First */}
        {yonlendirilenOgrenciler.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-gray-200 p-3 sm:p-4 shadow-2xl z-50 lg:hidden animate-slide-in-up safe-area-bottom">
            <div className="container mx-auto max-w-lg">
              {/* Quick Stats */}
              <div className="flex items-center justify-between mb-2 sm:mb-3 text-[10px] sm:text-xs text-gray-500">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <Activity className="w-3 h-3 text-green-500 animate-pulse" />
                  <span>{yonlendirilenOgrenciler.length} öğrenci hazır</span>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <Clock className="w-3 h-3" />
                  <span>{currentTime.toLocaleTimeString('tr-TR')}</span>
                </div>
              </div>
              <Button
                onClick={sendToGuidance}
                className="w-full bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 hover:from-green-700 hover:via-emerald-700 hover:to-teal-700 min-h-[56px] sm:min-h-[60px] text-base sm:text-lg font-semibold shadow-xl shadow-green-500/30 hover:shadow-2xl hover:shadow-green-500/40 transform active:scale-[0.98] transition-all duration-300 relative overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none rounded-xl"
                disabled={yonlendirilenOgrenciler.length === 0 || sendingLoading}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                {sendingLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white"></div>
                    <span className="relative z-10">Gönderiliyor...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2 sm:gap-3 relative z-10">
                    <Send className="h-5 w-5 sm:h-6 sm:w-6 group-hover:rotate-12 group-hover:scale-110 transition-transform duration-300" />
                    <span>Rehberliğe Gönder</span>
                    <Badge className="bg-white/20 text-white text-sm px-2 py-0.5">{yonlendirilenOgrenciler.length}</Badge>
                  </div>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Desktop için normal buton - Enhanced */}
        {yonlendirilenOgrenciler.length > 0 && (
          <div className="hidden lg:block mt-4 sm:mt-6 animate-fade-in px-1">
            <div className="container mx-auto px-4 max-w-7xl">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-8">
                <div></div> {/* Boş alan - form alanı için */}
                <div className="bg-gradient-to-r from-white/80 to-gray-50/80 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-gray-100">
                  {/* Stats row */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <span><strong>{yonlendirilenOgrenciler.length}</strong> öğrenci</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Clock className="w-4 h-4 text-blue-500" />
                        <span>{currentTime.toLocaleTimeString('tr-TR')}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 px-2 py-1 bg-green-100 rounded-full text-xs text-green-700">
                      <Activity className="w-3 h-3 animate-pulse" />
                      <span>Hazır</span>
                    </div>
                  </div>
                  
                  <Button
                    onClick={sendToGuidance}
                    className="w-full bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 hover:from-green-700 hover:via-emerald-700 hover:to-teal-700 min-h-[52px] text-sm font-semibold shadow-lg shadow-green-500/30 hover:shadow-xl hover:shadow-green-500/40 transform hover:scale-[1.01] transition-all duration-300 relative overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:hover:shadow-green-500/30 rounded-xl"
                    disabled={yonlendirilenOgrenciler.length === 0 || sendingLoading}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                    {sendingLoading ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white"></div>
                        <span className="relative z-10">Rehberlik Servisine Gönderiliyor...</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2 relative z-10">
                        <Send className="h-5 w-5 group-hover:rotate-12 group-hover:scale-110 transition-transform duration-300" />
                        <span>Rehberlik Servisine Gönder</span>
                        <Badge className="bg-white/20 text-white px-2 py-0.5">{yonlendirilenOgrenciler.length}</Badge>
                        <Rocket className="w-4 h-4 text-amber-300 animate-bounce" />
                      </div>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}