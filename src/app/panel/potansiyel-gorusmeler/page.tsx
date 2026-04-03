"use client";

import { useEffect, useMemo, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { MessageSquare, Users, Eye, Search, RefreshCw, Calendar, Clock, ArrowRight, Loader2, PhoneCall, Edit2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  ReferralRecord,
  ObservationPoolRecord,
  StudentIncidentRecord,
  ParentMeetingRequestRecord,
  INCIDENT_STATUSES,
  OBSERVATION_PRIORITIES,
  OBSERVATION_STATUSES,
  OBSERVATION_TYPES,
  PARENT_REQUEST_STATUSES
} from "@/types";

type SourceTab = "all" | "incidents" | "referrals" | "observations" | "requests";

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  return new Date(value).toLocaleString("tr-TR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
};

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

const matchesQuery = (fields: Array<string | null | undefined>, query: string) => {
  if (!query) return true;
  const text = fields.filter(Boolean).join(" ");
  return normalizeText(text).includes(query);
};

const buildAppointmentUrl = (studentName: string, classDisplay?: string | null, classKey?: string | null, note?: string | null) => {
  const params = new URLSearchParams();
  if (studentName) params.set("studentName", studentName);
  if (classDisplay) params.set("classDisplay", classDisplay);
  if (classKey) params.set("classKey", classKey);
  if (note) params.set("note", note);
  return `/panel/randevu?${params.toString()}`;
};

function AppointmentButton({ href }: { href: string }) {
  return (
    <Button asChild size="sm" className="w-full border-0 bg-gradient-to-r from-indigo-600 via-sky-600 to-cyan-600 text-white shadow-lg shadow-cyan-500/20 transition-all hover:scale-[1.01] hover:from-indigo-500 hover:via-sky-500 hover:to-cyan-500 sm:w-auto">
      <Link href={href}>
        <ArrowRight className="mr-2 h-4 w-4" />
        Randevuya dönüştür
      </Link>
    </Button>
  );
}

export default function PotansiyelGorusmelerPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<SourceTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [referrals, setReferrals] = useState<ReferralRecord[]>([]);
  const [observations, setObservations] = useState<ObservationPoolRecord[]>([]);
  const [incidents, setIncidents] = useState<StudentIncidentRecord[]>([]);
  const [requests, setRequests] = useState<ParentMeetingRequestRecord[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setLoadError(null);

      const [referralResult, observationResult, incidentResult, requestResult] = await Promise.all([
        supabase.from("referrals").select("*").order("created_at", { ascending: false }),
        fetch("/api/gozlem-havuzu?status=pending"),
        supabase
          .from("student_incidents")
          .select("*")
          .in("status", ["new", "reviewing"])
          .order("incident_date", { ascending: false })
          .order("created_at", { ascending: false }),
        supabase
          .from("parent_meeting_requests")
          .select("*")
          .order("created_at", { ascending: false })
      ]);

      if (referralResult.error) throw referralResult.error;
      if (incidentResult.error) throw incidentResult.error;
      if (requestResult.error) throw requestResult.error;

      setReferrals((referralResult.data || []) as ReferralRecord[]);
      setIncidents((incidentResult.data || []) as StudentIncidentRecord[]);
      setRequests((requestResult.data || []) as ParentMeetingRequestRecord[]);

      if (observationResult.ok) {
        const json = await observationResult.json();
        setObservations(Array.isArray(json.observations) ? json.observations : []);
      } else {
        setObservations([]);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Beklenmeyen hata";
      setLoadError(message);
      toast.error("Potansiyel görüşmeler yüklenemedi");
      console.error("Potansiyel görüşmeler yüklenemedi:", message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const query = normalizeText(searchQuery);

  const filteredIncidents = useMemo(() => {
    return incidents.filter((incident) =>
      matchesQuery(
        [
          incident.target_student_name,
          incident.reporter_student_name,
          incident.description,
          incident.status,
          incident.incident_type
        ],
        query
      )
    );
  }, [incidents, query]);

  const filteredReferrals = useMemo(() => {
    return referrals.filter((referral) =>
      matchesQuery([referral.student_name, referral.teacher_name, referral.class_display, referral.reason, referral.note], query)
    );
  }, [referrals, query]);

  const filteredObservations = useMemo(() => {
    return observations.filter((observation) =>
      matchesQuery(
        [
          observation.student_name,
          observation.student_number,
          observation.class_display,
          observation.note,
          observation.observation_type,
          observation.priority,
          observation.status
        ],
        query
      )
    );
  }, [observations, query]);

  const filteredRequests = useMemo(() => {
    return requests.filter((request) =>
      matchesQuery(
        [
          request.student_name,
          request.parent_name,
          request.class_display,
          request.subject,
          request.detail,
          request.status
        ],
        query
      )
    );
  }, [requests, query]);

  const totalVisible =
    filteredIncidents.length + filteredReferrals.length + filteredObservations.length + filteredRequests.length;

  const handleEditSource = (kind: "incident" | "referral" | "observation" | "request", record: { studentName: string; classDisplay?: string | null }) => {
    const classDisplay = record.classDisplay || undefined;
    const studentName = record.studentName || undefined;

    switch (kind) {
      case "incident":
        router.push("/panel/ogrenci-bildirimleri");
        return;
      case "referral":
        router.push(studentName ? `/panel/ogrenci-gecmisi?studentName=${encodeURIComponent(studentName)}${classDisplay ? `&classDisplay=${encodeURIComponent(classDisplay)}` : ""}` : "/panel/ogrenci-gecmisi");
        return;
      case "observation":
        router.push(studentName ? `/panel/gozlem-havuzu?studentName=${encodeURIComponent(studentName)}${classDisplay ? `&classDisplay=${encodeURIComponent(classDisplay)}` : ""}` : "/panel/gozlem-havuzu");
        return;
      case "request":
        router.push("/panel/veli-talepleri");
        return;
    }
  };

  const handleDeleteSource = async (kind: "incident" | "referral" | "observation" | "request", id?: string) => {
    if (!id) {
      toast.error("Kayıt silinemedi");
      return;
    }

    const confirmed = window.confirm("Bu kaydı silmek istediğinize emin misiniz?");
    if (!confirmed) return;

    try {
      if (kind === "observation") {
        const res = await fetch(`/api/gozlem-havuzu?id=${encodeURIComponent(id)}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Gözlem kaydı silinemedi");
      } else if (kind === "incident") {
        const { error } = await supabase.from("student_incidents").delete().eq("id", id);
        if (error) throw error;
      } else if (kind === "referral") {
        const { error } = await supabase.from("referrals").delete().eq("id", id);
        if (error) throw error;
      } else if (kind === "request") {
        const { error } = await supabase.from("parent_meeting_requests").delete().eq("id", id);
        if (error) throw error;
      }

      toast.success("Kayıt silindi");
      await loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Kayıt silinemedi";
      toast.error(message);
      console.error("Potansiyel görüşme silme hatası:", error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-cyan-900 to-teal-700 p-6 text-white shadow-xl">
        <div className="absolute inset-0 bg-grid-white/10" />
        <div className="absolute -top-20 -right-20 h-56 w-56 rounded-full bg-cyan-300/20 blur-3xl animate-float-slow" />
        <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-teal-400/20 blur-3xl animate-float-reverse" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm shadow-lg">
              <MessageSquare className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Potansiyel Görüşmeler</h1>
              <p className="text-slate-200">
                Öğretmen yönlendirmeleri, gözlem havuzu ve öğrenci bildirimleri tek ekranda.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="rounded-lg border border-white/10 bg-white/10 px-3 py-2 backdrop-blur-sm">
              <p className="text-[10px] uppercase tracking-wider text-cyan-100">Toplam</p>
              <p className="text-lg font-bold leading-none">{totalVisible}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/10 px-3 py-2 backdrop-blur-sm">
              <p className="text-[10px] uppercase tracking-wider text-cyan-100">Bildirim</p>
              <p className="text-lg font-bold leading-none">{filteredIncidents.length}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/10 px-3 py-2 backdrop-blur-sm">
              <p className="text-[10px] uppercase tracking-wider text-cyan-100">Yönlendirme</p>
              <p className="text-lg font-bold leading-none">{filteredReferrals.length}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/10 px-3 py-2 backdrop-blur-sm">
              <p className="text-[10px] uppercase tracking-wider text-cyan-100">Gözlem</p>
              <p className="text-lg font-bold leading-none">{filteredObservations.length}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/10 px-3 py-2 backdrop-blur-sm">
              <p className="text-[10px] uppercase tracking-wider text-cyan-100">Veli Talebi</p>
              <p className="text-lg font-bold leading-none">{filteredRequests.length}</p>
            </div>
          </div>
        </div>
      </div>

      <Card className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Öğrenci adı, sınıf, öğretmen, açıklama..."
                className="pl-10"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={loadData}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Yenile
              </Button>
              <Button asChild className="bg-slate-900 hover:bg-slate-800">
                <Link href="/panel/ogrenci-bildirimleri">
                  <ArrowRight className="mr-2 h-4 w-4" />
                  Bildirim Ekranı
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {loadError && (
        <Card className="overflow-hidden rounded-2xl border border-amber-200 bg-amber-50 shadow-sm">
          <CardContent className="p-4 text-sm text-amber-800">
            <strong>Yükleme uyarısı:</strong> {loadError}
          </CardContent>
        </Card>
      )}

      {loading ? (
        <Card className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <CardContent className="flex items-center justify-center py-14">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-600" />
            <span className="ml-3 text-slate-600">Potansiyel görüşmeler yükleniyor...</span>
          </CardContent>
        </Card>
      ) : (
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as SourceTab)}>
          <TabsList className="grid h-auto w-full grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-2 md:grid-cols-5">
            <TabsTrigger value="all">Tümü</TabsTrigger>
            <TabsTrigger value="incidents">Öğrenci Bildirimleri</TabsTrigger>
            <TabsTrigger value="referrals">Öğretmen Yönlendirmeleri</TabsTrigger>
            <TabsTrigger value="observations">Gözlem Havuzu</TabsTrigger>
            <TabsTrigger value="requests">Veli Talepleri</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-6 space-y-4">
            <SectionBlock
              title="Öğrenci Bildirimleri"
              icon={MessageSquare}
              count={filteredIncidents.length}
              emptyText="Bildirim bulunamadı"
            >
              {filteredIncidents.map((incident) => (
                <IncidentCard
                  key={incident.id}
                  incident={incident}
                  onEdit={() => handleEditSource("incident", { studentName: incident.target_student_name || "", classDisplay: incident.target_class_display || null })}
                  onDelete={() => handleDeleteSource("incident", incident.id)}
                />
              ))}
            </SectionBlock>

            <SectionBlock
              title="Öğretmen Yönlendirmeleri"
              icon={Users}
              count={filteredReferrals.length}
              emptyText="Yönlendirme bulunamadı"
            >
              {filteredReferrals.map((referral) => (
                <ReferralCard
                  key={referral.id}
                  referral={referral}
                  onEdit={() => handleEditSource("referral", { studentName: referral.student_name, classDisplay: referral.class_display || null })}
                  onDelete={() => handleDeleteSource("referral", referral.id)}
                />
              ))}
            </SectionBlock>

            <SectionBlock
              title="Gözlem Havuzu"
              icon={Eye}
              count={filteredObservations.length}
              emptyText="Gözlem kaydı bulunamadı"
            >
              {filteredObservations.map((observation) => (
                <ObservationCard
                  key={observation.id}
                  observation={observation}
                  onEdit={() => handleEditSource("observation", { studentName: observation.student_name, classDisplay: observation.class_display || null })}
                  onDelete={() => handleDeleteSource("observation", observation.id)}
                />
              ))}
            </SectionBlock>

            <SectionBlock
              title="Veli Talepleri"
              icon={PhoneCall}
              count={filteredRequests.length}
              emptyText="Veli talebi bulunamadı"
            >
              {filteredRequests.map((request) => (
                <ParentRequestCard
                  key={request.id}
                  request={request}
                  onEdit={() => handleEditSource("request", { studentName: request.student_name, classDisplay: request.class_display || null })}
                  onDelete={() => handleDeleteSource("request", request.id)}
                />
              ))}
            </SectionBlock>
          </TabsContent>

          <TabsContent value="incidents" className="mt-6">
            <SectionBlock
              title="Öğrenci Bildirimleri"
              icon={MessageSquare}
              count={filteredIncidents.length}
              emptyText="Bildirim bulunamadı"
            >
              {filteredIncidents.map((incident) => (
                <IncidentCard
                  key={incident.id}
                  incident={incident}
                  onEdit={() => handleEditSource("incident", { studentName: incident.target_student_name || "", classDisplay: incident.target_class_display || null })}
                  onDelete={() => handleDeleteSource("incident", incident.id)}
                />
              ))}
            </SectionBlock>
          </TabsContent>

          <TabsContent value="referrals" className="mt-6">
            <SectionBlock
              title="Öğretmen Yönlendirmeleri"
              icon={Users}
              count={filteredReferrals.length}
              emptyText="Yönlendirme bulunamadı"
            >
              {filteredReferrals.map((referral) => (
                <ReferralCard
                  key={referral.id}
                  referral={referral}
                  onEdit={() => handleEditSource("referral", { studentName: referral.student_name, classDisplay: referral.class_display || null })}
                  onDelete={() => handleDeleteSource("referral", referral.id)}
                />
              ))}
            </SectionBlock>
          </TabsContent>

          <TabsContent value="observations" className="mt-6">
            <SectionBlock
              title="Gözlem Havuzu"
              icon={Eye}
              count={filteredObservations.length}
              emptyText="Gözlem kaydı bulunamadı"
            >
              {filteredObservations.map((observation) => (
                <ObservationCard
                  key={observation.id}
                  observation={observation}
                  onEdit={() => handleEditSource("observation", { studentName: observation.student_name, classDisplay: observation.class_display || null })}
                  onDelete={() => handleDeleteSource("observation", observation.id)}
                />
              ))}
            </SectionBlock>
          </TabsContent>

          <TabsContent value="requests" className="mt-6">
            <SectionBlock
              title="Veli Talepleri"
              icon={PhoneCall}
              count={filteredRequests.length}
              emptyText="Veli talebi bulunamadı"
            >
              {filteredRequests.map((request) => (
                <ParentRequestCard
                  key={request.id}
                  request={request}
                  onEdit={() => handleEditSource("request", { studentName: request.student_name, classDisplay: request.class_display || null })}
                  onDelete={() => handleDeleteSource("request", request.id)}
                />
              ))}
            </SectionBlock>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function SectionBlock({
  title,
  icon: Icon,
  count,
  emptyText,
  children
}: {
  title: string;
  icon: ComponentType<{ className?: string }>;
  count: number;
  emptyText: string;
  children: ReactNode;
}) {
  return (
    <Card className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <CardHeader className="border-b bg-slate-50 py-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Icon className="h-4 w-4" />
          <span>{title}</span>
          <Badge variant="secondary">{count}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-4">
        {count === 0 ? <p className="py-8 text-center text-slate-500">{emptyText}</p> : children}
      </CardContent>
    </Card>
  );
}

function IncidentCard({
  incident,
  onEdit,
  onDelete
}: {
  incident: StudentIncidentRecord;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isLinkedReporter = incident.record_role === "linked_reporter";
  const roleLabel = isLinkedReporter ? "Bildirimi yapan" : "Hakkında bildirim yapılan";
  const roleBadgeClass = isLinkedReporter
    ? "border-emerald-200 bg-emerald-100 text-emerald-700"
    : "border-orange-200 bg-orange-100 text-orange-700";
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-slate-800">{incident.target_student_name}</h3>
            <Badge variant="outline" className={roleBadgeClass}>{roleLabel}</Badge>
            <div className="w-full sm:ml-auto sm:w-auto">
              <AppointmentButton
                href={buildAppointmentUrl(
                  incident.target_student_name,
                  incident.target_class_display || null,
                  incident.target_class_key || null,
                  incident.description
                )}
              />
            </div>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-700">{incident.description}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={onEdit}
            >
              <Edit2 className="mr-2 h-4 w-4" />
              Düzenle
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onDelete}
              className="text-red-600 hover:bg-red-50"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Sil
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">
            <Clock className="mr-1 h-3.5 w-3.5" />
            {formatDateTime(incident.created_at || incident.incident_date)}
          </Badge>
          {incident.is_confidential && <Badge variant="destructive">Gizli</Badge>}
        </div>
      </div>
    </div>
  );
}

function ReferralCard({
  referral,
  onEdit,
  onDelete
}: {
  referral: ReferralRecord;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-slate-800">{referral.student_name}</h3>
            <Badge variant="outline">Öğretmen yönlendirmesi</Badge>
            <div className="w-full sm:ml-auto sm:w-auto">
              <AppointmentButton href={buildAppointmentUrl(referral.student_name, referral.class_display || null, referral.class_key || null, referral.note || referral.reason)} />
            </div>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            {referral.teacher_name} - {referral.class_display}
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-700">{referral.reason}</p>
          {referral.note && <p className="mt-2 text-xs text-slate-500">Not: {referral.note}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={onEdit}>
              <Edit2 className="mr-2 h-4 w-4" />
              Düzenle
            </Button>
            <Button size="sm" variant="outline" onClick={onDelete} className="text-red-600 hover:bg-red-50">
              <Trash2 className="mr-2 h-4 w-4" />
              Sil
            </Button>
          </div>
        </div>
        <Badge variant="outline">
          <Calendar className="mr-1 h-3.5 w-3.5" />
          {formatDateTime(referral.created_at)}
        </Badge>
      </div>
    </div>
  );
}

function ObservationCard({
  observation,
  onEdit,
  onDelete
}: {
  observation: ObservationPoolRecord;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-slate-800">{observation.student_name}</h3>
            <Badge variant="outline">
              {OBSERVATION_TYPES.find((item) => item.value === observation.observation_type)?.label}
            </Badge>
            <Badge variant="outline">
              {OBSERVATION_PRIORITIES.find((item) => item.value === observation.priority)?.label}
            </Badge>
            <Badge variant="outline">
              {OBSERVATION_STATUSES.find((item) => item.value === observation.status)?.label}
            </Badge>
            <div className="w-full sm:ml-auto sm:w-auto">
              <AppointmentButton href={buildAppointmentUrl(observation.student_name, observation.class_display || null, observation.class_key || null, observation.note)} />
            </div>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            {observation.class_display || observation.class_key || "-"}{observation.student_number ? ` - ${observation.student_number}` : ""}
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-700">{observation.note}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={onEdit}>
              <Edit2 className="mr-2 h-4 w-4" />
              Düzenle
            </Button>
            <Button size="sm" variant="outline" onClick={onDelete} className="text-red-600 hover:bg-red-50">
              <Trash2 className="mr-2 h-4 w-4" />
              Sil
            </Button>
          </div>
        </div>
        <Badge variant="outline">
          <Clock className="mr-1 h-3.5 w-3.5" />
          {formatDateTime(observation.observed_at)}
        </Badge>
      </div>
    </div>
  );
}

function ParentRequestCard({
  request,
  onEdit,
  onDelete
}: {
  request: ParentMeetingRequestRecord;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-slate-800">{request.student_name}</h3>
            <Badge variant="outline">
              {PARENT_REQUEST_STATUSES.find((item) => item.value === request.status)?.label || request.status}
            </Badge>
            <div className="w-full sm:ml-auto sm:w-auto">
              <AppointmentButton href={buildAppointmentUrl(request.student_name, request.class_display || null, request.class_key || null, request.detail)} />
            </div>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            {request.class_display || request.class_key || "-"}
            {request.parent_name ? ` - ${request.parent_name}` : ""}
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-700">{request.subject}</p>
          <p className="mt-1 text-sm text-slate-500">{request.detail}</p>
          {request.preferred_contact && (
            <p className="mt-2 text-xs text-slate-500">Tercih edilen iletişim: {request.preferred_contact}</p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={onEdit}>
              <Edit2 className="mr-2 h-4 w-4" />
              Düzenle
            </Button>
            <Button size="sm" variant="outline" onClick={onDelete} className="text-red-600 hover:bg-red-50">
              <Trash2 className="mr-2 h-4 w-4" />
              Sil
            </Button>
          </div>
        </div>
        <Badge variant="outline">
          <Clock className="mr-1 h-3.5 w-3.5" />
          {formatDateTime(request.created_at)}
        </Badge>
      </div>
    </div>
  );
}
