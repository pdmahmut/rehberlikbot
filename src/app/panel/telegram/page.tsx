"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, MessageCircle, Settings, CheckCircle, XCircle, RefreshCw, FileText, CalendarDays, History, Clock, X, Eye, Timer, Play } from "lucide-react";
import { toast } from "sonner";

type SummaryPeriod = "today" | "week" | "month" | "all" | "custom";

interface SentSummary {
  id: string;
  period_type: string;
  period_label: string;
  from_date: string;
  to_date: string;
  referral_count: number;
  sent_at: string;
  message_text?: string;
}

export default function TelegramPage() {
  const [testMessage, setTestMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"unknown" | "connected" | "error">("unknown");
  
  // Özet gönderimi için state'ler
  const [summaryPeriod, setSummaryPeriod] = useState<SummaryPeriod>("today");
  const [customDate, setCustomDate] = useState("");
  const [sendingSummary, setSendingSummary] = useState(false);

  // Gönderilen özetler
  const [sentSummaries, setSentSummaries] = useState<SentSummary[]>([]);
  const [loadingSummaries, setLoadingSummaries] = useState(false);
  const [showSentSummaries, setShowSentSummaries] = useState(false);
  const [needsTable, setNeedsTable] = useState(false);
  const [selectedSummary, setSelectedSummary] = useState<SentSummary | null>(null);

  // Otomatik özet için state
  const [testingCron, setTestingCron] = useState(false);

  // Gönderilen özetleri yükle
  const loadSentSummaries = async () => {
    setLoadingSummaries(true);
    try {
      const res = await fetch("/api/telegram-summary");
      if (res.ok) {
        const data = await res.json();
        setSentSummaries(data.summaries || []);
        setNeedsTable(data.needsTable || false);
      }
    } catch (error) {
      console.error("Load summaries error:", error);
    } finally {
      setLoadingSummaries(false);
    }
  };

  useEffect(() => {
    if (showSentSummaries && sentSummaries.length === 0) {
      loadSentSummaries();
    }
  }, [showSentSummaries]);

  const testConnection = async () => {
    setTesting(true);
    try {
      const res = await fetch("/api/telegram-test");
      if (res.ok) {
        setConnectionStatus("connected");
        toast.success("Telegram bağlantısı başarılı!");
      } else {
        setConnectionStatus("error");
        toast.error("Telegram bağlantısı başarısız");
      }
    } catch {
      setConnectionStatus("error");
      toast.error("Bağlantı testi yapılamadı");
    } finally {
      setTesting(false);
    }
  };

  const sendTestMessage = async () => {
    if (!testMessage.trim()) {
      toast.error("Lütfen bir mesaj girin");
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/telegram-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: testMessage }),
      });

      if (res.ok) {
        toast.success("Test mesajı gönderildi!");
        setTestMessage("");
      } else {
        const data = await res.json();
        toast.error(data.error || "Mesaj gönderilemedi");
      }
    } catch {
      toast.error("Mesaj gönderilirken hata oluştu");
    } finally {
      setSending(false);
    }
  };

  const sendSummary = async () => {
    if (summaryPeriod === "custom" && !customDate) {
      toast.error("Lütfen bir tarih seçin");
      return;
    }

    setSendingSummary(true);
    toast.loading("Özet hazırlanıyor...", { id: "summary" });

    try {
      const res = await fetch("/api/telegram-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          period: summaryPeriod,
          customDate: summaryPeriod === "custom" ? customDate : undefined
        }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success(`Özet gönderildi! (${data.count} kayıt)`, { id: "summary" });
        // Gönderilen özetleri yenile
        loadSentSummaries();
      } else {
        toast.error(data.error || "Özet gönderilemedi", { id: "summary" });
      }
    } catch {
      toast.error("Özet gönderilirken hata oluştu", { id: "summary" });
    } finally {
      setSendingSummary(false);
    }
  };

  const testCronJob = async () => {
    setTestingCron(true);
    toast.loading("Otomatik özet test ediliyor...", { id: "cron-test" });

    try {
      const res = await fetch("/api/cron/daily-summary", {
        method: "POST",
      });

      const data = await res.json();

      if (res.ok) {
        toast.success(`Otomatik özet gönderildi! (${data.count} kayıt, ${data.day})`, { id: "cron-test" });
        loadSentSummaries();
      } else {
        toast.error(data.error || "Otomatik özet gönderilemedi", { id: "cron-test" });
      }
    } catch {
      toast.error("Otomatik özet test edilirken hata oluştu", { id: "cron-test" });
    } finally {
      setTestingCron(false);
    }
  };

  const periodLabels: Record<SummaryPeriod, string> = {
    today: "Günlük",
    week: "Haftalık",
    month: "Aylık",
    all: "Tüm Zamanlar",
    custom: "Özel Tarih"
  };

  return (
    <div className="space-y-6">
      {/* Modern Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-700 p-6 text-white shadow-xl">
        <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,transparent,rgba(255,255,255,0.5))]" />
        
        {/* Animated Background Elements */}
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-sky-300/20 blur-3xl animate-float-slow" />
        <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-blue-300/20 blur-3xl animate-float-reverse" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-indigo-400/10 blur-3xl animate-pulse-glow" />
        
        {/* Floating Particles */}
        <div className="absolute top-10 right-20 h-2 w-2 rounded-full bg-sky-200/60 animate-float animation-delay-100" />
        <div className="absolute top-20 right-40 h-1.5 w-1.5 rounded-full bg-blue-200/60 animate-float animation-delay-300" />
        <div className="absolute bottom-16 left-32 h-2 w-2 rounded-full bg-cyan-200/60 animate-float animation-delay-500" />
        <div className="absolute top-1/3 left-1/4 h-1 w-1 rounded-full bg-white/40 animate-sparkle animation-delay-200" />
        <div className="absolute bottom-1/3 right-1/4 h-1.5 w-1.5 rounded-full bg-sky-300/50 animate-sparkle animation-delay-700" />
        
        <div className="relative">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                <Send className="h-7 w-7" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Telegram Bildirimleri</h1>
                <p className="text-sky-100">Bot ayarları, test ve özet gönderimi</p>
              </div>
            </div>
            
            {/* Bağlantı Durumu */}
            <div className="flex items-center gap-3">
              <div className={`flex items-center gap-2 rounded-lg backdrop-blur-sm px-4 py-2 ${
                connectionStatus === "connected" 
                  ? "bg-emerald-500/20 border border-emerald-400/30" 
                  : connectionStatus === "error" 
                    ? "bg-red-500/20 border border-red-400/30"
                    : "bg-white/10"
              }`}>
                {connectionStatus === "connected" ? (
                  <CheckCircle className="h-5 w-5 text-emerald-300" />
                ) : connectionStatus === "error" ? (
                  <XCircle className="h-5 w-5 text-red-300" />
                ) : (
                  <MessageCircle className="h-5 w-5 text-sky-200" />
                )}
                <div>
                  <p className="text-xs text-sky-200">Bot Durumu</p>
                  <p className="text-sm font-semibold">
                    {connectionStatus === "connected" 
                      ? "Bağlı" 
                      : connectionStatus === "error" 
                        ? "Hata" 
                        : "Bilinmiyor"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Bağlantı Durumu */}
        <Card className="bg-white/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
              <Settings className="h-5 w-5 text-blue-600" />
              Bağlantı Durumu
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border">
              <div className="flex items-center gap-3">
                {connectionStatus === "unknown" && (
                  <div className="h-3 w-3 rounded-full bg-slate-400" />
                )}
                {connectionStatus === "connected" && (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                )}
                {connectionStatus === "error" && (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
                <div>
                  <p className="font-medium text-slate-800">Telegram Bot</p>
                  <p className="text-xs text-slate-500">
                    {connectionStatus === "unknown" && "Bağlantı test edilmedi"}
                    {connectionStatus === "connected" && "Bağlantı başarılı"}
                    {connectionStatus === "error" && "Bağlantı hatası"}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={testConnection}
                disabled={testing}
              >
                {testing ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  "Test Et"
                )}
              </Button>
            </div>

            <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-xs text-blue-700 flex items-start gap-2">
                <MessageCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>
                  Telegram bot ayarları <code className="bg-blue-100 px-1 rounded">.env</code> dosyasındaki{" "}
                  <code className="bg-blue-100 px-1 rounded">TELEGRAM_BOT_TOKEN</code> ve{" "}
                  <code className="bg-blue-100 px-1 rounded">TELEGRAM_CHAT_ID</code> değişkenleri ile yapılandırılır.
                </span>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Test Mesajı Gönder */}
        <Card className="bg-white/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
              <Send className="h-5 w-5 text-emerald-600" />
              Test Mesajı Gönder
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-500">Mesaj</label>
              <Input
                placeholder="Test mesajınızı yazın..."
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendTestMessage()}
              />
            </div>

            <Button
              onClick={sendTestMessage}
              disabled={sending || !testMessage.trim()}
              className="w-full gap-2"
            >
              {sending ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Gönder
            </Button>

            <p className="text-xs text-slate-500 text-center">
              Bu mesaj yapılandırılmış Telegram kanalına gönderilecektir.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Özet Gönder */}
      <Card className="bg-white/80 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <FileText className="h-5 w-5 text-purple-600" />
            Özet Gönder
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">
            Seçilen dönemdeki tüm yönlendirmeleri Telegram kanalına özet olarak gönderin.
            Özette tarih, öğrenci, sınıf, neden ve öğretmen bilgileri yer alır.
          </p>

          <div className="space-y-3">
            <label className="text-xs font-medium text-slate-500">Dönem Seçin</label>
            <div className="flex flex-wrap gap-2">
              {(["today", "week", "month", "all", "custom"] as SummaryPeriod[]).map((period) => (
                <Button
                  key={period}
                  variant={summaryPeriod === period ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSummaryPeriod(period)}
                  className={summaryPeriod === period ? "bg-purple-600 hover:bg-purple-700" : ""}
                >
                  {period === "today" && "📅 Günlük"}
                  {period === "week" && "📆 Haftalık"}
                  {period === "month" && "🗓️ Aylık"}
                  {period === "all" && "📊 Tüm Zamanlar"}
                  {period === "custom" && "🎯 Özel Tarih"}
                </Button>
              ))}
            </div>
          </div>

          {summaryPeriod === "custom" && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-500 flex items-center gap-2">
                <CalendarDays className="h-3.5 w-3.5" />
                Tarih Seçin
              </label>
              <Input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="max-w-xs"
              />
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <div className="text-sm text-slate-500">
              Seçili dönem: <span className="font-medium text-slate-700">{periodLabels[summaryPeriod]}</span>
              {summaryPeriod === "custom" && customDate && (
                <span className="ml-1">
                  ({new Date(customDate).toLocaleDateString('tr-TR')})
                </span>
              )}
            </div>
            <Button
              onClick={sendSummary}
              disabled={sendingSummary || (summaryPeriod === "custom" && !customDate)}
              className="gap-2 bg-purple-600 hover:bg-purple-700"
            >
              {sendingSummary ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Özet Gönder
            </Button>
          </div>

          <div className="p-4 bg-purple-50 rounded-lg border border-purple-100">
            <p className="text-xs text-purple-700">
              <strong>Özet formatı:</strong> Her yönlendirme için tarih, öğrenci adı, sınıf, 
              yönlendirme nedeni ve gönderen öğretmen bilgisi içerir.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Zamanlanmış Görev */}
      <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-green-800 flex items-center gap-2">
            <Timer className="h-5 w-5 text-green-600" />
            Otomatik Günlük Özet
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-4 p-4 bg-white/60 rounded-lg border border-green-200">
            <div className="p-3 bg-green-100 rounded-lg">
              <Clock className="h-6 w-6 text-green-600" />
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-green-900">Her Hafta İçi Saat 17:00</h4>
              <p className="text-sm text-green-700 mt-1">
                Pazartesi - Cuma günleri saat 17:00&apos;de günlük yönlendirme özeti otomatik olarak Telegram&apos;a gönderilir.
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                {['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma'].map((day) => (
                  <span key={day} className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-green-100 text-green-800">
                    {day}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm text-green-700">
              <span className="font-medium">Durum:</span>{" "}
              <span className="inline-flex items-center gap-1">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                Aktif
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={testCronJob}
              disabled={testingCron}
              className="gap-2 border-green-300 text-green-700 hover:bg-green-100"
            >
              {testingCron ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Şimdi Test Et
            </Button>
          </div>

          <div className="p-3 bg-green-100/50 rounded-lg border border-green-200">
            <p className="text-xs text-green-700">
              <strong>Not:</strong> Otomatik gönderim için Vercel Cron Jobs veya harici bir cron servisi (cron-job.org) kullanılmalıdır.
              Endpoint: <code className="bg-green-200/50 px-1 rounded">/api/cron/daily-summary</code>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Gönderilen Özetler */}
      <Card className="bg-white/80 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-amber-600" />
              Gönderilen Özetler
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadSentSummaries}
                disabled={loadingSummaries}
              >
                {loadingSummaries ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant={showSentSummaries ? "default" : "outline"}
                size="sm"
                onClick={() => setShowSentSummaries(!showSentSummaries)}
              >
                {showSentSummaries ? "Gizle" : "Göster"}
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        {showSentSummaries && (
          <CardContent>
            {loadingSummaries ? (
              <div className="flex items-center justify-center py-8 text-slate-500">
                <RefreshCw className="h-5 w-5 animate-spin mr-2" />
                Yükleniyor...
              </div>
            ) : sentSummaries.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <History className="h-12 w-12 mx-auto mb-2 opacity-30" />
                <p>Henüz gönderilmiş özet bulunmuyor.</p>
                {needsTable && (
                  <p className="text-xs mt-1">Supabase&apos;te <code className="bg-slate-100 px-1 rounded">telegram_summaries</code> tablosu oluşturun.</p>
                )}
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {sentSummaries.map((summary) => (
                  <div
                    key={summary.id}
                    onClick={() => setSelectedSummary(summary)}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border hover:bg-slate-100 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-amber-100 rounded-lg group-hover:bg-amber-200 transition-colors">
                        <FileText className="h-4 w-4 text-amber-600" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-800 text-sm flex items-center gap-2">
                          {summary.period_label}
                          <Eye className="h-3 w-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </p>
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(summary.sent_at).toLocaleString('tr-TR')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {summary.referral_count} kayıt
                      </span>
                      <p className="text-xs text-slate-400 mt-1">
                        {summary.from_date === summary.to_date 
                          ? new Date(summary.from_date).toLocaleDateString('tr-TR')
                          : `${new Date(summary.from_date).toLocaleDateString('tr-TR')} - ${new Date(summary.to_date).toLocaleDateString('tr-TR')}`
                        }
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Mesaj Detay Modal */}
      {selectedSummary && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedSummary(null)}>
          <div 
            className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-amber-50 to-orange-50">
              <div>
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                  <MessageCircle className="h-5 w-5 text-amber-600" />
                  Gönderilen Mesaj
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  {selectedSummary.period_label} • {new Date(selectedSummary.sent_at).toLocaleString('tr-TR')}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelectedSummary(null)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              {selectedSummary.message_text ? (
                <pre className="whitespace-pre-wrap font-mono text-sm text-slate-700 bg-slate-50 p-4 rounded-lg border">
                  {selectedSummary.message_text}
                </pre>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <MessageCircle className="h-12 w-12 mx-auto mb-2 opacity-30" />
                  <p>Mesaj metni kaydedilmemiş.</p>
                  <p className="text-xs mt-1">Eski kayıtlarda mesaj metni bulunmayabilir.</p>
                </div>
              )}
            </div>
            <div className="p-4 border-t bg-slate-50 flex justify-between items-center">
              <div className="text-xs text-slate-500">
                {selectedSummary.referral_count} kayıt • 
                {selectedSummary.from_date === selectedSummary.to_date 
                  ? ` ${new Date(selectedSummary.from_date).toLocaleDateString('tr-TR')}`
                  : ` ${new Date(selectedSummary.from_date).toLocaleDateString('tr-TR')} - ${new Date(selectedSummary.to_date).toLocaleDateString('tr-TR')}`
                }
              </div>
              <Button variant="outline" size="sm" onClick={() => setSelectedSummary(null)}>
                Kapat
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Bilgi Kartı */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-100">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <MessageCircle className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">Telegram Entegrasyonu</h3>
              <p className="text-sm text-slate-600 mt-1">
                Öğrenci yönlendirmeleri otomatik olarak Telegram kanalınıza bildirilir. 
                Her yeni yönlendirme kayıt edildiğinde, öğrenci adı, sınıfı ve yönlendirme 
                nedeni ile birlikte anlık bildirim gönderilir.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
