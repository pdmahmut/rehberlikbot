"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Users, Plus, RefreshCw, GraduationCap, Filter, CheckCircle2, Target, BookOpen, Layers3 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { usePanelData, useClassStudents } from "../hooks";
import type { StudentStatus } from "../types";

export default function OgrencilerPage() {
  const { classes, loadingFilters } = usePanelData();
  const { classStudents, setClassStudents, loadingStudents, studentError, setStudentError, loadClassStudents } = useClassStudents();
  const students = classStudents;
  
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [selectedStatusView, setSelectedStatusView] = useState<"tumu" | "aktif_takip" | "basvurular">("tumu");
  const [searchTerm, setSearchTerm] = useState("");
  const [newStudentName, setNewStudentName] = useState("");
  const [newStudentClass, setNewStudentClass] = useState("");
  const [newStudentNumber, setNewStudentNumber] = useState("");
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);

  const handleAddStudent = async () => {
    if (!newStudentName.trim() || !newStudentClass || !newStudentNumber.trim()) return;

    try {
      const classText = classes.find((c) => c.value === newStudentClass)?.text || newStudentClass;
      const res = await fetch("/api/class-students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          class_key: newStudentClass,
          class_display: classText,
          student_name: newStudentName.trim(),
          student_number: newStudentNumber.trim(),
          status: "tumu",
        }),
      });
      if (!res.ok) {
        throw new Error("Öğrenci ekleme isteği başarısız");
      }

      const json = await res.json();
      if (json.student) {
        if (json.student.class_key === selectedClass) {
          await loadClassStudents(selectedClass);
        }
        toast.success(`${newStudentName} başarıyla eklendi`);
        setNewStudentName("");
        setNewStudentClass("");
        setNewStudentNumber("");
      }
    } catch (error) {
      console.error("Panel add student error:", error);
      setStudentError("Öğrenci eklenemedi");
      toast.error("Öğrenci eklenirken hata oluştu");
    }
  };

  const handleClearForm = () => {
    setNewStudentName("");
    setNewStudentClass("");
    setNewStudentNumber("");
    toast.info("Form temizlendi");
  };

  const handleStatusChange = async (studentId: string, newStatus: StudentStatus) => {
    if (!studentId) return;
    try {
      setStatusUpdatingId(studentId);
      const { error } = await supabase
        .from("class_students")
        .update({ status: newStatus })
        .eq("id", studentId);

      if (error) {
        throw error;
      }

      setClassStudents(prev =>
        prev.map(s =>
          s.id === studentId
            ? { ...s, status: newStatus }
            : s
        )
      );

      toast.success("Öğrenci durumu güncellendi");
    } catch (error) {
      console.error("Panel student status update error:", error);
      setStudentError("Öğrenci durumu güncellenemedi");
      toast.error("Öğrenci durumu güncellenemedi");
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const handleResetFilters = () => {
    setSearchTerm("");
    setSelectedStatusView("tumu");
  };

  const filteredStudents = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return students
      .filter((student) => {
        const matchesSearch = !query ||
          student.student_name.toLowerCase().includes(query) ||
          (student.student_number || "").toLowerCase().includes(query) ||
          `${student.student_number ? `${student.student_number} ` : ""}${student.student_name}`.toLowerCase().includes(query);

        const matchesView =
          selectedStatusView === "tumu"
            ? student.status === "tumu"
            : selectedStatusView === "aktif_takip"
              ? student.status === "aktif_takip"
              : ["aktif_takip", "tamamlandi"].includes(student.status);

        return matchesSearch && matchesView;
      })
      .sort((a, b) => a.student_name.localeCompare(b.student_name, "tr"));
  }, [students, searchTerm, selectedStatusView]);

  const tumuListesi = useMemo(
    () => students.filter(s => s.status === "tumu"),
    [students]
  );

  const aktifTakipListesi = useMemo(
    () => students.filter(s => s.status === "aktif_takip"),
    [students]
  );

  const basvurularListesi = useMemo(
    () =>
      students.filter((s) =>
        ["aktif_takip", "tamamlandi"].includes(s.status)
      ),
    [students]
  );

  const renderStudentRow = (student: typeof classStudents[number], idx: number) => (
    <li
      key={student.id}
      className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50/80"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="text-xs text-slate-400 w-6">{idx + 1}</span>
        <div className="min-w-0">
          <span className="block truncate text-sm font-medium text-slate-800">
            {student.student_number ? `${student.student_number} ${student.student_name}` : student.student_name}
          </span>
          <Badge
            variant="outline"
            className={
              student.status === "aktif_takip"
                ? "mt-1 border-cyan-200 bg-cyan-50 text-cyan-700"
                : student.status === "tamamlandi"
                ? "mt-1 border-emerald-200 bg-emerald-50 text-emerald-700"
                : "mt-1 border-slate-200 bg-slate-50 text-slate-600"
            }
          >
            {student.status === "tumu"
              ? "Tümü"
              : student.status === "aktif_takip"
              ? "Aktif Takip"
              : "Tamamlandı"}
          </Badge>
        </div>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant={student.status === "aktif_takip" ? "default" : "outline"}
          size="sm"
          disabled={statusUpdatingId === student.id}
          onClick={() => handleStatusChange(student.id, "aktif_takip")}
        >
          Aktif Takip
        </Button>
        <Button
          variant={student.status === "tamamlandi" ? "default" : "outline"}
          size="sm"
          disabled={statusUpdatingId === student.id}
          onClick={() => handleStatusChange(student.id, "tamamlandi")}
        >
          Tamamlandı
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={statusUpdatingId === student.id}
          onClick={() => handleStatusChange(student.id, "tumu")}
        >
          Tümü
        </Button>
      </div>
    </li>
  );

  return (
    <div className="space-y-6">
      {/* Modern Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-700 via-slate-800 to-zinc-900 p-6 text-white shadow-xl">
        <div className="absolute inset-0 bg-grid-white/5 [mask-image:linear-gradient(0deg,transparent,rgba(255,255,255,0.3))]" />
        
        {/* Animated Background Elements */}
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-slate-500/20 blur-3xl animate-float-slow" />
        <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-zinc-500/20 blur-3xl animate-float-reverse" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-slate-400/10 blur-3xl animate-pulse-glow" />
        
        {/* Floating Particles */}
        <div className="absolute top-10 right-20 h-2 w-2 rounded-full bg-slate-300/40 animate-float animation-delay-100" />
        <div className="absolute top-20 right-40 h-1.5 w-1.5 rounded-full bg-zinc-300/40 animate-float animation-delay-300" />
        <div className="absolute bottom-16 left-32 h-2 w-2 rounded-full bg-slate-400/40 animate-float animation-delay-500" />
        <div className="absolute top-1/3 left-1/4 h-1 w-1 rounded-full bg-white/30 animate-sparkle animation-delay-200" />
        <div className="absolute bottom-1/3 right-1/4 h-1.5 w-1.5 rounded-full bg-slate-300/30 animate-sparkle animation-delay-700" />
        
        <div className="relative">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm">
                <Users className="h-7 w-7" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Öğrenci Yönetimi</h1>
                <p className="text-slate-400">Sınıflara öğrenci ekleyin veya çıkarın</p>
              </div>
            </div>
            
            {/* Hızlı İstatistikler */}
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2 rounded-lg bg-white/10 backdrop-blur-sm px-4 py-2">
                <Plus className="h-5 w-5 text-emerald-400" />
                <div>
                  <p className="text-xs text-slate-400">Sınıflar</p>
                  <p className="text-lg font-bold">{classes.length}</p>
                </div>
              </div>
              {selectedClass && (
                <div className="flex items-center gap-2 rounded-lg bg-white/10 backdrop-blur-sm px-4 py-2">
                  <Users className="h-5 w-5 text-blue-400" />
                  <div>
                    <p className="text-xs text-slate-400">Öğrenci</p>
                    <p className="text-lg font-bold">{classStudents.length}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Sınıf Öğrencileri */}
        <Card className="bg-white/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              Sınıf Öğrencileri
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select
              disabled={loadingFilters || classes.length === 0}
              value={selectedClass}
              onValueChange={(value) => {
                setSelectedClass(value);
                setSearchTerm("");
                setSelectedStatusView("tumu");
                const classText = classes.find(c => c.value === value)?.text || value;
                toast.info(`${classText} sınıfı seçildi`);
                loadClassStudents(value, true);
              }}
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder={loadingFilters ? "Yükleniyor..." : "Sınıf/Şube seçin"} />
              </SelectTrigger>
              <SelectContent>
                {classes.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.text}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex flex-wrap gap-2">
              {[
                { value: "tumu", label: "Tümü", icon: Layers3 },
                { value: "aktif_takip", label: "Aktif Takip", icon: Target },
                { value: "basvurular", label: "Başvurular", icon: CheckCircle2 }
              ].map((tab) => {
                const Icon = tab.icon;
                const active = selectedStatusView === tab.value;
                return (
                  <Button
                    key={tab.value}
                    type="button"
                    variant={active ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedStatusView(tab.value as typeof selectedStatusView)}
                    className={active ? "gap-2 bg-slate-900 text-white" : "gap-2"}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </Button>
                );
              })}
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Öğrenci ara..."
                  className="pl-9 h-10 bg-white"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Button variant="outline" onClick={handleResetFilters} className="h-10">
                Sıfırla
              </Button>
            </div>

            <div className="h-80 rounded-lg border border-slate-200/80 bg-white overflow-y-auto">
              {selectedClass ? (
                loadingStudents ? (
                  <div className="h-full flex items-center justify-center text-slate-400">
                    <RefreshCw className="h-5 w-5 animate-spin mr-2" />
                    Öğrenciler yükleniyor…
                  </div>
                ) : filteredStudents.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-400 px-4 text-center">
                    {searchTerm || selectedStatusView !== "tumu"
                      ? "Filtreye uygun öğrenci bulunamadı."
                      : "Bu sınıfa kayıtlı öğrenci bulunamadı."}
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {(selectedStatusView === "tumu"
                      ? tumuListesi
                      : selectedStatusView === "aktif_takip"
                      ? aktifTakipListesi
                      : basvurularListesi
                    ).map((student, idx) => renderStudentRow(student, idx))}
                  </ul>
                )
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 px-4 text-center">
                  <div className="text-center">
                    <Users className="h-12 w-12 mx-auto mb-2 opacity-30" />
                    <p>Önce bir sınıf/şube seçin</p>
                  </div>
                </div>
              )}
            </div>

            {studentError && (
              <p className="text-xs text-red-500">{studentError}</p>
            )}

            {selectedClass && classStudents.length > 0 && (
              <p className="text-xs text-slate-500 text-center">
                Toplam {filteredStudents.length} öğrenci
              </p>
            )}
          </CardContent>
        </Card>

        {/* Yeni Öğrenci Ekle */}
        <Card className="bg-white/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
              <Plus className="h-5 w-5 text-emerald-600" />
              Yeni Öğrenci Ekle
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-500">Ad Soyad</label>
              <Input
                placeholder="Öğrenci adı soyadı"
                className="h-10"
                value={newStudentName}
                onChange={(e) => setNewStudentName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-500">Öğrenci Numarası</label>
              <Input
                placeholder="Öğrenci numarası (örn. 75)"
                className="h-10"
                value={newStudentNumber}
                onChange={(e) => setNewStudentNumber(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-500">Sınıf / Şube</label>
              <Select
                disabled={loadingFilters || classes.length === 0}
                value={newStudentClass}
                onValueChange={setNewStudentClass}
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder={loadingFilters ? "Yükleniyor..." : "Sınıf/Şube seçin"} />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.text}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button 
                variant="outline" 
                onClick={handleClearForm}
                disabled={!newStudentName && !newStudentClass && !newStudentNumber}
              >
                Temizle
              </Button>
              <Button
                onClick={handleAddStudent}
                disabled={!newStudentName.trim() || !newStudentClass || !newStudentNumber.trim()}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Kaydet
              </Button>
            </div>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-xs text-blue-700 flex items-start gap-2">
                <Users className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>
                  Eklenen öğrenciler ana sayfadaki yönlendirme formundaki öğrenci listesinde de görünür.
                </span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
