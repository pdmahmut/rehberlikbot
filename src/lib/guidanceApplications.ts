import type {
  ApplicationSourceType,
  ApplicationStatus,
  ObservationPoolRecord
} from "@/types";

export const APPLICATION_SOURCE_LABELS: Record<ApplicationSourceType, string> = {
  observation: "Gözlem Havuzu",
  student_report: "Öğrenci Bildirimi",
  teacher_referral: "Öğretmen Yönlendirmesi",
  parent_request: "Veli Talebi",
  self_application: "Bireysel Başvuru"
};

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  pending: "Bekliyor",
  scheduled: "Randevu Verildi",
  active_follow: "Aktif Takip",
  regular_meeting: "Düzenli Görüşme",
  completed: "Görüşme Yapıldı"
};

export const APPLICATION_STATUS_COLORS: Record<ApplicationStatus, string> = {
  pending: "bg-amber-100 text-amber-700",
  scheduled: "bg-blue-100 text-blue-700",
  active_follow: "bg-cyan-100 text-cyan-700",
  regular_meeting: "bg-violet-100 text-violet-700",
  completed: "bg-emerald-100 text-emerald-700"
};

export function normalizeApplicationStatus(status?: string | null): ApplicationStatus {
  switch (status) {
    case "scheduled":
    case "active_follow":
    case "regular_meeting":
    case "completed":
      return status;
    case "randevu_verildi":
      return "scheduled";
    case "converted":
      return "scheduled";
    default:
      return "pending";
  }
}

export function normalizeSourceType(value?: string | null): ApplicationSourceType {
  switch (value) {
    case "student_report":
    case "teacher_referral":
    case "parent_request":
    case "self_application":
    case "observation":
      return value;
    default:
      return "observation";
  }
}

export function getApplicationSourceLabel(value?: string | null) {
  return APPLICATION_SOURCE_LABELS[normalizeSourceType(value)];
}

export function buildApplicationNote(record: Partial<ObservationPoolRecord>) {
  return record.note || "";
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
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.error || "Merkezi başvuru kaydı güncellenemedi");
  }

  return response.json();
}
