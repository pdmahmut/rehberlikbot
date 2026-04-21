"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  UserCog, Plus, Trash2, KeyRound, Eye, EyeOff,
  Loader2, RefreshCw, User, ShieldCheck, X, Check,
  BookOpen, ChevronDown, Clock, CheckCircle2, XCircle,
  Send, CircleCheck, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { normalizeLessonSlot } from "@/lib/lessonSlots";

function useBusySlots() {
  const [busySlots, setBusySlots] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  // Modalı açmadan önce sıfırla — eski slot verisinin gösterilmesini engeller
  const reset = useCallback(() => {
    setBusySlots(new Set());
    setLoading(true);
  }, []);

  const fetchBusySlots = useCallback(async (date: string): Promise<Set<string>> => {
    if (!date) {
      setBusySlots(new Set());
      setLoading(false);
      return new Set<string>();
    }
    setLoading(true);
    const allBusySlots = new Set<string>();

    try {
      // 1) Randevular (appointments API)
      const appointmentRes = await fetch(
        `/api/appointments?date=${date}`,
        { headers: { Accept: "application/json" } }
      ).catch(() => null);

      if (appointmentRes?.ok) {
        const json = await appointmentRes.json().catch(() => ({}));
        (json.appointments ?? []).forEach((apt: { status: string; start_time: string }) => {
          if (apt.status !== "cancelled") {
            const n = normalizeLessonSlot(apt.start_time);
            if (n) allBusySlots.add(n);
          }
        });
      }

      // 2) Sınıf rehberliği planları
      const plansRes = await supabase
        .from("guidance_plans")
        .select("lesson_period")
        .eq("plan_date", date)
        .in("status", ["planned", "completed"]);

      if (!plansRes.error && plansRes.data) {
        plansRes.data.forEach((plan: { lesson_period: number | null }) => {
          const n = normalizeLessonSlot(plan.lesson_period);
          if (n) allBusySlots.add(n);
        });
      }

      // 3) Sınıf etkinlikleri (tablo yoksa sessizce geç)
      try {
        const activitiesRes = await supabase
          .from("class_activities")
          .select("activity_time")
          .eq("activity_date", date);
        if (!activitiesRes.error && activitiesRes.data) {
          activitiesRes.data.forEach((a: { activity_time: string | null }) => {
            const n = normalizeLessonSlot(a.activity_time);
            if (n) allBusySlots.add(n);
          });
        }
      } catch { /* class_activities tablosu yoksa önemli değil */ }

    } catch (err) {
      console.error("useBusySlots fetchBusySlots hata:", err);
    }

    setBusySlots(allBusySlots);
    setLoading(false);
    return allBusySlots;
  }, []);

  return { busySlots, busyLoading: loading, fetchBusySlots, reset };
}

interface TeacherUser {
  id: string;
  username: string;
  teacher_name: string;
  class_key: string | null;
  class_display: string | null;
  created_at: string;
}

interface SinifSube { value: string; text: string; }

interface DeletionRequest {
  id: string;
  class_key: string;
  class_display: string;
  student_name: string;
  student_number: string | null;
  student_value: string;
  teacher_name: string;
  status: string;
  created_at: string;
}

