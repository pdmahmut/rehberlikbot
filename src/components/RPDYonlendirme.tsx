"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Send, Users, GraduationCap, FileText, Sparkles, Target, Rocket, BookOpen, UserCheck, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "sonner";

import { parseJsonResponse, parseResponseError } from "@/lib/utils";
import { normalizeGuidanceStudent, notifyGuidanceReferralsChanged } from "@/lib/guidance";
import { YONLENDIRME_KATEGORILERI } from "@/types";

interface SinifSube { value: string; text: string; }
interface Ogrenci { value: string; text: string; }

const formSchema = z.object({
  ogretmenAdi: z.string().min(2, "Öğretmen adı en az 2 karakter olmalıdır"),
  sinifSube: z.string().min(1, "Sınıf/Şube seçimi zorunludur"),
  ogrenci: z.string().min(1, "Öğrenci seçimi zorunludur"),
  yonlendirmeNedenleri: z.array(z.string()).min(1, "En az bir yönlendirme nedeni seçilmelidir"),
  not: z.string().optional(),
});

interface RPDYonlendirmeProps {
  teacherName?: string;
  classKey?: string;
  classDisplay?: string;
}

export default function RPDYonlendirme({ teacherName, classKey, classDisplay }: RPDYonlendirmeProps = {}) {
  const [sinifSubeList, setSinifSubeList] = useState<SinifSube[]>([]);
  const [ogrenciList, setOgrenciList] = useState<Ogrenci[]>([]);
  const [loading, setLoading] = useState(true);
  const [ogrenciLoading, setOgrenciLoading] = useState(false);
  const [sendingLoading, setSendingLoading] = useState(false);
  const [teacherOptions, setTeacherOptions] = useState<{ value: string; label: string; sinifSubeKey: string; sinifSubeDisplay: string }[]>([]);

  // Öğretmen modu — öğrenci arama
  const [studentQuery, setStudentQuery] = useState("");
  const [studentResults, setStudentResults] = useState<{ value: string; text: string; class_key: string; class_display: string }[]>([]);
  const [studentSearchLoading, setStudentSearchLoading] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<{ name: string; classDisplay: string; classKey: string; value: string } | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const abortRef = useRef<AbortController | null>(null);

  // Dropdown pozisyonunu hesapla (fixed positioning — scroll'dan bağımsız)
  const updateDropdownPos = useCallback(() => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    }
  }, []);

  // Debounced arama — AbortController ile race condition önleme
  useEffect(() => {
    if (!teacherName) return;
    if (studentQuery.length < 2) {
      setStudentResults([]);
      setStudentSearchLoading(false);
      return;
    }
    const timer = setTimeout(async () => {
      // Önceki isteği iptal et
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setStudentSearchLoading(true);
      try {
        const res = await fetch(`/api/students?q=${encodeURIComponent(studentQuery)}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        setStudentResults(Array.isArray(data) ? data.slice(0, 8) : []);
      } catch (err: any) {
        if (err.name !== 'AbortError') setStudentResults([]);
      } finally {
        if (!controller.signal.aborted) setStudentSearchLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [studentQuery, teacherName]);

  const handleSelectStudent = (s: typeof studentResults[0]) => {
    setSelectedStudent({ name: s.text, classDisplay: s.class_display, classKey: s.class_key, value: s.value });
    setStudentQuery("");
    setIsFocused(false);
    setStudentResults([]);
    form.setValue("sinifSube", s.class_key);
    form.setValue("ogrenci", s.value);
  };

  const clearSelectedStudent = () => {
    setSelectedStudent(null);
    form.setValue("sinifSube", "");
    form.setValue("ogrenci", "");
  };

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      ogretmenAdi: teacherName || "",
      sinifSube: classKey || "",
      ogrenci: "",
      yonlendirmeNedenleri: [],
      not: "",
    },
  });

  // teacherName veya classKey sonradan gelirse forma set et
  useEffect(() => {
    if (teacherName) form.setValue("ogretmenAdi", teacherName);
    if (classKey) form.setValue("sinifSube", classKey);
  }, [teacherName, classKey, form]);


  // Veri yükle
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/data', { headers: { Accept: "application/json" } });
        const data = await parseJsonResponse<any>(response);
        setSinifSubeList(data.sinifSubeList);

        if (!teacherName) {
          // Yönetici modu: öğretmen listesini yükle
          const tRes = await fetch('/api/teachers', { headers: { Accept: "application/json" } });
          const tJson = await parseJsonResponse<any>(tRes);
          if (tJson && Array.isArray(tJson.teachers)) setTeacherOptions(tJson.teachers);
        }

        setLoading(false);
      } catch (error) {
        toast.error("Veri yüklenirken hata oluştu");
        setLoading(false);
      }
    };

    fetchData();
  }, [teacherName]);

  // Sınıf rehberi: sınıf atandığında öğrenci listesini yükle
  useEffect(() => {
    if (!classKey) return;
    form.setValue("sinifSube", classKey);
    setOgrenciLoading(true);
    fetch(`/api/students?sinifSube=${encodeURIComponent(classKey)}`, { headers: { Accept: "application/json" } })
      .then(r => r.json())
      .then(data => { setOgrenciList(Array.isArray(data) ? data : []); })
      .catch(() => setOgrenciList([]))
      .finally(() => setOgrenciLoading(false));
  }, [classKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sınıf değiştiğinde öğrenci listesini güncelle
  const handleSinifChange = async (sinifSube: string) => {
    console.log('🔄 Sınıf değişti:', sinifSube);
    setOgrenciLoading(true);
    try {
      // URL encode yaparak # karakterinin düzgün gönderilmesini sağla
      const encodedSinifSube = encodeURIComponent(sinifSube);
      console.log('📤 API çağrısı:', `/api/students?sinifSube=${encodedSinifSube}`);
      const response = await fetch(`/api/students?sinifSube=${encodedSinifSube}`, {
        headers: { Accept: "application/json" }
      });
      const data = await parseJsonResponse<any>(response);
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

  // Başlangıçta classKey verilmişse öğrencileri yükle
  useEffect(() => {
    if (!loading && classKey) {
      handleSinifChange(classKey);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    const sinifSubeText = selectedStudent?.classDisplay
      || sinifSubeList.find(s => s.value === values.sinifSube)?.text
      || classDisplay
      || classKey
      || "";
    const ogrenciAdi = selectedStudent
      ? selectedStudent.name.replace(/^\d+\s*/, "")
      : ogrenciList.find(o => o.value === values.ogrenci)?.text || "";
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
          'Accept': 'application/json',
        },
        body: JSON.stringify({ students }),
      });

      const result = await parseJsonResponse<any>(response);

      if (response.ok && result.success) {
        toast.success("Öğrenci yönlendirildi.");

        if (!result.sheets) {
          console.warn("Google Sheets senkronizasyonu yapılamadı:", result.message);
        }

        notifyGuidanceReferralsChanged({
          action: "create",
          studentName: students[0]?.ogrenciAdi || "",
        });
        form.setValue("yonlendirmeNedenleri", []);
        form.setValue("not", "");
        form.setValue("ogrenci", "");
        setSelectedStudent(null);
        // sinifSube'yi koru — seçili sınıfta kalmaya devam etsin
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
    <div className="pb-20 md:pb-0">
      <div className="container mx-auto px-2 sm:px-3 md:px-4 py-3 md:py-4 max-w-3xl">

        <div className="grid grid-cols-1 place-items-center gap-3 sm:gap-4 md:gap-8 px-1">
          {/* Form Kartı - Mobile Enhanced */}
          <Card className="w-full max-w-3xl shadow-xl shadow-blue-500/10 backdrop-blur-sm bg-white/80 border-0 hover:shadow-2xl hover:shadow-blue-500/20 transition-all duration-500 group animate-slide-in-left overflow-visible">
            <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-t-lg p-3 sm:p-4">
              <CardTitle className="flex items-center text-base sm:text-lg">
                <div className="p-1.5 bg-white/20 rounded-lg mr-2">
                  <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
                Öğrenci Yönlendirme
              </CardTitle>
              <CardDescription className="text-blue-100 text-xs sm:text-sm">
                Yönlendirme bilgilerini girin
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 md:p-6">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3 sm:space-y-4 md:space-y-6">
                  {/* Öğretmen — oturumdan geliyorsa göster, yoksa seçim yap */}
                  <div className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
                  {teacherName ? (
                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-50 border-2 border-blue-100">
                      <UserCheck className="w-4 h-4 text-blue-500 shrink-0" />
                      <div>
                        <p className="text-xs text-blue-500 font-medium">Öğretmen</p>
                        <p className="text-sm font-semibold text-blue-800">{teacherName}</p>
                      </div>
                    </div>
                  ) : (
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
                          {teacherName ? (
                            <div className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-blue-200 bg-blue-50/70 min-h-[48px] sm:min-h-[52px]">
                              <UserCheck className="w-4 h-4 text-blue-500 flex-shrink-0" />
                              <span className="text-sm sm:text-base font-medium text-blue-800">{field.value}</span>
                              <span className="ml-auto text-[10px] text-blue-400 bg-blue-100 px-2 py-0.5 rounded-full">Giriş yapıldı</span>
                            </div>
                          ) : (
                            <Select
                              onValueChange={(val) => {
                                field.onChange(val);
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
                          )}
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  )}
                  </div>

                  {/* ── Öğrenci seçimi: 3 mod ── */}
                  {classKey ? (
                    /* MOD 1: Sınıf Rehber Öğretmeni — kendi sınıfı varsayılan, değiştirilebilir */
                    <div className="animate-fade-in space-y-3" style={{ animationDelay: '0.15s' }}>
                      {/* Sınıf — dropdown, varsayılan atanmış sınıf */}
                      <FormField
                        control={form.control}
                        name="sinifSube"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2 text-gray-700 font-medium text-sm">
                              <BookOpen className="w-4 h-4 text-teal-500" />
                              Sınıf *
                            </FormLabel>
                            <Select
                              onValueChange={(value) => {
                                field.onChange(value);
                                form.setValue("ogrenci", "");
                                handleSinifChange(value);
                              }}
                              value={field.value}
                            >
                              <FormControl>
                                <SelectTrigger className="border-2 border-gray-200 hover:border-teal-300 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/20 transition-all bg-white/70 min-h-[48px] px-4 text-sm rounded-xl">
                                  <SelectValue placeholder="🏫 Sınıf seçin" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent position="item-aligned" className="max-h-64 overflow-y-auto">
                                {sinifSubeList.map((sinif) => (
                                  <SelectItem key={sinif.value} value={sinif.value}>
                                    {sinif.text}
                                    {sinif.value === classKey && (
                                      <span className="ml-2 text-[10px] text-teal-500 font-semibold">(sınıfınız)</span>
                                    )}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Öğrenci dropdown */}
                      <FormField
                        control={form.control}
                        name="ogrenci"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2 text-gray-700 font-medium text-sm">
                              <Users className="w-4 h-4 text-purple-500" />
                              Öğrenci *
                            </FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className={`border-2 border-gray-200 hover:border-purple-300 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/20 transition-all bg-white/70 min-h-[48px] px-4 text-sm rounded-xl ${ogrenciLoading ? 'animate-pulse' : ''}`}>
                                  <SelectValue placeholder={ogrenciLoading ? "🔄 Yükleniyor..." : "👤 Öğrenci seçin"} />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent position="item-aligned" className="max-h-64 overflow-y-auto">
                                {ogrenciLoading ? (
                                  <SelectItem value="loading" disabled>🔄 Yükleniyor...</SelectItem>
                                ) : ogrenciList.length === 0 ? (
                                  <SelectItem value="empty" disabled>📭 Öğrenci bulunamadı</SelectItem>
                                ) : ogrenciList.map((o) => (
                                  <SelectItem key={o.value} value={o.value}>{o.text}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  ) : teacherName ? (
                    /* MOD 2: Normal Öğretmen — tüm okul öğrencileri arama */
                    <div className="animate-fade-in space-y-2" style={{ animationDelay: '0.15s' }}>
                      <label className="flex items-center gap-2 text-gray-700 font-medium text-sm">
                        <Users className="w-4 h-4 text-purple-500" />
                        Öğrenci *
                      </label>

                      {selectedStudent ? (
                        <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-purple-50 border-2 border-purple-200">
                          <div>
                            <p className="font-semibold text-purple-800 text-sm">{selectedStudent.name}</p>
                            <p className="text-xs text-purple-500">{selectedStudent.classDisplay}</p>
                          </div>
                          <button type="button" onClick={clearSelectedStudent}
                            className="p-1.5 rounded-lg hover:bg-purple-100 text-purple-400 hover:text-purple-600 transition-colors">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div>
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            {studentSearchLoading && (
                              <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                            )}
                            <input
                              ref={inputRef}
                              type="text"
                              autoComplete="off"
                              value={studentQuery}
                              onChange={(e) => { setStudentQuery(e.target.value); setIsFocused(true); updateDropdownPos(); }}
                              onFocus={() => { setIsFocused(true); updateDropdownPos(); }}
                              onBlur={() => { setTimeout(() => setIsFocused(false), 150); }}
                              onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
                              placeholder="Ad, soyad veya okul numarası yazın..."
                              className="w-full pl-9 pr-4 py-3 border-2 border-gray-200 hover:border-purple-300 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/20 rounded-xl text-sm outline-none transition-all bg-white/70"
                            />
                          </div>
                          {isFocused && typeof window !== 'undefined' && studentQuery.length >= 2 &&
                            createPortal(
                              <div style={{ position: 'fixed', top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width, zIndex: 99999 }}
                                className="bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
                                {studentSearchLoading && studentResults.length === 0 ? (
                                  <div className="px-4 py-3 flex items-center gap-2 text-sm text-slate-400">
                                    <div className="w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin shrink-0" />
                                    Aranıyor...
                                  </div>
                                ) : studentResults.length > 0 ? studentResults.map((s, i) => (
                                  <button key={i} type="button"
                                    onMouseDown={(e) => { e.preventDefault(); handleSelectStudent(s); }}
                                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-purple-50 transition-colors text-left border-b border-slate-100 last:border-0">
                                    <span className="text-sm font-medium text-slate-800">{s.text}</span>
                                    <span className="text-xs text-slate-400 shrink-0 ml-2">{s.class_display}</span>
                                  </button>
                                )) : (
                                  <div className="px-4 py-3 text-sm text-slate-400">Öğrenci bulunamadı</div>
                                )}
                              </div>,
                              document.body
                            )
                          }
                        </div>
                      )}
                    </div>
                  ) : (
                    /* MOD 3: Yönetici — sınıf + öğrenci dropdown */
                  <>
                  {/* Sınıf/Şube Seçimi — Yönetici modu */}
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

                  {/* Öğrenci Seçimi — Yönetici modu */}
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
                  </>
                  )}

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
                          {field.value?.length > 0 && (
                            <Badge className="bg-emerald-100 text-emerald-700 text-[10px] sm:text-xs">{field.value.length} seçili</Badge>
                          )}
                        </FormLabel>

                        <div className="border-2 border-gray-200 rounded-xl p-2 sm:p-3 bg-gradient-to-br from-white/50 to-gray-50/50 backdrop-blur-sm">
                          {YONLENDIRME_KATEGORILERI.map((kategori) => {
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
