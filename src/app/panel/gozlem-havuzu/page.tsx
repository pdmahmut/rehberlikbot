"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Loader2, CheckCircle2, Eye } from "lucide-react";
import { supabase } from "@/lib/supabase";

type StudentSuggestion = { value: string; text: string; class_display?: string; class_key?: string };

const emptyForm = {
  student_name: "",
  class_display: "",
  class_key: "",
  observed_at: new Date().toISOString().slice(0, 10),
  note: "",
  observation_type: "behavior",
  priority: "medium"
};

const formatErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Bilinmeyen hata";
};

export default function GozlemHavuzuPage() {
  const searchParams = useSearchParams();
  const editId = searchParams.get("editId");
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

  useEffect(() => {
    if (!editId) {
      resetForm();
      return;
    }

    let cancelled = false;
    const loadEditData = async () => {
      setLoading(true);
      try {
        const { data: observation, error } = await supabase
          .from("observation_pool")
          .select("*")
          .eq("id", editId)
          .single();

        if (error) throw error;
        if (cancelled) return;

        setFormData({
          student_name: observation.student_name || "",
          class_display: observation.class_display || "",
          class_key: observation.class_key || "",
          observed_at:
            observation.observed_at || observation.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
          note: observation.note || "",
          observation_type: observation.observation_type || "behavior",
          priority: observation.priority || "medium"
        });
      } catch (error) {
        console.error("Gözlem edit verisi yüklenemedi:", error);
        toast.error("Düzenlenecek gözlem yüklenemedi");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadEditData();
    return () => {
      cancelled = true;
    };
  }, [editId]);

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

  const handleSave = async () => {
    if (!formData.student_name.trim()) {
      toast.error("Öğrenci adı gereklidir");
      return;
    }

    try {
      setSaving(true);
      const isEdit = !!editId;
      const res = await fetch("/api/gozlem-havuzu", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(isEdit ? { id: editId } : {}),
          student_name: formData.student_name.trim(),
          class_key: formData.class_key || null,
          class_display: formData.class_display || null,
          observed_at: formData.observed_at,
          note: formData.note || null,
          observation_type: formData.observation_type,
          priority: formData.priority
        })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Gözlem eklenemedi");
      }

      resetForm();
      toast.success(isEdit ? "Gözlem başarıyla güncellendi" : "Gözlem başarıyla eklendi");
    } catch (error) {
      console.error(`Gözlem eklenirken hata: ${formatErrorMessage(error)}`);
      toast.error(formatErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Başlık */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 via-slate-900 to-zinc-900 p-6 text-white shadow-xl">
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-teal-500/20 blur-3xl" />

        <div className="relative">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Gözlem Havuzu</h1>
              <p className="text-slate-400 text-sm mt-2">Öğrencileri gözlemle, notlarını kaydet</p>
            </div>
          </div>
        </div>
      </div>

      {/* Ekleme Formu */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-cyan-50 to-teal-50 border-b">
          <CardTitle className="text-lg flex items-center gap-2">
            <Eye className="h-5 w-5 text-cyan-600" />
            {editId ? "Gözlem Düzenle" : "Yeni Gözlem Ekle"}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
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
              <Label className="text-sm font-medium mb-2 block">Gözlem Tarihi *</Label>
              <Input
                type="date"
                value={formData.observed_at}
                onChange={(e) => setFormData((prev) => ({ ...prev, observed_at: e.target.value }))}
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
                placeholder="Gözlem notunuz..."
                value={formData.note || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, note: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
                rows={3}
              />
            </div>
          </div>

          <div className="flex gap-2 mt-6">
            <Button
              onClick={handleSave}
              disabled={saving || loading || !formData.student_name.trim()}
              className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {editId ? "Güncelleniyor..." : "Ekleniyor..."}
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  {editId ? "Gözlem Güncelle" : "Gözlem Ekle"}
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
        </CardContent>
      </Card>

      {/* Başarı mesajı */}
      <div className="text-center py-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-50 border border-cyan-200 rounded-lg">
          <CheckCircle2 className="h-5 w-5 text-cyan-600" />
          <span className="text-sm text-cyan-700">
            Gözlemler potansiyel görüşmeler sekmesindeki "Gözlem Havuzu" bölümünden takip edilebilir
          </span>
        </div>
      </div>
    </div>
  );
}

