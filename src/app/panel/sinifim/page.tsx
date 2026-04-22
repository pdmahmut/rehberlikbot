"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  GraduationCap, Users, History, BookOpen, Plus, Trash2,
  RefreshCw, UserCheck, ArrowRightLeft, ChevronDown, Award, AlertCircle,
  MessageSquare, X, Calendar, Clock, CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Referral {
  id: string;
  student_name: string;
  class_key: string | null;
  class_display: string | null;
  teacher_name: string | null;
  note: string | null;
  reason: string | null;
  status: string;
  created_at: string;
}

interface StudentOption {
  value: string;
  text: string;
  class_key?: string;
  class_display?: string;
}

interface AuthInfo {
  teacherName: string;
  classKey: string | null;
  classDisplay: string | null;
  isHomeroom: boolean;
}

interface ClassStudentRequest {
  id: string;
  student_name: string;
  request_type: "delete" | "class_change";
  new_class_display: string | null;
  status: "pending" | "approved" | "rejected";
}

interface SinifOption { value: string; text: string; }

interface GuidanceRequest {
  id: string;
  teacher_name: string;
  class_key: string;
  class_display: string;
  topic: string;
  description: string | null;
  status: "pending" | "scheduled" | "completed" | "rejected";
  scheduled_date: string | null;
  lesson_slot: number | null;
  feedback: string | null;
  created_at: string;
  updated_at: string | null;
}

type TabId = "my-referrals" | "class-list" | "class-referrals" | "guidance-requests";

const CHART_COLORS = [
  "#6366f1","#8b5cf6","#a855f7","#ec4899","#f43f5e","#f97316","#eab308",
];

const GUIDANCE_TOPICS = [
  "Kariyer ve Meslek Rehberliği",
  "Sınav Kaygısı ve Stres Yönetimi",
  "Zorbalık ve Akran İlişkileri",
  "Uyum Sorunu ve Okula Devam",
  "Aile ve Ev Ortamı Sorunları",
  "Motivasyon ve Çalışma Alışkanlıkları",
  "Kimlik Gelişimi ve Ergenlik",
  "Sınıf İçi Davranış Sorunları",
  "Sosyal Beceri Geliştirme",
  "Diğer",
];

const MONTHS_TR = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];

