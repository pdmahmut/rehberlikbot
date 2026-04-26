"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { History, Loader2, RefreshCw, Search, BookOpen, UserCheck, Calendar, AlertCircle } from "lucide-react";

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

type SubTab = "mine" | "class";

const normalizeText = (value?: string | null) =>
  String(value || "").toLocaleLowerCase("tr-TR").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();

const normalizeClassText = (value?: string | null) =>
  normalizeText(value).replace(/[\/\-_.()]/g, "");

const normalizeDecisionText = (value: string) =>
  value.toLocaleLowerCase("tr-TR").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ı/g, "i").replace(/ö/g, "o").replace(/ş/g, "s").replace(/ü/g, "u").trim();

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
  const times = [
    apt.appointment_date ? new Date(`${apt.appointment_date}T00:00:00`).getTime() : NaN,
    apt.created_at ? new Date(apt.created_at).getTime() : NaN,
    apt.updated_at ? new Date(apt.updated_at).getTime() : NaN,
  ].filter(Number.isFinite);
  return times.length > 0 && Math.max(...times) >= referralTime;
};

const getOutcomeLabel = (decisions?: string[] | null): string | null => {
  if (!decisions || decisions.length === 0) return null;
  for (const d of decisions) {
    const n = normalizeDecisionText(d);
    if (n.includes("tamamlandi")) return "Tamamlandı";
    if (n.includes("aktif takip") || n.includes("duzenli gorusme")) return "Aktif Takip";
  }
  return null;
};

const latestTimestamp = (...values: Array<string | null | undefined>) => {
  const sorted = values.filter((v): v is string => Boolean(v))
    .map(v => ({ raw: v, time: new Date(v).getTime() })).filter(i => Number.isFinite(i.time)).sort((a, b) => b.time - a.time);
  return sorted[0]?.raw || new Date().toISOString();
};

