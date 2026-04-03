"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import {
  AlertTriangle,
  Plus,
  Search,
  RefreshCw,
  Users,
  User,
  Calendar,
  Clock,
  Eye,
  MessageSquare,
  ShieldAlert,
  Flag,
  Trash2,
  Edit,
  Loader2,
  ArrowRight
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import {
  INCIDENT_REPORTER_TYPES,
  INCIDENT_TYPES,
  INCIDENT_SEVERITIES,
  INCIDENT_STATUSES,
  StudentIncidentRecord
} from "@/types";

type ClassOption = { value: string; text: string };
type IncidentFormState = {
  incident_date: string;
  reporter_name: string;
  recommended_students_text: string;
  description: string;
  is_confidential: boolean;
};

const formatErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const candidate = error as { message?: unknown; hint?: unknown; code?: unknown; details?: unknown };
    const parts = [
      candidate.message,
      candidate.hint,
      candidate.code ? `code: ${candidate.code}` : null,
      candidate.details ? `details: ${candidate.details}` : null
    ].filter(Boolean);

    if (parts.length > 0) {
      return parts.join(" | ");
    }

    try {
      return JSON.stringify(error);
    } catch {
      return Object.prototype.toString.call(error);
    }
  }
  return "Bilinmeyen hata";
};

const today = new Date().toISOString().split("T")[0];

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  return new Date(value).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
};

const buildAppointmentUrl = (studentName: string, classDisplay?: string | null, classKey?: string | null, note?: string | null) => {
  const params = new URLSearchParams();
  if (studentName) params.set("studentName", studentName);
  if (classDisplay) params.set("classDisplay", classDisplay);
  if (classKey) params.set("classKey", classKey);
  if (note) params.set("note", note);
  return `/panel/randevu?${params.toString()}`;
};

const normalizeName = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^\d+\s+/, "")
    .trim();

const cleanIncidentDescription = (value: string) => {
  const markers = [
    /(?:\n|\s)*Bildirimi yapan kişi.*$/i,
    /(?:\n|\s)*Bildirimi yapan kisi.*$/i,
    /(?:\n|\s)*Ana vaka:.*$/i
  ];

  let output = value.trim();
  for (const marker of markers) {
    const match = output.search(marker);
    if (match >= 0) {
      output = output.slice(0, match).trim();
    }
  }

  return output;
};

const severityStyleMap: Record<string, string> = {
  low: "bg-slate-100 text-slate-700 border-slate-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  critical: "bg-red-100 text-red-700 border-red-200"
};

const statusStyleMap: Record<string, string> = {
  new: "bg-blue-100 text-blue-700 border-blue-200",
  reviewing: "bg-amber-100 text-amber-700 border-amber-200",
  resolved: "bg-emerald-100 text-emerald-700 border-emerald-200",
  dismissed: "bg-slate-100 text-slate-700 border-slate-200"
};

const typeStyleMap: Record<string, string> = {
  bullying: "bg-rose-100 text-rose-700 border-rose-200",
  conflict: "bg-blue-100 text-blue-700 border-blue-200",
  threat: "bg-red-100 text-red-700 border-red-200",
  verbal: "bg-orange-100 text-orange-700 border-orange-200",
  physical: "bg-purple-100 text-purple-700 border-purple-200",
  damage: "bg-amber-100 text-amber-700 border-amber-200",
  theft: "bg-teal-100 text-teal-700 border-teal-200",
  other: "bg-slate-100 text-slate-700 border-slate-200"
};

const emptyForm: IncidentFormState = {
  incident_date: today,
  reporter_name: "",
  recommended_students_text: "",
  description: "",
  is_confidential: false
};

