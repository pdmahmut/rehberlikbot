"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CalendarPlus,
  Eye,
  Loader2,
  RefreshCw,
  Search,
  UserMinus,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { YONLENDIRME_NEDENLERI } from "@/types";

// Takipteki öğrenciler.
//
// Takip işareti öğrencinin kendisinde durur, tek tek görüşmelerde değil.
// Böylece öğrenciye yeni bir başvuru geldiğinde takip bozulmaz; öğrenci
// listede kalmaya devam eder ve yeni başvuru onun altında görünür.

interface FollowUpStudent {
  id: string;
  studentName: string;
  studentNumber: string | null;
  classKey: string;
  classDisplay: string;
  reason: string | null;
  note: string | null;
  since: string | null;
  lastMeeting: string | null;
  nextAppointment: string | null;
  meetingCount: number;
  openApplications: number;
}

const formatDate = (value: string | null) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });
};

/** Son görüşmeden bu yana geçen gün sayısı. */
const daysSince = (value: string | null) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
};

export default function TakibimdekilerPage() {
  const [students, setStudents] = useState<FollowUpStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/follow-up");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Liste alınamadı");
      setStudents(data.students || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Liste alınamadı");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleRemove = async (student: FollowUpStudent) => {
    if (!confirm(`${student.studentName} takipten çıkarılacak. Geçmiş görüşme kayıtları silinmez. Onaylıyor musunuz?`)) {
      return;
    }
    setBusyId(student.id);
    try {
      const res = await fetch(`/api/follow-up?studentId=${encodeURIComponent(student.id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Çıkarılamadı");
      toast.success(`${student.studentName} takipten çıkarıldı`);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Çıkarılamadı");
    } finally {
      setBusyId(null);
    }
  };

  // Takip sebebini gunceller. Hazir kategoriler kullanildigi icin ileride
  // "kac ogrenci hangi sebeple takipte" gibi bir dokum alinabilir.
  const handleReasonChange = async (student: FollowUpStudent, reason: string) => {
    setBusyId(student.id);
    try {
      const res = await fetch("/api/follow-up", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: student.id, reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Guncellenemedi");
      setStudents((prev) => prev.map((x) => (x.id === student.id ? { ...x, reason: reason || null } : x)));
      toast.success("Takip sebebi guncellendi");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Guncellenemedi");
    } finally {
      setBusyId(null);
    }
  };

  const handleNewAppointment = (student: FollowUpStudent) => {
    const params = new URLSearchParams();
    params.set("studentName", student.studentName);
    params.set("classDisplay", student.classDisplay);
    params.set("classKey", student.classKey);
    params.set("purpose", "Takip görüşmesi");
    window.location.href = `/panel/takvim?${params.toString()}`;
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("tr-TR");
    if (!q) return students;
    return students.filter(
      (s) =>
        s.studentName.toLocaleLowerCase("tr-TR").includes(q) ||
        s.classDisplay.toLocaleLowerCase("tr-TR").includes(q) ||
        (s.reason || "").toLocaleLowerCase("tr-TR").includes(q)
    );
  }, [students, search]);

  // Randevusu olmayanlar üstte: dikkat isteyenler önce görünsün
  const sorted = useMemo(
    () =>
      [...filtered].sort((a, b) => {
        if (!a.nextAppointment && b.nextAppointment) return -1;
        if (a.nextAppointment && !b.nextAppointment) return 1;
        return a.studentName.localeCompare(b.studentName, "tr");
      }),
    [filtered]
  );

  const withoutAppointment = students.filter((s) => !s.nextAppointment).length;

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-600 via-sky-600 to-blue-700 p-6 text-white shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="rounded-xl bg-white/20 p-3">
              <Eye className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Takibimdekiler</h1>
              <p className="text-sm text-white/80">
                Düzenli izlemede olan öğrenciler
              </p>
            </div>
          </div>
          <div className="flex gap-4 text-center">
            <div className="rounded-xl bg-white/15 px-4 py-2">
              <div className="text-xl font-bold">{students.length}</div>
              <div className="text-xs text-white/80">öğrenci</div>
            </div>
            <div className="rounded-xl bg-white/15 px-4 py-2">
              <div className="text-xl font-bold">{withoutAppointment}</div>
              <div className="text-xs text-white/80">randevusuz</div>
            </div>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="flex items-center gap-2 border-b p-4">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Öğrenci, sınıf veya sebep ara..."
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
          ) : sorted.length === 0 ? (
            <div className="p-10 text-center">
              <Eye className="mx-auto mb-3 h-10 w-10 text-slate-300" />
              <p className="font-medium text-slate-600">
                {students.length === 0 ? "Takipte öğrenci yok" : "Aramayla eşleşen öğrenci yok"}
              </p>
              {students.length === 0 && (
                <p className="mt-1 text-sm text-slate-400">
                  Bir görüşmeyi tamamlarken &quot;Aktif Takip&quot; seçerseniz öğrenci buraya eklenir.
                </p>
              )}
            </div>
          ) : (
            <div className="divide-y">
              {sorted.map((s) => {
                const gecen = daysSince(s.lastMeeting);
                const busy = busyId === s.id;

                return (
                  <div key={s.id} className="p-4 hover:bg-slate-50/60">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-slate-800">
                            {s.studentNumber ? `${s.studentNumber} ` : ""}
                            {s.studentName}
                          </span>
                          <Badge variant="secondary">{s.classDisplay}</Badge>
                          {s.openApplications > 0 && (
                            <Badge className="bg-amber-100 text-amber-700">
                              {s.openApplications} bekleyen başvuru
                            </Badge>
                          )}
                        </div>

                        {/* Takip sebebi — öğretmenlerin yönlendirmede kullandığı
                            kategorilerle aynı liste, böylece aynı dil konuşulur */}
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <span className="text-xs text-slate-400">Sebep:</span>
                          <select
                            value={s.reason || ""}
                            disabled={busy}
                            onChange={(e) => handleReasonChange(s, e.target.value)}
                            className={
                              "rounded-lg border px-2 py-1 text-xs disabled:opacity-50 " +
                              (s.reason
                                ? "border-slate-200 bg-white text-slate-700"
                                : "border-amber-300 bg-amber-50 text-amber-700")
                            }
                          >
                            <option value="">— sebep seçilmedi —</option>
                            {YONLENDIRME_NEDENLERI.map((neden) => (
                              <option key={neden} value={neden}>
                                {neden}
                              </option>
                            ))}
                          </select>
                        </div>
                        {s.note && <p className="mt-0.5 text-sm text-slate-500">{s.note}</p>}

                        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
                          {s.since && <span>Takipte: {formatDate(s.since)}&apos;den beri</span>}
                          <span>{s.meetingCount} görüşme yapıldı</span>
                          {s.lastMeeting ? (
                            <span>
                              Son görüşme: {formatDate(s.lastMeeting)}
                              {gecen !== null && gecen > 0 && ` (${gecen} gün önce)`}
                            </span>
                          ) : (
                            <span className="text-slate-400">Henüz görüşme yapılmadı</span>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        {s.nextAppointment ? (
                          <div className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-sm text-emerald-700">
                            <CalendarClock className="h-4 w-4" />
                            {formatDate(s.nextAppointment)}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-sm text-amber-700">
                            <AlertTriangle className="h-4 w-4" />
                            Randevu yok
                          </div>
                        )}

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleNewAppointment(s)}
                          disabled={busy}
                          title="Bu öğrenciye randevu ver"
                        >
                          <CalendarPlus className="mr-1.5 h-4 w-4" />
                          Randevu
                        </Button>

                        <button
                          type="button"
                          onClick={() => handleRemove(s)}
                          disabled={busy}
                          title="Takipten çıkar"
                          className="rounded-lg border border-slate-200 p-2 text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
                        >
                          {busy ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <UserMinus className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
