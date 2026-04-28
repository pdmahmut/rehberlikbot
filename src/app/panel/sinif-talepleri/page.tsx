"use client";
import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { ClipboardList, Check, X, RefreshCw, Clock, ArrowRightLeft, Trash2, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface ClassStudentRequest {
  id: string;
  teacher_name: string;
  class_key: string;
  class_display: string;
  student_name: string;
  student_value: string | null;
  request_type: "delete" | "class_change";
  new_class_key: string | null;
  new_class_display: string | null;
  status: "pending" | "approved" | "rejected";
  admin_note: string | null;
  created_at: string;
  updated_at: string | null;
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  pending: { label: "Bekliyor", className: "bg-amber-100 text-amber-700" },
  approved: { label: "Onaylandı", className: "bg-green-100 text-green-700" },
  rejected: { label: "Reddedildi", className: "bg-red-100 text-red-700" },
};

const TYPE_LABELS: Record<string, string> = {
  delete: "Silme",
  class_change: "Sınıf Değiştirme",
};

export default function SinifTalepleriPage() {
  const searchParams = useSearchParams();
  const [requests, setRequests] = useState<ClassStudentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());

  useEffect(() => {
    const filterParam = searchParams.get("filter");
    if (filterParam === "pending" || filterParam === "approved" || filterParam === "rejected" || filterParam === "all") {
      setFilter(filterParam);
    }
  }, [searchParams]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = filter !== "all" ? `?status=${filter}` : "";
      const res = await fetch(`/api/class-student-requests${qs}`);
      const data = await res.json();
      setRequests(data.requests || []);
    } catch {
      toast.error("Talepler yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const handleDecide = async (id: string, status: "approved" | "rejected") => {
    setProcessingId(id);
    try {
      const res = await fetch("/api/class-student-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status, adminNote: noteInputs[id] || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(status === "approved" ? "Talep onaylandı" : "Talep reddedildi");
      load();
    } catch (err: any) {
      toast.error(err.message || "İşlem başarısız");
    } finally {
      setProcessingId(null);
    }
  };

  const toggleNote = (id: string) => {
    setExpandedNotes(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const pendingCount = requests.filter(r => r.status === "pending").length;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-500 p-6 text-white shadow-xl">
        <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2.5 rounded-xl bg-white/20 backdrop-blur">
                <ClipboardList className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold">Sınıf Talepleri</h1>
            </div>
            <p className="text-white/70 text-sm">Öğretmenlerden gelen silme ve sınıf değiştirme talepleri</p>
          </div>
          <div className="flex gap-2 items-center">
            {pendingCount > 0 && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 rounded-xl text-sm font-semibold">
                <Clock className="h-4 w-4" />
                {pendingCount} bekleyen
              </span>
            )}
            <button onClick={load} className="p-2.5 rounded-xl bg-white/20 hover:bg-white/30 transition-colors">
              <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {(["pending", "approved", "rejected", "all"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              filter === f ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {f === "pending" ? "Bekleyenler" : f === "approved" ? "Onaylananlar" : f === "rejected" ? "Reddedilenler" : "Tümü"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-amber-500/30 rounded-full animate-spin border-t-amber-500"></div>
        </div>
      ) : requests.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-16 text-center text-slate-400">
            <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>Talep bulunmuyor</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {requests.map(req => {
            const statusInfo = STATUS_LABELS[req.status];
            const isProcessing = processingId === req.id;
            const noteExpanded = expandedNotes.has(req.id);

            return (
              <Card key={req.id} className="border-0 shadow-sm overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Type icon */}
                    <div className={`p-2.5 rounded-xl flex-shrink-0 ${req.request_type === "delete" ? "bg-red-100" : "bg-blue-100"}`}>
                      {req.request_type === "delete"
                        ? <Trash2 className="h-4 w-4 text-red-600" />
                        : <ArrowRightLeft className="h-4 w-4 text-blue-600" />
                      }
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-semibold text-slate-800 text-sm">{req.student_name}</span>
                        <Badge variant="outline" className="text-xs">{req.class_display}</Badge>
                        <Badge className={`text-xs ${req.request_type === "delete" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}>
                          {TYPE_LABELS[req.request_type]}
                        </Badge>
                        <Badge className={`text-xs ${statusInfo.className}`}>{statusInfo.label}</Badge>
                      </div>
                      <p className="text-xs text-slate-500 mb-1">
                        <span className="font-medium">{req.teacher_name}</span> tarafından —{" "}
                        {new Date(req.created_at).toLocaleDateString("tr-TR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
                      </p>
                      {req.request_type === "class_change" && req.new_class_display && (
                        <p className="text-xs text-slate-600">
                          Hedef sınıf: <span className="font-medium text-blue-700">{req.new_class_display}</span>
                        </p>
                      )}
                      {req.admin_note && (
                        <p className="text-xs text-slate-500 mt-1 italic">Not: {req.admin_note}</p>
                      )}
                      {req.student_value && !req.student_value.startsWith("supabase_") && req.status === "approved" && (
                        <p className="text-xs text-amber-600 mt-1">⚠ Excel tabanlı öğrenci — manuel güncelleme gerekebilir</p>
                      )}
                    </div>

                    {/* Actions */}
                    {req.status === "pending" && (
                      <div className="flex flex-col gap-1.5 flex-shrink-0">
                        <div className="flex gap-1.5">
                          <Button
                            size="sm"
                            onClick={() => handleDecide(req.id, "approved")}
                            disabled={isProcessing}
                            className="bg-green-600 hover:bg-green-700 text-white h-8 px-3 text-xs gap-1"
                          >
                            <Check className="h-3.5 w-3.5" /> Onayla
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDecide(req.id, "rejected")}
                            disabled={isProcessing}
                            className="border-red-200 text-red-600 hover:bg-red-50 h-8 px-3 text-xs gap-1"
                          >
                            <X className="h-3.5 w-3.5" /> Reddet
                          </Button>
                        </div>
                        <button
                          onClick={() => toggleNote(req.id)}
                          className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600"
                        >
                          <ChevronDown className={`h-3 w-3 transition-transform ${noteExpanded ? "rotate-180" : ""}`} />
                          Not ekle
                        </button>
                        {noteExpanded && (
                          <input
                            type="text"
                            placeholder="Yönetici notu..."
                            value={noteInputs[req.id] || ""}
                            onChange={e => setNoteInputs(prev => ({ ...prev, [req.id]: e.target.value }))}
                            className="text-xs px-2 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-400 w-48"
                          />
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
