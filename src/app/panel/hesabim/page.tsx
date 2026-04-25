"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Eye, EyeOff, KeyRound, Loader2, Plus, ArrowRightLeft,
  Trash2, X, Settings, ChevronDown, Search,
} from "lucide-react";

interface StudentOption { value: string; text: string; }
interface SinifOption { value: string; text: string; }
interface PendingRequest {
  id: string;
  student_name: string;
  request_type: "delete" | "class_change";
  new_class_display: string | null;
  status: "pending" | "approved" | "rejected";
}

export default function HesabimPage() {
  const [role, setRole] = useState<"admin" | "teacher" | null>(null);
  const [teacherName, setTeacherName] = useState<string>("");
  const [isHomeroom, setIsHomeroom] = useState(false);
  const [classKey, setClassKey] = useState<string | null>(null);
  const [classDisplay, setClassDisplay] = useState<string | null>(null);
  const [loadingRole, setLoadingRole] = useState(true);

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  const [showClassSettings, setShowClassSettings] = useState(false);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [siniflar, setSiniflar] = useState<SinifOption[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  const [newStudentName, setNewStudentName] = useState("");
  const [newStudentNumber, setNewStudentNumber] = useState("");
  const [addingStudent, setAddingStudent] = useState(false);

  const [requestModal, setRequestModal] = useState<{ student: StudentOption; type: "delete" | "class_change" } | null>(null);
  const [classChangeTarget, setClassChangeTarget] = useState("");
  const [requestSubmitting, setRequestSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        setRole(d.role === "admin" ? "admin" : "teacher");
        setTeacherName(d.teacherName || "");
        setIsHomeroom(d.isHomeroom || false);
        setClassKey(d.classKey || null);
        setClassDisplay(d.classDisplay || null);
      })
      .finally(() => setLoadingRole(false));
  }, []);

  useEffect(() => {
    if (!showClassSettings || !classKey) return;
    loadStudents();
    loadSiniflar();
    loadPendingRequests();
  }, [showClassSettings, classKey]);

  const loadStudents = async () => {
    if (!classKey) return;
    setStudentsLoading(true);
    try {
      const res = await fetch(`/api/students?sinifSube=${encodeURIComponent(classKey)}`);
      if (res.ok) {
        const data = await res.json();
        setStudents(Array.isArray(data) ? data.map((s: any) => ({ value: s.value || s.text, text: s.text })) : []);
      }
    } catch { /* */ }
    finally { setStudentsLoading(false); }
  };

  const loadSiniflar = async () => {
    try {
      const res = await fetch("/api/data");
      if (res.ok) {
        const data = await res.json();
        setSiniflar((data.sinifSubeList || []).filter((s: SinifOption) => s.value !== classKey));
      }
    } catch { /* */ }
  };

  const loadPendingRequests = async () => {
    try {
      const res = await fetch(`/api/class-student-requests?classKey=${encodeURIComponent(classKey!)}&status=pending`);
      if (res.ok) {
        const data = await res.json();
        setPendingRequests(data.requests || []);
      }
    } catch { /* */ }
  };

  const handleAddStudent = async () => {
    if (!newStudentName.trim() || !classKey) return;
    setAddingStudent(true);
    try {
      const res = await fetch("/api/class-students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classKey, classDisplay, studentName: newStudentName.trim(), studentNumber: newStudentNumber.trim() || null }),
      });
      if (!res.ok) throw new Error("Eklenemedi");
      toast.success(`${newStudentName.trim()} eklendi`);
      setNewStudentName("");
      setNewStudentNumber("");
      loadStudents();
    } catch { toast.error("Öğrenci eklenirken hata oluştu"); }
    finally { setAddingStudent(false); }
  };

  const handleSubmitRequest = async () => {
    if (!requestModal || !classKey) return;
    setRequestSubmitting(true);
    try {
      const selectedTargetClass = siniflar.find((s) => s.value === classChangeTarget);
      const res = await fetch("/api/class-student-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherName,
          classKey, classDisplay,
          studentName: requestModal.student.text,
          studentValue: requestModal.student.value,
          requestType: requestModal.type,
          newClassKey: requestModal.type === "class_change" ? classChangeTarget : null,
          newClassDisplay:
            requestModal.type === "class_change"
              ? selectedTargetClass?.text || null
              : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Talep gönderilemedi");
      toast.success(requestModal.type === "delete" ? "Silme talebi gönderildi" : "Sınıf değişikliği talebi gönderildi");
      setRequestModal(null);
      setClassChangeTarget("");
      loadPendingRequests();
    } catch (err: any) { toast.error(err.message || "Talep gönderilirken hata oluştu"); }
    finally { setRequestSubmitting(false); }
  };

  const getStudentPendingRequest = (name: string) => pendingRequests.find((r) => r.student_name === name);

  const handleChangePassword = async () => {
    if (!oldPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) { toast.error("Tüm alanları doldurun"); return; }
    if (newPassword.trim().length < 4) { toast.error("Yeni şifre en az 4 karakter olmalı"); return; }
    if (newPassword !== confirmPassword) { toast.error("Yeni şifre ve tekrarı eşleşmiyor"); return; }
    setSaving(true);
    try {
      const endpoint = role === "admin" ? "/api/auth/change-admin-password" : "/api/auth/change-password";
      const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ oldPassword: oldPassword.trim(), newPassword: newPassword.trim() }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Şifre güncellenemedi");
      toast.success("Şifreniz güncellendi");
      setOldPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (err: any) { toast.error(err.message || "Şifre güncellenemedi"); }
    finally { setSaving(false); }
  };

  const filteredStudents = students.filter((s) => !searchTerm.trim() || s.text.toLowerCase().includes(searchTerm.toLowerCase()));

  if (loadingRole) return <div className="mx-auto max-w-xl flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-violet-500" /></div>;

  return (
    <div className="mx-auto max-w-xl space-y-5">
      {/* Şifre Değiştir */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="border-b bg-slate-50 rounded-t-xl py-3">
          <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-violet-600" />
            Şifre Değiştir
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          <div className="space-y-1.5">
            <Label className="text-xs">Mevcut Şifre</Label>
            <div className="relative">
              <Input type={showOldPassword ? "text" : "password"} value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} placeholder="Mevcut şifreniz" />
              <button type="button" onClick={() => setShowOldPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">{showOldPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Yeni Şifre</Label>
            <div className="relative">
              <Input type={showNewPassword ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="En az 4 karakter" />
              <button type="button" onClick={() => setShowNewPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">{showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Yeni Şifre (Tekrar)</Label>
            <div className="relative">
              <Input type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Yeni şifreyi tekrar yazın" />
              <button type="button" onClick={() => setShowConfirmPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">{showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
            </div>
          </div>
          <Button onClick={handleChangePassword} disabled={saving} className="w-full bg-violet-600 hover:bg-violet-700 text-white">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Şifreyi Güncelle
          </Button>
        </CardContent>
      </Card>

      {/* Sınıf Ayarları — sadece sınıf rehber öğretmenine */}
      {isHomeroom && classKey && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="border-b bg-slate-50 rounded-t-xl py-3 cursor-pointer" onClick={() => setShowClassSettings(!showClassSettings)}>
            <CardTitle className="text-sm font-semibold text-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-teal-600" />
                Sınıf Ayarları
                {classDisplay && <span className="rounded bg-teal-100 px-1.5 py-0.5 text-[10px] font-semibold text-teal-700">{classDisplay}</span>}
              </div>
              <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${showClassSettings ? "rotate-180" : ""}`} />
            </CardTitle>
          </CardHeader>
          {showClassSettings && (
            <CardContent className="space-y-4 pt-4">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Öğrenci Ekle</p>
                <div className="flex gap-2">
                  <Input placeholder="Ad soyad" value={newStudentName} onChange={(e) => setNewStudentName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAddStudent()} className="flex-1" />
                  <Input placeholder="No" value={newStudentNumber} onChange={(e) => setNewStudentNumber(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAddStudent()} className="w-16" />
                  <Button onClick={handleAddStudent} disabled={!newStudentName.trim() || addingStudent} size="sm" className="bg-teal-600 hover:bg-teal-700 text-white px-3">
                    {addingStudent ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Öğrenci İşlemleri</p>
                  <span className="text-[10px] text-slate-400">{filteredStudents.length} öğrenci</span>
                </div>
                <div className="relative mb-2">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <Input placeholder="Ara..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-8 h-8 text-sm" />
                </div>
                {studentsLoading ? (
                  <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-teal-500" /></div>
                ) : (
                  <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 rounded-lg border border-slate-200">
                    {filteredStudents.map((s) => {
                      const pending = getStudentPendingRequest(s.text);
                      return (
                        <div key={s.value} className="flex items-center justify-between px-3 py-2 text-sm">
                          <span className="truncate text-slate-700">{s.text}</span>
                          <div className="flex items-center gap-1 shrink-0">
                            {pending ? (
                              <Badge className="text-[10px] bg-amber-100 text-amber-700 border-0">
                                {pending.request_type === "delete" ? "Silme" : "Değişiklik"} bekliyor
                              </Badge>
                            ) : (
                              <>
                                <button onClick={() => { setRequestModal({ student: s, type: "class_change" }); setClassChangeTarget(""); }} className="p-1 text-blue-500 hover:bg-blue-50 rounded transition-colors" title="Sınıf değiştir">
                                  <ArrowRightLeft className="h-3.5 w-3.5" />
                                </button>
                                <button onClick={() => setRequestModal({ student: s, type: "delete" })} className="p-1 text-red-400 hover:bg-red-50 rounded transition-colors" title="Listeden çıkar">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Talep Modalı */}
      {requestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setRequestModal(null)} />
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-800">
                {requestModal.type === "delete" ? "Listeden Çıkarma Talebi" : "Sınıf Değişikliği Talebi"}
              </h3>
              <button onClick={() => setRequestModal(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>
            <p className="text-sm text-slate-600 mb-3">
              <span className="font-semibold">{requestModal.student.text}</span>
              {requestModal.type === "delete" ? " öğrencisini listeden çıkarmak istediğinize emin misiniz? Bu talep yöneticiye iletilecektir." : " öğrencisi için sınıf değişikliği talebinde bulunuyorsunuz."}
            </p>
            {requestModal.type === "class_change" && (
              <div className="mb-4">
                <Label className="text-xs mb-1.5 block">Hedef Sınıf</Label>
                <select value={classChangeTarget} onChange={(e) => setClassChangeTarget(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30">
                  <option value="">Sınıf seçin...</option>
                  {siniflar.map((s) => <option key={s.value} value={s.value}>{s.text}</option>)}
                </select>
              </div>
            )}
            <div className="flex gap-2">
              <Button onClick={handleSubmitRequest} disabled={requestSubmitting || (requestModal.type === "class_change" && !classChangeTarget)} className="flex-1 bg-teal-600 hover:bg-teal-700 text-white">
                {requestSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Talebi Gönder
              </Button>
              <Button variant="outline" onClick={() => setRequestModal(null)} className="px-4">İptal</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
