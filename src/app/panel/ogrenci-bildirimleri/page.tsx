"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Loader2, CheckCircle2, MessageSquare, User, Users } from "lucide-react";

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
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({ ...emptyForm });
  const [reporterSuggestions, setReporterSuggestions] = useState<StudentSuggestion[]>([]);
  const [targetSuggestions, setTargetSuggestions] = useState<StudentSuggestion[]>([]);
  const [activeField, setActiveField] = useState<"reporter" | "target" | null>(null);

  const activeReporterQuery = useMemo(() => formData.reporter_student_name.trim(), [formData.reporter_student_name]);
  const activeTargetQuery = useMemo(() => formData.target_student_name.trim(), [formData.target_student_name]);

  useEffect(() => {
    const query = activeReporterQuery;
    if (query.length < 2) {
      setReporterSuggestions([]);
      return;
    }

    let cancelled = false;

    const loadSuggestions = async () => {
      try {
        const res = await fetch(`/api/students?query=${encodeURIComponent(query)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data)) {
          setReporterSuggestions(data.slice(0, 8));
        }
      } catch (error) {
        if (!cancelled) {
          console.error(`Öğrenci önerileri yüklenemedi: ${formatErrorMessage(error)}`);
          setReporterSuggestions([]);
        }
      }
    };

    loadSuggestions();
    return () => {
      cancelled = true;
    };
  }, [activeReporterQuery]);

  useEffect(() => {
    const query = activeTargetQuery;
    if (query.length < 2) {
      setTargetSuggestions([]);
      return;
    }

    let cancelled = false;

    const loadSuggestions = async () => {
      try {
        const res = await fetch(`/api/students?query=${encodeURIComponent(query)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data)) {
          setTargetSuggestions(data.slice(0, 8));
        }
      } catch (error) {
        if (!cancelled) {
          console.error(`Öğrenci önerileri yüklenemedi: ${formatErrorMessage(error)}`);
          setTargetSuggestions([]);
        }
      }
    };

    loadSuggestions();
    return () => {
      cancelled = true;
    };
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

  const resetForm = () => {
    setFormData({ ...emptyForm });
    setReporterSuggestions([]);
    setTargetSuggestions([]);
    setActiveField(null);
  };

  const handleSave = async () => {
    if (!formData.reporter_student_name.trim() || !formData.target_student_name.trim()) {
      toast.error("Bildiren ve hedef öğrenci adları gereklidir");
      return;
    }

    try {
      setSaving(true);

      // Bildirimi kaydet
      const incidentRes = await fetch("/api/student-incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reporter_student_name: formData.reporter_student_name.trim(),
          reporter_class_key: formData.reporter_class_key || null,
          reporter_class_display: formData.reporter_class_display || null,
          target_student_name: formData.target_student_name.trim(),
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

      // Eğer görüşme isteniyorsa bireysel başvuruyu da kaydet
      if (formData.wants_meeting) {
        const requestRes = await fetch("/api/individual-requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            student_name: formData.reporter_student_name.trim(),
            class_key: formData.reporter_class_key || null,
            class_display: formData.reporter_class_display || null,
            request_date: formData.incident_date,
            note: `Öğrenci bildirimi sonrası görüşme isteği: ${formData.note || ""}`
          })
        });

        if (!requestRes.ok) {
          const error = await requestRes.json();
          console.error("Bireysel başvuru kaydedilemedi:", error);
          toast.error("Bildirim kaydedildi ancak bireysel başvuru kaydedilemedi");
          return;
        }
      }

      resetForm();
      toast.success("Kaydedildi");
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
            <MessageSquare className="h-5 w-5 text-rose-600" />
            Yeni Öğrenci Bildirimi Ekle
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
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
                <IndividualRequestForm
                  prefilledData={{
                    student_name: formData.reporter_student_name,
                    class_display: formData.reporter_class_display,
                    class_key: formData.reporter_class_key,
                    note: `Öğrenci bildirimi sonrası görüşme isteği: ${formData.note || ""}`
                  }}
                />
              </div>
            </div>
          )}
        </CardContent>

        {/* Form Butonları */}
        <div className="flex gap-2 mt-6 px-6 pb-6">
          <Button
            onClick={handleSave}
            disabled={saving || !formData.reporter_student_name.trim() || !formData.target_student_name.trim()}
            className="flex-1 bg-rose-600 hover:bg-rose-700 text-white"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Ekleniyor...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Kaydet
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

// Bireysel Başvuru Formu Bileşeni
function IndividualRequestForm({ prefilledData }: {
  prefilledData: any;
}) {
  const [formData, setFormData] = useState({
    student_name: prefilledData.student_name || "",
    class_display: prefilledData.class_display || "",
    class_key: prefilledData.class_key || "",
    request_date: new Date().toISOString().slice(0, 10),
    note: prefilledData.note || ""
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label className="text-sm font-medium mb-2 block">Öğrenci Adı *</Label>
          <Input
            value={formData.student_name}
            onChange={(e) => setFormData((prev) => ({ ...prev, student_name: e.target.value }))}
            className="border-slate-200"
          />
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
            value={formData.class_display || ""}
            readOnly
            className="border-slate-200 bg-slate-50"
          />
        </div>

        <div className="md:col-span-2">
          <Label className="text-sm font-medium mb-2 block">Kısa Not (Opsiyonel)</Label>
          <textarea
            value={formData.note || ""}
            onChange={(e) => setFormData((prev) => ({ ...prev, note: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            rows={3}
          />
        </div>
      </div>
    </div>
  );
}
