"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Loader2, CheckCircle2, Edit2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

type StudentSuggestion = { value: string; text: string; class_display?: string; class_key?: string };

const emptyForm = {
  student_name: "",
  class_display: "",
  class_key: "",
  request_date: new Date().toISOString().slice(0, 10),
  note: ""
};

const formatErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Bilinmeyen hata";
};

export default function BireyselBasvurularPage() {
  const searchParams = useSearchParams();
  const editId = searchParams.get('editId');
  const editType = searchParams.get('type');
  const referer = searchParams.get('referer');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ ...emptyForm });
  const [studentSuggestions, setStudentSuggestions] = useState<StudentSuggestion[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);

  const activeStudentQuery = useMemo(() => formData.student_name.trim(), [formData.student_name]);

  useEffect(() => {
    const query = activeStudentQuery;
    if (query.length < 2) {
      setStudentSuggestions([]);
      return;
    }

    let cancelled = false;

    const loadSuggestions = async () => {
      try {
        const res = await fetch(`/api/students?query=${encodeURIComponent(query)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data)) {
          setStudentSuggestions(data.slice(0, 8));
        }
      } catch (error) {
        if (!cancelled) {
          console.error(`Öğrenci önerileri yüklenemedi: ${formatErrorMessage(error)}`);
          setStudentSuggestions([]);
        }
      }
    };

    loadSuggestions();
    return () => {
      cancelled = true;
    };
  }, [activeStudentQuery]);

  // Edit modu için veri yükleme
  useEffect(() => {
    if (editId && editType) {
      setLoading(true);
      const fetchEditData = async () => {
        try {
          let apiUrl = '';
          let responseData;

          switch (editType) {
            case 'student_report':
              // Öğrenci bildirimi - Supabase'den çek
              const { data: incidentData, error: incidentError } = await supabase
                .from('student_incidents')
                .select('*')
                .eq('id', editId)
                .single();
              if (incidentError) throw incidentError;
              responseData = { record: incidentData };
              break;

            case 'teacher_referral':
              // Öğretmen yönlendirmesi - Supabase'den çek
              const { data: referralData, error: referralError } = await supabase
                .from('referrals')
                .select('*')
                .eq('id', editId)
                .single();
              if (referralError) throw referralError;
              responseData = { record: referralData };
              break;

            case 'observation':
              // Gözlem havuzu - API'den çek
              const observationRes = await fetch(`/api/gozlem-havuzu?id=${encodeURIComponent(editId)}`);
              if (!observationRes.ok) throw new Error('Gözlem verisi alınamadı');
              responseData = await observationRes.json();
              break;

            case 'parent_request':
              // Veli talebi - Supabase'den çek
              const { data: requestData, error: requestError } = await supabase
                .from('parent_meeting_requests')
                .select('*')
                .eq('id', editId)
                .single();
              if (requestError) throw requestError;
              responseData = { record: requestData };
              break;

            case 'individual':
              // Bireysel başvuru - API'den çek
              const individualRes = await fetch(`/api/individual-requests?id=${encodeURIComponent(editId)}`);
              if (!individualRes.ok) throw new Error('Bireysel başvuru verisi alınamadı');
              responseData = await individualRes.json();
              break;

            default:
              throw new Error(`Geçersiz kayıt türü: ${editType}`);
          }

          const record = responseData?.record || responseData?.request;
          if (record) {
            setFormData({
              student_name: record.student_name || record.target_student_name || "",
              class_display: record.class_display || record.target_class_display || "",
              class_key: record.class_key || record.target_class_key || "",
              request_date: record.request_date || record.incident_date || record.observed_at || record.created_at || new Date().toISOString().slice(0, 10),
              note: record.note || record.description || record.detail || record.reason || ""
            });
          }
        } catch (error) {
          console.error('Edit verisi yüklenirken hata:', error);
          toast.error('Düzenlenecek kayıt yüklenemedi');
        } finally {
          setLoading(false);
        }
      };

      fetchEditData();
    } else {
      resetForm();
    }
  }, [editId || '', editType || '']);

  const selectSuggestion = (student: StudentSuggestion) => {
    setFormData((prev) => ({
      ...prev,
      student_name: student.text,
      class_display: student.class_display || prev.class_display,
      class_key: student.class_key || prev.class_key
    }));
    setStudentSuggestions([]);
    setSuggestionsOpen(false);
  };

  const resetForm = () => {
    setFormData({ ...emptyForm });
    setStudentSuggestions([]);
    setSuggestionsOpen(false);
  };

  const handleAddRequest = async () => {
    if (!formData.student_name.trim()) {
      toast.error("Öğrenci adı gereklidir");
      return;
    }

    try {
      setSaving(true);
      const isEdit = !!editId && !!editType;
      let method = isEdit ? "PUT" : "POST";
      let apiUrl = "/api/individual-requests";
      let body: any;

      if (isEdit) {
        switch (editType) {
          case 'student_report':
            // Öğrenci bildirimi güncelleme - Supabase
            const { error: incidentError } = await supabase
              .from('student_incidents')
              .update({
                target_student_name: formData.student_name,
                target_class_display: formData.class_display,
                target_class_key: formData.class_key,
                incident_date: formData.request_date,
                description: formData.note,
                updated_at: new Date().toISOString()
              })
              .eq('id', editId);
            if (incidentError) throw incidentError;
            toast.success("Öğrenci bildirimi başarıyla güncellendi");
            if (referer === 'potansiyel-gorusmeler') {
              window.location.href = '/panel/potansiyel-gorusmeler';
            } else {
              window.history.replaceState(null, '', '/panel/bireysel-basvurular');
            }
            return;

          case 'teacher_referral':
            // Öğretmen yönlendirmesi güncelleme - Supabase
            const { error: referralError } = await supabase
              .from('referrals')
              .update({
                student_name: formData.student_name,
                class_display: formData.class_display,
                class_key: formData.class_key,
                reason: formData.note,
                updated_at: new Date().toISOString()
              })
              .eq('id', editId);
            if (referralError) throw referralError;
            toast.success("Öğretmen yönlendirmesi başarıyla güncellendi");
            if (referer === 'potansiyel-gorusmeler') {
              window.location.href = '/panel/potansiyel-gorusmeler';
            } else {
              window.history.replaceState(null, '', '/panel/bireysel-basvurular');
            }
            return;

          case 'observation':
            // Gözlem havuzu güncelleme - API
            apiUrl = "/api/gozlem-havuzu";
            body = {
              id: editId,
              student_name: formData.student_name,
              class_display: formData.class_display,
              class_key: formData.class_key,
              observed_at: formData.request_date,
              note: formData.note
            };
            break;

          case 'parent_request':
            // Veli talebi güncelleme - Supabase
            const { error: requestError } = await supabase
              .from('parent_meeting_requests')
              .update({
                student_name: formData.student_name,
                class_display: formData.class_display,
                class_key: formData.class_key,
                subject: formData.note,
                detail: formData.note,
                updated_at: new Date().toISOString()
              })
              .eq('id', editId);
            if (requestError) throw requestError;
            toast.success("Veli talebi başarıyla güncellendi");
            if (referer === 'potansiyel-gorusmeler') {
              window.location.href = '/panel/potansiyel-gorusmeler';
            } else {
              window.history.replaceState(null, '', '/panel/bireysel-basvurular');
            }
            return;

          case 'individual':
            // Bireysel başvuru güncelleme - API
            body = {
              id: editId,
              student_name: formData.student_name.trim(),
              class_key: formData.class_key || null,
              class_display: formData.class_display || null,
              request_date: formData.request_date,
              note: formData.note || null
            };
            break;

          default:
            throw new Error(`Geçersiz kayıt türü: ${editType}`);
        }
      } else {
        // Yeni kayıt
        body = {
          student_name: formData.student_name.trim(),
          class_key: formData.class_key || null,
          class_display: formData.class_display || null,
          request_date: formData.request_date,
          note: formData.note || null
        };
      }

      const res = await fetch(apiUrl, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || `${isEdit ? "Kayıt güncellenemedi" : "Kayıt eklenemedi"}`);
      }

      resetForm();
      toast.success(isEdit ? "Kayıt başarıyla güncellendi" : "Kayıt başarıyla eklendi");
      
      // Edit modundan çık - referer'a göre yönlendir
      if (isEdit) {
        if (referer === 'potansiyel-gorusmeler') {
          window.location.href = '/panel/potansiyel-gorusmeler';
        } else {
          window.history.replaceState(null, '', '/panel/bireysel-basvurular');
        }
      }
    } catch (error) {
      console.error(`${editId ? "Kayıt güncellenirken" : "Kayıt eklenirken"} hata: ${formatErrorMessage(error)}`);
      toast.error(formatErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Başlık */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 via-slate-900 to-zinc-900 p-6 text-white shadow-xl">
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-violet-500/20 blur-3xl" />

        <div className="relative">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                {editId && editType ? "Kayıt Düzenle" : "Bireysel Başvurular"}
              </h1>
              <p className="text-slate-400 text-sm mt-2">
                {editId && editType ? (
                  editType === 'student_report' ? "Öğrenci bildirimini düzenleyin" :
                  editType === 'teacher_referral' ? "Öğretmen yönlendirmesini düzenleyin" :
                  editType === 'observation' ? "Gözlem kaydını düzenleyin" :
                  editType === 'parent_request' ? "Veli talebini düzenleyin" :
                  editType === 'individual' ? "Bireysel başvuruyu düzenleyin" :
                  "Kayıt düzenleniyor..."
                ) : "Teneffüste veya bireysel görüşmek isteyen öğrenciler"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Ekleme Formu */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
          <CardTitle className="text-lg flex items-center gap-2">
            {editId && editType ? <Edit2 className="h-5 w-5 text-blue-600" /> : <Plus className="h-5 w-5 text-blue-600" />}
            {editId && editType ? (
              editType === 'student_report' ? "Öğrenci Bildirimi Düzenle" :
              editType === 'teacher_referral' ? "Öğretmen Yönlendirmesi Düzenle" :
              editType === 'observation' ? "Gözlem Kaydı Düzenle" :
              editType === 'parent_request' ? "Veli Talebi Düzenle" :
              editType === 'individual' ? "Bireysel Başvuru Düzenle" :
              "Kayıt Düzenle"
            ) : "Yeni Kayıt Ekle"}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
              <span className="ml-2 text-slate-600">Veri yükleniyor...</span>
            </div>
          ) : (
            <div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="relative">
                  <Label className="text-sm font-medium mb-2 block">Öğrenci Adı *</Label>
                  <Input
                    placeholder="Öğrenci adı yazınız..."
                    value={formData.student_name}
                    onChange={(e) => {
                      setFormData((prev) => ({ ...prev, student_name: e.target.value }));
                      setSuggestionsOpen(true);
                    }}
                    onFocus={() => setSuggestionsOpen(true)}
                    className="border-slate-200"
                  />
                  {suggestionsOpen && studentSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-lg shadow-lg z-10 max-h-40 overflow-y-auto">
                      {studentSuggestions.map((student) => (
                        <button
                          key={student.value}
                          onClick={() => selectSuggestion(student)}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 border-b border-slate-100 last:border-0"
                        >
                          <div className="font-medium">{student.text}</div>
                          <div className="text-xs text-slate-500">{student.class_display || "Sınıf bilinmiyor"}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <Label className="text-sm font-medium mb-2 block">Başvuru Tarihi *</Label>
                  <Input
                    type="date"
                    value={formData.request_date}
                    onChange={(e) => setFormData((prev) => ({ ...prev, request_date: e.target.value }))}
                    className="border-slate-200"
                  />
                </div>

                <div className="md:col-span-2">
                  <Label className="text-sm font-medium mb-2 block">Sınıf</Label>
                  <Input
                    placeholder="Sınıf (otomatik doldurulur)"
                    value={formData.class_display || ""}
                    readOnly
                    className="border-slate-200 bg-slate-50"
                  />
                </div>

                <div className="md:col-span-2">
                  <Label className="text-sm font-medium mb-2 block">Kısa Not (Opsiyonel)</Label>
                  <textarea
                    placeholder="Başvuru nedeni veya notunuz..."
                    value={formData.note || ""}
                    onChange={(e) => setFormData((prev) => ({ ...prev, note: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    rows={3}
                  />
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                <Button
                  onClick={handleAddRequest}
                  disabled={saving || !formData.student_name.trim()}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {editId ? "Güncelleniyor..." : "Ekleniyor..."}
                    </>
                  ) : (
                    <>
                      {editId ? <Edit2 className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                      {editId ? "Başvuru Güncelle" : "Başvuru Ekle"}
                    </>
                  )}
                </Button>
                <Button
                  onClick={resetForm}
                  variant="outline"
                  className="flex-1"
                >
                  Temizle
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Başarı mesajı */}
      <div className="text-center py-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-lg">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <span className="text-sm text-green-700">
            Başvurular potansiyel görüşmeler sekmesindeki "Bireysel Başvurular" bölümünden takip edilebilir
          </span>
        </div>
      </div>
    </div>
  );
}
