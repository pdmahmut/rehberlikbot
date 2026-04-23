"use client";

import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import {
  Users,
  Plus,
  Trash2,
  RefreshCw,
  UserCheck,
  X,
  Search,
  BookOpen,
  ChevronDown,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface TeacherRecord {
  teacherId: string;
  teacherName: string;
  teacherNameNormalized: string;
  sinifSubeKey?: string;
  sinifSubeDisplay?: string;
}

interface Sinif {
  value: string;
  text: string;
}

type Tab = "ogretmenler" | "atamalar";
interface TeacherUser {
  id: string;
  teacher_name: string;
  class_key: string | null;
  class_display: string | null;
  password_hash: string | null;
  created_at: string;
}

type Tab = "ogretmenler" | "atamalar" | "hesaplar";

export default function OgretmenYonetimiPage() {
  const [tab, setTab] = useState<Tab>("ogretmenler");
  const [teachers, setTeachers] = useState<TeacherRecord[]>([]);
  const [users, setUsers] = useState<TeacherUser[]>([]);
  const [sinifList, setSinifList] = useState<Sinif[]>([]);
  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(true);

  // Öğretmen ekleme
  const [newName, setNewName] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  // Silme
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  // Atama modal
  const [assigningClass, setAssigningClass] = useState<Sinif | null>(null);
  const [teacherSearch, setTeacherSearch] = useState("");
  const [isSavingAssign, setIsSavingAssign] = useState(false);

  // Öğretmen listesi arama
  const [listSearch, setListSearch] = useState("");
  const [accountSearch, setAccountSearch] = useState("");
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountPassword, setNewAccountPassword] = useState("");
  const [addingAccount, setAddingAccount] = useState(false);
  const [changingPassId, setChangingPassId] = useState<string | null>(null);
  const [newPassValue, setNewPassValue] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [isSavingPass, setIsSavingPass] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [teachersRes, sinifRes] = await Promise.all([
        fetch("/api/teachers?all=1"),
        fetch("/api/data"),
      ]);
      const teachersData = await teachersRes.json();
      const sinifData = await sinifRes.json();
      setTeachers(teachersData.teachers || []);
      setSinifList(sinifData.sinifSubeList || []);
      loadUsers();
    } catch {
      toast.error("Veriler yüklenemedi");
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    setUsersLoading(true);
    try {
      const res = await fetch("/api/teacher-accounts");
      const data = await res.json();
      setUsers(data.users || []);
    } catch {
      toast.error("Kullanıcı hesapları yüklenemedi");
    } finally {
      setUsersLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newName.trim()) { toast.error("Ad boş olamaz"); return; }
    setIsAdding(true);
    try {
      const res = await fetch("/api/teachers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", teacherName: newName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Eklenemedi"); return; }
      setTeachers(prev => [...prev, data.teacher]);
      setNewName("");
      toast.success(`${data.teacher.teacherName} eklendi`);
    } catch {
      toast.error("Bağlantı hatası");
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemove = async (teacher: TeacherRecord) => {
    if (!confirm(`"${teacher.teacherName}" silinsin mi?`)) return;
    setDeletingId(teacher.teacherId);
    try {
      const res = await fetch("/api/teachers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove", teacherId: teacher.teacherId }),
      });
      if (!res.ok) { toast.error("Silinemedi"); return; }
      setTeachers(prev => prev.filter(t => t.teacherId !== teacher.teacherId));
      toast.success(`${teacher.teacherName} silindi`);
    } catch {
      toast.error("Bağlantı hatası");
    } finally {
      setDeletingId(null);
    }
  };

  const handleAssign = async (teacher: TeacherRecord) => {
    if (!assigningClass) return;
    setIsSavingAssign(true);
    try {
      const res = await fetch("/api/teachers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "assign_class",
          teacherId: teacher.teacherId,
          sinifSubeKey: assigningClass.value,
          sinifSubeDisplay: assigningClass.text,
        }),
      });
      if (!res.ok) { toast.error("Atama başarısız"); return; }
      setTeachers(prev => prev.map(t => {
        if (t.sinifSubeKey === assigningClass.value) return { ...t, sinifSubeKey: undefined, sinifSubeDisplay: undefined };
        if (t.teacherId === teacher.teacherId) return { ...t, sinifSubeKey: assigningClass.value, sinifSubeDisplay: assigningClass.text };
        return t;
      }));
      toast.success(`${assigningClass.text} → ${teacher.teacherName}`);
      setAssigningClass(null);
      setTeacherSearch("");
    } catch {
      toast.error("Bağlantı hatası");
    } finally {
      setIsSavingAssign(false);
    }
  };

  const handleRemoveAssignment = async (teacher: TeacherRecord) => {
    try {
      const res = await fetch("/api/teachers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove_class", teacherId: teacher.teacherId }),
      });
      if (!res.ok) { toast.error("Kaldırılamadı"); return; }
      setTeachers(prev => prev.map(t =>
        t.teacherId === teacher.teacherId ? { ...t, sinifSubeKey: undefined, sinifSubeDisplay: undefined } : t
      ));
      toast.success("Atama kaldırıldı");
    } catch {
      toast.error("Bağlantı hatası");
    }
  };

  const handleAddAccount = async () => {
    if (!newAccountName.trim() || !newAccountPassword.trim()) {
      toast.error("Ad ve şifre zorunlu");
      return;
    }
    setAddingAccount(true);
    try {
      const res = await fetch("/api/teacher-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacher_name: newAccountName.trim(),
          password: newAccountPassword.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Hesap eklenemedi");
      setUsers((prev) => [...prev, data.user]);
      setNewAccountName("");
      setNewAccountPassword("");
      toast.success("Öğretmen hesabı eklendi");
    } catch (err: any) {
      toast.error(err.message || "Hesap eklenemedi");
    } finally {
      setAddingAccount(false);
    }
  };

  const handleDeleteAccount = async (id: string) => {
    setDeletingUserId(id);
    try {
      const res = await fetch("/api/teacher-accounts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Hesap silinemedi");
      setUsers((prev) => prev.filter((u) => u.id !== id));
      toast.success("Öğretmen hesabı silindi");
    } catch (err: any) {
      toast.error(err.message || "Hesap silinemedi");
    } finally {
      setDeletingUserId(null);
    }
  };

  const handleChangePassword = async (id: string) => {
    if (!newPassValue.trim()) {
      toast.error("Yeni şifre boş olamaz");
      return;
    }
    setIsSavingPass(true);
    try {
      const res = await fetch("/api/teacher-accounts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, password: newPassValue.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Şifre güncellenemedi");
      setUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, password_hash: newPassValue.trim() } : u))
      );
      toast.success("Şifre güncellendi");
      setChangingPassId(null);
      setNewPassValue("");
    } catch (err: any) {
      toast.error(err.message || "Şifre güncellenemedi");
    } finally {
      setIsSavingPass(false);
    }
  };

  // Sınıf rehber öğretmenlerinin haritası: sinifSubeKey → teacher
  const assignmentMap = useMemo(() => {
    const map: Record<string, TeacherRecord> = {};
    for (const t of teachers) {
      if (t.sinifSubeKey) map[t.sinifSubeKey] = t;
    }
    return map;
  }, [teachers]);

  const filteredTeachers = useMemo(() =>
    teachers.filter(t => t.teacherName.toLowerCase().includes(listSearch.toLowerCase())),
    [teachers, listSearch]
  );

  const filteredTeachersForAssign = useMemo(() =>
    teachers.filter(t => t.teacherName.toLowerCase().includes(teacherSearch.toLowerCase())),
    [teachers, teacherSearch]
  );

  const assignedCount = teachers.filter(t => t.sinifSubeKey).length;
  const filteredUsers = useMemo(
    () =>
      users.filter(
        (u) =>
          u.teacher_name.toLowerCase().includes(accountSearch.toLowerCase())
      ),
    [users, accountSearch]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 p-6 text-white shadow-xl">
        <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-purple-300/20 blur-3xl" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm shadow-lg">
              <Users className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Öğretmen Yönetimi</h1>
              <p className="text-purple-200">Öğretmen ekleme, çıkarma ve sınıf rehber atamaları</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 border border-white/20">
              <Users className="h-4 w-4 text-purple-200" />
              <div>
                <p className="text-[10px] text-purple-200 uppercase tracking-wider">Öğretmen</p>
                <p className="text-lg font-bold leading-none">{teachers.length}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 border border-white/20">
              <UserCheck className="h-4 w-4 text-purple-200" />
              <div>
                <p className="text-[10px] text-purple-200 uppercase tracking-wider">Atanmış</p>
                <p className="text-lg font-bold leading-none">{assignedCount}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setTab("ogretmenler")}
          className={`px-5 py-2.5 text-sm font-medium rounded-t-lg transition-all ${
            tab === "ogretmenler"
              ? "bg-white border border-b-white border-slate-200 text-violet-700 -mb-px"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <span className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Öğretmenler
          </span>
        </button>
        <button
          onClick={() => setTab("atamalar")}
          className={`px-5 py-2.5 text-sm font-medium rounded-t-lg transition-all ${
            tab === "atamalar"
              ? "bg-white border border-b-white border-slate-200 text-violet-700 -mb-px"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <span className="flex items-center gap-2">
            <UserCheck className="h-4 w-4" />
            Sınıf Rehber Atamaları
          </span>
        </button>
        <button
          onClick={() => setTab("hesaplar")}
          className={`px-5 py-2.5 text-sm font-medium rounded-t-lg transition-all ${
            tab === "hesaplar"
              ? "bg-white border border-b-white border-slate-200 text-violet-700 -mb-px"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <span className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            Hesaplar
          </span>
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="h-6 w-6 animate-spin text-violet-500 mr-2" />
          <span className="text-slate-500">Yükleniyor...</span>
        </div>
      ) : (
        <>
          {/* ── TAB: ÖĞRETMENLER ── */}
          {tab === "ogretmenler" && (
            <div className="space-y-4">
              {/* Yeni öğretmen ekleme */}
              <Card className="border-0 shadow-md">
                <CardHeader className="pb-3 bg-gradient-to-r from-violet-50 to-purple-50 rounded-t-xl">
                  <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <Plus className="h-4 w-4 text-violet-600" />
                    Yeni Öğretmen Ekle
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Öğretmen adı soyadı..."
                      value={newName}
                      onChange={e => setNewName(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleAdd()}
                      className="flex-1"
                    />
                    <Button
                      onClick={handleAdd}
                      disabled={isAdding || !newName.trim()}
                      className="bg-violet-600 hover:bg-violet-700 text-white px-5"
                    >
                      {isAdding ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                      Ekle
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Öğretmen listesi */}
              <Card className="border-0 shadow-md">
                <CardHeader className="pb-3 border-b bg-gradient-to-r from-slate-50 to-slate-100 rounded-t-xl">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
                      <Users className="h-4 w-4 text-slate-500" />
                      Öğretmen Listesi
                      <Badge className="bg-violet-100 text-violet-700 border-0 ml-1">{filteredTeachers.length}</Badge>
                    </CardTitle>
                    <div className="relative w-52">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <Input
                        placeholder="Ara..."
                        className="pl-8 h-8 text-sm"
                        value={listSearch}
                        onChange={e => setListSearch(e.target.value)}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {filteredTeachers.length === 0 ? (
                    <div className="py-12 text-center text-slate-400">
                      <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">
                        {listSearch ? "Arama sonucu bulunamadı" : "Henüz öğretmen eklenmemiş"}
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                      {filteredTeachers.map(teacher => (
                        <div key={teacher.teacherId} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                              {teacher.teacherName.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-slate-800 text-sm truncate">{teacher.teacherName}</p>
                              {teacher.sinifSubeDisplay ? (
                                <Badge className="bg-emerald-100 text-emerald-700 border-0 text-[11px] mt-0.5">
                                  <BookOpen className="h-3 w-3 mr-1" />
                                  {teacher.sinifSubeDisplay}
                                </Badge>
                              ) : (
                                <span className="text-[11px] text-slate-400">Sınıf ataması yok</span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => handleRemove(teacher)}
                            disabled={deletingId === teacher.teacherId}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors ml-2 flex-shrink-0"
                            title="Öğretmeni sil"
                          >
                            {deletingId === teacher.teacherId
                              ? <RefreshCw className="h-4 w-4 animate-spin" />
                              : <Trash2 className="h-4 w-4" />}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* ── TAB: SINIF REHBER ATAMALARI ── */}
          {tab === "atamalar" && (
            <Card className="border-0 shadow-md">
              <CardHeader className="pb-3 border-b bg-gradient-to-r from-emerald-50 to-teal-50 rounded-t-xl">
                <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-emerald-600" />
                  Sınıf Rehber Öğretmeni Atamaları
                  <Badge className="bg-emerald-100 text-emerald-700 border-0 ml-1">
                    {assignedCount}/{sinifList.length} atandı
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {sinifList.length === 0 ? (
                  <div className="py-12 text-center text-slate-400">
                    <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Sınıf listesi yüklenemedi</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
                    {sinifList.map(sinif => {
                      const assigned = assignmentMap[sinif.value];
                      return (
                        <div key={sinif.value} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                              assigned
                                ? "bg-gradient-to-br from-emerald-500 to-teal-600"
                                : "bg-slate-200"
                            }`}>
                              <BookOpen className={`h-4 w-4 ${assigned ? "text-white" : "text-slate-400"}`} />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-slate-800 text-sm">{sinif.text}</p>
                              {assigned ? (
                                <p className="text-[11px] text-emerald-600 font-medium">{assigned.teacherName}</p>
                              ) : (
                                <p className="text-[11px] text-slate-400">Rehber öğretmen atanmamış</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                            {assigned && (
                              <button
                                onClick={() => handleRemoveAssignment(assigned)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                title="Atamayı kaldır"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => { setAssigningClass(sinif); setTeacherSearch(""); }}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-100 text-violet-700 hover:bg-violet-200 transition-colors"
                            >
                              {assigned ? "Değiştir" : "Ata"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {tab === "hesaplar" && (
            <div className="space-y-4">
              <Card className="border-0 shadow-md">
                <CardHeader className="pb-3 bg-gradient-to-r from-violet-50 to-purple-50 rounded-t-xl">
                  <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <Plus className="h-4 w-4 text-violet-600" />
                    Öğretmen Hesabı Ekle
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    <Input placeholder="Ad soyad" value={newAccountName} onChange={e => setNewAccountName(e.target.value)} />
                    <Input placeholder="Giriş şifresi (en az 4 karakter)" value={newAccountPassword} onChange={e => setNewAccountPassword(e.target.value)} />
                  </div>
                  <div className="mt-3 flex justify-end">
                    <Button onClick={handleAddAccount} disabled={addingAccount} className="bg-violet-600 hover:bg-violet-700 text-white">
                      {addingAccount ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                      Hesap Ekle
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-md">
                <CardHeader className="pb-3 border-b bg-gradient-to-r from-slate-50 to-slate-100 rounded-t-xl">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
                      <KeyRound className="h-4 w-4 text-slate-500" />
                      Kullanıcı Hesapları
                      <Badge className="bg-violet-100 text-violet-700 border-0 ml-1">{filteredUsers.length}</Badge>
                    </CardTitle>
                    <div className="relative w-52">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <Input placeholder="Ara..." className="pl-8 h-8 text-sm" value={accountSearch} onChange={e => setAccountSearch(e.target.value)} />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {usersLoading ? (
                    <div className="py-10 text-center text-slate-400">
                      <RefreshCw className="h-5 w-5 mx-auto mb-2 animate-spin" />
                      Yükleniyor...
                    </div>
                  ) : filteredUsers.length === 0 ? (
                    <div className="py-10 text-center text-slate-400">Kullanıcı hesabı bulunamadı</div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {filteredUsers.map((user) => (
                        <div key={user.id} className="px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-800 truncate">{user.teacher_name}</p>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => {
                                  setChangingPassId(changingPassId === user.id ? null : user.id);
                                  setNewPassValue("");
                                }}
                                className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                              >
                                <KeyRound className="h-3.5 w-3.5" /> Şifre
                              </button>
                              <button
                                onClick={() => handleDeleteAccount(user.id)}
                                disabled={deletingUserId === user.id}
                                className="rounded-lg border border-red-200 p-1.5 text-red-500 hover:bg-red-50 disabled:opacity-50"
                              >
                                {deletingUserId === user.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                              </button>
                            </div>
                          </div>
                          {changingPassId === user.id && (
                            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                              <div className="mb-2 flex items-center gap-2 text-xs text-slate-600">
                                <span>Mevcut şifre:</span>
                                <span className="font-mono font-semibold text-slate-800">
                                  {user.password_hash?.trim()
                                    ? user.password_hash.trim()
                                    : user.teacher_name.split(" ")[0].toLocaleLowerCase("tr-TR")}
                                </span>
                              </div>
                              <div className="flex flex-col gap-2 sm:flex-row">
                                <div className="relative flex-1">
                                  <Input
                                    type={showPass ? "text" : "password"}
                                    placeholder="Yeni şifre"
                                    value={newPassValue}
                                    onChange={e => setNewPassValue(e.target.value)}
                                    className="pr-10"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setShowPass(v => !v)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400"
                                  >
                                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                  </button>
                                </div>
                                <Button onClick={() => handleChangePassword(user.id)} disabled={isSavingPass} className="bg-violet-600 hover:bg-violet-700 text-white">
                                  {isSavingPass ? <Loader2 className="h-4 w-4 animate-spin" /> : "Kaydet"}
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}

      {/* Öğretmen Seçim Modal */}
      {assigningClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setAssigningClass(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-5 border-b bg-gradient-to-r from-violet-50 to-purple-50">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-slate-800">Rehber Öğretmen Seç</h3>
                  <p className="text-sm text-slate-500 mt-0.5">{assigningClass.text}</p>
                </div>
                <button onClick={() => setAssigningClass(null)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="relative mt-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Öğretmen ara..."
                  className="pl-9"
                  value={teacherSearch}
                  onChange={e => setTeacherSearch(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
              {filteredTeachersForAssign.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-sm">Öğretmen bulunamadı</div>
              ) : (
                filteredTeachersForAssign.map(teacher => (
                  <button
                    key={teacher.teacherId}
                    onClick={() => handleAssign(teacher)}
                    disabled={isSavingAssign}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-violet-50 transition-colors text-left"
                  >
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                      {teacher.teacherName.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{teacher.teacherName}</p>
                      {teacher.sinifSubeDisplay && (
                        <p className="text-[11px] text-amber-600">Şu an: {teacher.sinifSubeDisplay}</p>
                      )}
                    </div>
                    {teacher.sinifSubeKey === assigningClass.value && (
                      <Badge className="bg-emerald-100 text-emerald-700 border-0 text-[10px]">Mevcut</Badge>
                    )}
                  </button>
                ))
              )}
            </div>
            <div className="p-3 border-t bg-slate-50 text-center">
              <button onClick={() => setAssigningClass(null)} className="text-sm text-slate-500 hover:text-slate-700">
                İptal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
