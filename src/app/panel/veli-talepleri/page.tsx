"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Link2, Plus, RefreshCw, Search, User, PhoneCall, Loader2, Edit2, Trash2, Clock } from "lucide-react";
import { PARENT_REQUEST_STATUSES, ParentMeetingRequestRecord } from "@/types";

type StudentSuggestion = { value: string; text: string; class_display?: string; class_key?: string };

const emptyForm = {
  student_name: "",
  class_display: "",
  class_key: "",
  parent_name: "",
  parent_phone: "",
  subject: "",
  detail: "",
  status: "new"
};

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("tr-TR", {
    year: "numeric",
    month: "short",
    day: "2-digit"
  });
};

const buildAppointmentUrl = (
  studentName: string,
  classDisplay?: string | null,
  classKey?: string | null,
  note?: string | null
) => {
  const params = new URLSearchParams();
  if (studentName) params.set("studentName", studentName);
  if (classDisplay) params.set("classDisplay", classDisplay);
  if (classKey) params.set("classKey", classKey);
  if (note) params.set("note", note);
  return `/panel/randevu?${params.toString()}`;
};

const formatErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const candidate = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
    const parts = [candidate.message, candidate.details, candidate.hint, candidate.code ? `code: ${candidate.code}` : null].filter(Boolean);
    if (parts.length) return parts.join(" | ");
    try {
      return JSON.stringify(error);
    } catch {
      return Object.prototype.toString.call(error);
    }
  }
  return "Bilinmeyen hata";
};

