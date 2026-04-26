"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Clock, Save, Loader2, RotateCcw } from "lucide-react";

interface LessonHour {
  period_number: number;
  start_time: string;
  end_time: string;
}

const DEFAULT_HOURS: LessonHour[] = [
  { period_number: 1, start_time: "08:30", end_time: "09:10" },
  { period_number: 2, start_time: "09:20", end_time: "10:00" },
  { period_number: 3, start_time: "10:10", end_time: "10:50" },
  { period_number: 4, start_time: "11:00", end_time: "11:40" },
  { period_number: 5, start_time: "11:50", end_time: "12:30" },
  { period_number: 6, start_time: "13:30", end_time: "14:10" },
  { period_number: 7, start_time: "14:20", end_time: "15:00" },
];

export default function LessonHoursSettings() {
  const [hours, setHours] = useState<LessonHour[]>(DEFAULT_HOURS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadHours();
  }, []);

  const loadHours = async () => {
    try {
      const res = await fetch("/api/lesson-hours");
      if (res.ok) {
        const data = await res.json();
        if (data.hours && data.hours.length > 0) {
          setHours(data.hours);
        }
      }
    } catch { /* varsayılan saatler kalır */ }
    finally { setLoading(false); }
  };

  const handleChange = (periodNumber: number, field: "start_time" | "end_time", value: string) => {
    setHours(prev =>
      prev.map(h => h.period_number === periodNumber ? { ...h, [field]: value } : h)
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/lesson-hours", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hours }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Kaydedilemedi");
      }
      toast.success("Ders saatleri güncellendi");
    } catch (err: any) {
      toast.error(err.message || "Ders saatleri kaydedilemedi");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setHours(DEFAULT_HOURS);
    toast.info("Varsayılan saatlere döndürüldü — kaydetmeyi unutmayın");
  };

  if (loading) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-teal-500" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="border-b bg-slate-50 py-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <Clock className="h-4 w-4 text-teal-600" />
            Ders Saatleri
          </CardTitle>
          <div className="flex gap-1.5">
            <Button variant="ghost" size="sm" onClick={handleReset} className="text-xs text-slate-500 h-7 px-2">
              <RotateCcw className="h-3 w-3 mr-1" />
              Varsayılan
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="bg-teal-600 hover:bg-teal-700 text-white h-7 px-3 text-xs">
              {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
              Kaydet
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-slate-100">
          {hours.map((h) => (
            <div key={h.period_number} className="flex items-center gap-3 px-4 py-2.5">
              <span className="text-sm font-semibold text-slate-600 w-16 shrink-0">
                {h.period_number}. Ders
              </span>
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="time"
                  value={h.start_time}
                  onChange={(e) => handleChange(h.period_number, "start_time", e.target.value)}
                  className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 w-28"
                />
                <span className="text-slate-400 text-xs">—</span>
                <input
                  type="time"
                  value={h.end_time}
                  onChange={(e) => handleChange(h.period_number, "end_time", e.target.value)}
                  className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 w-28"
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
