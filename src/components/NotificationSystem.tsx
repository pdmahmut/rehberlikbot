"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface NotificationPermissionProps {
  onPermissionChange?: (permission: NotificationPermission) => void;
}

// Bildirim izin durumu hook'u
export function useNotificationPermission() {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setIsSupported(true);
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (!isSupported) return "denied";
    
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result;
    } catch (error) {
      console.error("Bildirim izni alınamadı:", error);
      return "denied";
    }
  }, [isSupported]);

  return { permission, isSupported, requestPermission };
}

// Bildirim gönderme hook'u
export function useNotification() {
  const { permission, isSupported, requestPermission } = useNotificationPermission();

  const showNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (!isSupported || permission !== "granted") {
      console.log("Bildirim gösterilemedi - izin yok veya desteklenmiyor");
      return null;
    }

    try {
      const notification = new Notification(title, {
        icon: "/icon.svg",
        badge: "/icon.svg",
        tag: "rpd-notification",
        ...options,
      });

      // Tıklama olayı
      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      // 5 saniye sonra otomatik kapat
      setTimeout(() => notification.close(), 5000);

      return notification;
    } catch (error) {
      console.error("Bildirim gösterilemedi:", error);
      return null;
    }
  }, [isSupported, permission]);

  return { showNotification, permission, isSupported, requestPermission };
}

// Yeni yönlendirme izleme hook'u
export function useNewReferralNotification(
  currentCount: number,
  latestStudent?: { name: string; reason: string; class: string } | null
) {
  const { showNotification, permission } = useNotification();
  const prevCountRef = useRef<number>(currentCount);
  const initialLoadRef = useRef(true);

  useEffect(() => {
    // İlk yüklemede bildirim gösterme
    if (initialLoadRef.current) {
      initialLoadRef.current = false;
      prevCountRef.current = currentCount;
      return;
    }

    // Sayı arttıysa yeni yönlendirme var
    if (currentCount > prevCountRef.current && permission === "granted") {
      const newCount = currentCount - prevCountRef.current;
      
      if (latestStudent) {
        showNotification("Yeni RPD Yönlendirmesi", {
          body: `${latestStudent.name} (${latestStudent.class})\n${latestStudent.reason}`,
          tag: `rpd-new-${Date.now()}`,
        });
      } else {
        showNotification("Yeni RPD Yönlendirmesi", {
          body: `${newCount} yeni yönlendirme eklendi`,
          tag: `rpd-new-${Date.now()}`,
        });
      }
    }

    prevCountRef.current = currentCount;
  }, [currentCount, latestStudent, showNotification, permission]);
}

// Bildirim izin banneri
export function NotificationPermissionBanner({ onPermissionChange }: NotificationPermissionProps) {
  const { permission, isSupported, requestPermission } = useNotificationPermission();
  const [dismissed, setDismissed] = useState(false);

  // LocalStorage'dan dismiss durumunu oku
  useEffect(() => {
    if (typeof window !== "undefined") {
      const isDismissed = localStorage.getItem("rpd-notification-dismissed") === "true";
      setDismissed(isDismissed);
    }
  }, []);

  const handleRequestPermission = async () => {
    const result = await requestPermission();
    onPermissionChange?.(result);
    if (result === "granted") {
      setDismissed(true);
      localStorage.setItem("rpd-notification-dismissed", "true");
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem("rpd-notification-dismissed", "true");
  };

  // Desteklenmiyorsa, izin verildiyse veya kapatıldıysa gösterme
  if (!isSupported || permission === "granted" || dismissed) {
    return null;
  }

  // İzin reddedildiyse farklı mesaj
  if (permission === "denied") {
    return null; // Reddedildiyse banner gösterme
  }

  return (
    <Card className="mb-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5 text-blue-600"
              >
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-800">
                Masaüstü Bildirimleri
              </p>
              <p className="text-xs text-slate-600">
                Yeni yönlendirmelerden anında haberdar olun
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="text-slate-500 hover:text-slate-700"
            >
              Daha Sonra
            </Button>
            <Button
              size="sm"
              onClick={handleRequestPermission}
              className="bg-blue-600 hover:bg-blue-700"
            >
              İzin Ver
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Bildirim durumu göstergesi
export function NotificationStatus() {
  const { permission, isSupported } = useNotificationPermission();

  if (!isSupported) {
    return (
      <span className="text-xs text-slate-400" title="Tarayıcınız bildirimleri desteklemiyor">
        🔕 Desteklenmiyor
      </span>
    );
  }

  switch (permission) {
    case "granted":
      return (
        <span className="text-xs text-emerald-600" title="Bildirimler açık">
          🔔 Bildirimler Açık
        </span>
      );
    case "denied":
      return (
        <span className="text-xs text-red-500" title="Bildirimler engellendi">
          🔕 Bildirimler Engelli
        </span>
      );
    default:
      return (
        <span className="text-xs text-amber-600" title="Bildirim izni bekleniyor">
          🔔 İzin Bekleniyor
        </span>
      );
  }
}

// Test bildirimi butonu (debug için)
export function TestNotificationButton() {
  const { showNotification, permission, isSupported, requestPermission } = useNotification();

  const handleTest = async () => {
    if (permission !== "granted") {
      await requestPermission();
      return;
    }

    showNotification("Test Bildirimi", {
      body: "Bu bir test bildirimidir. RPD yönlendirme sistemi çalışıyor!",
      tag: `rpd-test-${Date.now()}`,
    });
  };

  if (!isSupported) return null;

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleTest}
      className="text-xs"
    >
      {permission === "granted" ? "Test Bildirimi Gönder" : "Bildirimleri Etkinleştir"}
    </Button>
  );
}
