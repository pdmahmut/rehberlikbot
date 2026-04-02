"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Eye,
  Plus,
  Search,
  RefreshCw,
  Users,
  User,
  Calendar,
  Clock,
  Edit,
  Trash2,
  CheckCircle2,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Loader2,
  Filter,
  X
} from "lucide-react";
import { ObservationPoolRecord, ObservationPoolFormData, ObservationPriority, ObservationStatus, ObservationType, OBSERVATION_PRIORITIES, OBSERVATION_STATUSES, OBSERVATION_TYPES } from "@/types";

type StudentOption = { value: string; text: string; class_key?: string; class_display?: string };
type ClassOption = { value: string; text: string };

type ObservationGroup = {
  key: string;
  student_name: string;
  student_number: string;
  class_key: string;
  class_display: string;
  items: ObservationPoolRecord[];
  pendingItems: ObservationPoolRecord[];
  latestItem: ObservationPoolRecord | null;
};

const today = new Date().toISOString().slice(0, 10);

const typeStyleMap: Record<ObservationType, { bg: string; text: string; border: string }> = {
  behavior: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  academic: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  social: { bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-200" },
  emotional: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" }
};

const priorityStyleMap: Record<ObservationPriority, { bg: string; text: string; border: string }> = {
  low: { bg: "bg-slate-50", text: "text-slate-700", border: "border-slate-200" },
  medium: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  high: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" }
};

const statusStyleMap: Record<ObservationStatus, { bg: string; text: string; border: string }> = {
  pending: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  completed: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  converted: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" }
};

const observationTypeLabelMap: Record<ObservationType, string> = {
  behavior: "Davranış",
  academic: "Akademik",
  social: "Sosyal",
  emotional: "Duygusal"
};

function parseStudentLabel(label: string) {
  const trimmed = label.trim();
  if (!trimmed) return { studentName: "", studentNumber: "" };

  const firstSpace = trimmed.indexOf(" ");
  if (firstSpace > 0) {
    const maybeNumber = trimmed.slice(0, firstSpace).trim();
    const name = trimmed.slice(firstSpace + 1).trim();
    if (maybeNumber && name) {
      return { studentName: name, studentNumber: maybeNumber };
    }
  }

  return { studentName: trimmed, studentNumber: "" };
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("tr-TR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("tr-TR", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export default function GozlemHavuzuPage() {
  const router = useRouter();
  const [observations, setObservations] = useState<ObservationPoolRecord[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingObservation, setEditingObservation] = useState<ObservationPoolRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [studentQuery, setStudentQuery] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);
  const [viewFilter, setViewFilter] = useState<"active" | "all" | "archive">("active");
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const [formData, setFormData] = useState<ObservationPoolFormData>({
    student_name: "",
    student_number: "",
    class_key: "",
    class_display: "",
    observation_type: "behavior",
    priority: "medium",
    note: "",
    observed_at: today
  });

  const loadClasses = async () => {
    try {
      const res = await fetch("/api/data");
      if (!res.ok) return;
      const json = await res.json();
      if (Array.isArray(json.sinifSubeList)) setClasses(json.sinifSubeList);
    } catch (error) {
      console.error("Sınıflar yüklenemedi:", error);
    }
  };

  const loadObservations = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/gozlem-havuzu");
      if (!res.ok) throw new Error("Gözlem kayıtları alınamadı");
      const json = await res.json();
      setObservations(Array.isArray(json.observations) ? json.observations : []);
    } catch (error) {
      console.error("Gözlem havuzu yüklenemedi:", error);
      toast.error("Gözlem havuzu yüklenemedi");
    } finally {
      setLoading(false);
    }
  };

  const loadStudents = async (classKey: string, query = "") => {
    const trimmedQuery = query.trim();

    if (!classKey && !trimmedQuery) {
      setStudents([]);
      return;
    }

    try {
      setLoadingStudents(true);
      const endpoint = classKey
        ? `/api/students?sinifSube=${encodeURIComponent(classKey)}`
        : `/api/students?query=${encodeURIComponent(trimmedQuery)}`;
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error("Öğrenci listesi alınamadı");
      const json = await res.json();
      setStudents(Array.isArray(json) ? json : []);
    } catch (error) {
      console.error("Öğrenciler yüklenemedi:", error);
      setStudents([]);
    } finally {
      setLoadingStudents(false);
    }
  };

  useEffect(() => {
    loadClasses();
    loadObservations();
  }, []);

  useEffect(() => {
    if (selectedClass) {
      loadStudents(selectedClass);
    } else {
      loadStudents("", studentQuery);
    }

    setFormData((prev) => ({
      ...prev,
      class_key: selectedClass,
      class_display: classes.find((item) => item.value === selectedClass)?.text || selectedClass
    }));
  }, [selectedClass, classes]);

  useEffect(() => {
    if (selectedClass) return;

    const trimmedQuery = studentQuery.trim();
    const timer = window.setTimeout(() => {
      loadStudents("", trimmedQuery);
      setShowStudentDropdown(Boolean(trimmedQuery));
    }, 250);

    return () => window.clearTimeout(timer);
  }, [studentQuery, selectedClass]);

  const resetForm = () => {
    setFormData({
      student_name: "",
      student_number: "",
      class_key: "",
      class_display: "",
      observation_type: "behavior",
      priority: "medium",
      note: "",
      observed_at: today
    });
    setSelectedClass("");
    setStudentQuery("");
    setShowStudentDropdown(false);
    setStudents([]);
    setEditingObservation(null);
  };

  const openCreateForm = () => {
    resetForm();
    setShowForm(true);
  };

  const openEditForm = (observation: ObservationPoolRecord) => {
    setEditingObservation(observation);
    setSelectedClass(observation.class_key || "");
    setStudentQuery(observation.student_number ? `${observation.student_number} ${observation.student_name}` : observation.student_name);
    setFormData({
      student_name: observation.student_name,
      student_number: observation.student_number || "",
      class_key: observation.class_key || "",
      class_display: observation.class_display || "",
      observation_type: observation.observation_type,
      priority: observation.priority,
      note: observation.note,
      observed_at: observation.observed_at || today
    });
    setShowForm(true);
  };

  const filteredStudentOptions = useMemo(() => {
    const query = normalizeText(studentQuery);
    if (!selectedClass) return students;
    if (!query) return students;
    return students.filter((item) => normalizeText(item.text).includes(query));
  }, [students, studentQuery, selectedClass]);

  const groupedObservations = useMemo(() => {
    const map = new Map<string, ObservationGroup>();
    observations.forEach((observation) => {
      const key = [
        observation.class_key || observation.class_display || "",
        observation.student_name || "",
        observation.student_number || ""
      ].join("|");
      if (!map.has(key)) {
        map.set(key, {
          key,
          student_name: observation.student_name,
          student_number: observation.student_number || "",
          class_key: observation.class_key || "",
          class_display: observation.class_display || "",
          items: [],
          pendingItems: [],
          latestItem: null
        });
      }
      map.get(key)!.items.push(observation);
    });

    return Array.from(map.values())
      .map((group) => {
        const items = [...group.items].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        const pendingItems = items.filter((item) => item.status === "pending");
        return { ...group, items, pendingItems, latestItem: items[0] || null };
      })
      .sort((a, b) => {
        const aDate = a.latestItem?.created_at ? new Date(a.latestItem.created_at).getTime() : 0;
        const bDate = b.latestItem?.created_at ? new Date(b.latestItem.created_at).getTime() : 0;
        return bDate - aDate;
      });
  }, [observations]);

  const filteredGroups = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return groupedObservations.filter((group) => {
      const hasActive = group.pendingItems.length > 0;
      if (viewFilter === "active" && !hasActive) return false;
      if (viewFilter === "archive" && hasActive) return false;
      if (!query) return true;

      const fields = [
        group.student_name,
        group.student_number,
        group.class_display,
        group.class_key,
        ...group.items.map((item) => item.note),
        ...group.items.map((item) => item.observation_type),
        ...group.items.map((item) => item.priority),
        ...group.items.map((item) => item.status)
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return fields.includes(query);
    });
  }, [groupedObservations, searchQuery, viewFilter]);

  const stats = useMemo(() => {
    const activeItems = observations.filter((item) => item.status === "pending").length;
    const completedItems = observations.filter((item) => item.status === "completed").length;
    const convertedItems = observations.filter((item) => item.status === "converted").length;
    const uniqueStudents = new Set(
      observations.map((item) => `${item.class_key || ""}|${item.student_name || ""}|${item.student_number || ""}`)
    ).size;

    return { total: observations.length, active: activeItems, completed: completedItems, converted: convertedItems, uniqueStudents };
  }, [observations]);

  const handleStudentSelect = (option: StudentOption) => {
    const parsed = parseStudentLabel(option.text);
    const nextClassKey = option.class_key || selectedClass;
    const classDisplay = option.class_display || classes.find((item) => item.value === nextClassKey)?.text || nextClassKey;

    setSelectedClass(nextClassKey || "");
    setFormData((prev) => ({
      ...prev,
      student_name: parsed.studentName || option.text,
      student_number: parsed.studentNumber,
      class_key: nextClassKey || "",
      class_display: classDisplay
    }));
    setStudentQuery(option.text);
    setShowStudentDropdown(false);
  };

  const handleSave = async () => {
    const studentName = (formData.student_name || studentQuery).trim();
    if (!studentName) {
      toast.error("Öğrenci seçin");
      return;
    }

    try {
      setSaving(true);
      const classDisplay = classes.find((item) => item.value === selectedClass)?.text || formData.class_display || selectedClass;
      const payload = {
        ...formData,
        student_name: studentName,
        class_key: selectedClass || formData.class_key,
        class_display: classDisplay,
        observed_at: formData.observed_at || today
      };

      const res = await fetch("/api/gozlem-havuzu", {
        method: editingObservation ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: editingObservation
          ? JSON.stringify({ id: editingObservation.id, action: "update", ...payload })
          : JSON.stringify(payload)
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || "Kaydetme başarısız");
      }

      toast.success(editingObservation ? "Gözlem güncellendi" : "Gözlem havuzuna eklendi");
      setShowForm(false);
      resetForm();
      await loadObservations();
    } catch (error) {
      console.error("Gözlem kaydedilemedi:", error);
      toast.error(error instanceof Error ? error.message : "Kaydetme sırasında hata oluştu");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Bu gözlem kaydını silmek istiyor musunuz?")) return;
    try {
      const res = await fetch(`/api/gozlem-havuzu?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Silme başarısız");
      toast.success("Gözlem silindi");
      await loadObservations();
    } catch (error) {
      console.error("Gözlem silinemedi:", error);
      toast.error("Gözlem silinemedi");
    }
  };

  const handleComplete = async (id: string) => {
    try {
      const res = await fetch("/api/gozlem-havuzu", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "status", ids: [id], status: "completed" })
      });
      if (!res.ok) throw new Error("Durum güncellenemedi");
      toast.success("Gözlem tamamlandı olarak işaretlendi");
      await loadObservations();
    } catch (error) {
      console.error("Gözlem tamamlanamadı:", error);
      toast.error("Gözlem tamamlanamadı");
    }
  };

  const handleRestoreToPool = async (id: string) => {
    try {
      const res = await fetch("/api/gozlem-havuzu", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "status", ids: [id], status: "pending" })
      });
      if (!res.ok) throw new Error("Havuza alma başarısız");
      toast.success("Gözlem yeniden havuza alındı");
      await loadObservations();
    } catch (error) {
      console.error("Gözlem havuza alınamadı:", error);
      toast.error("Gözlem havuza alınamadı");
    }
  };

  const handleConvertToAppointment = (group: ObservationGroup) => {
    const pendingIds = group.pendingItems.map((item) => item.id);
    if (pendingIds.length === 0) {
      toast.info("Dönüştürülecek bekleyen gözlem yok");
      return;
    }

    const leadItem = group.pendingItems[0] || group.latestItem;
    const params = new URLSearchParams();
    params.set("poolIds", pendingIds.join(","));
    params.set("studentName", group.student_name);
    if (group.class_key) params.set("classKey", group.class_key);
    if (group.class_display) params.set("classDisplay", group.class_display);
    if (leadItem) {
      params.set("observationType", leadItem.observation_type);
      params.set("priority", leadItem.priority);
      params.set("note", leadItem.note);
    }

    router.push(`/panel/randevu?${params.toString()}`);
  };

  const toggleExpandedGroup = (key: string) => {
    setExpandedGroups((prev) => (prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]));
  };

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-cyan-900 to-teal-700 p-6 text-white shadow-xl">
        <div className="absolute inset-0 bg-grid-white/10" />
        <div className="absolute -top-20 -right-20 h-56 w-56 rounded-full bg-cyan-300/20 blur-3xl animate-float-slow" />
        <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-teal-400/20 blur-3xl animate-float-reverse" />

        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm shadow-lg">
              <Eye className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Gözlem Havuzu</h1>
              <p className="text-cyan-100">
                Öğrencileri anlık gözlemlerle kaydet, geçmişi tek kartta biriktir ve randevuya dönüştür.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="rounded-lg bg-white/10 px-3 py-2 backdrop-blur-sm">
              <p className="text-[10px] uppercase tracking-wider text-cyan-200">Aktif</p>
              <p className="text-lg font-bold leading-none">{stats.active}</p>
            </div>
            <div className="rounded-lg bg-white/10 px-3 py-2 backdrop-blur-sm">
              <p className="text-[10px] uppercase tracking-wider text-cyan-200">Toplam</p>
              <p className="text-lg font-bold leading-none">{stats.total}</p>
            </div>
            <div className="rounded-lg bg-white/10 px-3 py-2 backdrop-blur-sm">
              <p className="text-[10px] uppercase tracking-wider text-cyan-200">Öğrenci</p>
              <p className="text-lg font-bold leading-none">{stats.uniqueStudents}</p>
            </div>
          </div>
        </div>

        <div className="relative mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/15 pt-4">
          <div className="flex flex-wrap gap-2">
            {[
              { value: "active", label: "Aktif Havuz" },
              { value: "all", label: "Tümü" },
              { value: "archive", label: "Arşiv" }
            ].map((item) => (
              <button
                key={item.value}
                onClick={() => setViewFilter(item.value as typeof viewFilter)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  viewFilter === item.value ? "bg-white text-cyan-700 shadow-sm" : "bg-white/10 text-white/80 hover:bg-white/15"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={loadObservations}
              className="border-0 bg-white/10 text-white hover:bg-white/20"
            >
              <RefreshCw className={`mr-1 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Yenile
            </Button>
            <Button onClick={openCreateForm} className="bg-white text-cyan-700 hover:bg-white/90">
              <Plus className="mr-1 h-4 w-4" />
              Yeni Gözlem
            </Button>
          </div>
        </div>
      </div>

      <Card className="bg-white/80 backdrop-blur border-slate-200/60">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <div className="flex-1">
              <Label className="mb-1 block text-xs font-medium text-slate-500">Ara</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Öğrenci adı, numara, not, tür ara..."
                  className="pl-9"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="px-3 py-1.5">
                <Users className="mr-1 h-3.5 w-3.5" />
                {stats.uniqueStudents} öğrenci
              </Badge>
              <Badge variant="outline" className="px-3 py-1.5">
                <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                {stats.completed} tamamlandı
              </Badge>
              <Badge variant="outline" className="px-3 py-1.5">
                <ArrowRight className="mr-1 h-3.5 w-3.5" />
                {stats.converted} randevuya dönüştü
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {showForm && (
        <Card className="border-2 border-cyan-200 bg-cyan-50/40">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Eye className="h-5 w-5 text-cyan-700" />
              {editingObservation ? "Gözlem Düzenle" : "Yeni Gözlem Ekle"}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => { setShowForm(false); resetForm(); }}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Öğrenci Ara</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={studentQuery}
                    onChange={(e) => {
                      setStudentQuery(e.target.value);
                      setShowStudentDropdown(true);
                      setFormData((prev) => ({ ...prev, student_name: e.target.value }));
                    }}
                    placeholder="Ad veya numara yazın"
                    className="pl-9"
                  />
                </div>
                {!selectedClass && (
                  <p className="text-xs text-slate-500">
                    Sınıfı bilmiyorsanız öğrencinin adını yazın, eşleşen sonuçtan seçince sınıf otomatik gelir.
                  </p>
                )}

                {showStudentDropdown && filteredStudentOptions.length > 0 && (
                  <div className="max-h-56 overflow-y-auto rounded-xl border bg-white shadow-sm">
                    {filteredStudentOptions.map((student) => (
                      <button
                        key={student.value}
                        type="button"
                        onClick={() => handleStudentSelect(student)}
                        className="flex w-full items-center gap-3 border-b px-4 py-3 text-left last:border-0 hover:bg-cyan-50"
                      >
                        <div className="rounded-lg bg-cyan-100 p-2">
                          <User className="h-4 w-4 text-cyan-700" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">{student.text}</p>
                          {student.class_display && <p className="text-xs text-slate-500">{student.class_display}</p>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {loadingStudents && (
                  <p className="text-xs text-slate-500">Öğrenciler yükleniyor...</p>
                )}
              </div>

              <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
                <div className="space-y-2">
                  <Label>Sınıf <span className="text-slate-400">(isteğe bağlı)</span></Label>
                  <select
                    value={selectedClass}
                    onChange={(e) => {
                      const nextClass = e.target.value;
                      setSelectedClass(nextClass);
                      setStudentQuery("");
                      setShowStudentDropdown(Boolean(nextClass));
                      setFormData((prev) => ({
                        ...prev,
                        student_name: "",
                        student_number: "",
                        class_key: nextClass,
                        class_display: classes.find((item) => item.value === nextClass)?.text || nextClass
                      }));
                    }}
                    className="w-full rounded-lg border bg-white px-3 py-2 text-sm focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="">Sonradan seçebilirsiniz</option>
                    {classes.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.text}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label className="opacity-0">Bilgi</Label>
                  <div className="rounded-lg border border-dashed border-slate-200 bg-white/70 px-3 py-2 text-xs text-slate-500">
                    Öğrenci adıyla başlayabilir, sınıfı sonra ekleyebilirsiniz.
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <Label>Öğrenci Bilgisi</Label>
                <div className="rounded-xl border bg-white p-3 text-sm text-slate-600">
                  <p className="font-medium text-slate-800">{formData.student_name || "Henüz seçilmedi"}</p>
                  <p className="text-xs text-slate-500">
                    {formData.student_number ? `Numara: ${formData.student_number}` : "Numara bilgisi yok"}
                    {formData.class_display ? ` • ${formData.class_display}` : ""}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Otomatik Tarih</Label>
                <Input
                  type="date"
                  value={formData.observed_at}
                  onChange={(e) => setFormData((prev) => ({ ...prev, observed_at: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                <Label>Gözlem Türü</Label>
                <div className="flex flex-wrap gap-2">
                  {OBSERVATION_TYPES.map((item) => {
                    const isSelected = formData.observation_type === item.value;
                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, observation_type: item.value }))}
                        className={`rounded-full px-3 py-1.5 text-sm transition-all ${
                          isSelected ? "bg-cyan-600 text-white shadow-sm" : "border bg-white text-slate-600 hover:bg-cyan-50"
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3">
                <Label>Öncelik</Label>
                <div className="flex flex-wrap gap-2">
                  {OBSERVATION_PRIORITIES.map((item) => {
                    const isSelected = formData.priority === item.value;
                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, priority: item.value }))}
                        className={`rounded-full px-3 py-1.5 text-sm transition-all ${
                          isSelected ? "bg-amber-600 text-white shadow-sm" : "border bg-white text-slate-600 hover:bg-amber-50"
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Kısa Not <span className="text-slate-400">(opsiyonel)</span></Label>
              <textarea
                value={formData.note}
                onChange={(e) => setFormData((prev) => ({ ...prev, note: e.target.value }))}
                rows={4}
                className="w-full rounded-xl border bg-white px-4 py-3 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500"
                placeholder="Öğrencide fark edilen kısa gözlem notu..."
              />
            </div>

            <div className="flex items-center justify-between gap-3 rounded-xl border bg-white px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Clock className="h-4 w-4 text-cyan-600" />
                Gözlem havuzuna kaydedildiğinde kart altında geçmiş olarak birikir.
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { setShowForm(false); resetForm(); }}>
                  İptal
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                  {editingObservation ? "Güncelle" : "Kaydet"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-14">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-600" />
            <span className="ml-3 text-slate-600">Gözlem havuzu yükleniyor...</span>
          </CardContent>
        </Card>
      ) : filteredGroups.length === 0 ? (
        <Card className="border-dashed border-slate-200">
          <CardContent className="py-14 text-center">
            <Eye className="mx-auto mb-4 h-12 w-12 text-slate-300" />
            <p className="text-slate-500">Bu filtrelerde gözlem kaydı bulunmuyor</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredGroups.map((group) => {
            const isExpanded = expandedGroups.includes(group.key);
            const hasActive = group.pendingItems.length > 0;
            const leadItem = group.latestItem;
            const activeType = leadItem ? typeStyleMap[leadItem.observation_type] : typeStyleMap.behavior;
            const historyItems = group.items.slice(1);

            return (
              <Card key={group.key} className={`overflow-hidden border-l-4 ${hasActive ? "border-l-cyan-500" : "border-l-slate-300"} shadow-sm`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className={`rounded-2xl p-3 ${activeType.bg}`}>
                      <Users className={`h-6 w-6 ${activeType.text}`} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-semibold text-slate-800">{group.student_name}</h3>
                            {group.student_number && <Badge variant="outline">{group.student_number}</Badge>}
                            {group.class_display && <Badge variant="outline">{group.class_display}</Badge>}
                            <Badge className={`${statusStyleMap[hasActive ? "pending" : "converted"].bg} ${statusStyleMap[hasActive ? "pending" : "converted"].text}`}>
                              {hasActive ? "Aktif havuz" : "Arşiv"}
                            </Badge>
                            <Badge className={`${priorityStyleMap[leadItem?.priority || "medium"].bg} ${priorityStyleMap[leadItem?.priority || "medium"].text}`}>
                              {leadItem ? OBSERVATION_PRIORITIES.find((item) => item.value === leadItem.priority)?.label : "Orta"}
                            </Badge>
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-600">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {leadItem ? formatDateTime(leadItem.created_at) : "-"}
                            </span>
                            <span className="flex items-center gap-1">
                              <CheckCircle2 className="h-4 w-4" />
                              {group.items.length} kayıt
                            </span>
                            <span className="flex items-center gap-1">
                              <Filter className="h-4 w-4" />
                              {leadItem ? OBSERVATION_STATUSES.find((item) => item.value === leadItem.status)?.label : "-"}
                            </span>
                          </div>

                          {leadItem && (
                            <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge className={`${typeStyleMap[leadItem.observation_type].bg} ${typeStyleMap[leadItem.observation_type].text}`}>
                                  {observationTypeLabelMap[leadItem.observation_type]}
                                </Badge>
                                <Badge className={`${priorityStyleMap[leadItem.priority].bg} ${priorityStyleMap[leadItem.priority].text}`}>
                                  {OBSERVATION_PRIORITIES.find((item) => item.value === leadItem.priority)?.label}
                                </Badge>
                                <Badge className={`${statusStyleMap[leadItem.status].bg} ${statusStyleMap[leadItem.status].text}`}>
                                  {OBSERVATION_STATUSES.find((item) => item.value === leadItem.status)?.label}
                                </Badge>
                              </div>
                              <p className="mt-2 text-sm leading-6 text-slate-700">{leadItem.note || "Not eklenmedi"}</p>
                              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3.5 w-3.5" />
                                  {formatDateTime(leadItem.created_at)}
                                </span>
                                {leadItem.observed_at && (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3.5 w-3.5" />
                                    {formatDate(leadItem.observed_at)}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2 lg:justify-end">
                          {leadItem?.status === "converted" ? (
                            <Button size="sm" variant="outline" onClick={() => handleRestoreToPool(leadItem.id)}>
                              <ArrowRight className="mr-2 h-4 w-4 rotate-180" />
                              Havuza al
                            </Button>
                          ) : hasActive ? (
                            <Button size="sm" className="bg-cyan-600 hover:bg-cyan-700" onClick={() => handleConvertToAppointment(group)}>
                              <ArrowRight className="mr-2 h-4 w-4" />
                              Randevuya dönüştür
                            </Button>
                          ) : null}

                          {leadItem && (
                            <>
                              <Button size="sm" variant="outline" onClick={() => openEditForm(leadItem)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Düzenle
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDelete(leadItem.id)}
                                className="text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Sil
                              </Button>
                            </>
                          )}

                          <Button size="sm" variant="outline" onClick={() => toggleExpandedGroup(group.key)}>
                            {isExpanded ? <ChevronUp className="mr-2 h-4 w-4" /> : <ChevronDown className="mr-2 h-4 w-4" />}
                            {isExpanded ? "Geçmişi gizle" : `Geçmiş (${historyItems.length})`}
                          </Button>
                        </div>
                      </div>

                      {historyItems.length > 0 && (
                        <div className={`mt-4 space-y-2 ${isExpanded ? "" : "hidden"}`}>
                          {historyItems.map((item) => (
                            <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-3">
                              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge className={`${typeStyleMap[item.observation_type].bg} ${typeStyleMap[item.observation_type].text}`}>
                                      {observationTypeLabelMap[item.observation_type]}
                                    </Badge>
                                    <Badge className={`${priorityStyleMap[item.priority].bg} ${priorityStyleMap[item.priority].text}`}>
                                      {OBSERVATION_PRIORITIES.find((entry) => entry.value === item.priority)?.label}
                                    </Badge>
                                    <Badge className={`${statusStyleMap[item.status].bg} ${statusStyleMap[item.status].text}`}>
                                      {OBSERVATION_STATUSES.find((entry) => entry.value === item.status)?.label}
                                    </Badge>
                                  </div>
                                  <p className="mt-2 text-sm text-slate-700">{item.note || "Not eklenmedi"}</p>
                                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                                    <span className="flex items-center gap-1">
                                      <Clock className="h-3.5 w-3.5" />
                                      {formatDateTime(item.created_at)}
                                    </span>
                                    {item.observed_at && (
                                      <span className="flex items-center gap-1">
                                        <Calendar className="h-3.5 w-3.5" />
                                        {formatDate(item.observed_at)}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                  {item.status === "pending" && (
                                    <Button size="sm" variant="outline" onClick={() => handleComplete(item.id)}>
                                      <CheckCircle2 className="mr-1 h-4 w-4" />
                                      Tamamlandı
                                    </Button>
                                  )}
                                  {item.status === "converted" && (
                                    <Button size="sm" variant="outline" onClick={() => handleRestoreToPool(item.id)}>
                                      <ArrowRight className="mr-1 h-4 w-4 rotate-180" />
                                      Havuza al
                                    </Button>
                                  )}
                                  <Button size="sm" variant="outline" onClick={() => openEditForm(item)}>
                                    <Edit className="mr-1 h-4 w-4" />
                                    Düzenle
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleDelete(item.id)}
                                    className="text-red-600 hover:bg-red-50"
                                  >
                                    <Trash2 className="mr-1 h-4 w-4" />
                                    Sil
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

