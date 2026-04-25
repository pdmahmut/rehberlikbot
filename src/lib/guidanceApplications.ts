import type {
  ApplicationSourceType,
  ApplicationStatus,
  ObservationPoolRecord,
} from "@/types";

export type LegacyApplicationSourceType =
  | ApplicationSourceType
  | "parent_meeting"
  | "student_incident";

export type PanelApplicationSource =
  | "Gözlem Havuzu"
  | "Öğrenci Bildirimleri"
  | "Öğretmen Yönlendirmeleri"
  | "Veli Talepleri"
  | "Bireysel Başvuru";

type SourceReferenceInput = {
  source_application_type?: string | null;
  source_application_id?: string | null;
  source_individual_request_id?: string | null;
};

type ObservationProxyMeta = {
  sourceType: ApplicationSourceType;
  sourceRecordId: string | null;
  legacyObservationId: string | null;
  isProxy: boolean;
};

const SOURCE_TABLES: Record<ApplicationSourceType, string> = {
  observation: "observation_pool",
  self_application: "individual_requests",
  teacher_referral: "referrals",
  parent_request: "parent_meeting_requests",
  student_report: "student_incidents",
};

export const APPLICATION_SOURCE_LABELS: Record<ApplicationSourceType, string> = {
  observation: "Gözlem Havuzu",
  student_report: "Öğrenci Bildirimi",
  teacher_referral: "Öğretmen Yönlendirmesi",
  parent_request: "Veli Talebi",
  self_application: "Bireysel Başvuru",
};

export const PANEL_SOURCE_LABELS: Record<ApplicationSourceType, PanelApplicationSource> = {
  observation: "Gözlem Havuzu",
  student_report: "Öğrenci Bildirimleri",
  teacher_referral: "Öğretmen Yönlendirmeleri",
  parent_request: "Veli Talepleri",
  self_application: "Bireysel Başvuru",
};

const PANEL_SOURCE_TO_TYPE: Record<PanelApplicationSource, ApplicationSourceType> = {
  "Gözlem Havuzu": "observation",
  "Öğrenci Bildirimleri": "student_report",
  "Öğretmen Yönlendirmeleri": "teacher_referral",
  "Veli Talepleri": "parent_request",
  "Bireysel Başvuru": "self_application",
};

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  pending: "Bekliyor",
  scheduled: "Randevu Verildi",
  active_follow: "Aktif Takip",
  completed: "Görüşme Yapıldı",
};

export const APPLICATION_STATUS_COLORS: Record<ApplicationStatus, string> = {
  pending: "bg-amber-100 text-amber-700",
  scheduled: "bg-blue-100 text-blue-700",
  active_follow: "bg-cyan-100 text-cyan-700",
  completed: "bg-emerald-100 text-emerald-700",
};

const normalizeText = (value?: string | null) =>
  String(value || "").trim().toLocaleLowerCase("tr-TR");

export function normalizeApplicationStatus(status?: string | null): ApplicationStatus {
  switch (normalizeText(status)) {
    case "scheduled":
    case "randevu verildi":
    case "converted":
    case "randevu_verildi":
      return "scheduled";
    case "active_follow":
    case "aktif takip":
    case "regular_meeting":
    case "active":
    case "regular":
      return "active_follow";
    case "completed":
    case "closed":
    case "resolved":
    case "görüşüldü":
    case "goruşuldu":
    case "gorusuldu":
      return "completed";
    case "reviewing":
    case "new":
    case "pending":
    case "bekliyor":
    default:
      return "pending";
  }
}

export function normalizeSourceType(
  value?: string | null,
  fallback: ApplicationSourceType = "observation"
): ApplicationSourceType {
  switch (value) {
    case "student_report":
    case "teacher_referral":
    case "parent_request":
    case "self_application":
    case "observation":
      return value;
    case "parent_meeting":
      return "parent_request";
    case "student_incident":
      return "student_report";
    default:
      return fallback;
  }
}

export function normalizeSourceTypeOrNull(value?: string | null): ApplicationSourceType | null {
  if (!value?.trim()) return null;
  switch (value) {
    case "student_report":
    case "teacher_referral":
    case "parent_request":
    case "self_application":
    case "observation":
    case "parent_meeting":
    case "student_incident":
      return normalizeSourceType(value, "observation");
    default:
      return null;
  }
}

export function getApplicationSourceLabel(value?: string | null) {
  return APPLICATION_SOURCE_LABELS[normalizeSourceType(value)];
}

export function getPanelSourceLabel(value?: string | null): PanelApplicationSource {
  return PANEL_SOURCE_LABELS[normalizeSourceType(value)];
}

