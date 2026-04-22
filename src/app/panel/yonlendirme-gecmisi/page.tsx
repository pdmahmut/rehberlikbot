"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  History,
  User,
  Calendar,
  FileText,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronUp,
  Search,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface Referral {
  id: string;
  student_name: string;
  class_display: string;
  reason: string;
  note: string | null;
  created_at: string;
}


export default function YonlendirmeGecmisiPage() {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadReferrals = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/yonlendirme-gecmisi");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setReferrals(data.referrals);
    } catch (err: any) {
      toast.error("Geçmiş yüklenemedi: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReferrals();
  }, []);

  const q = search.toLowerCase();
  const filtered = referrals.filter((r) =>
    (r.student_name ?? '').toLowerCase().includes(q) ||
    (r.class_display ?? '').toLowerCase().includes(q) ||
    (r.reason ?? '').toLowerCase().includes(q)
  );

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("tr-TR", {
      day: "2-digit", month: "long", year: "numeric",
    });
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  };

  // Tarihe göre grupla
  const grouped = filtered.reduce((acc, r) => {
    const date = formatDate(r.created_at);
    if (!acc[date]) acc[date] = [];
    acc[date].push(r);
    return acc;
  }, {} as Record<string, Referral[]>);

  return (
    <div className="space-y-5">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl shadow">
            <History className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Yönlendirme Geçmişi</h1>
            <p className="text-xs text-slate-500">Gönderdiğiniz tüm yönlendirmeler</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={loadReferrals} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
          Yenile
        </Button>
      </div>

      {/* Arama */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Öğrenci adı, sınıf veya neden ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* İstatistik Özeti */}
      {!isLoading && referrals.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl border border-slate-100 p-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-indigo-600">{referrals.length}</p>
            <p className="text-xs text-slate-500 mt-0.5">Toplam</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-100 p-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-emerald-600">
              {new Set(referrals.map(r => r.class_display)).size}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">Farklı Sınıf</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-100 p-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-amber-600">
              {new Set(referrals.map(r => r.student_name)).size}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">Farklı Öğrenci</p>
          </div>
        </div>
      )}

      {/* Liste */}
      {isLoading ? (
        <Card>
          <CardContent className="py-12 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
            <span className="ml-2 text-slate-500">Yükleniyor...</span>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <History className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">
              {search ? "Arama sonucu bulunamadı." : "Henüz yönlendirme kaydı yok."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {Object.entries(grouped).map(([date, items]) => (
            <div key={date}>
              {/* Tarih Başlığı */}
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{date}</span>
                <div className="flex-1 h-px bg-slate-200" />
                <Badge className="bg-slate-100 text-slate-600 text-xs">{items.length} kayıt</Badge>
              </div>

              {/* Kayıtlar */}
              <div className="space-y-2">
                {items.map((r) => (
                  <Card key={r.id} className="overflow-hidden hover:shadow-sm transition-shadow">
                    <div
                      className="p-4 cursor-pointer"
                      onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                            {r.student_name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-800 truncate">{r.student_name}</p>
                            <p className="text-xs text-slate-500">{r.class_display} · {formatTime(r.created_at)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {expandedId === r.id
                            ? <ChevronUp className="h-4 w-4 text-slate-400" />
                            : <ChevronDown className="h-4 w-4 text-slate-400" />}
                        </div>
                      </div>
                    </div>

                    {/* Detay */}
                    {expandedId === r.id && (
                      <div className="px-4 pb-4 pt-0 border-t border-slate-100 bg-slate-50/50 space-y-2">
                        <div className="flex items-start gap-2 mt-3">
                          <FileText className="h-4 w-4 text-indigo-500 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs font-medium text-slate-500">Yönlendirme Nedeni</p>
                            <p className="text-sm text-slate-700">{r.reason}</p>
                          </div>
                        </div>
                        {r.note && (
                          <div className="flex items-start gap-2">
                            <FileText className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                            <div>
                              <p className="text-xs font-medium text-slate-500">Not</p>
                              <p className="text-sm text-slate-600 italic">{r.note}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
