"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { Bell, ChevronRight, Eye, History, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NotificationDetailModal } from "@/components/NotificationDetailModal";
import type { AdminNotificationItem, AdminNotificationListResponse } from "@/lib/adminNotifications";
import { ADMIN_NOTIFICATION_KIND_LABELS } from "@/lib/adminNotifications";

type NotificationTab = "new" | "history";

const STATUS_LABELS: Record<string, string> = {
  Bekliyor: "Bekliyor",
  pending: "Bekliyor",
  scheduled: "Randevu verildi",
  "Randevu verildi": "Randevu verildi",
  completed: "Görüşüldü",
  active_follow: "Görüşüldü",
  "Görüşüldü": "Görüşüldü",
  rejected: "Reddedildi",
  approved: "Onaylandı",
};

const STATUS_CLASSES: Record<string, string> = {
  Bekliyor: "bg-amber-100 text-amber-700",
  pending: "bg-amber-100 text-amber-700",
  scheduled: "bg-blue-100 text-blue-700",
  "Randevu verildi": "bg-blue-100 text-blue-700",
  completed: "bg-emerald-100 text-emerald-700",
  active_follow: "bg-emerald-100 text-emerald-700",
  "Görüşüldü": "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  approved: "bg-green-100 text-green-700",
};

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function BildirimlerPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<AdminNotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<NotificationTab>("new");
  const [selectedNotification, setSelectedNotification] = useState<AdminNotificationItem | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const initialReadMarkedRef = useRef(false);

  const fetchNotifications = async (options?: { silent?: boolean }) => {
    if (options?.silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const response = await fetch("/api/admin-notifications", {
        headers: { Accept: "application/json" },
      });
      const payload = (await response.json()) as AdminNotificationListResponse;

      if (!response.ok) {
        throw new Error((payload as any)?.error || "Bildirimler yüklenemedi");
      }

      setNotifications(payload.notifications || []);
      setUnreadCount(payload.unreadCount || 0);
    } catch (error: any) {
      toast.error(error?.message || "Bildirimler yüklenemedi");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  useEffect(() => {
    if (loading || initialReadMarkedRef.current) return;

    const unreadIds = notifications.filter((item) => !item.read).map((item) => item.id);
    if (unreadIds.length === 0) {
      initialReadMarkedRef.current = true;
      return;
    }

    initialReadMarkedRef.current = true;
    fetch("/api/admin-notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: unreadIds, read: true }),
    })
      .then(() => {
        window.dispatchEvent(new CustomEvent("admin-notifications:refresh"));
      })
      .catch(() => {});
  }, [loading, notifications]);

  const filteredNotifications = useMemo(() => {
    if (activeTab === "new") {
      return notifications.filter((item) => !item.read);
    }

    return notifications;
  }, [activeTab, notifications]);

  const counts = useMemo(
    () => ({
      new: notifications.filter((item) => !item.read).length,
      history: notifications.length,
    }),
    [notifications]
  );

  const markAsRead = async (ids: string[]) => {
    if (ids.length === 0) return;

    try {
      await fetch("/api/admin-notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, read: true }),
      });
      window.dispatchEvent(new CustomEvent("admin-notifications:refresh"));
      setUnreadCount((prev) => Math.max(0, prev - ids.length));
      setNotifications((prev) =>
        prev.map((item) => (ids.includes(item.id) ? { ...item, read: true } : item))
      );
    } catch {
      toast.error("Bildirim durumu güncellenemedi");
    }
  };

  const handleOpenNotification = async (item: AdminNotificationItem) => {
    if (!item.read) {
      await markAsRead([item.id]);
    }
    if (item.kind === "teacher_referral") {
      setSelectedNotification(item);
      setIsDetailModalOpen(true);
      return;
    }
    router.push(item.targetUrl);
  };

  const handleMarkAllAsRead = async () => {
    const unreadIds = notifications.filter((item) => !item.read).map((item) => item.id);
    await markAsRead(unreadIds);
  };

  const handleDeleteNotification = async (item: AdminNotificationItem) => {
    try {
      const response = await fetch("/api/admin-notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [item.id], deleted: true }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "Bildirim silinemedi");
      }

      const wasUnread = !item.read;
      setNotifications((prev) => prev.filter((current) => current.id !== item.id));
      if (wasUnread) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
      window.dispatchEvent(new CustomEvent("admin-notifications:refresh"));
      toast.success("Bildirim silindi");
    } catch (error: any) {
      toast.error(error?.message || "Bildirim silinemedi");
    }
  };

  const handleNotificationCardKeyDown = (
    event: KeyboardEvent<HTMLDivElement>,
    item: AdminNotificationItem
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      void handleOpenNotification(item);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <NotificationDetailModal
        open={isDetailModalOpen}
        item={selectedNotification}
        onOpenChange={(open) => {
          setIsDetailModalOpen(open);
          if (!open) {
            setSelectedNotification(null);
          }
        }}
      />
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-sky-500 via-blue-500 to-cyan-500 p-6 text-white shadow-xl">
        <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-3">
              <div className="rounded-xl bg-white/20 p-2.5 backdrop-blur">
                <Bell className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold">Bildirimler</h1>
            </div>
            <p className="text-sm text-white/80">
              Yeni gelişmeleri tek yerden takip edin. {unreadCount > 0 ? `${unreadCount} okunmamış bildirim var.` : "İşlemler mevcut sekmelerinde kalır."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={handleMarkAllAsRead}
              disabled={counts.new === 0}
              className="border-0 bg-white/20 text-white hover:bg-white/30"
            >
              <Eye className="mr-2 h-4 w-4" />
              Tümünü okundu yap
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => fetchNotifications({ silent: true })}
              disabled={refreshing}
              className="border-0 bg-white/20 text-white hover:bg-white/30"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Yenile
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 rounded-2xl bg-slate-100 p-1.5">
        {([
          { id: "new", label: "Yeni", count: counts.new },
          { id: "history", label: "Geçmiş", count: counts.history },
        ] as const).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
              activeTab === tab.id
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.id === "new" ? <Bell className="h-4 w-4" /> : <History className="h-4 w-4" />}
            {tab.label}
            <Badge variant="secondary" className="bg-slate-200 text-slate-700">
              {tab.count}
            </Badge>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-sky-500/30 border-t-sky-500" />
        </div>
      ) : filteredNotifications.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-16 text-center text-slate-400">
            <Bell className="mx-auto mb-3 h-10 w-10 opacity-30" />
            <p>Bu görünümde bildirim yok.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredNotifications.map((item) => {
            const statusLabel = STATUS_LABELS[item.status] || item.status;
            const statusClass = STATUS_CLASSES[item.status] || "bg-slate-100 text-slate-600";
            const kindLabel = ADMIN_NOTIFICATION_KIND_LABELS[item.kind];

            return (
              <div key={item.id} className="w-full">
                <Card
                  role="button"
                  tabIndex={0}
                  onClick={() => void handleOpenNotification(item)}
                  onKeyDown={(event) => handleNotificationCardKeyDown(event, item)}
                  className={`cursor-pointer overflow-hidden border text-left transition-all hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-sky-500/30 ${
                  item.read ? "border-slate-200 bg-white" : "border-sky-200 bg-sky-50/30"
                }`}
                >
                  <CardHeader className="pb-3">
                    <CardTitle className="flex flex-col gap-3 text-base sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <Badge className="bg-slate-100 text-slate-700">{kindLabel}</Badge>
                          <Badge className={statusClass}>{statusLabel}</Badge>
                          {!item.read && (
                            <Badge className="bg-sky-100 text-sky-700">Yeni</Badge>
                          )}
                        </div>
                        <p className="truncate font-semibold text-slate-800">{item.title}</p>
                        <p className="mt-1 text-sm font-normal text-slate-500">{item.summary}</p>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-400">
                        <span className="whitespace-nowrap">{formatDate(item.createdAt)}</span>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            event.preventDefault();
                            handleDeleteNotification(item);
                          }}
                          className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                          title="Bildirimi sil"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <ChevronRight className="h-4 w-4" />
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-wrap items-center gap-3 pt-0 text-xs text-slate-500">
                    {item.classDisplay && <span>Sınıf: {item.classDisplay}</span>}
                    {item.teacherName && <span>Öğretmen: {item.teacherName}</span>}
                    {item.studentName && item.kind !== "teacher_referral" && (
                      <span>Öğrenci: {item.studentName}</span>
                    )}
                    <span className="font-medium text-sky-700">
                      {item.kind === "teacher_referral" ? "Detayı görüntüle" : item.targetLabel}
                    </span>
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
