"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Loader2, RefreshCw, RotateCcw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface ResetGroup {
  key: string;
  label: string;
  count: number;
  tables: Array<{ table: string; count: number }>;
}

const KEPT = [
  "Yönetici şifreniz",
  "Okulun ders saatleri",
  "Yükleme geçmişi kaydı",
];

export default function YeniDonemPage() {
  const [groups, setGroups] = useState<ResetGroup[]>([]);
  const [total, setTotal] = useState(0);
  const [confirmPhrase, setConfirmPhrase] = useState("YENİ DÖNEME BAŞLA");
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [typed, setTyped] = useState("");
  const [armed, setArmed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/new-term");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Özet alınamadı");
      setGroups(data.groups || []);
      setTotal(data.total || 0);
      if (data.confirmPhrase) setConfirmPhrase(data.confirmPhrase);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Özet alınamadı");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleReset = async () => {
    setResetting(true);
    try {
      const res = await fetch("/api/new-term", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: typed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sıfırlama başarısız");

      toast.success(`${data.totalDeleted} kayıt silindi. Sistem yeni döneme hazır.`);
      setTyped("");
      setArmed(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sıfırlama başarısız");
    } finally {
      setResetting(false);
    }
  };

  const canReset = typed.trim().toLocaleUpperCase("tr-TR") === confirmPhrase;

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 p-6 text-white shadow-xl">
        <div className="flex items-center gap-4">
          <div className="rounded-xl bg-white/20 p-3">
            <RotateCcw className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Yeni Döneme Başla</h1>
            <p className="text-sm text-white/80">
              Sene sonunda sistemi boşaltır, yeni dönem sıfırdan kurulur
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">Silinecek kayıtlar</h2>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={"mr-2 h-4 w-4 " + (loading ? "animate-spin" : "")} />
              Yenile
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 py-6 text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Yükleniyor...
            </div>
          ) : total === 0 ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
              Sistem zaten boş. Silinecek kayıt yok.
            </div>
          ) : (
            <div className="divide-y rounded-lg border">
              {groups.map((g) => (
                <div key={g.key} className="flex items-center justify-between p-3">
                  <span className="text-slate-700">{g.label}</span>
                  <span
                    className={
                      "font-semibold " + (g.count > 0 ? "text-slate-900" : "text-slate-300")
                    }
                  >
                    {g.count} kayıt
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between bg-slate-50 p-3">
                <span className="font-medium text-slate-800">Toplam</span>
                <span className="text-lg font-bold text-red-600">{total} kayıt</span>
              </div>
            </div>
          )}

          <div className="rounded-lg border border-sky-200 bg-sky-50 p-4">
            <div className="mb-2 flex items-center gap-2 font-medium text-sky-900">
              <ShieldCheck className="h-4 w-4" /> Silinmeyecekler
            </div>
            <ul className="ml-6 list-disc space-y-0.5 text-sm text-sky-800">
              {KEPT.map((k) => (
                <li key={k}>{k}</li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      {total > 0 && (
        <Card className="border-red-200">
          <CardContent className="space-y-4 p-6">
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="text-sm">
                <p className="font-semibold">Bu işlem geri alınamaz.</p>
                <p className="mt-1">
                  Öğrenci listesi, sınıflar, tüm görüşme ve yönlendirme geçmişi, öğretmen kadrosu ve
                  giriş hesapları silinecek. Öğretmenlere yeni şifre dağıtmanız gerekecek.
                </p>
              </div>
            </div>

            {!armed ? (
              <Button
                variant="outline"
                className="w-full border-red-300 text-red-700 hover:bg-red-50"
                onClick={() => setArmed(true)}
              >
                Sıfırlamak istiyorum
              </Button>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Onaylamak için aşağıdaki metni yazın:{" "}
                    <span className="font-mono font-bold text-red-700">{confirmPhrase}</span>
                  </label>
                  <Input
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    placeholder={confirmPhrase}
                    autoComplete="off"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setArmed(false);
                      setTyped("");
                    }}
                    disabled={resetting}
                  >
                    Vazgeç
                  </Button>
                  <Button
                    className="flex-1 bg-red-600 hover:bg-red-700"
                    onClick={handleReset}
                    disabled={!canReset || resetting}
                  >
                    {resetting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Siliniyor...
                      </>
                    ) : (
                      <>{total} kaydı sil</>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
