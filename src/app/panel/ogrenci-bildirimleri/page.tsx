﻿"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Loader2, CheckCircle2, MessageSquare, User, Edit2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

type StudentSuggestion = { value: string; text: string; class_display?: string; class_key?: string };

const emptyForm = {
  reporter_student_name: "",
  reporter_class_display: "",
  reporter_class_key: "",
  target_student_name: "",
  target_class_display: "",
  target_class_key: "",
  incident_date: new Date().toISOString().slice(0, 10),
  note: "",
  wants_meeting: false
};

const formatErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Bilinmeyen hata";
};

export default function OgrenciBildirimleriPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const editId = searchParams.get('editId');
  const referer = searchParams.get('referer');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({ ...emptyForm });
  const [reporterSuggestions, setReporterSuggestions] = useState<StudentSuggestion[]>([]);
  const [targetSuggestions, setTargetSuggestions] = useState<StudentSuggestion[]>([]);
  const [activeField, setActiveField] = useState<"reporter" | "target" | null>(null);

  const activeReporterQuery = useMemo(() => formData.reporter_student_name.trim(), [formData.reporter_student_name]);
  const activeTargetQuery = useMemo(() => formData.target_student_name.trim(), [formData.target_student_name]);

  // Öğrenci arama mantığını tek bir fonksiyonda birleştirelim
  const fetchSuggestions = async (query: string, setter: (data: StudentSuggestion[]) => void, signal: AbortSignal) => {
    try {
      const res = await fetch(`/api/students?query=${encodeURIComponent(query)}`, { signal });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) {
        setter(data.slice(0, 8));
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error(`Öğrenci önerileri yüklenemedi: ${formatErrorMessage(error)}`);
        setter([]);
      }
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    if (activeReporterQuery.length >= 2) {
      fetchSuggestions(activeReporterQuery, setReporterSuggestions, controller.signal);
    } else {
      setReporterSuggestions([]);
    }
    return () => controller.abort();
  }, [activeReporterQuery]);

  useEffect(() => {
    const controller = new AbortController();
    if (activeTargetQuery.length >= 2) {
      fetchSuggestions(activeTargetQuery, setTargetSuggestions, controller.signal);
    } else {
      setTargetSuggestions([]);
    }
    return () => controller.abort();
  }, [activeTargetQuery]);

  const selectReporterSuggestion = (student: StudentSuggestion) => {
    setFormData((prev) => ({
      ...prev,
      reporter_student_name: student.text,
      reporter_class_display: student.class_display || prev.reporter_class_display,
      reporter_class_key: student.class_key || prev.reporter_class_key
    }));
    setReporterSuggestions([]);
    setActiveField(null);
  };

  const selectTargetSuggestion = (student: StudentSuggestion) => {
    setFormData((prev) => ({
      ...prev,
      target_student_name: student.text,
      target_class_display: student.class_display || prev.target_class_display,
      target_class_key: student.class_key || prev.target_class_key
    }));
    setTargetSuggestions([]);
    setActiveField(null);
  };

  // Edit modu için veri yükleme
  useEffect(() => {
    if (editId) {
      const fetchEditData = async () => {
        setLoading(true);
        try {
          const { data: record, error } = await supabase
            .from('student_incidents')
            .select('*')
            .eq('id', editId)
            .single();

          if (error) throw error;

          if (record) {
            setFormData({
              reporter_student_name: record.reporter_student_name || "",
              reporter_class_display: record.reporter_class_display || "",
              reporter_class_key: record.reporter_class_key || "",
              target_student_name: record.target_student_name || "",
              target_class_display: record.target_class_display || "",
              target_class_key: record.target_class_key || "",
              incident_date: record.incident_date || record.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
              note: record.description || record.note || "",
              wants_meeting: record.wants_meeting || false
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
  }, [editId]);

  const resetForm = () => {
    setFormData({ ...emptyForm });
    setReporterSuggestions([]);
    setTargetSuggestions([]);
    setActiveField(null);
  };

  const handleSave = async () => {
    const reporterName = formData.reporter_student_name.trim();
    const targetName = formData.target_student_name.trim();

    if (!reporterName || !targetName) {
      toast.error("Bildiren ve bildirilen öğrenci adları gereklidir");
      return;
    }

    if (reporterName === targetName) {
      toast.error("Bildiren ve bildirilen öğrenci aynı kişi olamaz");
      return;
    }

    try {
      setSaving(true);
      const isEdit = !!editId;

      // Bildirimi kaydet
      const incidentRes = await fetch("/api/student-incidents", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editId,
          reporter_student_name: reporterName,
          reporter_class_key: formData.reporter_class_key || null,
          reporter_class_display: formData.reporter_class_display || null,
          target_student_name: targetName,
          target_class_key: formData.target_class_key || null,
          target_class_display: formData.target_class_display || null,
          incident_date: formData.incident_date,
          description: formData.note || "",
          wants_meeting: formData.wants_meeting
        })
      });

      if (!incidentRes.ok) {
        const error = await incidentRes.json();
        throw new Error(error.error || "Bildirim eklenemedi");
      }

      resetForm();
      toast.success("Kaydedildi");

      if (isEdit) {
        if (referer === 'potansiyel-gorusmeler') {
          router.push('/panel/potansiyel-gorusmeler');
        } else {
          window.history.replaceState(null, '', '/panel/ogrenci-bildirimleri');
          router.refresh();
        }
      }
    } catch (error) {
      console.error("Kaydedilirken hata:", error);
      toast.error(formatErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Başlık */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 via-slate-900 to-zinc-900 p-6 text-white shadow-xl">
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-rose-500/20 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-pink-500/20 blur-3xl" />

        <div className="relative">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Öğrenci Bildirimleri</h1>
              <p className="text-slate-400 text-sm mt-2">Öğrenciler arası bildirim ve şikayet kayıtları</p>
            </div>
          </div>
        </div>
      </div>

      {/* Ekleme Formu */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-rose-50 to-pink-50 border-b">
          <CardTitle className="text-lg flex items-center gap-2">
            {editId ? <Edit2 className="h-5 w-5 text-rose-600" /> : <MessageSquare className="h-5 w-5 text-rose-600" />}
            {editId ? "Bildirimi Düzenle" : "Yeni Öğrenci Bildirimi Ekle"}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-rose-500" />
              <span className="ml-2 text-slate-600">Veri yükleniyor...</span>
            </div>
          ) : (
          <>
          <div className="grid gap-4 md:grid-cols-2">
            {/* Bildiren Öğrenci */}
            <div className="relative">
              <Label className="text-sm font-medium mb-2 block">Bildiren Öğrenci Adı *</Label>
              <Input
                placeholder="Bildiren öğrenci adı yazınız..."
                value={formData.reporter_student_name}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, reporter_student_name: e.target.value }));
                  setActiveField("reporter");
                }}
                onFocus={() => setActiveField("reporter")}
                className="border-slate-200"
              />
              {activeField === "reporter" && reporterSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-lg shadow-lg z-10 max-h-40 overflow-y-auto">
                  {reporterSuggestions.map((student) => (
                    <button
                      key={student.value}
                      onClick={() => selectReporterSuggestion(student)}
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
              <Label className="text-sm font-medium mb-2 block">Bildirme Tarihi *</Label>
              <Input
                type="date"
                value={formData.incident_date}
                onChange={(e) => setFormData((prev) => ({ ...prev, incident_date: e.target.value }))}
                className="border-slate-200"
              />
            </div>

            <div className="md:col-span-2">
              <Label className="text-sm font-medium mb-2 block">Bildiren Öğrenci Sınıfı</Label>
              <Input
                placeholder="Sınıf (otomatik doldurulur)"
                value={formData.reporter_class_display || ""}
                readOnly
                className="border-slate-200 bg-slate-50"
              />
            </div>

            {/* Bildirilen Öğrenci */}
            <div className="relative">
              <Label className="text-sm font-medium mb-2 block">Bildirilen Öğrenci Adı *</Label>
              <Input
                placeholder="Bildirilen öğrenci adı yazınız..."
                value={formData.target_student_name}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, target_student_name: e.target.value }));
                  setActiveField("target");
                }}
                onFocus={() => setActiveField("target")}
                className="border-slate-200"
              />
              {activeField === "target" && targetSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-lg shadow-lg z-10 max-h-40 overflow-y-auto">
                  {targetSuggestions.map((student) => (
                    <button
                      key={student.value}
                      onClick={() => selectTargetSuggestion(student)}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 border-b border-slate-100 last:border-0"
                    >
                      <div className="font-medium">{student.text}</div>
                      <div className="text-xs text-slate-500">{student.class_display || "Sınıf bilinmiyor"}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="md:col-span-2">
              <Label className="text-sm font-medium mb-2 block">Bildirilen Öğrenci Sınıfı</Label>
              <Input
                placeholder="Sınıf (otomatik doldurulur)"
                value={formData.target_class_display || ""}
                readOnly
                className="border-slate-200 bg-slate-50"
              />
            </div>

            <div className="md:col-span-2">
              <Label className="text-sm font-medium mb-2 block">Kısa Not (Opsiyonel)</Label>
              <textarea
                placeholder="Bildirim hakkında kısa notunuz..."
                value={formData.note || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, note: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none"
                rows={3}
              />
            </div>

            {/* Görüşme İsteği */}
            <div className="md:col-span-2">
              <Label className="text-sm font-medium mb-2 block">Bildiren öğrenci görüşme istiyor mu?</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="wants_meeting"
                    checked={formData.wants_meeting === true}
                    onChange={() => setFormData((prev) => ({ ...prev, wants_meeting: true }))}
                    className="text-rose-600 focus:ring-rose-500"
                  />
                  <span className="text-sm">Evet</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="wants_meeting"
                    checked={formData.wants_meeting === false}
                    onChange={() => setFormData((prev) => ({ ...prev, wants_meeting: false }))}
                    className="text-rose-600 focus:ring-rose-500"
                  />
                  <span className="text-sm">Hayır</span>
                </label>
              </div>
            </div>
          </div>

          {/* Görüşme İsteği Formu */}
          {formData.wants_meeting && (
            <div className="md:col-span-2">
              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Bildiren Öğrenci İçin Bireysel Başvuru
                </h3>
                <div className="text-sm text-blue-700 mb-2">
                  Bu seçenek işaretlendiğinde, bildiren öğrenci için otomatik olarak bir görüşme talebi oluşturulacaktır.
                </div>
                <Input 
                  value={formData.reporter_student_name}
                  readOnly
                  className="bg-white/50 border-blue-200"
                />
              </div>
            </div>
          )}
          </>
          )}
        </CardContent>

        {/* Form Butonları */}
        <div className="flex gap-2 mt-6 px-6 pb-6">
          <Button
            onClick={handleSave}
            disabled={
              saving || 
              !formData.reporter_student_name.trim() || 
              !formData.target_student_name.trim() ||
              formData.reporter_student_name.trim() === formData.target_student_name.trim()
            }
            className="flex-1 bg-rose-600 hover:bg-rose-700 text-white"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {editId ? "Güncelleniyor..." : "Ekleniyor..."}
              </>
            ) : (
              <>
                {editId ? <Edit2 className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                {editId ? "Değişiklikleri Kaydet" : "Kaydet"}
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
      </Card>
      <div className="text-center py-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-rose-50 border border-rose-200 rounded-lg">
          <CheckCircle2 className="h-5 w-5 text-rose-600" />
          <span className="text-sm text-rose-700">
            Bildirimler potansiyel görüşmeler sekmesindeki "Öğrenci Bildirimleri" bölümünden takip edilebilir
          </span>
        </div>
      </div>
    </div>
  );
}