export function getSourceTypeFromPanelLabel(value?: string | null): ApplicationSourceType | null {
  if (!value?.trim()) return null;
  return PANEL_SOURCE_TO_TYPE[value as PanelApplicationSource] || null;
}

export function getSourceTable(sourceType: ApplicationSourceType) {
  return SOURCE_TABLES[sourceType];
}

export function buildApplicationNote(record: Partial<ObservationPoolRecord>) {
  return record.note || "";
}

export function buildSourceRecordKey(
  sourceType?: string | null,
  sourceRecordId?: string | null
) {
  const normalizedType = normalizeSourceTypeOrNull(sourceType);
  const normalizedId = sourceRecordId?.trim();
  if (!normalizedType || !normalizedId) return null;
  return `${normalizedType}:${normalizedId}`;
}

export function getAppointmentSourceReference(input: SourceReferenceInput) {
  const sourceType =
    normalizeSourceTypeOrNull(input.source_application_type) ||
    (input.source_individual_request_id ? "self_application" : null);

  if (!sourceType) {
    return { sourceType: null, sourceRecordId: null, sourceKey: null };
  }

  const sourceRecordId =
    (sourceType === "self_application"
      ? input.source_application_id || input.source_individual_request_id
      : input.source_application_id) || null;

  return {
    sourceType,
    sourceRecordId,
    sourceKey: buildSourceRecordKey(sourceType, sourceRecordId),
  };
}

export function isAppointmentLinkedToSource(
  appointment: SourceReferenceInput,
  sourceType?: string | null,
  sourceRecordId?: string | null
) {
  const sourceKey = buildSourceRecordKey(sourceType, sourceRecordId);
  if (!sourceKey) return false;
  return getAppointmentSourceReference(appointment).sourceKey === sourceKey;
}

export function getObservationProxyMeta(
  record: Partial<ObservationPoolRecord>
): ObservationProxyMeta {
  const sourceType = normalizeSourceType(record.source_type, "observation");
  const sourceRecordId = record.source_record_id?.trim() || null;
  const legacyObservationId = record.id?.trim() || null;
  const isProxy = sourceType !== "observation";

  return {
    sourceType,
    sourceRecordId,
    legacyObservationId,
    isProxy,
  };
}

export function getStatusCandidatesForSource(
  sourceType: ApplicationSourceType,
  status: ApplicationStatus
) {
  const candidates: Record<ApplicationSourceType, Record<ApplicationStatus, string[]>> = {
    observation: {
      pending: ["pending", "Bekliyor"],
      scheduled: ["scheduled", "converted", "randevu_verildi", "Randevu verildi"],
      active_follow: ["active_follow", "regular_meeting", "completed", "Görüşüldü"],
      completed: ["completed", "Görüşüldü"],
    },
    self_application: {
      pending: ["pending", "Bekliyor"],
      scheduled: ["scheduled", "Randevu verildi", "pending"],
      active_follow: ["active_follow", "completed", "Görüşüldü"],
      completed: ["completed", "Görüşüldü"],
    },
    teacher_referral: {
      pending: ["Bekliyor", "pending"],
      scheduled: ["Randevu verildi", "scheduled"],
      active_follow: ["Görüşüldü", "completed"],
      completed: ["Görüşüldü", "completed"],
    },
    parent_request: {
      pending: ["pending", "new", "Bekliyor"],
      scheduled: ["scheduled", "Randevu verildi", "reviewing"],
      active_follow: ["closed", "completed", "reviewing"],
      completed: ["closed", "completed", "Görüşüldü"],
    },
    student_report: {
      pending: ["new", "pending", "Bekliyor"],
      scheduled: ["reviewing", "scheduled", "Randevu verildi"],
      active_follow: ["resolved", "reviewing", "completed"],
      completed: ["resolved", "completed", "Görüşüldü"],
    },
  };

  return Array.from(new Set(candidates[sourceType][status]));
}

export function isPendingStatus(value?: string | null) {
  return normalizeApplicationStatus(value) === "pending";
}

export async function upsertGuidanceApplicationRecord(payload: {
  student_name: string;
  student_number?: string | null;
  class_key?: string | null;
  class_display?: string | null;
  note?: string | null;
  observed_at?: string;
  observation_type?: string;
  priority?: string;
  status?: string;
  source_type: ApplicationSourceType;
  source_record_id?: string | null;
  source_record_table?: string | null;
}) {
  const response = await fetch("/api/gozlem-havuzu", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.error || "Merkezi başvuru kaydı güncellenemedi");
  }

  return response.json();
}
