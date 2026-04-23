"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { History, Loader2, RefreshCw, Search } from "lucide-react";

type Referral = {
  id: string;
  student_name: string;
  class_key: string | null;
  class_display: string | null;
  teacher_name: string | null;
  note: string | null;
  reason: string | null;
  status: string;
  created_at: string;
  updated_at?: string | null;
};

type Appointment = {
  id: string;
  participant_name: string;
  participant_class?: string | null;
  appointment_date?: string | null;
  status: string;
  created_at?: string | null;
  updated_at?: string | null;
  outcome_decision?: string[] | null;
};

type MyReferralRecord = {
  id: string;
  studentName: string;
  classDisplay: string;
  reason: string;
  createdAt: string;
  status: "Bekliyor" | "Randevu verildi" | "Görüşüldü";
  outcomeLabel: string | null;
  lastActivityAt: string;
};

const normalizeText = (value?: string | null) =>
  String(value || "")
    .toLocaleLowerCase("tr-TR")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const normalizeClassText = (value?: string | null) =>
  normalizeText(value).replace(/[\/\-_.()]/g, "");

const normalizeDecisionText = (value: string) =>
  value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u")
    .trim();

const matchesAppointment = (apt: Appointment, referral: Referral) => {
  const aptName = normalizeText(apt.participant_name);
  const refName = normalizeText(referral.student_name);
  if (!aptName || !refName) return false;
  const nameMatch = aptName === refName || aptName.includes(refName) || refName.includes(aptName);
  if (!nameMatch) return false;

  const aptClass = normalizeClassText(apt.participant_class);
  const refClass = normalizeClassText(referral.class_display || referral.class_key);
  if (!aptClass || !refClass) return true;
  return aptClass === refClass || aptClass.includes(refClass) || refClass.includes(aptClass);
};

const isAppointmentAfterReferral = (apt: Appointment, referral: Referral) => {
  const referralTime = new Date(referral.created_at).getTime();
  if (!Number.isFinite(referralTime)) return true;

  const appointmentDateTime = apt.appointment_date
    ? new Date(`${apt.appointment_date}T00:00:00`).getTime()
    : Number.NaN;
  const appointmentCreatedAt = apt.created_at ? new Date(apt.created_at).getTime() : Number.NaN;
  const appointmentUpdatedAt = apt.updated_at ? new Date(apt.updated_at).getTime() : Number.NaN;

  const candidateTimes = [appointmentDateTime, appointmentCreatedAt, appointmentUpdatedAt].filter((t) =>
    Number.isFinite(t)
  );
  if (candidateTimes.length === 0) return false;
  return Math.max(...candidateTimes) >= referralTime;
};

const getOutcomeLabel = (decisions?: string[] | null): string | null => {
  if (!decisions || decisions.length === 0) return null;
  for (const decision of decisions) {
    const normalized = normalizeDecisionText(decision);
    if (normalized.includes("tamamlandi")) return "Tamamlandı";
    if (normalized.includes("aktif takip") || normalized.includes("duzenli gorusme")) return "Aktif Takip";
  }
  return null;
};

const latestTimestamp = (...values: Array<string | null | undefined>) => {
  const sorted = values
    .filter((value): value is string => Boolean(value))
    .map((value) => ({ raw: value, time: new Date(value).getTime() }))
    .filter((item) => Number.isFinite(item.time))
    .sort((a, b) => b.time - a.time);
  return sorted[0]?.raw || new Date().toISOString();
};

