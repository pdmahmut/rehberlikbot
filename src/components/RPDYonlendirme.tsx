"use client";

import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Send, Users, GraduationCap, FileText, Sparkles, ChevronDown, ChevronUp, Target, Rocket, BookOpen, UserCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "sonner";

import { SinifSube, Ogrenci, YONLENDIRME_KATEGORILERI } from "@/types";
import { normalizeGuidanceStudent, notifyGuidanceReferralsChanged } from "@/lib/guidance";

const formSchema = z.object({
  ogretmenAdi: z.string().min(2, "Öğretmen adı en az 2 karakter olmalıdır"),
  sinifSube: z.string().min(1, "Sınıf/Şube seçimi zorunludur"),
  ogrenci: z.string().min(1, "Öğrenci seçimi zorunludur"),
  yonlendirmeNedenleri: z.array(z.string()).min(1, "En az bir yönlendirme nedeni seçilmelidir"),
  not: z.string().optional(),
});

export default function RPDYonlendirme() {
  const [sinifSubeList, setSinifSubeList] = useState<SinifSube[]>([]);
  const [ogrenciList, setOgrenciList] = useState<Ogrenci[]>([]);
  const [loading, setLoading] = useState(true);
  const [ogrenciLoading, setOgrenciLoading] = useState(false);
  const [sendingLoading, setSendingLoading] = useState(false);
  const [teacherOptions, setTeacherOptions] = useState<{ value: string; label: string; sinifSubeKey: string; sinifSubeDisplay: string }[]>([]);
  const [showReasonSearch, setShowReasonSearch] = useState(false);
  const [reasonSearch, setReasonSearch] = useState("");

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

  // Filtrelenmiş kategoriler
  const filteredCategories = useMemo(() => {
    if (!reasonSearch) return YONLENDIRME_KATEGORILERI;
    return YONLENDIRME_KATEGORILERI.filter(kategori =>
      kategori.baslik.toLowerCase().includes(reasonSearch.toLowerCase())
    );
  }, [reasonSearch]);

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

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    const sinifSubeText = sinifSubeList.find(s => s.value === values.sinifSube)?.text || "";
    const ogrenciAdi = ogrenciList.find(o => o.value === values.ogrenci)?.text || "";
    const yeniKayit = normalizeGuidanceStudent({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ogretmenAdi: values.ogretmenAdi,
      ogretmenKey: values.ogretmenAdi,
      sinifSube: sinifSubeText,
      sinifSubeKey: values.sinifSube,
      ogrenciAdi,
      ogrenciKey: values.ogrenci,
      yonlendirmeNedenleri: values.yonlendirmeNedenleri,
      not: values.not?.trim() ? values.not : undefined,
      tarih: new Date().toLocaleString('tr-TR'),
    });

    await sendToGuidance([yeniKayit]);
  };

  const sendToGuidance = async (students: Array<ReturnType<typeof normalizeGuidanceStudent>>) => {
    if (students.length === 0) {
      toast.error("Yönlendirilecek öğrenci bulunmuyor");
      return;
    }

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
        body: JSON.stringify({ students }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        if (result.telegram && result.sheets) {
          toast.success("✅ Öğrenci Telegram ve Google Sheets'e başarıyla gönderildi!");
        } else if (result.telegram || result.sheets) {
          toast.success("⚠️ Öğrenci kısmen gönderildi. " + result.message);
        } else {
          toast.error("❌ Gönderim başarısız: " + result.message);
        }

        if (result.telegram || result.sheets) {
          notifyGuidanceReferralsChanged({
            action: "create",
            studentName: students[0]?.ogrenciAdi || "",
          });
          form.setValue("yonlendirmeNedenleri", []);
          form.setValue("not", "");
          form.setValue("ogrenci", "");
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
          
        </div>

        <div className="grid grid-cols-1 place-items-center gap-3 sm:gap-4 md:gap-8 px-1">
          {/* Form Kartı - Mobile Enhanced */}
          <Card className="w-full max-w-3xl shadow-xl shadow-blue-500/10 backdrop-blur-sm bg-white/80 border-0 hover:shadow-2xl hover:shadow-blue-500/20 transition-all duration-500 group animate-slide-in-left">
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
                              // Öğretmen değiştiğinde sınıf ve öğrenci seçimini sıfırla
                              form.setValue('sinifSube', '');
                              form.setValue('ogrenci', '');
                              setOgrenciList([]);
                            }}
                            value={field.value}
                          >
                            <SelectTrigger className="border-2 border-gray-200 hover:border-blue-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all duration-300 bg-white/70 backdrop-blur-sm hover:bg-white/90 hover:shadow-md min-h-[48px] sm:min-h-[52px] px-3 sm:px-4 text-sm sm:text-base w-full rounded-xl active:scale-[0.99]">
                              <SelectValue placeholder="🧑‍🏫 Öğretmen seçin" />
                            </SelectTrigger>
                            <SelectContent position="item-aligned" className="max-h-none overflow-visible">
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
                    render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2 text-gray-700 font-medium text-sm sm:text-base">
                            <BookOpen className="w-4 h-4 text-indigo-500" />
                            Sınıf *
                          </FormLabel>
                          <Select
                            onValueChange={(value) => { field.onChange(value); handleSinifChange(value); }}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger className="border-2 border-gray-200 hover:border-indigo-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 transition-all duration-300 bg-white/70 backdrop-blur-sm hover:bg-white/90 hover:shadow-md min-h-[48px] sm:min-h-[52px] px-3 sm:px-4 text-sm sm:text-base w-full rounded-xl active:scale-[0.99]">
                                <SelectValue placeholder="🏫 Sınıf seçin" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent position="item-aligned" className="max-h-none overflow-visible">
                              {sinifSubeList.map((sinif) => (
                                <SelectItem key={sinif.value} value={sinif.value}>
                                  {sinif.text}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
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
                          <SelectContent position="item-aligned" className="max-h-none overflow-visible">
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
                              <Badge className="bg-emerald-100 text-emerald-700 text-[10px] sm:text-xs">{field.value.length} seçili</Badge>
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
                              placeholder="🔍 Neden ara..."
                              className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                            />
                          </div>
                        )}
                        
                        <div className="border-2 border-gray-200 rounded-xl p-2 sm:p-3 bg-gradient-to-br from-white/50 to-gray-50/50 backdrop-blur-sm">
                          {filteredCategories.map((kategori) => {
                            const isSelected = field.value?.includes(kategori.baslik);
                            
                            // Renk eşlemesi
                            const colorMap: Record<string, { bg: string; border: string; text: string; light: string }> = {
                              blue: { bg: 'bg-blue-500', border: 'border-blue-300', text: 'text-blue-700', light: 'bg-blue-50' },
                              orange: { bg: 'bg-orange-500', border: 'border-orange-300', text: 'text-orange-700', light: 'bg-orange-50' },
                              purple: { bg: 'bg-purple-500', border: 'border-purple-300', text: 'text-purple-700', light: 'bg-purple-50' },
                              pink: { bg: 'bg-pink-500', border: 'border-pink-300', text: 'text-pink-700', light: 'bg-pink-50' },
                              teal: { bg: 'bg-teal-500', border: 'border-teal-300', text: 'text-teal-700', light: 'bg-teal-50' },
                              red: { bg: 'bg-red-500', border: 'border-red-300', text: 'text-red-700', light: 'bg-red-50' },
                              indigo: { bg: 'bg-indigo-500', border: 'border-indigo-300', text: 'text-indigo-700', light: 'bg-indigo-50' },
                              amber: { bg: 'bg-amber-500', border: 'border-amber-300', text: 'text-amber-700', light: 'bg-amber-50' },
                            };
                            const colors = colorMap[kategori.renk] || colorMap.blue;
                            
                            return (
                              <div key={kategori.id} className="mb-2 last:mb-0">
                                {/* Kategori Başlığı */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const currentValues = field.value || [];
                                    if (isSelected) {
                                      field.onChange(currentValues.filter(v => v !== kategori.baslik));
                                    } else {
                                      field.onChange([...currentValues, kategori.baslik]);
                                    }
                                  }}
                                  className={`w-full flex items-center justify-between p-2.5 sm:p-3 rounded-lg transition-all duration-200 ${
                                    isSelected ? `${colors.light} ${colors.border} border-2` : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 sm:gap-3">
                                    <span className="text-lg sm:text-xl">{kategori.icon}</span>
                                    <span className={`font-semibold text-xs sm:text-sm ${isSelected ? colors.text : 'text-gray-700'}`}>
                                      {kategori.baslik}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {isSelected && (
                                      <Badge className={`${colors.bg} text-white text-[10px] px-1.5`}>
                                        ✓
                                      </Badge>
                                    )}
                                  </div>
                                </button>
                              </div>
                            );
                          })}
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
                      <Send className="h-5 w-5 group-hover:rotate-12 transition-transform duration-300" />
                      <span>Rehberliğe Gönder</span>
                      <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                    </div>
                  </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