export default function YonlendirmelerPage() {
  const [teacherName, setTeacherName] = useState("");
  const [classKey, setClassKey] = useState("");
  const [classDisplay, setClassDisplay] = useState("");
  const [isHomeroom, setIsHomeroom] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [subTab, setSubTab] = useState<SubTab>("mine");

  const [allReferrals, setAllReferrals] = useState<Referral[]>([]);
  const [attendedAppointments, setAttendedAppointments] = useState<Appointment[]>([]);
  const [scheduledAppointments, setScheduledAppointments] = useState<Appointment[]>([]);

  const loadData = async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const auth = await fetch("/api/auth/me").then(r => r.json());
      const name = auth.teacherName || "";
      setTeacherName(name);
      setClassKey(auth.classKey || "");
      setClassDisplay(auth.classDisplay || "");
      setIsHomeroom(auth.isHomeroom || false);
      if (!name) { setAllReferrals([]); return; }

      const [referralRes, attendedRes, scheduledRes] = await Promise.all([
        fetch("/api/referrals"),
        fetch("/api/appointments?participantType=student&status=attended"),
        fetch("/api/appointments?participantType=student&status=planned"),
      ]);

      const referralData = await referralRes.json().catch(() => ({ referrals: [] }));
      const attendedData = await attendedRes.json().catch(() => ({ appointments: [] }));
      const scheduledData = await scheduledRes.json().catch(() => ({ appointments: [] }));

      setAllReferrals(referralData.referrals || []);
      setAttendedAppointments(attendedData.appointments || []);
      setScheduledAppointments(scheduledData.appointments || []);
    } finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { loadData(); }, []);

  // Benim yönlendirmelerim
  const myReferrals = useMemo(() =>
    allReferrals.filter(r => normalizeText(r.teacher_name) === normalizeText(teacherName)),
    [allReferrals, teacherName]
  );

  // Sınıfıma yapılan yönlendirmeler (diğer öğretmenler dahil)
  const classReferrals = useMemo(() => {
    if (!classKey) return [];
    return allReferrals.filter(r => {
      const refClass = normalizeClassText(r.class_display || r.class_key);
      const myClass = normalizeClassText(classDisplay || classKey);
      return refClass === myClass || refClass.includes(myClass) || myClass.includes(refClass);
    });
  }, [allReferrals, classKey, classDisplay]);

  const currentReferrals = subTab === "mine" ? myReferrals : classReferrals;

  const enrichedRecords = useMemo(() => {
    return currentReferrals.map(ref => {
      const matchedAttended = attendedAppointments.find(apt => matchesAppointment(apt, ref) && isAppointmentAfterReferral(apt, ref)) || null;
      const matchedScheduled = scheduledAppointments.find(apt => matchesAppointment(apt, ref) && isAppointmentAfterReferral(apt, ref)) || null;

      let status = "Bekliyor";
      if (matchedAttended) status = "Görüşüldü";
      else if (matchedScheduled) status = "Randevu verildi";

      const outcomeLabel = matchedAttended ? getOutcomeLabel(matchedAttended.outcome_decision) : null;
      const lastActivityAt = latestTimestamp(ref.updated_at, ref.created_at, matchedScheduled?.updated_at, matchedAttended?.updated_at);

      return {
        id: ref.id,
        studentName: ref.student_name,
        classDisplay: ref.class_display || ref.class_key || "-",
        reason: ref.reason || ref.note || "-",
        teacherName: ref.teacher_name || "-",
        createdAt: ref.created_at,
        status, outcomeLabel, lastActivityAt,
      };
    }).sort((a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime());
  }, [currentReferrals, attendedAppointments, scheduledAppointments]);

  const filtered = useMemo(() => {
    const q = normalizeText(search);
    if (!q) return enrichedRecords;
    return enrichedRecords.filter(i =>
      normalizeText(i.studentName).includes(q) || normalizeText(i.classDisplay).includes(q) || normalizeText(i.reason).includes(q)
    );
  }, [enrichedRecords, search]);

  if (loading) return <div className="flex items-center justify-center py-14"><Loader2 className="h-8 w-8 animate-spin text-violet-600" /></div>;

  return (
    <div className="space-y-4">
      {/* Başlık */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 p-2.5 shadow-lg">
            <History className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Yönlendirmeler</h1>
            <p className="text-xs text-slate-500">{filtered.length} kayıt</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => loadData(true)} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Mini Sekmeler: Benim / Sınıfıma Yapılan */}
      <div className="flex rounded-xl bg-slate-100 p-1">
        <button
          onClick={() => setSubTab("mine")}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
            subTab === "mine" ? "bg-white text-violet-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <UserCheck className="h-3.5 w-3.5" />
          Benim
          <Badge variant="secondary" className="text-[10px] px-1.5">{myReferrals.length}</Badge>
        </button>
        <button
          onClick={() => setSubTab("class")}
          disabled={!isHomeroom}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
            subTab === "class" ? "bg-white text-teal-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
          } ${!isHomeroom ? "opacity-40 cursor-not-allowed" : ""}`}
        >
          <BookOpen className="h-3.5 w-3.5" />
          Sınıfıma Yapılan
          {isHomeroom && <Badge variant="secondary" className="text-[10px] px-1.5">{classReferrals.length}</Badge>}
        </button>
      </div>

      {/* Arama */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Öğrenci, sınıf veya neden ara..."
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400"
        />
      </div>

      {/* Liste */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="py-10 text-center text-slate-400">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Kayıt bulunamadı</p>
            </div>
          ) : (
            <>
              {/* Masaüstü: Tablo */}
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50">
                    <tr className="border-b border-slate-200 text-slate-700">
                      <th className="px-4 py-3 font-semibold">Öğrenci</th>
                      <th className="px-4 py-3 font-semibold">Sınıf</th>
                      {subTab === "class" && <th className="px-4 py-3 font-semibold">Öğretmen</th>}
                      <th className="px-4 py-3 font-semibold">Neden</th>
                      <th className="px-4 py-3 font-semibold">Durum</th>
                      <th className="px-4 py-3 font-semibold">Sonuç</th>
                      <th className="px-4 py-3 font-semibold">Tarih</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(item => (
                      <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-800">{item.studentName}</td>
                        <td className="px-4 py-3"><Badge variant="outline" className="text-xs">{item.classDisplay}</Badge></td>
                        {subTab === "class" && <td className="px-4 py-3 text-xs text-slate-600">{item.teacherName}</td>}
                        <td className="px-4 py-3 text-slate-600 max-w-[300px] truncate">{item.reason}</td>
                        <td className="px-4 py-3">
                          <Badge className={item.status === "Görüşüldü" ? "bg-emerald-100 text-emerald-700" : item.status === "Randevu verildi" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}>
                            {item.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          {item.outcomeLabel ? <Badge className="bg-violet-100 text-violet-700">{item.outcomeLabel}</Badge> : <span className="text-xs text-slate-400">—</span>}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {new Date(item.lastActivityAt).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobil: Kart Listesi */}
              <div className="md:hidden divide-y divide-slate-100">
                {filtered.map(item => (
                  <div key={item.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-800 truncate">{item.studentName}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {item.classDisplay} · {item.reason}
                        </p>
                        {subTab === "class" && item.teacherName !== "-" && (
                          <p className="text-[10px] text-slate-400 mt-0.5">Öğretmen: {item.teacherName}</p>
                        )}
                      </div>
                      <Badge className={`shrink-0 text-[10px] ${
                        item.status === "Görüşüldü" ? "bg-emerald-100 text-emerald-700"
                        : item.status === "Randevu verildi" ? "bg-blue-100 text-blue-700"
                        : "bg-amber-100 text-amber-700"
                      }`}>
                        {item.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      {item.outcomeLabel && <Badge className="text-[9px] bg-violet-100 text-violet-700">{item.outcomeLabel}</Badge>}
                      <span className="text-[10px] text-slate-400">
                        {new Date(item.lastActivityAt).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
