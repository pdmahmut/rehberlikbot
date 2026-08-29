"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

// Öğretmen yönetimi — tek ekran.
//
// Önceden üç sekme vardı (Öğretmenler / Sınıf Rehber Atamaları / Hesaplar) ve
// üçü de aynı listeyi gösteriyordu. Ayrıca "Hesaplar" sekmesindeki ekleme
// formu kadroda karşılığı olmayan sahipsiz hesaplar oluşturabiliyordu.
// Artık tek satırda öğretmen + sınıf + şifre birlikte yönetiliyor.

interface Teacher {
  teacherId: string;
  teacherName: string;
  sinifSubeKey?: string;
  sinifSubeDisplay?: string;
}

interface Account {
  id: string;
  teacher_name: string;
  password: string | null;
}

interface ClassOption {
  value: string;
  text: string;
}

export default function OgretmenYonetimiPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tRes, aRes, cRes] = await Promise.all([
        fetch("/api/teachers?all=1"),
        fetch("/api/teacher-accounts"),
        fetch("/api/data"),
      ]);
      const [tData, aData, cData] = await Promise.all([tRes.json(), aRes.json(), cRes.json()]);

      if (!tRes.ok) throw new Error(tData.error || "Öğretmenler alınamadı");

      setTeachers(tData.records || tData.teachers || []);
      setAccounts(aRes.ok ? aData.users || [] : []);
      setClasses(cRes.ok ? cData.sinifSubeList || [] : []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Liste alınamadı");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** Öğretmen adına göre giriş hesabını bulur. */
  const accountFor = useCallback(
    (name: string) => {
      const target = name.trim().toLocaleLowerCase("tr-TR");
      return accounts.find((a) => a.teacher_name.trim().toLocaleLowerCase("tr-TR") === target);
    },
    [accounts]
  );

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) {
      toast.error("Öğretmen adı gerekli");
      return;
    }
    setAdding(true);
    try {
      const res = await fetch("/api/teachers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", teacherName: name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Eklenemedi");

      toast.success(name + " eklendi, giriş hesabı oluşturuldu");
      setNewName("");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Eklenemedi");
    } finally {
      setAdding(false);
    }
  };

  const handleAssignClass = async (teacher: Teacher, classKey: string) => {
    setBusyId(teacher.teacherId);
    try {
      const body = classKey
        ? {
            action: "assign_class",
            teacherId: teacher.teacherId,
            teacherName: teacher.teacherName,
            sinifSubeKey: classKey,
            sinifSubeDisplay: classes.find((c) => c.value === classKey)?.text || classKey,
          }
        : { action: "remove_class", teacherId: teacher.teacherId, teacherName: teacher.teacherName };

      const res = await fetch("/api/teachers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Atama yapılamadı");

      toast.success(classKey ? "Sınıf atandı" : "Sınıf ataması kaldırıldı");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Atama yapılamadı");
    } finally {
      setBusyId(null);
    }
  };

  const handleNewPassword = async (teacher: Teacher) => {
    const account = accountFor(teacher.teacherName);
    if (!account) {
      toast.error("Bu öğretmenin giriş hesabı bulunamadı");
      return;
    }
    setBusyId(teacher.teacherId);
    try {
      const res = await fetch("/api/teacher-accounts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: account.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Şifre üretilemedi");

      toast.success("Yeni şifre: " + data.password);
      setVisiblePasswords((prev) => new Set(prev).add(account.id));
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Şifre üretilemedi");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (teacher: Teacher) => {
    if (!confirm(teacher.teacherName + " silinecek. Giriş hesabı da kapatılacak. Onaylıyor musunuz?")) {
      return;
    }
    setBusyId(teacher.teacherId);
    try {
      const res = await fetch("/api/teachers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove", teacherId: teacher.teacherId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Silinemedi");

      toast.success(teacher.teacherName + " silindi");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Silinemedi");
    } finally {
      setBusyId(null);
    }
  };

  const togglePassword = (id: string) => {
    setVisiblePasswords((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("tr-TR");
    if (!q) return teachers;
    return teachers.filter((t) => t.teacherName.toLocaleLowerCase("tr-TR").includes(q));
  }, [teachers, search]);

  const assignedCount = teachers.filter((t) => t.sinifSubeKey).length;
  const missingAccount = teachers.filter((t) => !accountFor(t.teacherName)).length;

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 p-6 text-white shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="rounded-xl bg-white/20 p-3">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Öğretmen Yönetimi</h1>
              <p className="text-sm text-white/80">
                Öğretmen ekleyin, sınıf rehberliği atayın, giriş şifrelerini yönetin
              </p>
            </div>
          </div>
          <div className="flex gap-4 text-center">
            <div className="rounded-xl bg-white/15 px-4 py-2">
              <div className="text-xl font-bold">{teachers.length}</div>
              <div className="text-xs text-white/80">öğretmen</div>
            </div>
            <div className="rounded-xl bg-white/15 px-4 py-2">
              <div className="text-xl font-bold">{assignedCount}</div>
              <div className="text-xs text-white/80">sınıf rehberi</div>
            </div>
          </div>
        </div>
      </div>

      {/* Ekleme */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              placeholder="Öğretmen adı soyadı"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              className="flex-1"
            />
            <Button onClick={handleAdd} disabled={adding || !newName.trim()}>
              {adding ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Ekleniyor...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" /> Ekle
                </>
              )}
            </Button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Eklediğinizde giriş hesabı ve şifre otomatik oluşturulur.
          </p>
        </CardContent>
      </Card>

      {missingAccount > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {missingAccount} öğretmenin giriş hesabı yok. Satırdaki anahtar simgesine basarak şifre
          oluşturabilirsiniz.
        </div>
      )}

      {/* Liste */}
      <Card>
        <CardContent className="p-0">
          <div className="flex items-center gap-2 border-b p-4">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Öğretmen ara..."
              className="flex-1 bg-transparent text-sm outline-none"
            />
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={"h-4 w-4 " + (loading ? "animate-spin" : "")} />
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 p-8 text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Yükleniyor...
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              {teachers.length === 0
                ? "Henüz öğretmen eklenmemiş. Yukarıdaki kutudan ekleyebilirsiniz."
                : "Aramayla eşleşen öğretmen yok."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="p-3 font-medium">Öğretmen</th>
                    <th className="p-3 font-medium">Rehberi olduğu sınıf</th>
                    <th className="p-3 font-medium">Giriş şifresi</th>
                    <th className="p-3 text-right font-medium">İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t) => {
                    const account = accountFor(t.teacherName);
                    const shown = account ? visiblePasswords.has(account.id) : false;
                    const busy = busyId === t.teacherId;

                    return (
                      <tr key={t.teacherId} className="border-t">
                        <td className="p-3 font-medium text-slate-800">{t.teacherName}</td>

                        <td className="p-3">
                          <select
                            value={t.sinifSubeKey || ""}
                            disabled={busy}
                            onChange={(e) => handleAssignClass(t, e.target.value)}
                            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm disabled:opacity-50"
                          >
                            <option value="">— atanmamış —</option>
                            {classes.map((c) => (
                              <option key={c.value} value={c.value}>
                                {c.text}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td className="p-3">
                          {account?.password ? (
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-slate-800">
                                {shown ? account.password : "••••••••"}
                              </span>
                              <button
                                type="button"
                                onClick={() => togglePassword(account.id)}
                                className="text-slate-400 hover:text-slate-600"
                                title={shown ? "Gizle" : "Göster"}
                              >
                                {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-400">hesap yok</span>
                          )}
                        </td>

                        <td className="p-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleNewPassword(t)}
                              disabled={busy || !account}
                              title="Yeni şifre üret"
                              className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                            >
                              <KeyRound className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(t)}
                              disabled={busy}
                              title="Öğretmeni ve hesabını sil"
                              className="rounded-lg border border-red-200 p-1.5 text-red-500 hover:bg-red-50 disabled:opacity-40"
                            >
                              {busy ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