export default function OgrenciBildirimleriPage() {
  const [incidents, setIncidents] = useState<StudentIncidentRecord[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingIncident, setEditingIncident] = useState<StudentIncidentRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [formData, setFormData] = useState<IncidentFormState>(emptyForm);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [studentSuggestions, setStudentSuggestions] = useState<{ value: string; text: string; class_display?: string }[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeAutocompleteField, setActiveAutocompleteField] = useState<"recommended" | "reporter" | null>(null);
  const [reporterFollowUps, setReporterFollowUps] = useState<Record<string, boolean>>({});
  const [studentMetaByName, setStudentMetaByName] = useState<Record<string, { class_display?: string; class_key?: string; student_number?: string }>>({});
  const reporterFollowUpsRef = useRef<Record<string, boolean>>({});

  const activeStudentQuery = useMemo(() => {
    const sourceText =
      activeAutocompleteField === "reporter"
        ? formData.reporter_name
        : formData.recommended_students_text;
    const parts = sourceText.split(/[,\n;]/);
    return parts[parts.length - 1]?.trim() || "";
  }, [activeAutocompleteField, formData.recommended_students_text, formData.reporter_name]);

  const reporterCandidates = useMemo(() => {
    return formData.reporter_name
      .split(/[,\n;]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }, [formData.reporter_name]);

  useEffect(() => {
    setReporterFollowUps((prev) => {
      const next: Record<string, boolean> = {};
      reporterCandidates.forEach((name) => {
        next[name] = prev[name] ?? false;
      });
      reporterFollowUpsRef.current = next;
      return next;
    });
  }, [reporterCandidates]);

  useEffect(() => {
    const query = activeStudentQuery.trim();
    if (query.length < 2) {
      setStudentSuggestions([]);
      return;
    }

    let cancelled = false;

    const loadSuggestions = async () => {
      try {
        const res = await fetch(`/api/students?query=${encodeURIComponent(query)}`);
        if (!res.ok) {
          if (!cancelled) setStudentSuggestions([]);
          return;
        }

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

  const loadClasses = async () => {
    try {
      const res = await fetch("/api/data");
      if (!res.ok) return;
      const json = await res.json();
      if (Array.isArray(json.sinifSubeList)) {
        setClasses(json.sinifSubeList);
      }
    } catch (error) {
      console.error(`Siniflar yuklenemedi: ${formatErrorMessage(error)}`);
    }
  };

  const loadIncidents = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const { data, error } = await supabase
        .from("student_incidents")
        .select("*")
        .order("incident_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      setIncidents((data || []) as StudentIncidentRecord[]);
      } catch (error) {
        const message = formatErrorMessage(error);
        setLoadError(message);
        console.error(`Öğrenci bildirimleri yüklenemedi: ${message}`);
        toast.error("Öğrenci bildirimleri yüklenemedi");
      } finally {
        setLoading(false);
      }
  };

  useEffect(() => {
    loadClasses();
    loadIncidents();
  }, []);

  useEffect(() => {
    const uniqueNames = Array.from(
      new Set(
        incidents
          .map((incident) => incident.target_student_name?.trim())
          .filter(Boolean)
          .map((name) => normalizeName(name!))
      )
    );

    if (uniqueNames.length === 0) return;

    let cancelled = false;

    const loadStudentMeta = async () => {
      const nextMeta: Record<string, { class_display?: string; class_key?: string; student_number?: string }> = {};

      for (const normalizedName of uniqueNames) {
        try {
          const res = await fetch(`/api/students?query=${encodeURIComponent(normalizedName)}`);
          if (!res.ok) continue;

          const data = await res.json();
          if (!Array.isArray(data) || data.length === 0) continue;

          const bestMatch = data.find((student: { value?: string; text?: string }) => {
            const candidate = normalizeName(student.value || student.text || "");
            return candidate === normalizedName || candidate.includes(normalizedName) || normalizedName.includes(candidate);
          }) || data[0];

          const text = String(bestMatch.text || "");
          const numberMatch = text.match(/^(\d+)\s+/);
          nextMeta[normalizedName] = {
            class_display: bestMatch.class_display || "",
            class_key: bestMatch.class_key || "",
            student_number: numberMatch?.[1] || ""
          };
        } catch (error) {
          console.error("Öğrenci meta yüklenemedi:", error);
        }
      }

      if (!cancelled && Object.keys(nextMeta).length > 0) {
        setStudentMetaByName((prev) => ({ ...prev, ...nextMeta }));
      }
    };

    loadStudentMeta();

    return () => {
      cancelled = true;
    };
  }, [incidents]);

  const resetForm = () => {
    setFormData(emptyForm);
    setEditingIncident(null);
    reporterFollowUpsRef.current = {};
    setReporterFollowUps({});
  };

  const openCreateForm = () => {
    resetForm();
    setShowForm(true);
  };

  const openEditForm = (incident: StudentIncidentRecord) => {
    setEditingIncident(incident);
    setFormData({
      incident_date: incident.incident_date || today,
      reporter_name: incident.reporter_student_name || "",
      recommended_students_text: incident.target_student_name || "",
      description: incident.description || "",
      is_confidential: incident.is_confidential || false
    });
    setReporterFollowUps({});
    setShowForm(true);
  };

  const replaceAutocompleteValue = (field: "recommended" | "reporter", studentText: string) => {
    const key = field === "recommended" ? "recommended_students_text" : "reporter_name";

    setFormData((prev) => {
      const parts = prev[key].split(/[,\n;]/);
      parts[parts.length - 1] = studentText;
      const nextText = parts
        .map((part, index) => {
          const trimmed = part.trim();
          if (index === parts.length - 1) return studentText;
          return trimmed;
        })
        .filter(Boolean)
        .join(", ");

      return {
        ...prev,
        [key]: nextText
      };
    });
    setStudentSuggestions([]);
    setSuggestionsOpen(false);
    setActiveAutocompleteField(null);
  };

  const resolveStudentClassInfo = async (studentName: string) => {
    const normalized = normalizeName(studentName);
    const cached = studentMetaByName[normalized];
    if (cached?.class_display || cached?.class_key) {
      return cached;
    }

    try {
      const res = await fetch(`/api/students?query=${encodeURIComponent(studentName)}`);
      if (!res.ok) return {};

      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) return {};

      const bestMatch = data.find((student: { value?: string; text?: string }) => {
        const candidate = normalizeName(student.value || student.text || "");
        return candidate === normalized || candidate.includes(normalized) || normalized.includes(candidate);
      }) || data[0];

      const classDisplay = String(bestMatch.class_display || "");
      const classKey = String(bestMatch.class_key || "");

      return {
        class_display: classDisplay,
        class_key: classKey
      };
    } catch (error) {
      console.error("Öğrenci sınıf bilgisi çözülemedi:", error);
      return {};
    }
  };

  const handleSave = async () => {
    const recommendedStudents = formData.recommended_students_text
      .split(/[,\n;]/)
      .map((item) => item.trim())
      .filter(Boolean);
    const primaryStudents = recommendedStudents.length > 0
      ? recommendedStudents
      : [];

    if (primaryStudents.length === 0) {
      toast.error("Görüşülmesi önerilen öğrenci gerekli");
      return;
    }
    if (!formData.description.trim()) {
      toast.error("Açıklama gerekli");
      return;
    }

    try {
      setSaving(true);
      const groupId = editingIncident?.case_group_id || (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
      const reporterNames = reporterCandidates;
      const reporterNameText = reporterNames.join(", ");
      const reportersToFollowUp = reporterNames.filter((name) => reporterFollowUpsRef.current[name]);
      const isEditingSingle = Boolean(editingIncident?.id);
      let createdLinkedCount = 0;
      const classMetaByStudent = new Map<string, { class_display?: string; class_key?: string }>();

      await Promise.all(
        primaryStudents.map(async (studentName) => {
          const meta = await resolveStudentClassInfo(studentName);
          classMetaByStudent.set(normalizeName(studentName), meta);
        })
      );

      if (isEditingSingle) {
        const currentIncident = editingIncident!;
        const targetMeta = await resolveStudentClassInfo(primaryStudents[0]);
        const payload: Partial<StudentIncidentRecord> = {
          case_group_id: currentIncident.case_group_id || groupId,
          record_role: currentIncident.record_role || "main",
          linked_from_id: currentIncident.linked_from_id || null,
          incident_date: formData.incident_date,
          reporter_type: "student",
          reporter_student_name: reporterNameText || null,
          reporter_class_key: null,
          reporter_class_display: null,
          target_student_name: primaryStudents[0],
          target_class_key: targetMeta.class_key || currentIncident.target_class_key || null,
          target_class_display: targetMeta.class_display || currentIncident.target_class_display || null,
          incident_type: "other",
          severity: "medium",
          status: "reviewing",
          description: formData.description.trim(),
          location: null,
          follow_up_date: null,
          is_confidential: formData.is_confidential
        };

        const { error } = await supabase
          .from("student_incidents")
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", currentIncident.id);

        if (error) throw error;
        toast.success("Kayıt güncellendi");
      } else {
        const baseDescription = formData.description.trim();
        const createdIds: string[] = [];

        for (const studentName of primaryStudents) {
          const studentMeta = classMetaByStudent.get(normalizeName(studentName)) || {};
          const payload: StudentIncidentRecord = {
            case_group_id: groupId,
            record_role: "main",
            linked_from_id: null,
            incident_date: formData.incident_date,
            reporter_type: "student",
            reporter_student_name: reporterNameText || null,
            reporter_class_key: null,
            reporter_class_display: null,
            target_student_name: studentName,
            target_class_key: studentMeta.class_key || null,
            target_class_display: studentMeta.class_display || null,
            incident_type: "other",
            severity: "medium",
            status: "reviewing",
            description: baseDescription,
            location: null,
            follow_up_date: null,
            is_confidential: formData.is_confidential
          };

          const { data, error } = await supabase
            .from("student_incidents")
            .insert(payload)
            .select("id")
            .single();

          if (error) throw error;
          if (data?.id) createdIds.push(data.id);
        }

        if (reportersToFollowUp.length > 0) {
          for (const reporterStudent of reportersToFollowUp) {
            const studentMeta = classMetaByStudent.get(normalizeName(reporterStudent)) || {};
            const linkedPayload: StudentIncidentRecord = {
              case_group_id: groupId,
              record_role: "linked_reporter",
              linked_from_id: createdIds[0] || null,
              incident_date: formData.incident_date,
              reporter_type: "student",
              reporter_student_name: reporterNameText || null,
              reporter_class_key: null,
              reporter_class_display: null,
              target_student_name: reporterStudent,
              target_class_key: studentMeta.class_key || null,
              target_class_display: studentMeta.class_display || null,
              incident_type: "other",
              severity: "medium",
              status: "reviewing",
              description: baseDescription,
              location: null,
              follow_up_date: null,
              is_confidential: formData.is_confidential
            };

            const { error } = await supabase.from("student_incidents").insert(linkedPayload);
            if (error) throw error;
            createdLinkedCount += 1;
          }
        }

        toast.success(
          createdLinkedCount > 0
            ? `Bildirim listesine eklendi. ${createdLinkedCount} ek görüşme kaydı oluşturuldu.`
            : "Bildirim listesine eklendi"
        );
      }

      setShowForm(false);
      resetForm();
      await loadIncidents();
    } catch (error) {
      console.error(`Bildirim kaydedilemedi: ${formatErrorMessage(error)}`);
      toast.error(`Bildirim kaydedilemedi: ${formatErrorMessage(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id: string, status: StudentIncidentRecord["status"]) => {
    try {
      const { error } = await supabase
        .from("student_incidents")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
      toast.success("Durum güncellendi");
      await loadIncidents();
    } catch (error) {
      console.error(`Durum guncellenemedi: ${formatErrorMessage(error)}`);
      toast.error("Durum güncellenemedi");
    }
  };

  const deleteIncident = async (id: string) => {
    if (!window.confirm("Bu bildirimi silmek istediğinize emin misiniz?")) return;

    try {
      const { error } = await supabase.from("student_incidents").delete().eq("id", id);
      if (error) throw error;
      toast.success("Bildirim silindi");
      await loadIncidents();
    } catch (error) {
      console.error(`Bildirim silinemedi: ${formatErrorMessage(error)}`);
      toast.error("Bildirim silinemedi");
    }
  };

  const filteredIncidents = useMemo(() => {
    return incidents.filter((incident) => {
      if (statusFilter !== "all" && incident.status !== statusFilter) return false;
      if (typeFilter !== "all" && incident.incident_type !== typeFilter) return false;
      if (severityFilter !== "all" && incident.severity !== severityFilter) return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const fields = [
          incident.target_student_name,
          incident.description
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!fields.includes(query)) return false;
      }

      return true;
    });
  }, [incidents, searchQuery, statusFilter, typeFilter, severityFilter]);

  const studentList = useMemo(() => {
    return filteredIncidents
      .map((incident) => ({
        ...incident,
        displayName: incident.target_student_name || "İsimsiz öğrenci"
      }))
      .sort((a, b) => new Date(b.created_at || b.incident_date).getTime() - new Date(a.created_at || a.incident_date).getTime());
  }, [filteredIncidents]);

  const stats = useMemo(() => ({
    total: incidents.length,
    newCount: incidents.filter((i) => i.status === "new").length,
    resolved: incidents.filter((i) => i.status === "resolved").length,
    highRisk: incidents.filter((i) => i.severity === "high" || i.severity === "critical").length
  }), [incidents]);

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-cyan-900 to-teal-700 p-6 text-white shadow-xl">
        <div className="absolute inset-0 bg-grid-white/10" />
        <div className="absolute -top-20 -right-20 h-56 w-56 rounded-full bg-cyan-300/20 blur-3xl animate-float-slow" />
        <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-teal-400/20 blur-3xl animate-float-reverse" />

        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm shadow-lg">
              <MessageSquare className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Öğrenci Bildirimleri</h1>
              <p className="text-slate-200">
                Öğrenci, öğretmen veya veli kaynaklı şikayet ve akran bildirimi kayıtları
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="rounded-lg border border-white/10 bg-white/10 px-3 py-2 backdrop-blur-sm">
              <p className="text-[10px] uppercase tracking-wider text-cyan-100">Toplam</p>
              <p className="text-lg font-bold leading-none">{stats.total}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/10 px-3 py-2 backdrop-blur-sm">
              <p className="text-[10px] uppercase tracking-wider text-cyan-100">Yeni</p>
              <p className="text-lg font-bold leading-none">{stats.newCount}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/10 px-3 py-2 backdrop-blur-sm">
              <p className="text-[10px] uppercase tracking-wider text-cyan-100">Yüksek Risk</p>
              <p className="text-lg font-bold leading-none">{stats.highRisk}</p>
            </div>
          </div>
        </div>
      </div>

      <Card className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Öğrenci, açıklama, sınıf veya not içinde ara..."
                className="pl-10"
              />
            </div>
            <div className="flex flex-wrap gap-2 lg:justify-end">
              <Button onClick={openCreateForm} className="bg-rose-600 hover:bg-rose-700">
                <Plus className="mr-2 h-4 w-4" />
                Yeni Bildirim
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {loadError && (
        <Card className="overflow-hidden rounded-2xl border border-amber-200 bg-amber-50 shadow-sm">
          <CardContent className="p-4 text-sm text-amber-800">
            <strong>Yükleme uyarısı:</strong> {loadError}
            <div className="mt-1 text-amber-700">
              Eğer tablo henüz oluşturulmadıysa Supabase SQL Editor'da
              `supabase/migrations/005_create_student_incidents.sql` içeriğini çalıştır.
            </div>
          </CardContent>
        </Card>
      )}

      {showForm && (
        <Card className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <CardHeader className="border-b bg-slate-50 py-3">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold text-slate-700">
              <Plus className="h-5 w-5 text-cyan-600" />
              {editingIncident ? "Kaydı Düzenle" : "Yeni Öğrenci Bildirimi"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="mb-1 block text-sm text-slate-600">Tarih</Label>
                <Input
                  type="date"
                  value={formData.incident_date}
                  onChange={(e) => setFormData({ ...formData, incident_date: e.target.value })}
                />
              </div>
              <div className="rounded-xl border border-rose-200 bg-white p-3 text-sm text-slate-600">
                Bu kayıt sade tutulur. Amacımız öğrenciyi hızlıca tespit etmek.
              </div>
            </div>

            <div className="space-y-2">
              <Label>Görüşülmesi Önerilen Öğrenci(ler)</Label>
              <div className="space-y-2">
                <textarea
                  value={formData.recommended_students_text}
                  onChange={(e) => {
                    setFormData({ ...formData, recommended_students_text: e.target.value });
                    setActiveAutocompleteField("recommended");
                    setSuggestionsOpen(true);
                  }}
                  onFocus={() => {
                    setActiveAutocompleteField("recommended");
                    setSuggestionsOpen(true);
                  }}
                  onBlur={() => setTimeout(() => {
                    setSuggestionsOpen(false);
                    setActiveAutocompleteField(null);
                  }, 150)}
                  placeholder="Bir veya birden fazla öğrenci adını virgül ya da alt satırla ayır"
                  rows={3}
                  className="w-full min-h-[96px] resize-y rounded-lg border px-4 py-3 focus:ring-2 focus:ring-cyan-500"
                />
                {suggestionsOpen && activeAutocompleteField === "recommended" && studentSuggestions.length > 0 && (
                  <div className="w-full overflow-hidden rounded-xl border bg-white shadow-xl">
                    {studentSuggestions.map((student) => (
                      <button
                        key={`${student.value}-${student.text}`}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => replaceAutocompleteValue("recommended", student.text.replace(/^\d+\s+/, "").trim())}
                        className="flex w-full items-start gap-3 border-b px-4 py-3 text-left last:border-b-0 hover:bg-cyan-50"
                      >
                        <div className="mt-0.5 rounded-lg bg-cyan-100 p-2">
                          <User className="h-4 w-4 text-cyan-600" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">{student.text}</p>
                          {student.class_display && (
                            <p className="text-sm text-slate-500">{student.class_display}</p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Bildirimi Yapan Kişi(ler)</Label>
              <div className="space-y-2">
                <textarea
                  value={formData.reporter_name}
                  onChange={(e) => {
                    setFormData({ ...formData, reporter_name: e.target.value });
                    setActiveAutocompleteField("reporter");
                    setSuggestionsOpen(true);
                  }}
                  onFocus={() => {
                    setActiveAutocompleteField("reporter");
                    setSuggestionsOpen(true);
                  }}
                  onBlur={() => setTimeout(() => {
                    setSuggestionsOpen(false);
                    setActiveAutocompleteField(null);
                  }, 150)}
                  placeholder="Bir veya birden fazla öğrenci adını virgül ya da alt satırla ayır"
                  rows={3}
                  className="w-full min-h-[96px] resize-y rounded-lg border px-4 py-3 focus:ring-2 focus:ring-cyan-500"
                />
                {suggestionsOpen && activeAutocompleteField === "reporter" && studentSuggestions.length > 0 && (
                  <div className="w-full overflow-hidden rounded-xl border bg-white shadow-xl">
                    {studentSuggestions.map((student) => (
                      <button
                        key={`${student.value}-${student.text}`}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => replaceAutocompleteValue("reporter", student.text.replace(/^\d+\s+/, "").trim())}
                        className="flex w-full items-start gap-3 border-b px-4 py-3 text-left last:border-b-0 hover:bg-cyan-50"
                      >
                        <div className="mt-0.5 rounded-lg bg-cyan-100 p-2">
                          <User className="h-4 w-4 text-cyan-600" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">{student.text}</p>
                          {student.class_display && (
                            <p className="text-sm text-slate-500">{student.class_display}</p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {reporterCandidates.length > 0 && (
                  <div className="space-y-2 rounded-xl border bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Bildirimi yapan kişiyle görüşme yapılacak mı?
                    </p>
                    <div className="space-y-2">
                      {reporterCandidates.map((name) => (
                        <div key={name} className="flex flex-col gap-2 rounded-lg bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="font-medium text-slate-800">{name}</p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant={reporterFollowUps[name] ? "default" : "outline"}
                              className={reporterFollowUps[name] ? "bg-cyan-600 hover:bg-cyan-700" : ""}
                              onClick={() => {
                                setReporterFollowUps((prev) => {
                                  const next = { ...prev, [name]: true };
                                  reporterFollowUpsRef.current = next;
                                  return next;
                                });
                              }}
                            >
                              Evet
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant={!reporterFollowUps[name] ? "default" : "outline"}
                              className={!reporterFollowUps[name] ? "bg-slate-700 hover:bg-slate-800" : ""}
                              onClick={() => {
                                setReporterFollowUps((prev) => {
                                  const next = { ...prev, [name]: false };
                                  reporterFollowUpsRef.current = next;
                                  return next;
                                });
                              }}
                            >
                              Hayır
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Kısa Açıklama</Label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
                className="w-full rounded-lg border px-4 py-3 focus:ring-2 focus:ring-cyan-500"
                placeholder="Öğrencinin yaşadığı durumun kısa notu..."
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
              >
                İptal
              </Button>
              <Button onClick={handleSave} disabled={saving} className="bg-cyan-600 hover:bg-cyan-700">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                {editingIncident ? "Güncelle" : "Kaydet"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <Card className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <CardContent className="flex items-center justify-center py-14">
            <Loader2 className="h-8 w-8 animate-spin text-rose-600" />
            <span className="ml-3 text-slate-600">Bildirimler yukleniyor...</span>
          </CardContent>
        </Card>
      ) : studentList.length === 0 ? (
        <Card className="overflow-hidden rounded-2xl border border-dashed border-slate-200 bg-white shadow-sm">
          <CardContent className="py-14 text-center">
            <MessageSquare className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">Kayıt bulunamadı</p>
            <Button variant="outline" className="mt-4" onClick={openCreateForm}>
              <Plus className="mr-2 h-4 w-4" />
              İlk bildirimi ekle
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div id="incident-list" className="space-y-4">
          <Card className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <CardHeader className="border-b bg-slate-50 py-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <span>Öğrenci Bildirimleri</span>
                <Badge variant="secondary">{studentList.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-4">
              {studentList.map((incident) => (
                <IncidentCard
                  key={incident.id}
                  incident={incident}
                  meta={studentMetaByName[normalizeName(incident.displayName)]}
                  onEdit={() => openEditForm(incident)}
                  onDelete={() => deleteIncident(incident.id!)}
                />
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function AppointmentButton({ href }: { href: string }) {
  return (
    <Button
      asChild
      size="sm"
      className="w-full border-0 bg-gradient-to-r from-indigo-600 via-sky-600 to-cyan-600 text-white shadow-lg shadow-cyan-500/20 transition-all hover:scale-[1.01] hover:from-indigo-500 hover:via-sky-500 hover:to-cyan-500 sm:w-auto"
    >
      <Link href={href}>
        <ArrowRight className="mr-2 h-4 w-4" />
        Randevuya dönüştür
      </Link>
    </Button>
  );
}

function IncidentCard({
  incident,
  meta,
  onEdit,
  onDelete
}: {
  incident: StudentIncidentRecord & { displayName: string };
  meta?: { class_display?: string; class_key?: string; student_number?: string };
  onEdit: () => void;
  onDelete: () => void;
}) {
  const classLabel = meta?.class_display || incident.target_class_display || incident.target_class_key || "-";
  const numberLabel = meta?.student_number ? `No: ${meta.student_number}` : "";
  const displayDescription = cleanIncidentDescription(incident.description);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-slate-800">{incident.displayName}</h3>
            <Badge variant="outline">Öğrenci bildirimi</Badge>
          </div>

          <p className="mt-2 text-sm text-slate-600">
            {classLabel}
            {numberLabel ? ` · ${numberLabel}` : ""}
          </p>

          <p className="mt-2 text-sm leading-6 text-slate-700">{displayDescription}</p>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={onEdit}>
              <Edit className="mr-2 h-4 w-4" />
              Düzenle
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onDelete}
              className="text-red-600 hover:bg-red-50"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Sil
            </Button>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-2 lg:items-end">
          <AppointmentButton
            href={buildAppointmentUrl(
              incident.target_student_name,
              meta?.class_display || incident.target_class_display || null,
              meta?.class_key || incident.target_class_key || null,
              incident.description
            )}
          />
          <Badge variant="outline">
            <Clock className="mr-1 h-3.5 w-3.5" />
            {formatDateTime(incident.created_at || incident.incident_date)}
          </Badge>
        </div>
      </div>
    </div>
  );
}
