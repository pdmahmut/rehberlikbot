"use client";

import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AdminNotificationItem } from "@/lib/adminNotifications";

type NotificationDetailModalProps = {
  open: boolean;
  item: AdminNotificationItem | null;
  onOpenChange: (open: boolean) => void;
};

const STATUS_LABELS: Record<string, string> = {
  Bekliyor: "Bekliyor",
  pending: "Bekliyor",
  scheduled: "Randevu verildi",
  "Randevu verildi": "Randevu verildi",
  completed: "Görüşüldü",
  active_follow: "Görüşüldü",
  "Görüşüldü": "Görüşüldü",
};

const STATUS_CLASSES: Record<string, string> = {
  Bekliyor: "bg-amber-100 text-amber-700",
  pending: "bg-amber-100 text-amber-700",
  scheduled: "bg-blue-100 text-blue-700",
  "Randevu verildi": "bg-blue-100 text-blue-700",
  completed: "bg-emerald-100 text-emerald-700",
  active_follow: "bg-emerald-100 text-emerald-700",
  "Görüşüldü": "bg-emerald-100 text-emerald-700",
};

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const extractReasonFromSummary = (summary?: string | null) => {
  if (!summary) return null;
  const parts = summary.split("•").map((part) => part.trim()).filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : null;
};

export function NotificationDetailModal({
  open,
  item,
  onOpenChange,
}: NotificationDetailModalProps) {
  if (!item) return null;

  const statusLabel = STATUS_LABELS[item.status] || item.status;
  const statusClass = STATUS_CLASSES[item.status] || "bg-slate-100 text-slate-600";
  const reason = item.reason || extractReasonFromSummary(item.summary);
  const note = item.note?.trim() || null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="max-w-2xl rounded-2xl p-6">
        <DialogClose className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/30">
          <X className="h-4 w-4" />
          <span className="sr-only">Kapat</span>
        </DialogClose>
        <DialogHeader>
          <div className="space-y-3 pr-16">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-slate-100 text-slate-700">Öğretmen Yönlendirmesi</Badge>
                <Badge className={statusClass}>{statusLabel}</Badge>
              </div>
              <DialogTitle className="text-xl text-slate-900">{item.studentName || item.title}</DialogTitle>
              <DialogDescription className="text-sm text-slate-500">
                Bildirim detayı
              </DialogDescription>
            </div>
            <div className="text-sm font-medium text-slate-400">
              {formatDate(item.createdAt)}
            </div>
          </div>
        </DialogHeader>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Sınıf</div>
            <div className="mt-2 text-sm font-medium text-slate-700">
              {item.classDisplay || "Bilgi yok"}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Öğretmen</div>
            <div className="mt-2 text-sm font-medium text-slate-700">
              {item.teacherName || "Bilgi yok"}
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Yönlendirme Nedeni</div>
          <div className="mt-2 text-sm text-slate-700 whitespace-pre-line">
            {reason || "Bilgi yok"}
          </div>
        </div>

        {note && (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Not</div>
            <div className="mt-2 text-sm text-slate-700 whitespace-pre-line">{note}</div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
