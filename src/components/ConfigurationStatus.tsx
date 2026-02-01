"use client";

import { useState, useEffect } from "react";
import { CheckCircle, XCircle, Settings } from "lucide-react";

interface ConfigStatus {
  telegram: boolean;
  sheets: boolean;
  configured: boolean;
}

export default function ConfigurationStatus() {
  const [status, setStatus] = useState<ConfigStatus>({ telegram: false, sheets: false, configured: false });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkConfiguration();
  }, []);

  const checkConfiguration = async () => {
    try {
      const response = await fetch('/api/config-check');
      const data = await response.json();
      setStatus(data);
    } catch (error) {
      console.error('Configuration check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return null;
  }

  const allConfigured = status.telegram && status.sheets;

  // Marquee içeriği
  const statusText = allConfigured 
    ? `✓ Sistem Aktif • Telegram: Bağlı • Google Sheets: Bağlı • Tüm entegrasyonlar çalışıyor`
    : `⚠ Yapılandırma Gerekli • Telegram: ${status.telegram ? 'Aktif' : 'Bekliyor'} • Google Sheets: ${status.sheets ? 'Aktif' : 'Bekliyor'}`;

  return (
    <div className="w-full overflow-hidden bg-gradient-to-r from-slate-50 via-slate-100 to-slate-50 border-t border-slate-200/50 py-2">
      <div className="marquee-container">
        <div className="marquee-content">
          {/* İlk kopya */}
          <div className="flex items-center gap-8 px-8">
            <div className={`flex items-center gap-2 text-xs ${allConfigured ? 'text-emerald-600' : 'text-amber-600'}`}>
              {allConfigured ? <CheckCircle className="h-3 w-3" /> : <Settings className="h-3 w-3 animate-spin-slow" />}
              <span className="font-medium whitespace-nowrap">{statusText}</span>
            </div>
            <span className="text-slate-300">•</span>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="whitespace-nowrap">RPD Öğrenci Yönlendirme Sistemi</span>
            </div>
            <span className="text-slate-300">•</span>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="whitespace-nowrap">v1.0</span>
            </div>
            <span className="text-slate-300">•</span>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="whitespace-nowrap font-medium">Coded By Mehmet DALĞIN</span>
            </div>
          </div>
          {/* İkinci kopya (seamless loop için) */}
          <div className="flex items-center gap-8 px-8">
            <div className={`flex items-center gap-2 text-xs ${allConfigured ? 'text-emerald-600' : 'text-amber-600'}`}>
              {allConfigured ? <CheckCircle className="h-3 w-3" /> : <Settings className="h-3 w-3 animate-spin-slow" />}
              <span className="font-medium whitespace-nowrap">{statusText}</span>
            </div>
            <span className="text-slate-300">•</span>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="whitespace-nowrap">RPD Öğrenci Yönlendirme Sistemi</span>
            </div>
            <span className="text-slate-300">•</span>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="whitespace-nowrap">v1.0</span>
            </div>
            <span className="text-slate-300">•</span>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="whitespace-nowrap font-medium">Coded By Mehmet DALĞIN</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}