export default function YaptigimYonlendirmelerPage() {
  const [teacherName, setTeacherName] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [attendedAppointments, setAttendedAppointments] = useState<Appointment[]>([]);
  const [scheduledAppointments, setScheduledAppointments] = useState<Appointment[]>([]);

  const loadData = async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const auth = await fetch("/api/auth/me").then((r) => r.json());
      const name = auth.teacherName || "";
      setTeacherName(name);
      if (!name) {
        setReferrals([]);
        return;
      }

      const [referralRes, attendedRes, scheduledRes] = await Promise.all([
        fetch("/api/referrals"),
        fetch("/api/appointments?participantType=student&status=attended"),
        fetch("/api/appointments?participantType=student&status=planned"),
      ]);

      const referralData = await referralRes.json().catch(() => ({ referrals: [] }));
      const attendedData = await attendedRes.json().catch(() => ({ appointments: [] }));
      const scheduledData = await scheduledRes.json().catch(() => ({ appointments: [] }));

      const myReferrals = (referralData.referrals || []).filter(
        (ref: Referral) => normalizeText(ref.teacher_name) === normalizeText(name)
      );

      setReferrals(myReferrals);
      setAttendedAppointments(attendedData.appointments || []);
      setScheduledAppointments(scheduledData.appointments || []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const records = useMemo<MyReferralRecord[]>(() => {
    return referrals
      .map((ref) => {
        const matchedAttended =
          attendedAppointments.find(
            (apt) => matchesAppointment(apt, ref) && isAppointmentAfterReferral(apt, ref)
          ) || null;
        const matchedScheduled =
          scheduledAppointments.find(
            (apt) => matchesAppointment(apt, ref) && isAppointmentAfterReferral(apt, ref)
          ) || null;

        let status: MyReferralRecord["status"] = "Bekliyor";
        if (matchedAttended) {
          status = "Görüşüldü";
        } else if (matchedScheduled) {
          status = "Randevu verildi";
        }

        const outcomeLabel = matchedAttended ? getOutcomeLabel(matchedAttended.outcome_decision) : null;
        const lastActivityAt = latestTimestamp(
          ref.updated_at,
          ref.created_at,
          matchedScheduled?.updated_at,
          matchedScheduled?.created_at,
          matchedAttended?.updated_at,
          matchedAttended?.created_at
        );

        return {
          id: ref.id,
          studentName: ref.student_name,
          classDisplay: ref.class_display || ref.class_key || "-",
          reason: ref.reason || ref.note || "-",
          createdAt: ref.created_at,
          status,
          outcomeLabel,
          lastActivityAt,
        };
      })
      .sort((a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime());
  }, [referrals, attendedAppointments, scheduledAppointments]);

  const filtered = useMemo(
    () =>
      records.filter((item) => {
        const q = normalizeText(search);
        if (!q) return true;
        return (
          normalizeText(item.studentName).includes(q) ||
          normalizeText(item.classDisplay).includes(q) ||
          normalizeText(item.reason).includes(q)
        );
      }),
    [records, search]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-14">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Yaptığım Yönlendirmeler</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {teacherName ? `${teacherName} tarafından yapılan yönlendirmeler` : "Yönlendirme listesi"}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => loadData(true)} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-slate-700 flex items-center gap-2">
            <Search className="h-4 w-4 text-slate-400" />
            Arama
          </CardTitle>
        </CardHeader>
        <CardContent>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Öğrenci, sınıf veya neden ara..."
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400"
          />
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-slate-700 flex items-center gap-2">
            <History className="h-4 w-4 text-violet-500" />
            Yönlendirme Durumları
            <Badge variant="secondary" className="ml-1">{filtered.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="py-10 text-center text-slate-400">Kayıt bulunamadı.</div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200 text-slate-700">
                    <th className="px-4 py-3 font-semibold">Öğrenci</th>
                    <th className="px-4 py-3 font-semibold">Sınıf</th>
                    <th className="px-4 py-3 font-semibold">Neden</th>
                    <th className="px-4 py-3 font-semibold">Durum</th>
                    <th className="px-4 py-3 font-semibold">Görüşme Sonucu</th>
                    <th className="px-4 py-3 font-semibold">Son Güncelleme</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">{item.studentName}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-xs">{item.classDisplay}</Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-600 max-w-[380px] truncate">{item.reason}</td>
                      <td className="px-4 py-3">
                        <Badge
                          className={
                            item.status === "Görüşüldü"
                              ? "bg-emerald-100 text-emerald-700"
                              : item.status === "Randevu verildi"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-amber-100 text-amber-700"
                          }
                        >
                          {item.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {item.outcomeLabel ? (
                          <Badge className="bg-violet-100 text-violet-700">{item.outcomeLabel}</Badge>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {new Date(item.lastActivityAt).toLocaleString("tr-TR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
