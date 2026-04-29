export type AdminNotificationKind =
  | "teacher_referral"
  | "class_request"
  | "class_student_request";

export interface AdminNotificationItem {
  id: string;
  kind: AdminNotificationKind;
  sourceId: string;
  title: string;
  summary: string;
  status: string;
  createdAt: string;
  updatedAt: string | null;
  read: boolean;
  popupSeen: boolean;
  targetUrl: string;
  targetLabel: string;
  teacherName?: string | null;
  classDisplay?: string | null;
  studentName?: string | null;
  reason?: string | null;
  note?: string | null;
}

export interface AdminNotificationListResponse {
  notifications: AdminNotificationItem[];
  unreadCount: number;
}

export const ADMIN_NOTIFICATION_KIND_LABELS: Record<AdminNotificationKind, string> = {
  teacher_referral: "Öğretmen Yönlendirmesi",
  class_request: "Sınıf Rehberlik Talebi",
  class_student_request: "Sınıf Talebi",
};

export const buildAdminNotificationId = (
  kind: AdminNotificationKind,
  sourceId: string
) => `${kind}:${sourceId}`;

export const parseAdminNotificationId = (value: string) => {
  const separatorIndex = value.indexOf(":");
  if (separatorIndex <= 0) return null;

  const kind = value.slice(0, separatorIndex) as AdminNotificationKind;
  const sourceId = value.slice(separatorIndex + 1);

  if (!sourceId) return null;
  if (!(kind in ADMIN_NOTIFICATION_KIND_LABELS)) return null;

  return { kind, sourceId };
};

export const isPendingAdminNotification = (item: AdminNotificationItem) => {
  if (item.kind === "teacher_referral") {
    return item.status === "Bekliyor";
  }

  return item.status === "pending";
};