function formatDateShort(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getDate()} ${MONTHS_TR[d.getMonth()]} ${d.getFullYear()}`;
}

const REQUEST_STATUS: Record<GuidanceRequest["status"], { label: string; cls: string }> = {
  pending:   { label: "Bekliyor",   cls: "bg-amber-100 text-amber-700" },
  scheduled: { label: "Planlandı",  cls: "bg-blue-100 text-blue-700" },
  completed: { label: "Tamamlandı", cls: "bg-emerald-100 text-emerald-700" },
  rejected:  { label: "Reddedildi", cls: "bg-red-100 text-red-700" },
};

export default function SinifimPage() {
  const [auth, setAuth] = useState<AuthInfo | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("my-referrals");
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [pendingRequests, setPendingRequests] = useState<ClassStudentRequest[]>([]);
  const [sinifList, setSinifList] = useState<SinifOption[]>([]);
  const [referralsLoading, setReferralsLoading] = useState(false);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [newStudentName, setNewStudentName] = useState("");
  const [newStudentNumber, setNewStudentNumber] = useState("");
  const [addingStudent, setAddingStudent] = useState(false);
  const [expandedStudents, setExpandedStudents] = useState<Set<string>>(new Set());
  const [requestModal, setRequestModal] = useState<{ student: StudentOption | null; type: "delete" | "class_change" | null }>({ student: null, type: null });
  const [classChangeTarget, setClassChangeTarget] = useState("");
  const [submittingRequest, setSubmittingRequest] = useState(false);

  // Guidance requests state
  const [guidanceRequests, setGuidanceRequests] = useState<GuidanceRequest[]>([]);
  const [guidanceRequestsLoading, setGuidanceRequestsLoading] = useState(false);
  const [showNewGuidanceModal, setShowNewGuidanceModal] = useState(false);
  const [newRequestTopic, setNewRequestTopic] = useState("");
  const [newRequestDescription, setNewRequestDescription] = useState("");
  const [submittingGuidanceRequest, setSubmittingGuidanceRequest] = useState(false);
  const [feedbackInputs, setFeedbackInputs] = useState<Record<string, string>>({});
  const [submittingFeedback, setSubmittingFeedback] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => {
      if (d.teacherName) {
        setAuth({ teacherName: d.teacherName, classKey: d.classKey || null, classDisplay: d.classDisplay || null, isHomeroom: d.isHomeroom || false });
      }
    });
    fetch("/api/data").then(r => r.json()).then(d => setSinifList(d.sinifSubeList || []));
  }, []);

  const loadReferrals = useCallback(async () => {
    setReferralsLoading(true);
    try {
      const data = await fetch("/api/referrals").then(r => r.json());
      setReferrals(data.referrals || []);
    } catch { toast.error("Yönlendirmeler yüklenemedi"); }
    finally { setReferralsLoading(false); }
  }, []);

  const loadStudents = useCallback(async (classKey: string) => {
    setStudentsLoading(true);
    try {
      const data = await fetch(`/api/students?sinifSube=${encodeURIComponent(classKey)}`).then(r => r.json());
      setStudents(Array.isArray(data) ? data : []);
    } catch { toast.error("Öğrenci listesi yüklenemedi"); }
    finally { setStudentsLoading(false); }
  }, []);

  const loadPendingRequests = useCallback(async (classKey: string) => {
    try {
      const data = await fetch(`/api/class-student-requests?classKey=${encodeURIComponent(classKey)}&status=pending`).then(r => r.json());
      setPendingRequests(data.requests || []);
    } catch {}
  }, []);

  const loadGuidanceRequests = useCallback(async (teacherName: string) => {
    setGuidanceRequestsLoading(true);
    try {
      const data = await fetch(`/api/class-requests?teacherName=${encodeURIComponent(teacherName)}`).then(r => r.json());
      setGuidanceRequests(data.requests || []);
    } catch {}
    finally { setGuidanceRequestsLoading(false); }
  }, []);

  useEffect(() => {
    if (!auth) return;
    loadReferrals();
    if (auth.classKey) {
      loadStudents(auth.classKey);
      loadPendingRequests(auth.classKey);
    }
    if (auth.classKey) loadGuidanceRequests(auth.teacherName);
  }, [auth, loadReferrals, loadStudents, loadPendingRequests, loadGuidanceRequests]);

  const myReferrals = useMemo(() => referrals.filter(r => r.teacher_name === auth?.teacherName), [referrals, auth]);
  const classReferrals = useMemo(() => referrals.filter(r => auth?.classKey && r.class_key === auth.classKey), [referrals, auth]);

  const groupedReferrals = useMemo(() => {
    const groups: Record<string, Referral[]> = {};
    myReferrals.forEach(r => {
      if (!groups[r.student_name]) groups[r.student_name] = [];
      groups[r.student_name].push(r);
    });
    return Object.entries(groups)
      .map(([name, refs]) => ({
        name,
        referrals: [...refs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
        count: refs.length,
      }))
      .sort((a, b) => b.count - a.count);
  }, [myReferrals]);

  const reasonsChartData = useMemo(() => {
    const counts: Record<string, number> = {};
    myReferrals.forEach(r => {
      if (r.reason) counts[r.reason] = (counts[r.reason] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 7)
      .map(([name, count]) => ({ name: name.length > 22 ? name.slice(0, 20) + "…" : name, count, fullName: name }));
  }, [myReferrals]);

  const handleAddStudent = async () => {
    if (!newStudentName.trim() || !auth?.classKey) return;
    setAddingStudent(true);
    try {
      const res = await fetch("/api/class-students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classKey: auth.classKey, classDisplay: auth.classDisplay || auth.classKey, studentName: newStudentName.trim(), studentNumber: newStudentNumber.trim() || undefined }),
      });
      if (!res.ok) throw new Error();
      toast.success("Öğrenci eklendi");
      setNewStudentName(""); setNewStudentNumber("");
      loadStudents(auth.classKey);
    } catch { toast.error("Öğrenci eklenemedi"); }
    finally { setAddingStudent(false); }
  };

  const submitRequest = async () => {
    if (!auth || !requestModal.student || !requestModal.type) return;
    if (requestModal.type === "class_change" && !classChangeTarget) { toast.error("Hedef sınıf seçin"); return; }
    setSubmittingRequest(true);
    try {
      const targetSinif = sinifList.find(s => s.value === classChangeTarget);
      const res = await fetch("/api/class-student-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherName: auth.teacherName,
          classKey: auth.classKey,
          classDisplay: auth.classDisplay,
          studentName: requestModal.student.text,
          studentValue: requestModal.student.value,
          requestType: requestModal.type,
          newClassKey: classChangeTarget || null,
          newClassDisplay: targetSinif?.text || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Talep gönderildi. Yönetici onayı bekleniyor.");
      setRequestModal({ student: null, type: null });
      if (auth.classKey) loadPendingRequests(auth.classKey);
    } catch (err: any) {
      toast.error(err.message || "Talep gönderilemedi");
    } finally { setSubmittingRequest(false); }
  };

  const submitGuidanceRequest = async () => {
    if (!auth || !newRequestTopic) return;
    setSubmittingGuidanceRequest(true);
    try {
      const res = await fetch("/api/class-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherName: auth.teacherName,
          classKey: auth.classKey,
          classDisplay: auth.classDisplay || auth.classKey,
          topic: newRequestTopic,
          description: newRequestDescription.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Talep gönderildi");
      setShowNewGuidanceModal(false);
      setNewRequestTopic("");
      setNewRequestDescription("");
      loadGuidanceRequests(auth.teacherName);
    } catch (err: any) {
      toast.error(err.message || "Talep gönderilemedi");
    } finally { setSubmittingGuidanceRequest(false); }
  };

  const submitFeedback = async (requestId: string) => {
    const feedback = feedbackInputs[requestId]?.trim();
    if (!feedback || !auth) return;
    setSubmittingFeedback(requestId);
    try {
      const res = await fetch("/api/class-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: requestId, feedback }),
      });
      if (!res.ok) throw new Error();
      toast.success("Geri bildirim kaydedildi");
      setFeedbackInputs(prev => ({ ...prev, [requestId]: "" }));
      loadGuidanceRequests(auth.teacherName);
    } catch { toast.error("Kaydedilemedi"); }
    finally { setSubmittingFeedback(null); }
  };

  const getStudentPendingRequest = (studentText: string) =>
    pendingRequests.find(r => r.student_name === studentText);

  const toggleExpand = (name: string) =>
    setExpandedStudents(prev => { const s = new Set(prev); s.has(name) ? s.delete(name) : s.add(name); return s; });

  if (!auth) return (
    <div className="flex items-center justify-center min-h-[300px]">
      <div className="w-8 h-8 border-4 border-violet-500/30 rounded-full animate-spin border-t-violet-500" />
    </div>
  );

  const activeGuidanceRequests = guidanceRequests.filter(r => r.status !== "rejected");

  const tabs: { id: TabId; label: string; icon: typeof History; count: number; hidden?: boolean }[] = [
    { id: "my-referrals", label: "Yaptığım Yönlendirmeler", icon: History, count: myReferrals.length },
    { id: "class-list", label: "Sınıf Listesi", icon: Users, count: students.length },
    { id: "class-referrals", label: "Sınıfa Yapılan Yönlendirmeler", icon: BookOpen, count: classReferrals.length },
    { id: "guidance-requests", label: "Rehberlik Talebi", icon: MessageSquare, count: activeGuidanceRequests.length, hidden: !auth.classKey },
  ];

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 p-5 text-white shadow-xl relative overflow-hidden">
        <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-white/20 backdrop-blur shrink-0">
            <GraduationCap className="h-7 w-7 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold">Sınıfım</h1>
              {auth.isHomeroom && (
                <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-white/20 backdrop-blur font-medium">
                  <Award className="h-3 w-3" /> Sınıf Rehber Öğretmeni
                </span>
              )}
            </div>
            <p className="text-white/80 text-sm mt-0.5">{auth.teacherName}</p>
          </div>
          {auth.classDisplay && (
            <div className="text-right shrink-0">
              <p className="text-2xl font-bold">{auth.classDisplay}</p>
              <p className="text-white/60 text-xs">{students.length} öğrenci</p>
            </div>
          )}
        </div>
        {!auth.classKey && (
          <div className="relative mt-3 flex items-center gap-2 text-sm text-white/70 bg-white/10 rounded-xl px-3 py-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Sınıf ataması yok — yöneticinizle iletişime geçin
          </div>
        )}
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto">
        {tabs.filter(t => !t.hidden).map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all flex-1 justify-center ${active ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
              <Icon className="h-4 w-4 shrink-0" />
              <span className="hidden md:inline">{tab.label}</span>
              <Badge variant="secondary" className={`text-xs ${active ? "bg-violet-100 text-violet-700" : "bg-slate-200 text-slate-600"}`}>
                {tab.count}
              </Badge>
            </button>
          );
        })}
      </div>

      {/* ── My Referrals ── */}
      {activeTab === "my-referrals" && (
        <div className="space-y-4">
          {reasonsChartData.length > 0 && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-700">En Çok Yönlendirme Yapılan Alanlar</CardTitle>
              </CardHeader>
              <CardContent className="pr-2">
                <ResponsiveContainer width="100%" height={Math.max(160, reasonsChartData.length * 38)}>
                  <BarChart data={reasonsChartData} layout="vertical" margin={{ top: 0, right: 28, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#94a3b8" }} />
                    <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11, fill: "#64748b" }} />
                    <Tooltip
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={((val: number, _: string, props: any) => [`${val} kez`, props.payload.fullName]) as any}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}
                    />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {reasonsChartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3 flex-row items-center justify-between">
              <CardTitle className="text-base">
                Yönlendirme Listesi
                <span className="ml-2 text-sm font-normal text-slate-400">({groupedReferrals.length} öğrenci)</span>
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={loadReferrals} disabled={referralsLoading}>
                <RefreshCw className={`h-4 w-4 ${referralsLoading ? "animate-spin" : ""}`} />
              </Button>
            </CardHeader>
            <CardContent>
              {referralsLoading ? (
                <div className="flex justify-center py-8"><div className="w-8 h-8 border-4 border-violet-500/30 rounded-full animate-spin border-t-violet-500" /></div>
              ) : groupedReferrals.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <History className="h-10 w-10 mx-auto mb-3 opacity-30" /><p>Henüz yönlendirme yapılmamış</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {groupedReferrals.map(({ name, referrals: refs, count }) => {
                    const expanded = expandedStudents.has(name);
                    const latest = refs[0];
                    const multi = count > 1;
                    return (
                      <div key={name} className="py-2">
                        <button className="w-full text-left" onClick={() => multi && toggleExpand(name)}>
                          <div className="flex items-center gap-3 py-1.5 hover:bg-slate-50 rounded-lg px-2 -mx-2 transition-colors">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${multi ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-500"}`}>
                              {count}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-slate-800 text-sm">{name}</span>
                                {latest.class_display && <Badge variant="outline" className="text-xs">{latest.class_display}</Badge>}
                                {multi && <Badge className="bg-violet-100 text-violet-700 text-xs">{count}× yönlendirildi</Badge>}
                              </div>
                              {!expanded && (
                                <p className="text-xs text-slate-400 mt-0.5 truncate">
                                  Son: {latest.reason || "—"} · {new Date(latest.created_at).toLocaleDateString("tr-TR")}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Badge className={`text-xs ${latest.status === "Tamamlandı" ? "bg-green-100 text-green-700" : latest.status === "Devam Ediyor" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
                                {latest.status}
                              </Badge>
                              {multi && <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`} />}
                            </div>
                          </div>
                        </button>
                        {multi && expanded && (
                          <div className="mt-1 ml-11 border-l-2 border-violet-100 pl-3 space-y-2">
                            {refs.map(r => (
                              <div key={r.id} className="flex items-start justify-between gap-2 py-1.5">
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs text-slate-600 font-medium">{r.reason || "Neden belirtilmemiş"}</p>
                                  <p className="text-xs text-slate-400">{new Date(r.created_at).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}</p>
                                </div>
                                <Badge className={`text-xs shrink-0 ${r.status === "Tamamlandı" ? "bg-green-100 text-green-700" : r.status === "Devam Ediyor" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
                                  {r.status}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Class List ── */}
      {activeTab === "class-list" && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <CardTitle className="text-base">
              Sınıf Listesi
              {auth.classDisplay && <span className="ml-2 text-sm font-normal text-slate-500">({auth.classDisplay})</span>}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => auth.classKey && loadStudents(auth.classKey)} disabled={studentsLoading || !auth.classKey}>
              <RefreshCw className={`h-4 w-4 ${studentsLoading ? "animate-spin" : ""}`} />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {!auth.classKey ? (
              <div className="text-center py-12 text-slate-400">
                <UserCheck className="h-10 w-10 mx-auto mb-3 opacity-30" /><p>Sınıf ataması yapılmamış</p>
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <input type="text" placeholder="Öğrenci adı soyadı" value={newStudentName}
                    onChange={e => setNewStudentName(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleAddStudent()}
                    className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400" />
                  <input type="text" placeholder="No" value={newStudentNumber}
                    onChange={e => setNewStudentNumber(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleAddStudent()}
                    className="w-16 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400" />
                  <Button onClick={handleAddStudent} disabled={!newStudentName.trim() || addingStudent} size="sm" className="bg-violet-600 hover:bg-violet-700 text-white px-3">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {studentsLoading ? (
                  <div className="flex justify-center py-8"><div className="w-8 h-8 border-4 border-violet-500/30 rounded-full animate-spin border-t-violet-500" /></div>
                ) : students.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-30" /><p className="text-sm">Sınıf listesi boş</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {students.map((s, i) => {
                      const pending = getStudentPendingRequest(s.text);
                      return (
                        <div key={s.value} className="py-2.5 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-xs text-slate-400 w-5 text-right shrink-0">{i + 1}</span>
                            <span className="text-sm text-slate-800 font-medium truncate">{s.text}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {pending ? (
                              <Badge className="text-xs bg-amber-100 text-amber-700">
                                {pending.request_type === "delete" ? "Silme" : "Sınıf değişikliği"} talebi bekliyor
                              </Badge>
                            ) : (
                              <>
                                <button onClick={() => { setRequestModal({ student: s, type: "class_change" }); setClassChangeTarget(""); }}
                                  className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Sınıf değiştirme talebi">
                                  <ArrowRightLeft className="h-3.5 w-3.5" />
                                  <span className="hidden sm:inline">Sınıf Değiştir</span>
                                </button>
                                <button onClick={() => setRequestModal({ student: s, type: "delete" })}
                                  className="flex items-center gap-1 px-2 py-1 text-xs text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Silme talebi">
                                  <Trash2 className="h-3.5 w-3.5" />
                                  <span className="hidden sm:inline">Sil</span>
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Class Referrals ── */}
      {activeTab === "class-referrals" && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <CardTitle className="text-base">
              Sınıfa Yapılan Yönlendirmeler
              {auth.classDisplay && <span className="ml-2 text-sm font-normal text-slate-500">({auth.classDisplay})</span>}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={loadReferrals} disabled={referralsLoading}>
              <RefreshCw className={`h-4 w-4 ${referralsLoading ? "animate-spin" : ""}`} />
            </Button>
          </CardHeader>
          <CardContent>
            {!auth.classKey ? (
              <div className="text-center py-12 text-slate-400"><BookOpen className="h-10 w-10 mx-auto mb-3 opacity-30" /><p>Sınıf ataması yapılmamış</p></div>
            ) : referralsLoading ? (
              <div className="flex justify-center py-8"><div className="w-8 h-8 border-4 border-violet-500/30 rounded-full animate-spin border-t-violet-500" /></div>
            ) : classReferrals.length === 0 ? (
              <div className="text-center py-12 text-slate-400"><BookOpen className="h-10 w-10 mx-auto mb-3 opacity-30" /><p>Sınıfınızdaki öğrenciler için yönlendirme bulunmuyor</p></div>
            ) : (
              <div className="divide-y divide-slate-100">
                {classReferrals.map(r => (
                  <div key={r.id} className="py-3 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-slate-800 text-sm">{r.student_name}</span>
                        {r.teacher_name && <span className="text-xs text-slate-400">— {r.teacher_name}</span>}
                      </div>
                      {r.reason && <p className="text-xs text-slate-500 mt-0.5 truncate">{r.reason}</p>}
                      <p className="text-xs text-slate-400 mt-0.5">{new Date(r.created_at).toLocaleDateString("tr-TR")}</p>
                    </div>
                    <Badge className={`text-xs shrink-0 ${r.status === "Tamamlandı" ? "bg-green-100 text-green-700" : r.status === "Devam Ediyor" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
                      {r.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Guidance Requests ── */}
      {activeTab === "guidance-requests" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-800">Rehberlik Servisine Talepler</h2>
              <p className="text-xs text-slate-500 mt-0.5">Rehber öğretmenden sınıfınız için çalışma talep edin</p>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => auth.teacherName && loadGuidanceRequests(auth.teacherName)} disabled={guidanceRequestsLoading}>
                <RefreshCw className={`h-4 w-4 ${guidanceRequestsLoading ? "animate-spin" : ""}`} />
              </Button>
              <Button onClick={() => setShowNewGuidanceModal(true)} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5">
                <Plus className="h-4 w-4" /> Yeni Talep
              </Button>
            </div>
          </div>

          {guidanceRequestsLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-emerald-500/30 rounded-full animate-spin border-t-emerald-500" />
            </div>
          ) : guidanceRequests.length === 0 ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="py-16 text-center text-slate-400">
                <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Henüz talep oluşturulmamış</p>
                <p className="text-sm mt-1">Rehber öğretmenden sınıfınız için çalışma talebinde bulunabilirsiniz</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {guidanceRequests.map(req => {
                const statusInfo = REQUEST_STATUS[req.status];
                const showFeedbackBox = req.status === "completed" && !req.feedback;
                return (
                  <Card key={req.id} className="border-0 shadow-sm overflow-hidden">
                    <CardContent className="p-4 space-y-3">
                      {/* Top row */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-semibold text-slate-800 text-sm">{req.topic}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusInfo.cls}`}>{statusInfo.label}</span>
                          </div>
                          {req.description && (
                            <p className="text-xs text-slate-500 leading-relaxed">{req.description}</p>
                          )}
                          <p className="text-xs text-slate-400 mt-1">
                            {new Date(req.created_at).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}
                          </p>
                        </div>
                      </div>

                      {/* Scheduled info */}
                      {req.status === "scheduled" && req.scheduled_date && (
                        <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl">
                          <Calendar className="h-4 w-4 text-blue-500 shrink-0" />
                          <div>
                            <p className="text-sm font-semibold text-blue-800">{formatDateShort(req.scheduled_date)}</p>
                            {req.lesson_slot && (
                              <p className="text-xs text-blue-600 flex items-center gap-1 mt-0.5">
                                <Clock className="h-3 w-3" /> {req.lesson_slot}. ders saati
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Completed info */}
                      {req.status === "completed" && (
                        <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-xl">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-emerald-700">Çalışma tamamlandı</p>
                            {req.scheduled_date && (
                              <p className="text-xs text-emerald-600">{formatDateShort(req.scheduled_date)}{req.lesson_slot ? ` — ${req.lesson_slot}. ders` : ""}</p>
                            )}
                            {req.feedback && (
                              <p className="text-xs text-slate-600 mt-1 italic">Geri bildiriminiz: {req.feedback}</p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Feedback input for completed requests */}
                      {showFeedbackBox && (
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-slate-600">Geri bildirim ekleyin (isteğe bağlı)</p>
                          <div className="flex gap-2">
                            <textarea
                              rows={2}
                              placeholder="Çalışma hakkında görüşlerinizi paylaşın..."
                              value={feedbackInputs[req.id] || ""}
                              onChange={e => setFeedbackInputs(prev => ({ ...prev, [req.id]: e.target.value }))}
                              className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400/30 focus:border-emerald-400 resize-none"
                            />
                            <Button
                              size="sm"
                              onClick={() => submitFeedback(req.id)}
                              disabled={!feedbackInputs[req.id]?.trim() || submittingFeedback === req.id}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white self-end"
                            >
                              {submittingFeedback === req.id ? "..." : "Gönder"}
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Student Request Modal ── */}
      {requestModal.student && requestModal.type && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setRequestModal({ student: null, type: null })} />
          <Card className="relative w-full max-w-md border-0 shadow-2xl z-10">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                {requestModal.type === "delete"
                  ? <><Trash2 className="h-4 w-4 text-red-500" /> Silme Talebi</>
                  : <><ArrowRightLeft className="h-4 w-4 text-blue-500" /> Sınıf Değiştirme Talebi</>}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl">
                <p className="text-xs text-slate-500">Öğrenci</p>
                <p className="text-sm font-semibold text-slate-800 mt-0.5">{requestModal.student.text}</p>
              </div>
              {requestModal.type === "class_change" && (
                <div>
                  <p className="text-xs font-medium text-slate-600 mb-1.5">Hedef Sınıf</p>
                  <select value={classChangeTarget} onChange={e => setClassChangeTarget(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400">
                    <option value="">Sınıf seçin...</option>
                    {sinifList.filter(s => s.value !== auth?.classKey).map(s => (
                      <option key={s.value} value={s.value}>{s.text}</option>
                    ))}
                  </select>
                </div>
              )}
              {requestModal.type === "delete" && (
                <div className="flex items-start gap-2 p-3 bg-red-50 rounded-xl text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  Bu öğrenci için silme talebi yöneticiye gönderilecek. Yönetici onayladıktan sonra işlem gerçekleşecek.
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => setRequestModal({ student: null, type: null })}>
                  İptal
                </Button>
                <Button
                  className={`flex-1 text-white ${requestModal.type === "delete" ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"}`}
                  onClick={submitRequest} disabled={submittingRequest}>
                  {submittingRequest ? "Gönderiliyor..." : "Talep Gönder"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── New Guidance Request Modal ── */}
      {showNewGuidanceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowNewGuidanceModal(false)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden z-10">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-100">
                  <MessageSquare className="h-4 w-4 text-emerald-600" />
                </div>
                <h3 className="text-base font-bold text-slate-800">Rehberlik Çalışma Talebi</h3>
              </div>
              <button onClick={() => setShowNewGuidanceModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl">
                <p className="text-xs text-slate-500">Sınıf</p>
                <p className="text-sm font-semibold text-slate-800 mt-0.5">{auth.classDisplay || auth.classKey}</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">Konu</label>
                <select
                  value={newRequestTopic}
                  onChange={e => setNewRequestTopic(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
                >
                  <option value="">Konu seçin...</option>
                  {GUIDANCE_TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">
                  Detaylı Açıklama <span className="text-slate-400 font-normal">(isteğe bağlı)</span>
                </label>
                <textarea
                  rows={3}
                  value={newRequestDescription}
                  onChange={e => setNewRequestDescription(e.target.value)}
                  placeholder="Neden bu çalışmaya ihtiyaç duyduğunuzu açıklayın..."
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 px-5 pb-5">
              <button
                onClick={() => { setShowNewGuidanceModal(false); setNewRequestTopic(""); setNewRequestDescription(""); }}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                İptal
              </button>
              <button
                onClick={submitGuidanceRequest}
                disabled={!newRequestTopic || submittingGuidanceRequest}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:from-emerald-600 hover:to-teal-700 transition-all"
              >
                {submittingGuidanceRequest ? "Gönderiliyor..." : "Talep Gönder"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
