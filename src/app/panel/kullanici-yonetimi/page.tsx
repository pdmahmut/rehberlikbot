"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Users, Plus, Trash2, KeyRound, Eye, EyeOff,
  Loader2, RefreshCw, BookOpen, ChevronDown, X, Check
} from "lucide-react";

interface TeacherUser {
  id: string;
  username: string;
  teacher_name: string;
  class_key: string | null;
  class_display: string | null;
  password_hash: string | null;
  created_at: string;
}

interface Sinif {
  value: string;
  text: string;
}

export default function KullaniciYonetimiPage() {
  const [users, setUsers] = useState<TeacherUser[]>([]);
  const [sinifList, setSinifList] = useState<Sinif[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Yeni kullanıcı
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  // Şifre değiştirme
  const [changingPassId, setChangingPassId] = useState<string | null>(null);
  const [newPassValue, setNewPassValue] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [isSavingPass, setIsSavingPass] = useState(false);

  // Sınıf atama
  const [assigningClassId, setAssigningClassId] = useState<string | null>(null);
  const [selectedClassKey, setSelectedClassKey] = useState("");
  const [isSavingClass, setIsSavingClass] = useState(false);

  // Silme
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadUsers();
    loadSiniflar();
  }, []);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/kullanici-yonetimi");
      const data = await res.json();
      setUsers(data.users || []);
    } catch {
      toast.error("Kullanıcılar yüklenemedi");
    } finally {
      setIsLoading(false);
    }
  };

  const loadSiniflar = async () => {
    try {
      const res = await fetch("/api/data");
      const data = await res.json();
      setSinifList(data.sinifSubeList || []);
    } catch {}
  };

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
      toast.success(`"${newName}" eklendi`);
      setNewName(""); setNewUsername(""); setNewPassword(""); setShowAddForm(false);
      loadUsers();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsAdding(false);
    }
  };

  const handleChangePassword = async (id: string) => {
    if (!newPassValue.trim()) { toast.error("Şifre boş olamaz"); return; }
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
      toast.success(selectedClassKey ? `"${sinif?.text}" atandı` : "Sınıf ataması kaldırıldı");
      setAssigningClassId(null); setSelectedClassKey("");
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

  const homeroomCount = users.filter(u => u.class_key).length;

  // Sinif numarasina gore sirala (5A, 5B...), atamasizlar sona
  const sortedUsers = [...users].sort((a, b) => {
    if (a.class_display && b.class_display) {
      return a.class_display.localeCompare(b.class_display, 'tr', { numeric: true });
    }
    if (a.class_display) return -1;
    if (b.class_display) return 1;
    return a.teacher_name.localeCompare(b.teacher_name, 'tr');
  });

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 p-6 text-white shadow-xl">
        <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2.5 rounded-xl bg-white/20 backdrop-blur">
                <Users className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold">Kullanıcı Yönetimi</h1>
            </div>
            <p className="text-white/70 text-sm">Öğretmen hesaplarını yönetin</p>
          </div>
          <div className="flex gap-2">
            <button onClick={loadUsers} className="p-2.5 rounded-xl bg-white/20 hover:bg-white/30 transition-colors">
              <RefreshCw className="h-5 w-5" />
            </button>
            <button onClick={() => setShowAddForm(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-violet-700 font-semibold text-sm hover:bg-white/90 transition-colors">
              <Plus className="h-4 w-4" /> Öğretmen Ekle
            </button>
          </div>
        </div>
        {/* İstatistikler */}
        <div className="relative mt-4 grid grid-cols-3 gap-3">
          {[
            { label: "Toplam", value: users.length },
            { label: "Sınıf Rehberi", value: homeroomCount },
            { label: "Atamasız", value: users.length - homeroomCount },
          ].map(s => (
            <div key={s.label} className="bg-white/10 backdrop-blur rounded-xl p-3 text-center">
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs text-white/60">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Yeni kullanıcı formu */}
      {showAddForm && (
        <div className="bg-white rounded-2xl border border-violet-200 shadow-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">Yeni Öğretmen Ekle</h2>
            <button onClick={() => setShowAddForm(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Ad Soyad</label>
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ahmet Yilmaz"
                className="w-full h-9 px-3 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Kullanıcı Adı</label>
              <input value={newUsername} onChange={e => setNewUsername(e.target.value)} placeholder="ahmet.yilmaz"
                className="w-full h-9 px-3 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Şifre</label>
              <input value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Şifre"
                className="w-full h-9 px-3 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowAddForm(false)} className="px-4 py-2 text-sm rounded-lg border border-slate-200 hover:bg-slate-50">İptal</button>
            <button onClick={handleAdd} disabled={isAdding}
              className="px-4 py-2 text-sm rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-medium disabled:opacity-50 flex items-center gap-2">
              {isAdding && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Ekle
            </button>
          </div>
        </div>
      )}

      {/* Kullanıcı listesi */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Henüz kullanıcı yok</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sortedUsers.map(user => (
            <div key={user.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="flex items-center gap-4 p-4">
                {/* Avatar */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ${
                  user.class_key ? "bg-gradient-to-br from-teal-500 to-emerald-600" : "bg-gradient-to-br from-violet-500 to-purple-600"
                }`}>
                  {user.teacher_name.charAt(0).toUpperCase()}
                </div>

                {/* Bilgi */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 text-sm">{user.teacher_name}</p>
                  <p className="text-xs text-slate-400">@{user.username}</p>
                </div>

                {/* Sınıf badge */}
                <div className="hidden sm:block">
                  {user.class_key ? (
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-teal-100 text-teal-700">
                      {user.class_display}
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
                      Atamasız
                    </span>
                  )}
                </div>

                {/* Aksiyonlar */}
                {deletingId === user.id ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-red-600">Emin misiniz?</span>
                    <button onClick={() => handleDelete(user.id)} disabled={isDeleting}
                      className="px-3 py-1.5 text-xs rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-50">
                      {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : "Sil"}
                    </button>
                    <button onClick={() => setDeletingId(null)} className="px-3 py-1.5 text-xs rounded-lg border hover:bg-slate-50">İptal</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => { setAssigningClassId(assigningClassId === user.id ? null : user.id); setSelectedClassKey(user.class_key || ""); }}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600">
                      <BookOpen className="h-3.5 w-3.5" /> Sınıf
                      <ChevronDown className={`h-3 w-3 transition-transform ${assigningClassId === user.id ? "rotate-180" : ""}`} />
                    </button>
                    <button
                      onClick={() => { setChangingPassId(changingPassId === user.id ? null : user.id); setNewPassValue(""); }}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600">
                      <KeyRound className="h-3.5 w-3.5" /> Şifre
                    </button>
                    <button onClick={() => setDeletingId(user.id)}
                      className="p-1.5 rounded-lg border border-red-200 hover:bg-red-50 text-red-500">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Sınıf atama paneli */}
              {assigningClassId === user.id && (
                <div className="px-4 pb-4 pt-0 border-t border-slate-100 bg-slate-50">
                  <div className="flex items-end gap-3 mt-3">
                    <div className="flex-1">
                      <label className="text-xs text-slate-500 mb-1 block">Sınıf Ata</label>
                      <select value={selectedClassKey} onChange={e => setSelectedClassKey(e.target.value)}
                        className="w-full h-9 px-3 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500">
                        <option value="">— Atamayı kaldır —</option>
                        {sinifList.map(s => (
                          <option key={s.value} value={s.value}>{s.text}</option>
                        ))}
                      </select>
                    </div>
                    <button onClick={() => handleAssignClass(user.id)} disabled={isSavingClass}
                      className="h-9 px-4 text-sm rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-medium disabled:opacity-50 flex items-center gap-1.5">
                      {isSavingClass ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Kaydet
                    </button>
                    <button onClick={() => setAssigningClassId(null)} className="h-9 px-3 text-sm rounded-lg border hover:bg-white">
                      İptal
                    </button>
                  </div>
                </div>
              )}

              {/* Şifre değiştirme paneli */}
              {changingPassId === user.id && (
                <div className="px-4 pb-4 pt-0 border-t border-slate-100 bg-slate-50">
                  {/* Mevcut şifre göster */}
                  <div className="mt-3 mb-3 flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                    <KeyRound className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                    <span className="text-xs text-amber-700">Mevcut şifre:</span>
                    <span className="text-xs font-mono font-semibold text-amber-800">
                      {user.password_hash && user.password_hash.trim() !== ''
                        ? user.password_hash.trim()
                        : user.teacher_name.split(' ')[0].toLocaleLowerCase('tr-TR')}
                    </span>
                  </div>
                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <label className="text-xs text-slate-500 mb-1 block">Yeni Şifre</label>
                      <div className="relative">
                        <input
                          type={showPass ? "text" : "password"}
                          value={newPassValue}
                          onChange={e => setNewPassValue(e.target.value)}
                          placeholder="Yeni şifre"
                          className="w-full h-9 px-3 pr-9 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                        />
                        <button type="button" onClick={() => setShowPass(v => !v)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                          {showPass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>
                    <button onClick={() => handleChangePassword(user.id)} disabled={isSavingPass}
                      className="h-9 px-4 text-sm rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-medium disabled:opacity-50 flex items-center gap-1.5">
                      {isSavingPass ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Kaydet
                    </button>
                    <button onClick={() => setChangingPassId(null)} className="h-9 px-3 text-sm rounded-lg border hover:bg-white">
                      İptal
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
