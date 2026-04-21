"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Users, Search, RefreshCw, Loader2, GraduationCap,
  BookOpen, Plus, Trash2, X, Check, UserPlus,
  ArrowRightLeft, Clock, Send, CalendarCheck, CircleDashed,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface Student {
  value: string;
  text: string;
  isSupabase?: boolean;
  supabaseId?: string;
  isPendingDelete?: boolean;
  pendingRequestId?: string;
}

interface SinifSube { value: string; text: string; }

interface MyWorkRequest {
  id: string;
  message: string;
  status: string;
  plan_date: string | null;
  lesson_period: number | null;
  topic_title: string | null;
  guidance_plan_id: string | null;
  created_at: string;
  planStatus?: string; // guidance_plan'dan gelen gerçek durum
}

export default function SinifimPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [classKey, setClassKey] = useState<string | null>(null);
  const [classDisplay, setClassDisplay] = useState<string | null>(null);
  const [isHomeroom, setIsHomeroom] = useState(false);
  const [sinifList, setSinifList] = useState<SinifSube[]>([]);
  const [search, setSearch] = useState("");

  // Öğrenci ekleme
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newNumber, setNewNumber] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  // Silme isteği paneli
  const [showDeletePanel, setShowDeletePanel] = useState(false);
  const [deleteStudentValue, setDeleteStudentValue] = useState("");
  const [isSendingDelete, setIsSendingDelete] = useState(false);

  // Çalışma isteği
  const [showRequestPanel, setShowRequestPanel] = useState(false);
  const [requestMessage, setRequestMessage] = useState("");
  const [isSendingRequest, setIsSendingRequest] = useState(false);

  // Kendi isteklerim
  const [myRequests, setMyRequests] = useState<MyWorkRequest[]>([]);

  // Sınıf değiştirme paneli
  const [showChangePanel, setShowChangePanel] = useState(false);
  const [changeStudentValue, setChangeStudentValue] = useState("");
  const [newClassKey, setNewClassKey] = useState("");
  const [isChangingClass, setIsChangingClass] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.json())
      .then(d => {
        setIsHomeroom(d.isHomeroom || false);
        setClassKey(d.classKey || null);
        setClassDisplay(d.classDisplay || null);
        if (d.isHomeroom && d.classKey) {
          loadStudents(d.classKey);
          loadMyRequests(d.classKey);
        } else setIsLoading(false);
      })
      .catch(() => setIsLoading(false));

    fetch("/api/data")
      .then(r => r.json())
      .then(d => { if (d.sinifSubeList) setSinifList(d.sinifSubeList); })
      .catch(() => {});
  }, []);

  const loadMyRequests = async (key: string) => {
    try {
      const res = await fetch(`/api/work-requests?classKey=${encodeURIComponent(key)}`);
      const data = await res.json();
      const reqs: MyWorkRequest[] = data.requests ?? [];

      // Planlanmış olanların guidance_plan gerçek durumunu çek (takvimden tamamlanmış olabilir)
      const withPlanStatus = await Promise.all(reqs.map(async (r) => {
        if (r.guidance_plan_id) {
          const { data: plan } = await supabase
            .from('guidance_plans')
            .select('status')
            .eq('id', r.guidance_plan_id)
            .single();
          return { ...r, planStatus: plan?.status };
        }
        return r;
      }));

      setMyRequests(withPlanStatus);
    } catch {
      setMyRequests([]);
    }
  };

  useEffect(() => {
  }, []);

  const loadStudents = async (key: string) => {
    setIsLoading(true);
    try {
      const [studentsRes, excRes, pendingRes] = await Promise.all([
        fetch(`/api/students?sinifSube=${encodeURIComponent(key)}`),
        fetch(`/api/class-students?classKey=${encodeURIComponent(key)}&sinifDisi=true`),
        fetch(`/api/deletion-requests?classKey=${encodeURIComponent(key)}&status=bekliyor`),
      ]);

      const studentData: any[] = await studentsRes.json();
      const excData = await excRes.json();
      const pendingData = await pendingRes.json();

      // Onaylı silmelerde dışlanan öğrenci value'ları
      const excludedValues = new Set<string>(
        (excData.excluded ?? []).map((e: any) => e.student_name)
      );

      // Bekleyen istekler: value → request id
      const pendingMap = new Map<string, string>();
      for (const req of (pendingData.requests ?? [])) {
        pendingMap.set(req.student_value, req.id);
      }

      if (!Array.isArray(studentData)) { setStudents([]); return; }

      const enriched: Student[] = studentData
        .map(s => {
          const isSupabase = typeof s.value === "string" && s.value.startsWith("supabase_");
          return {
            ...s,
            isSupabase,
            supabaseId: isSupabase ? s.value.replace("supabase_", "") : undefined,
            isPendingDelete: pendingMap.has(s.value),
            pendingRequestId: pendingMap.get(s.value),
          };
        })
        .filter(s => !excludedValues.has(s.value));

      setStudents(enriched);
    } catch {
      toast.error("Öğrenci listesi yüklenemedi");
      setStudents([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newName.trim()) { toast.error("Öğrenci adı boş olamaz"); return; }
    if (!classKey) return;
    setIsAdding(true);
    try {
      const res = await fetch("/api/class-students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classKey,
          classDisplay: classDisplay || classKey,
          studentName: newName.trim(),
          studentNumber: newNumber.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`"${newName.trim()}" eklendi`);
      setNewName(""); setNewNumber(""); setShowAddForm(false);
      loadStudents(classKey);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsAdding(false);
    }
  };

  const handleRequestDelete = async () => {
    if (!deleteStudentValue) { toast.error("Lütfen bir öğrenci seçin"); return; }
    if (!classKey) return;

    const student = students.find(s => s.value === deleteStudentValue);
    if (!student) return;

    const parts = student.text.match(/^(\d+)\s+(.+)$/);
    const number = parts?.[1];
    const name = parts?.[2] || student.text;

    setIsSendingDelete(true);
    try {
      const res = await fetch("/api/deletion-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          class_key: classKey,
          class_display: classDisplay || classKey,
          student_name: name,
          student_number: number || null,
          student_value: student.value,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`"${name}" için silme isteği yöneticiye gönderildi`);
      setShowDeletePanel(false);
      setDeleteStudentValue("");
      loadStudents(classKey);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSendingDelete(false);
    }
  };

  const handleSendRequest = async () => {
    if (!requestMessage.trim()) { toast.error("Açıklama boş olamaz"); return; }
    setIsSendingRequest(true);
    try {
      const res = await fetch("/api/work-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: requestMessage.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Çalışma isteği yöneticiye gönderildi");
      setShowRequestPanel(false);
      setRequestMessage("");
      if (classKey) loadMyRequests(classKey);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSendingRequest(false);
    }
  };

  const handleCancelDelete = async (requestId: string, name: string) => {
    try {
      const res = await fetch(`/api/deletion-requests?id=${requestId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success(`"${name}" silme isteği iptal edildi`);
      if (classKey) loadStudents(classKey);
    } catch {
      toast.error("İstek iptal edilemedi");
    }
  };

  const handleChangeClass = async () => {
    if (!changeStudentValue) { toast.error("Lütfen bir öğrenci seçin"); return; }
    if (!newClassKey) { toast.error("Lütfen bir sınıf seçin"); return; }

    const student = students.find(s => s.value === changeStudentValue);
    if (!student) return;

    const parts = student.text.match(/^(\d+)\s+(.+)$/);
    const number = parts?.[1];
    const name = parts?.[2] || student.text;

    setIsChangingClass(true);
    try {
      const sinif = sinifList.find(s => s.value === newClassKey);
      let res: Response;

      if (student.isSupabase && student.supabaseId) {
        res = await fetch("/api/class-students", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: student.supabaseId,
            class_key: newClassKey,
            class_display: sinif?.text || newClassKey,
          }),
        });
      } else {
        res = await fetch("/api/class-students", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            classKey: newClassKey,
            classDisplay: sinif?.text || newClassKey,
            studentName: name,
            studentNumber: number || undefined,
          }),
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`"${name}" → ${sinif?.text || newClassKey} sınıfına taşındı`);
      setShowChangePanel(false);
      setChangeStudentValue("");
      setNewClassKey("");
      if (classKey) loadStudents(classKey);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsChangingClass(false);
    }
  };

  const filtered = students.filter(s =>
    s.text.toLowerCase().includes(search.toLowerCase())
  );

  if (!isHomeroom) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-3">
        <div className="p-4 bg-slate-100 rounded-full">
          <BookOpen className="h-8 w-8 text-slate-400" />
        </div>
        <p className="text-slate-500 text-sm">Bu sayfa yalnızca sınıf rehber öğretmenleri içindir.</p>
        <p className="text-slate-400 text-xs">Yönetici tarafından sınıf ataması yapılmamış.</p>
      </div>
    );
  }

  const pendingCount = students.filter(s => s.isPendingDelete).length;

  return (
    <div className="space-y-5">
      {/* Başlık */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-xl shadow">
            <Users className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Sınıfım</h1>
            <p className="text-xs text-slate-500">{classDisplay || classKey}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className="bg-teal-100 text-teal-700">{students.length} öğrenci</Badge>
          {pendingCount > 0 && (
            <Badge className="bg-amber-100 text-amber-700">
              <Clock className="h-3 w-3 mr-1" />
              {pendingCount} onay bekliyor
            </Badge>
          )}
          <Button variant="outline" size="sm"
            onClick={() => classKey && loadStudents(classKey)} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
            Yenile
          </Button>
          <Button size="sm" variant="outline"
            className={showRequestPanel ? 'border-blue-300 text-blue-600 bg-blue-50' : 'text-blue-600'}
            onClick={() => { setShowRequestPanel(v => !v); setShowAddForm(false); setShowChangePanel(false); setShowDeletePanel(false); setRequestMessage(""); }}>
            <Send className="h-4 w-4 mr-1.5" />
            Çalışma İste
          </Button>
          <Button size="sm" variant="outline"
            className={showDeletePanel ? 'border-red-300 text-red-600 bg-red-50' : 'text-red-500'}
            onClick={() => { setShowDeletePanel(v => !v); setShowAddForm(false); setShowChangePanel(false); setShowRequestPanel(false); setDeleteStudentValue(""); }}>
            <Trash2 className="h-4 w-4 mr-1.5" />
            Öğrenci Sil
          </Button>
          <Button size="sm" variant="outline"
            className={showChangePanel ? 'border-indigo-300 text-indigo-600 bg-indigo-50' : ''}
            onClick={() => { setShowChangePanel(v => !v); setShowAddForm(false); setShowDeletePanel(false); setShowRequestPanel(false); setChangeStudentValue(""); setNewClassKey(""); }}>
            <ArrowRightLeft className="h-4 w-4 mr-1.5" />
            Sınıf Değiştir
          </Button>
          <Button size="sm"
            className="bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white"
            onClick={() => { setShowAddForm(v => !v); setShowChangePanel(false); setShowDeletePanel(false); setShowRequestPanel(false); }}>
            <UserPlus className="h-4 w-4 mr-1.5" />
            Öğrenci Ekle
          </Button>
        </div>
      </div>

      {/* Öğrenci Ekleme Formu */}
      {showAddForm && (
        <Card className="border-teal-200 bg-teal-50/50">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm font-semibold text-teal-700 mb-3 flex items-center gap-2">
              <Plus className="h-4 w-4" /> Yeni Öğrenci Ekle
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 space-y-1">
                <Label className="text-xs text-slate-500">Ad Soyad *</Label>
                <Input placeholder="Ahmet Yılmaz" value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
                  autoFocus />
              </div>
              <div className="w-32 space-y-1">
                <Label className="text-xs text-slate-500">Okul No</Label>
                <Input placeholder="123" value={newNumber}
                  onChange={e => setNewNumber(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }} />
              </div>
              <div className="flex items-end gap-2">
                <Button onClick={handleAdd} disabled={isAdding}
                  className="bg-teal-600 hover:bg-teal-700 text-white">
                  {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
                  Ekle
                </Button>
                <Button variant="outline" onClick={() => { setShowAddForm(false); setNewName(""); setNewNumber(""); }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Çalışma İsteği Paneli */}
      {showRequestPanel && (
        <Card className="border-blue-200 bg-blue-50/40">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm font-semibold text-blue-700 mb-3 flex items-center gap-2">
              <Send className="h-4 w-4" /> Yöneticiye Çalışma İsteği Gönder
            </p>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">İstek / Açıklama</Label>
                <textarea
                  placeholder="Sınıfınız için ne tür bir çalışma istediğinizi açıklayın... (örn: akran zorbalığı farkındalık etkinliği, sınav kaygısı semineri)"
                  value={requestMessage}
                  onChange={e => setRequestMessage(e.target.value)}
                  rows={3}
                  autoFocus
                  className="w-full resize-none text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" className="h-9"
                  onClick={() => { setShowRequestPanel(false); setRequestMessage(""); }}>
                  <X className="h-4 w-4 mr-1" /> İptal
                </Button>
                <Button onClick={handleSendRequest} disabled={isSendingRequest}
                  className="bg-blue-600 hover:bg-blue-700 text-white h-9">
                  {isSendingRequest ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                  Gönder
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Öğrenci Sil Paneli */}
      {showDeletePanel && (
        <Card className="border-red-200 bg-red-50/40">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm font-semibold text-red-700 mb-3 flex items-center gap-2">
              <Trash2 className="h-4 w-4" /> Öğrenci Sil
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 space-y-1">
                <Label className="text-xs text-slate-500">Öğrenci</Label>
                <select
                  value={deleteStudentValue}
                  onChange={e => setDeleteStudentValue(e.target.value)}
                  className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                >
                  <option value="">— Öğrenci seçin —</option>
                  {students
                    .filter(s => !s.isPendingDelete)
                    .map(s => {
                      const parts = s.text.match(/^(\d+)\s+(.+)$/);
                      const label = parts?.[2] || s.text;
                      return <option key={s.value} value={s.value}>{label}</option>;
                    })}
                </select>
              </div>
              <div className="flex items-end gap-2">
                <Button onClick={handleRequestDelete} disabled={isSendingDelete}
                  className="bg-red-600 hover:bg-red-700 text-white h-9">
                  {isSendingDelete ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
                  İstek Gönder
                </Button>
                <Button variant="outline" className="h-9"
                  onClick={() => { setShowDeletePanel(false); setDeleteStudentValue(""); }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <p className="text-xs text-red-400 mt-2">
              Silme isteği yöneticiye gönderilir, onayladıktan sonra öğrenci listeden çıkar.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Sınıf Değiştirme Paneli */}
      {showChangePanel && (
        <Card className="border-indigo-200 bg-indigo-50/40">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm font-semibold text-indigo-700 mb-3 flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4" /> Sınıf Değiştir
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 space-y-1">
                <Label className="text-xs text-slate-500">Öğrenci</Label>
                <select
                  value={changeStudentValue}
                  onChange={e => setChangeStudentValue(e.target.value)}
                  className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">— Öğrenci seçin —</option>
                  {students.map(s => {
                    const parts = s.text.match(/^(\d+)\s+(.+)$/);
                    const label = parts?.[2] || s.text;
                    return <option key={s.value} value={s.value}>{label}</option>;
                  })}
                </select>
              </div>
              <div className="flex-1 space-y-1">
                <Label className="text-xs text-slate-500">Taşınacak Sınıf</Label>
                <select
                  value={newClassKey}
                  onChange={e => setNewClassKey(e.target.value)}
                  className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">— Sınıf seçin —</option>
                  {sinifList
                    .filter(sl => sl.value !== classKey)
                    .map(sl => (
                      <option key={sl.value} value={sl.value}>{sl.text}</option>
                    ))}
                </select>
              </div>
              <div className="flex items-end gap-2">
                <Button onClick={handleChangeClass} disabled={isChangingClass}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white h-9">
                  {isChangingClass ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
                  Taşı
                </Button>
                <Button variant="outline" className="h-9"
                  onClick={() => { setShowChangePanel(false); setChangeStudentValue(""); setNewClassKey(""); }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <p className="text-xs text-indigo-400 mt-2">Yönlendirme geçmişi korunur.</p>
          </CardContent>
        </Card>
      )}

      {/* Arama */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input placeholder="Öğrenci ara..." value={search}
          onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {/* Liste */}
      {isLoading ? (
        <Card>
          <CardContent className="py-12 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-teal-500" />
            <span className="ml-2 text-slate-500">Yükleniyor...</span>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <GraduationCap className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">
              {search ? "Arama sonucu bulunamadı." : "Sınıfta öğrenci kaydı bulunamadı."}
            </p>
            {!search && (
              <Button size="sm" variant="outline" className="mt-3" onClick={() => setShowAddForm(true)}>
                <Plus className="h-4 w-4 mr-1" /> İlk öğrenciyi ekle
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((s, i) => {
            const parts = s.text.match(/^(\d+)\s+(.+)$/);
            const name = parts?.[2] || s.text;
            const number = parts?.[1];
            const initial = name.charAt(0).toUpperCase();

            return (
              <div key={s.value}
                className={`rounded-xl border bg-white hover:shadow-sm transition-all ${
                  s.isPendingDelete ? 'border-amber-200 bg-amber-50/30' : 'border-slate-100'
                }`}>
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0 bg-gradient-to-br from-teal-400 to-emerald-500">
                    {initial}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 text-sm truncate">{name}</p>
                    <p className="text-xs text-slate-400">
                      {number ? `No: ${number}` : 'Numara yok'}
                    </p>
                  </div>

                  <span className="text-xs text-slate-300 font-medium shrink-0 hidden sm:block">#{i + 1}</span>

                  {s.isPendingDelete && (
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge className="bg-amber-100 text-amber-700 text-xs gap-1">
                        <Clock className="h-3 w-3" /> Onay Bekleniyor
                      </Badge>
                      <Button size="sm" variant="outline" className="h-8 text-xs text-slate-500"
                        onClick={() => handleCancelDelete(s.pendingRequestId!, name)}>
                        <X className="h-3.5 w-3.5 mr-1" /> İptal
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Çalışma İsteklerim */}
      {myRequests.length > 0 && (
        <div className="space-y-2 pt-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">
            Çalışma İsteklerim
          </p>
          {myRequests.map(req => {
            // guidance_plan tamamlandıysa takvimden gelir, work_request'i override eder
            const effectiveStatus = req.planStatus === 'completed'
              ? 'tamamlandi'
              : req.planStatus === 'planned' || req.status === 'planlandı'
              ? 'planlandı'
              : req.status;

            return (
              <div key={req.id}
                className={`rounded-xl border px-4 py-3 flex items-start gap-3 ${
                  effectiveStatus === 'tamamlandi'
                    ? 'border-emerald-200 bg-emerald-50/40'
                    : effectiveStatus === 'planlandı'
                    ? 'border-blue-200 bg-blue-50/40'
                    : 'border-slate-200 bg-white'
                }`}>
                <div className="mt-0.5 shrink-0">
                  {effectiveStatus === 'tamamlandi'
                    ? <CalendarCheck className="h-4 w-4 text-emerald-500" />
                    : effectiveStatus === 'planlandı'
                    ? <CalendarCheck className="h-4 w-4 text-blue-500" />
                    : <CircleDashed className="h-4 w-4 text-slate-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700 leading-snug">{req.message}</p>
                  <p className="text-xs mt-1 font-medium">
                    {effectiveStatus === 'tamamlandi' && (
                      <span className="text-emerald-600">✓ Tamamlandı</span>
                    )}
                    {effectiveStatus === 'planlandı' && (
                      <span className="text-blue-600">
                        Planlandı
                        {req.plan_date && ` — ${new Date(req.plan_date + 'T00:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' })}`}
                        {req.lesson_period && ` (${req.lesson_period}. ders)`}
                      </span>
                    )}
                    {effectiveStatus === 'bekliyor' && (
                      <span className="text-slate-400">Yönetici onayı bekleniyor</span>
                    )}
                  </p>
                </div>
                {/* Sadece bekliyor durumdaki istekler silinebilir */}
                {effectiveStatus === 'bekliyor' && (
                  <button
                    onClick={async () => {
                      if (!confirm('Bu çalışma isteğini iptal etmek istediğinize emin misiniz?')) return;
                      try {
                        const res = await fetch(`/api/work-requests?id=${req.id}`, { method: 'DELETE' });
                        if (!res.ok) throw new Error('Silinemedi');
                        if (classKey) loadMyRequests(classKey);
                      } catch {
                        toast.error('İstek silinemedi');
                      }
                    }}
                    className="shrink-0 p-1.5 rounded-lg text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors"
                    title="İsteği iptal et"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