export default function KullaniciYonetimiPage() {
  const [users, setUsers] = useState<TeacherUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sinifList, setSinifList] = useState<SinifSube[]>([]);

  // Yeni kullanıcı formu
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showNewPass, setShowNewPass] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  // Şifre değiştirme
  const [changingPassId, setChangingPassId] = useState<string | null>(null);
  const [newPassValue, setNewPassValue] = useState("");
  const [showChangePass, setShowChangePass] = useState(false);
  const [isSavingPass, setIsSavingPass] = useState(false);

  // Sınıf atama
  const [assigningClassId, setAssigningClassId] = useState<string | null>(null);
  const [selectedClassKey, setSelectedClassKey] = useState("");
  const [isSavingClass, setIsSavingClass] = useState(false);

  // Kullanıcı silme onayı
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Öğrenci silme istekleri
  const [delRequests, setDelRequests] = useState<DeletionRequest[]>([]);
  const [isLoadingReqs, setIsLoadingReqs] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Çalışma istekleri
  interface WorkRequest {
    id: string;
    class_key: string;
    class_display: string;
    teacher_name: string;
    message: string;
    status: string;
    plan_date: string | null;
    lesson_period: number | null;
    topic_title: string | null;
    guidance_plan_id: string | null;
    created_at: string;
  }
  const [workRequests, setWorkRequests] = useState<WorkRequest[]>([]); // bekliyor
  const [plannedWorkRequests, setPlannedWorkRequests] = useState<WorkRequest[]>([]); // planlandı
  const [completedWorkRequests, setCompletedWorkRequests] = useState<WorkRequest[]>([]); // tamamlandi
  const [isLoadingWork, setIsLoadingWork] = useState(true);
  const [isLoadingCompleted, setIsLoadingCompleted] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [processingWorkId, setProcessingWorkId] = useState<string | null>(null);

  // Planlama modalı
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [selectedWorkReq, setSelectedWorkReq] = useState<WorkRequest | null>(null);
  const [planTitle, setPlanTitle] = useState("");
  const [planDate, setPlanDate] = useState("");
  const [planPeriod, setPlanPeriod] = useState<number | null>(null);
  const [planTeacher, setPlanTeacher] = useState("");
  const [planConflictWarning, setPlanConflictWarning] = useState<string | null>(null);

  const { busySlots, busyLoading, fetchBusySlots, reset: resetBusySlots } = useBusySlots();

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/kullanici-yonetimi");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUsers(data.users);
    } catch (err: any) {
      toast.error("Kullanıcılar yüklenemedi: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSiniflar = async () => {
    try {
      const res = await fetch("/api/data");
      const data = await res.json();
      if (data.sinifSubeList) setSinifList(data.sinifSubeList);
    } catch {}
  };

  const loadRequests = async () => {
    setIsLoadingReqs(true);
    try {
      const res = await fetch("/api/deletion-requests?status=bekliyor");
      const data = await res.json();
      setDelRequests(data.requests ?? []);
    } catch {
      setDelRequests([]);
    } finally {
      setIsLoadingReqs(false);
    }
  };

  const loadWorkRequests = async () => {
    setIsLoadingWork(true);
    try {
      const [bekRes, planRes] = await Promise.all([
        fetch("/api/work-requests?status=bekliyor"),
        fetch("/api/work-requests?status=planlandı"),
      ]);
      const [bekData, planData] = await Promise.all([bekRes.json(), planRes.json()]);
      setWorkRequests(bekData.requests ?? []);
      setPlannedWorkRequests(planData.requests ?? []);
    } catch {
      setWorkRequests([]);
      setPlannedWorkRequests([]);
    } finally {
      setIsLoadingWork(false);
    }
  };

  const loadCompletedWorkRequests = async () => {
    setIsLoadingCompleted(true);
    try {
      const res = await fetch("/api/work-requests?status=tamamlandi");
      const data = await res.json();
      setCompletedWorkRequests(data.requests ?? []);
    } catch {
      setCompletedWorkRequests([]);
    } finally {
      setIsLoadingCompleted(false);
    }
  };

  const toggleCompleted = () => {
    if (!showCompleted) {
      loadCompletedWorkRequests();
    }
    setShowCompleted(v => !v);
  };

  useEffect(() => {
    loadUsers();
    loadSiniflar();
    loadRequests();
    loadWorkRequests();
  }, []);

  const handleAdd = async () => {
    if (!newName.trim() || !newUsername.trim() || !newPassword.trim()) {
      toast.error("Tüm alanları doldurun");
      return;
    }
    setIsAdding(true);
    try {
      const res = await fetch("/api/kullanici-yonetimi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacher_name: newName.trim(), username: newUsername.trim(), password: newPassword.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`"${newName}" kullanıcısı eklendi`);
      setNewName(""); setNewUsername(""); setNewPassword(""); setShowAddForm(false);
      loadUsers();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsAdding(false);
    }
  };

  const handleChangePassword = async (id: string) => {
    if (!newPassValue.trim()) { toast.error("Yeni şifre boş olamaz"); return; }
    setIsSavingPass(true);
    try {
      const res = await fetch("/api/kullanici-yonetimi", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, password: newPassValue.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Şifre güncellendi");
      setChangingPassId(null); setNewPassValue("");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSavingPass(false);
    }
  };

  const handleAssignClass = async (id: string) => {
    setIsSavingClass(true);
    try {
      const sinif = sinifList.find(s => s.value === selectedClassKey);
      const res = await fetch("/api/kullanici-yonetimi", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          action: "assign_class",
          class_key: selectedClassKey || null,
          class_display: sinif?.text || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(selectedClassKey ? `"${sinif?.text}" sınıfı atandı` : "Sınıf ataması kaldırıldı");
      setAssigningClassId(null);
      setSelectedClassKey("");
      loadUsers();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSavingClass(false);
    }
  };

  const handleRemoveClass = async (id: string) => {
    setIsSavingClass(true);
    try {
      const res = await fetch("/api/kullanici-yonetimi", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "assign_class", class_key: null, class_display: null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Sınıf ataması kaldırıldı");
      loadUsers();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSavingClass(false);
    }
  };

  const handleDelete = async (id: string) => {
    setIsDeleting(true);
    try {
      const res = await fetch("/api/kullanici-yonetimi", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Kullanıcı silindi");
      setDeletingId(null);
      loadUsers();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleProcessRequest = async (id: string, action: 'onayla' | 'reddet') => {
    setProcessingId(id);
    try {
      const res = await fetch("/api/deletion-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(action === 'onayla' ? "Öğrenci sınıftan çıkarıldı" : "İstek reddedildi");
      loadRequests();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setProcessingId(null);
    }
  };

  // Modal açık + tarih değişince busy slotları yeniden çek
  useEffect(() => {
    if (!showPlanModal || !planDate) return;
    let cancelled = false;
    fetchBusySlots(planDate).then(slots => {
      if (cancelled) return;
      // Tarih değiştiğinde seçili ders varsa çakışmayı güncelle
      setPlanConflictWarning(
        planPeriod && slots.has(String(planPeriod))
          ? "Bu tarihte bu ders saati zaten dolu!"
          : null
      );
    });
    return () => { cancelled = true; };
  // planPeriod kasıtlı olarak dep'e eklenmedi: tarih değişince re-fetch yapılsın,
  // sadece period değişince checkWorkConflict yeterli
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPlanModal, planDate, fetchBusySlots]);

  // Period seçilince sadece mevcut busySlots'a bak — ekstra fetch yapmadan
  const checkWorkConflict = useCallback((period: number | null) => {
    if (!period) { setPlanConflictWarning(null); return; }
    setPlanConflictWarning(
      busySlots.has(String(period))
        ? "Bu ders saati zaten dolu!"
        : null
    );
  }, [busySlots]);

  const openPlanModal = (req: WorkRequest) => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    resetBusySlots(); // eski slot verisini temizle, loading=true yap
    setSelectedWorkReq(req);
    setPlanTitle(req.message.split('\n')[0].slice(0, 80));
    setPlanDate(todayStr);
    setPlanPeriod(null);
    setPlanTeacher(req.teacher_name || "");
    setPlanConflictWarning(null);
    setShowPlanModal(true);
  };

  const closePlanModal = () => {
    setShowPlanModal(false);
    setSelectedWorkReq(null);
    setPlanTitle("");
    setPlanDate("");
    setPlanPeriod(null);
    setPlanTeacher("");
    setPlanConflictWarning(null);
  };

  const handlePlanWorkRequest = async (req: WorkRequest) => {
    if (!planTitle.trim() || !planDate) { toast.error("Konu başlığı ve tarih zorunlu"); return; }
    setProcessingWorkId(req.id);
    try {
      const res = await fetch("/api/work-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: req.id,
          action: 'planla',
          topic_title: planTitle.trim(),
          plan_date: planDate,
          lesson_period: planPeriod ?? null,
          class_key: req.class_key,
          class_display: req.class_display,
          teacher_name: planTeacher.trim() || req.teacher_name,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Planlandı ve öğretmene yansıtıldı");
      closePlanModal();
      loadWorkRequests();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setProcessingWorkId(null);
    }
  };

  const handleCompleteWorkRequest = async (id: string, guidancePlanId?: string | null) => {
    setProcessingWorkId(id);
    try {
      // work_request'i tamamlandı yap
      const res = await fetch("/api/work-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: 'tamamlandi' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      // Bağlı guidance_plan varsa onu da tamamla (takvimden de görsün)
      if (guidancePlanId && supabase) {
        await supabase.from('guidance_plans').update({ status: 'completed' }).eq('id', guidancePlanId);
      }
      toast.success("Tamamlandı olarak işaretlendi");
      loadWorkRequests();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setProcessingWorkId(null);
    }
  };

  const homeroomCount = users.filter(u => u.class_key).length;

  // Sınıf rehberlerini sınıfa göre sırala, sınıfsızları alfabeye göre
  const homeroomUsers = [...users.filter(u => u.class_key)]
    .sort((a, b) => (a.class_display || a.class_key || '').localeCompare(b.class_display || b.class_key || '', 'tr'));
  const regularUsers = [...users.filter(u => !u.class_key)]
    .sort((a, b) => a.teacher_name.localeCompare(b.teacher_name, 'tr'));

  const renderUserCard = (user: TeacherUser) => (
    <div key={user.id} className="rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:shadow-sm transition-all overflow-hidden">
      {/* Ana satır */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4">
        {/* Kullanıcı Bilgisi */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0 ${
            user.class_key
              ? 'bg-gradient-to-br from-teal-400 to-emerald-500'
              : 'bg-gradient-to-br from-violet-400 to-purple-500'
          }`}>
            {user.teacher_name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-slate-800 truncate">{user.teacher_name}</p>
            <p className="text-xs text-slate-500">@{user.username}</p>
          </div>
          {user.class_key ? (
            <Badge className="shrink-0 bg-teal-100 text-teal-700 text-xs gap-1">
              <BookOpen className="h-3 w-3" />
              {user.class_display || user.class_key}
            </Badge>
          ) : (
            <Badge className="shrink-0 bg-slate-100 text-slate-600 text-xs">Öğretmen</Badge>
          )}
        </div>

        {/* Aksiyonlar */}
        {changingPassId === user.id ? (
          <div className="flex items-center gap-2">
            <div className="relative">
              <Input type={showChangePass ? "text" : "password"} placeholder="Yeni şifre"
                value={newPassValue} onChange={(e) => setNewPassValue(e.target.value)}
                className="w-40 pr-8 h-9 text-sm" autoFocus />
              <button type="button" onClick={() => setShowChangePass(v => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400">
                {showChangePass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
            <Button size="sm" onClick={() => handleChangePassword(user.id)} disabled={isSavingPass}
              className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white">
              {isSavingPass ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            </Button>
            <Button size="sm" variant="outline" className="h-9"
              onClick={() => { setChangingPassId(null); setNewPassValue(""); }}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : deletingId === user.id ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-red-600 font-medium">Silinsin mi?</span>
            <Button size="sm" onClick={() => handleDelete(user.id)} disabled={isDeleting}
              className="h-9 bg-red-600 hover:bg-red-700 text-white">
              {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Evet, Sil"}
            </Button>
            <Button size="sm" variant="outline" className="h-9" onClick={() => setDeletingId(null)}>İptal</Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" variant="outline" className="h-9 text-xs"
              onClick={() => { setAssigningClassId(assigningClassId === user.id ? null : user.id); setSelectedClassKey(user.class_key || ""); }}>
              <BookOpen className="h-3.5 w-3.5 mr-1" />
              Sınıf Ata
              <ChevronDown className={`h-3 w-3 ml-1 transition-transform ${assigningClassId === user.id ? 'rotate-180' : ''}`} />
            </Button>
            <Button size="sm" variant="outline" className="h-9 text-xs"
              onClick={() => { setChangingPassId(user.id); setNewPassValue(""); setShowChangePass(false); }}>
              <KeyRound className="h-3.5 w-3.5 mr-1" /> Şifre
            </Button>
            <Button size="sm" variant="outline" className="h-9 text-xs text-red-600 hover:bg-red-50 hover:border-red-200"
              onClick={() => setDeletingId(user.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {/* Sınıf atama paneli */}
      {assigningClassId === user.id && (
        <div className="px-4 pb-4 pt-0 border-t border-slate-100 bg-white">
          <div className="flex items-center gap-3 mt-3">
            <div className="flex-1">
              <Label className="text-xs text-slate-500 mb-1 block">Sınıf Rehberi Olarak Ata</Label>
              <select
                value={selectedClassKey}
                onChange={(e) => setSelectedClassKey(e.target.value)}
                className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              >
                <option value="">— Sınıf seçin (atamayı kaldırmak için boş bırakın) —</option>
                {sinifList.map(s => (
                  <option key={s.value} value={s.value}>{s.text}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 mt-5">
              <Button size="sm" onClick={() => handleAssignClass(user.id)} disabled={isSavingClass}
                className="h-9 bg-teal-600 hover:bg-teal-700 text-white text-xs">
                {isSavingClass ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1" />}
                Kaydet
              </Button>
              <Button size="sm" variant="outline" className="h-9" onClick={() => setAssigningClassId(null)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          {user.class_key && (
            <p className="text-xs text-slate-400 mt-2">
              Şu anda: <span className="font-medium text-teal-600">{user.class_display}</span> sınıf rehberi
            </p>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg">
            <UserCog className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Kullanıcı Yönetimi</h1>
            <p className="text-sm text-slate-500">Öğretmen giriş hesaplarını ve sınıf atamalarını yönetin</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadUsers} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Yenile
          </Button>
          <Button size="sm" onClick={() => setShowAddForm(true)}
            className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white">
            <Plus className="h-4 w-4 mr-2" /> Yeni Kullanıcı
          </Button>
        </div>
      </div>

      {/* Özet istatistik */}
      {!isLoading && users.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl border border-slate-100 p-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-violet-600">{users.length}</p>
            <p className="text-xs text-slate-500 mt-0.5">Toplam Hesap</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-100 p-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-emerald-600">{homeroomCount}</p>
            <p className="text-xs text-slate-500 mt-0.5">Sınıf Rehberi</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-100 p-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-amber-600">{users.length - homeroomCount}</p>
            <p className="text-xs text-slate-500 mt-0.5">Normal Öğretmen</p>
          </div>
        </div>
      )}

      {/* Öğrenci Silme İstekleri */}
      {(isLoadingReqs || delRequests.length > 0) && (
        <Card className="border-amber-200 bg-amber-50/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-amber-700">
              <Clock className="h-4 w-4" />
              Öğrenci Çıkarma İstekleri
              {delRequests.length > 0 && (
                <Badge className="ml-1 bg-amber-500 text-white">{delRequests.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingReqs ? (
              <div className="flex items-center gap-2 py-4 justify-center">
                <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
                <span className="text-sm text-slate-500">Yükleniyor...</span>
              </div>
            ) : delRequests.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-2">Bekleyen istek yok.</p>
            ) : (
              <div className="space-y-3">
                {delRequests.map(req => (
                  <div key={req.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-xl bg-white border border-amber-100">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 text-sm">{req.student_name}</p>
                      <p className="text-xs text-slate-500">
                        {req.class_display || req.class_key} •{" "}
                        <span className="text-amber-600">İsteyen: {req.teacher_name}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button size="sm"
                        className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                        onClick={() => handleProcessRequest(req.id, 'onayla')}
                        disabled={processingId === req.id}>
                        {processingId === req.id
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <><CheckCircle2 className="h-3.5 w-3.5 mr-1" />Onayla</>}
                      </Button>
                      <Button size="sm" variant="outline"
                        className="h-8 text-xs text-red-500 hover:bg-red-50 hover:border-red-200"
                        onClick={() => handleProcessRequest(req.id, 'reddet')}
                        disabled={processingId === req.id}>
                        <XCircle className="h-3.5 w-3.5 mr-1" />Reddet
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Çalışma İstekleri */}
      {(isLoadingWork || workRequests.length > 0 || plannedWorkRequests.length > 0) && (
        <Card className="border-blue-200 bg-blue-50/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-blue-700">
              <Send className="h-4 w-4" />
              Çalışma İstekleri
              {workRequests.length > 0 && (
                <Badge className="ml-1 bg-blue-500 text-white">{workRequests.length} bekliyor</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoadingWork ? (
              <div className="flex items-center gap-2 py-4 justify-center">
                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                <span className="text-sm text-slate-500">Yükleniyor...</span>
              </div>
            ) : (
              <>
                {/* Bekleyen istekler */}
                {workRequests.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider">Bekleyen İstekler</p>
                    {workRequests.map(req => (
                      <div key={req.id} className="rounded-xl bg-white border border-blue-100 overflow-hidden">
                        <div className="flex items-start justify-between gap-3 p-3">
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-800 text-sm">
                              {req.class_display || req.class_key}
                              <span className="font-normal text-slate-500 ml-2">— {req.teacher_name}</span>
                            </p>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              {new Date(req.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                          <Button size="sm"
                            className="h-8 bg-blue-600 hover:bg-blue-700 text-white text-xs shrink-0"
                            onClick={() => openPlanModal(req)}
                            disabled={processingWorkId === req.id}>
                            {processingWorkId === req.id
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : <><Send className="h-3.5 w-3.5 mr-1" />Planla</>}
                          </Button>
                        </div>
                        <p className="text-sm text-slate-700 bg-blue-50 px-3 py-2 leading-relaxed mx-3 mb-3 rounded-lg">
                          {req.message}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {workRequests.length === 0 && plannedWorkRequests.length === 0 && (
                  <p className="text-sm text-slate-400 text-center py-2">Bekleyen çalışma isteği yok.</p>
                )}

                {/* Planlanmış (henüz tamamlanmamış) istekler */}
                {plannedWorkRequests.length > 0 && (
                  <div className="space-y-3">
                    {workRequests.length > 0 && <div className="border-t border-blue-100" />}
                    <p className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">Planlanan Çalışmalar</p>
                    {plannedWorkRequests.map(req => (
                      <div key={req.id} className="rounded-xl bg-white border border-emerald-100 overflow-hidden">
                        <div className="flex items-start justify-between gap-3 p-3">
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-slate-800 text-sm">
                              {req.class_display || req.class_key}
                              <span className="font-normal text-slate-500 ml-2">— {req.teacher_name}</span>
                            </p>
                            {req.topic_title && (
                              <p className="text-xs text-slate-600 mt-0.5 font-medium">{req.topic_title}</p>
                            )}
                            {req.plan_date && (
                              <p className="text-xs text-emerald-600 mt-0.5">
                                📅 {new Date(req.plan_date + 'T00:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' })}
                                {req.lesson_period && ` — ${req.lesson_period}. ders`}
                              </p>
                            )}
                          </div>
                          <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-100 text-blue-700 text-xs font-semibold">
                            <Clock className="h-3.5 w-3.5" />
                            Planlandı
                          </span>
                        </div>
                        <p className="text-sm text-slate-500 bg-slate-50 px-3 py-2 leading-relaxed mx-3 mb-3 rounded-lg text-[12px]">
                          {req.message}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tamamlanan Çalışmalar */}
      <Card className="border-emerald-200 bg-emerald-50/20">
        <CardHeader className="pb-3">
          <button
            className="flex items-center justify-between w-full text-left"
            onClick={toggleCompleted}
          >
            <CardTitle className="text-base flex items-center gap-2 text-emerald-700">
              <CircleCheck className="h-4 w-4" />
              Tamamlanan Çalışmalar
              {completedWorkRequests.length > 0 && showCompleted && (
                <Badge className="ml-1 bg-emerald-500 text-white">{completedWorkRequests.length}</Badge>
              )}
            </CardTitle>
            <ChevronDown className={`h-4 w-4 text-emerald-500 transition-transform ${showCompleted ? 'rotate-180' : ''}`} />
          </button>
        </CardHeader>
        {showCompleted && (
          <CardContent>
            {isLoadingCompleted ? (
              <div className="flex items-center gap-2 py-4 justify-center">
                <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
                <span className="text-sm text-slate-500">Yükleniyor...</span>
              </div>
            ) : completedWorkRequests.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-2">Tamamlanan çalışma yok.</p>
            ) : (
              <div className="space-y-3">
                {completedWorkRequests.map(req => (
                  <div key={req.id} className="rounded-xl bg-white border border-emerald-100 overflow-hidden">
                    <div className="flex items-start justify-between gap-3 p-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-800 text-sm">
                          {req.class_display || req.class_key}
                          <span className="font-normal text-slate-500 ml-2">— {req.teacher_name}</span>
                        </p>
                        {req.topic_title && (
                          <p className="text-xs text-slate-600 mt-0.5 font-medium">{req.topic_title}</p>
                        )}
                        {req.plan_date && (
                          <p className="text-xs text-emerald-600 mt-0.5">
                            📅 {new Date(req.plan_date + 'T00:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' })}
                            {req.lesson_period && ` — ${req.lesson_period}. ders`}
                          </p>
                        )}
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Gönderildi: {new Date(req.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}
                        </p>
                      </div>
                      <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-700 text-xs font-semibold">
                        <CircleCheck className="h-3.5 w-3.5" />
                        Tamamlandı
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 bg-slate-50 px-3 py-2 leading-relaxed mx-3 mb-3 rounded-lg text-[12px]">
                      {req.message}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Yeni Kullanıcı Formu */}
      {showAddForm && (
        <Card className="border-violet-200 bg-violet-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-violet-700">
              <Plus className="h-4 w-4" /> Yeni Öğretmen Hesabı
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label className="text-sm">Ad Soyad</Label>
                <Input placeholder="Ahmet Yılmaz" value={newName} onChange={(e) => setNewName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-sm">Kullanıcı Adı</Label>
                <Input placeholder="ahmet.yilmaz" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-sm">Şifre</Label>
                <div className="relative">
                  <Input type={showNewPass ? "text" : "password"} placeholder="••••••••"
                    value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="pr-10" />
                  <button type="button" onClick={() => setShowNewPass(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showNewPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => { setShowAddForm(false); setNewName(""); setNewUsername(""); setNewPassword(""); }}>
                <X className="h-4 w-4 mr-1" /> İptal
              </Button>
              <Button size="sm" onClick={handleAdd} disabled={isAdding} className="bg-violet-600 hover:bg-violet-700 text-white">
                {isAdding ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
                Kaydet
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Kullanıcı Listesi */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-violet-600" />
            Öğretmen Hesapları
            <Badge className="ml-auto bg-violet-100 text-violet-700">{users.length} hesap</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-12 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
              <span className="ml-2 text-slate-500">Yükleniyor...</span>
            </div>
          ) : users.length === 0 ? (
            <div className="py-12 text-center">
              <User className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">Henüz öğretmen hesabı eklenmemiş.</p>
              <Button size="sm" variant="outline" className="mt-3" onClick={() => setShowAddForm(true)}>
                <Plus className="h-4 w-4 mr-1" /> İlk hesabı ekle
              </Button>
            </div>
          ) : (
            <div className="space-y-1">
              {/* Sınıf rehberleri — sınıfa göre sıralı */}
              {homeroomUsers.length > 0 && (
                <>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-1 pt-1 pb-2">
                    Sınıf Rehber Öğretmenleri
                  </p>
                  <div className="space-y-2 mb-4">
                    {homeroomUsers.map(user => renderUserCard(user))}
                  </div>
                </>
              )}
              {/* Sınıfsız öğretmenler — alfabetik */}
              {regularUsers.length > 0 && (
                <>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-1 pt-1 pb-2">
                    Öğretmenler
                  </p>
                  <div className="space-y-2">
                    {regularUsers.map(user => renderUserCard(user))}
                  </div>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Planlama Modalı */}
      {showPlanModal && selectedWorkReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800">
                {selectedWorkReq.class_display || selectedWorkReq.class_key} — Plan Oluştur
              </h3>
              <button onClick={closePlanModal}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              {/* Konu Başlığı */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Konu Başlığı *</label>
                <input
                  type="text"
                  value={planTitle}
                  onChange={e => setPlanTitle(e.target.value)}
                  placeholder="Etkinlik / konu adı"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                />
              </div>

              {/* İstek metni */}
              <div className="bg-blue-50 rounded-xl px-4 py-3">
                <p className="text-xs text-blue-600 font-semibold mb-1">Öğretmen İsteği</p>
                <p className="text-sm text-slate-700 leading-relaxed">{selectedWorkReq.message}</p>
              </div>

              {/* Tarih */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Tarih *</label>
                <input
                  type="date"
                  value={planDate}
                  onChange={e => {
                    setPlanDate(e.target.value);
                    // tarih değişince useEffect fetch yapar, çakışma oradan güncellenir
                  }}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Ders Saati */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Ders Saati</label>
                <div className="grid grid-cols-7 gap-1.5">
                  {[1,2,3,4,5,6,7].map(p => (
                    <button
                      key={p}
                      disabled={busyLoading || busySlots.has(String(p))}
                      onClick={() => {
                        setPlanPeriod(p);
                        checkWorkConflict(p);
                      }}
                      className={`py-2 rounded-lg text-sm font-bold border-2 transition-all ${
                        busyLoading || busySlots.has(String(p))
                          ? 'bg-slate-100 border-slate-200 text-slate-400 opacity-60 cursor-not-allowed'
                          : planPeriod === p
                          ? 'bg-blue-500 border-blue-500 text-white'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300'
                      }`}
                    >
                      {p}{busySlots.has(String(p)) ? ' •' : ''}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-500">Dolu saatler pasif gösterilir ve seçilemez.</p>
              </div>

              {/* Öğretmen */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">
                  Öğretmen Adı <span className="text-slate-400 font-normal">(isteğe bağlı)</span>
                </label>
                <input
                  type="text"
                  value={planTeacher}
                  onChange={e => setPlanTeacher(e.target.value)}
                  placeholder={selectedWorkReq.teacher_name}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Çakışma uyarısı */}
              {planConflictWarning && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                  <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                  <span className="text-sm text-red-600 font-medium">{planConflictWarning}</span>
                </div>
              )}
            </div>

            <div className="flex gap-3 px-6 pb-6">
              <button
                onClick={closePlanModal}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                İptal
              </button>
              <button
                onClick={() => handlePlanWorkRequest(selectedWorkReq)}
                disabled={!planTitle.trim() || !planDate || !!planConflictWarning || processingWorkId === selectedWorkReq.id || busyLoading}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:from-blue-600 hover:to-indigo-700 transition-all"
              >
                {processingWorkId === selectedWorkReq.id ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

}