export default function VeliTalepleriPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [requests, setRequests] = useState<ParentMeetingRequestRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [formData, setFormData] = useState({ ...emptyForm });
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null);
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
          console.error(`Ogrenci onerileri yuklenemedi: ${formatErrorMessage(error)}`);
          setStudentSuggestions([]);
        }
      }
    };

    loadSuggestions();
    return () => {
      cancelled = true;
    };
  }, [activeStudentQuery]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("parent_meeting_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRequests((data || []) as ParentMeetingRequestRecord[]);
    } catch (error) {
      console.error(`Veli talepleri yuklenemedi: ${formatErrorMessage(error)}`);
      toast.error("Veli talepleri yuklenemedi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

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
    setEditingRequestId(null);
    setStudentSuggestions([]);
    setSuggestionsOpen(false);
  };

  const startEdit = (request: ParentMeetingRequestRecord) => {
    setEditingRequestId(request.id || null);
    setFormData({
      student_name: request.student_name || "",
      class_display: request.class_display || "",
      class_key: request.class_key || "",
      parent_name: request.parent_name || "",
      parent_phone: request.parent_phone || "",
      subject: request.subject || "",
      detail: request.detail || "",
      status: request.status || "new"
    });
    setStudentSuggestions([]);
    setSuggestionsOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (request: ParentMeetingRequestRecord) => {
    if (!request.id) {
      toast.error("Kayıt silinemedi");
      return;
    }

    const confirmed = window.confirm("Bu veli talebini silmek istediğinize emin misiniz?");
    if (!confirmed) return;

    try {
      const { error } = await supabase.from("parent_meeting_requests").delete().eq("id", request.id);
      if (error) throw error;
      toast.success("Veli talebi silindi");
      if (editingRequestId === request.id) resetForm();
      await loadRequests();
    } catch (error) {
      console.error(`Veli talebi silinemedi: ${formatErrorMessage(error)}`);
      toast.error(`Veli talebi silinemedi: ${formatErrorMessage(error)}`);
    }
  };

  const handleSave = async () => {
    if (!formData.student_name.trim()) {
      toast.error("Öğrenci adı gerekli");
      return;
    }
    if (!formData.subject.trim()) {
      toast.error("Konu gerekli");
      return;
    }
    if (!formData.detail.trim()) {
      toast.error("Açıklama gerekli");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        student_name: formData.student_name.trim(),
        class_key: formData.class_key.trim() || null,
        class_display: formData.class_display.trim() || null,
        parent_name: formData.parent_name.trim() || null,
        parent_phone: formData.parent_phone.trim() || null,
        request_type: "gorusme",
        subject: formData.subject.trim(),
        detail: formData.detail.trim(),
        status: formData.status
      };

      const query = editingRequestId
        ? supabase.from("parent_meeting_requests").update(payload).eq("id", editingRequestId)
        : supabase.from("parent_meeting_requests").insert(payload);

      const { error } = await query;
      if (error) throw error;

      toast.success(editingRequestId ? "Veli talebi güncellendi" : "Veli talebi kaydedildi");
      resetForm();
      await loadRequests();
    } catch (error) {
      console.error(`Veli talebi kaydedilemedi: ${formatErrorMessage(error)}`);
      toast.error(`Veli talebi kaydedilemedi: ${formatErrorMessage(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const query = searchQuery.trim().toLowerCase();

  const filteredRequests = useMemo(() => {
    return requests.filter((request) => {
      if (!query) return true;
      const fields = [
        request.student_name,
        request.parent_name,
        request.class_display,
        request.subject,
        request.detail,
        request.status
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return fields.includes(query);
    });
  }, [requests, query]);

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-cyan-900 to-teal-700 p-6 text-white shadow-xl">
        <div className="absolute inset-0 bg-grid-white/10" />
        <div className="absolute -top-20 -right-20 h-56 w-56 rounded-full bg-cyan-300/20 blur-3xl animate-float-slow" />
        <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-teal-400/20 blur-3xl animate-float-reverse" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm shadow-lg">
              <PhoneCall className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Veli Talepleri</h1>
              <p className="text-slate-200">Veli görüşme taleplerini buradan kaydet, Potansiyel Görüşmeler altında takip et.</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="rounded-lg border border-white/10 bg-white/10 px-3 py-2 backdrop-blur-sm">
              <p className="text-[10px] uppercase tracking-wider text-cyan-100">Toplam</p>
              <p className="text-lg font-bold leading-none">{requests.length}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/10 px-3 py-2 backdrop-blur-sm">
              <p className="text-[10px] uppercase tracking-wider text-cyan-100">Yeni</p>
              <p className="text-lg font-bold leading-none">{requests.filter((r) => r.status === "new").length}</p>
            </div>
          </div>
        </div>
      </div>

      <Card className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Öğrenci, veli, konu, sınıf..."
                className="pl-10"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={loadRequests}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Yenile
              </Button>
              <Button asChild className="bg-slate-900 hover:bg-slate-800">
                <a href="/panel/potansiyel-gorusmeler">
                  <Link2 className="mr-2 h-4 w-4" />
                  Potansiyel Görüşmeler
                </a>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <CardHeader className="border-b bg-slate-50 py-3">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold text-slate-700">
            <Plus className="h-5 w-5 text-cyan-600" />
            Yeni Veli Talebi
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Öğrenci Adı</Label>
              <div className="relative">
                <Input
                  value={formData.student_name}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, student_name: e.target.value }));
                    setSuggestionsOpen(true);
                  }}
                  onFocus={() => setSuggestionsOpen(true)}
                  onBlur={() => setTimeout(() => setSuggestionsOpen(false), 150)}
                  placeholder="Öğrenci adı yaz"
                />
                {suggestionsOpen && studentSuggestions.length > 0 && (
                  <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border bg-white shadow-xl">
                    {studentSuggestions.map((student) => (
                      <button
                        key={`${student.value}-${student.text}`}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selectSuggestion(student)}
                        className="flex w-full items-start gap-3 border-b px-4 py-3 text-left last:border-b-0 hover:bg-cyan-50"
                      >
                        <div className="mt-0.5 rounded-lg bg-cyan-100 p-2">
                          <User className="h-4 w-4 text-cyan-600" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">{student.text}</p>
                          {student.class_display && <p className="text-sm text-slate-500">{student.class_display}</p>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {formData.class_display && (
                  <p className="mt-2 text-xs text-slate-500">
                    Seçili öğrenci: {formData.student_name}
                    {formData.class_display ? ` • ${formData.class_display}` : ""}
                  </p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Veli Adı</Label>
              <Input
                value={formData.parent_name}
                onChange={(e) => setFormData((prev) => ({ ...prev, parent_name: e.target.value }))}
                placeholder="İsteğe bağlı"
              />
            </div>
            <div className="space-y-2">
              <Label>Telefon</Label>
              <Input
                value={formData.parent_phone}
                onChange={(e) => setFormData((prev) => ({ ...prev, parent_phone: e.target.value }))}
                placeholder="05xx xxx xx xx"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Konu</Label>
            <Input
              value={formData.subject}
              onChange={(e) => setFormData((prev) => ({ ...prev, subject: e.target.value }))}
              placeholder="Talebin kısa konusu"
            />
          </div>

          <div className="space-y-2">
            <Label>Açıklama</Label>
            <textarea
              value={formData.detail}
              onChange={(e) => setFormData((prev) => ({ ...prev, detail: e.target.value }))}
              rows={4}
              className="w-full rounded-lg border px-4 py-3 focus:ring-2 focus:ring-cyan-500"
              placeholder="Velinin talebini, beklentisini veya notunu yaz"
            />
          </div>

          <div className="flex justify-end">
            <div className="flex gap-2">
              {editingRequestId && (
                <Button variant="outline" onClick={resetForm}>
                  İptal
                </Button>
              )}
              <Button onClick={handleSave} disabled={saving} className="bg-cyan-600 hover:bg-cyan-700">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                {editingRequestId ? "Talebi Güncelle" : "Talebi Kaydet"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <CardHeader className="border-b bg-slate-50 py-3">
          <CardTitle className="text-sm font-semibold text-slate-700">Kayıtlar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-4">
          {filteredRequests.length === 0 ? (
            <p className="py-10 text-center text-slate-500">Kayıt bulunamadı</p>
          ) : (
            filteredRequests.map((request) => {
              const createdLabel = formatDate(request.created_at);
              return (
                <div
                  key={request.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-slate-800">{request.student_name}</h3>
                        <Badge variant="outline">Veli talebi</Badge>
                      </div>

                      <p className="mt-2 text-sm text-slate-600">
                        {request.class_display || request.class_key || "-"}
                        {request.parent_name ? ` · ${request.parent_name}` : ""}
                      </p>

                      <p className="mt-2 text-sm leading-6 text-slate-700">{request.subject}</p>
                      <p className="mt-2 text-sm text-slate-500">{request.detail}</p>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => startEdit(request)}>
                          <Edit2 className="mr-2 h-4 w-4" />
                          Düzenle
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void handleDelete(request)}
                          className="text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Sil
                        </Button>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col items-start gap-2 lg:items-end">
                      <Button
                        asChild
                        size="sm"
                        className="border-0 bg-gradient-to-r from-indigo-600 via-sky-600 to-cyan-600 text-white shadow-lg shadow-cyan-500/20 transition-all hover:scale-[1.01] hover:from-indigo-500 hover:via-sky-500 hover:to-cyan-500"
                      >
                        <a
                          href={buildAppointmentUrl(
                            request.student_name,
                            request.class_display || null,
                            request.class_key || null,
                            request.detail
                          )}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Randevuya dönüştür
                        </a>
                      </Button>
                      <Badge variant="outline">
                        <Clock className="mr-1 h-3.5 w-3.5" />
                        {createdLabel}
                      </Badge>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
