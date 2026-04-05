"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Ban, 
  Calendar, 
  User, 
  FileText,
  Download,
  TrendingUp,
  Search,
  CalendarDays,
  Sparkles,
  Building2,
  GraduationCap,
  Users,
  Heart,
  ArrowLeft,
  Copy,
  RefreshCw,
  Send,
  Printer,
  X,
  Save,
  Trash2,
  FileDown,
  File,
  History
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle, TableCell, TableRow, Table, WidthType } from "docx";
import { saveAs } from "file-saver";
import { Appointment, PARTICIPANT_TYPES } from "@/types";
import { toast } from "sonner";

// Tarih formatı
const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    weekday: "long"
  });
};

const formatTime = (timeStr: string) => {
  return timeStr.slice(0, 5);
};

// Durum bilgileri
const STATUS_INFO = {
  attended: {
    label: "Geldi",
    color: "bg-emerald-100 text-emerald-700 border-emerald-200",
    icon: CheckCircle,
    iconColor: "text-emerald-500",
    bgGradient: "from-emerald-500 to-teal-600"
  },
  not_attended: {
    label: "Gelmedi",
    color: "bg-red-100 text-red-700 border-red-200",
    icon: XCircle,
    iconColor: "text-red-500",
    bgGradient: "from-red-500 to-rose-600"
  },
  postponed: {
    label: "Ertelendi",
    color: "bg-amber-100 text-amber-700 border-amber-200",
    icon: Clock,
    iconColor: "text-amber-500",
    bgGradient: "from-amber-500 to-orange-600"
  },
  cancelled: {
    label: "İptal",
    color: "bg-slate-100 text-slate-700 border-slate-200",
    icon: Ban,
    iconColor: "text-slate-500",
    bgGradient: "from-slate-500 to-gray-600"
  },
  planned: {
    label: "Planlandı",
    color: "bg-blue-100 text-blue-700 border-blue-200",
    icon: Calendar,
    iconColor: "text-blue-500",
    bgGradient: "from-blue-500 to-indigo-600"
  }
};

// Katılımcı türü label
const getParticipantLabel = (type: string) => {
  const found = PARTICIPANT_TYPES.find(p => p.value === type);
  return found?.label || type;
};

// Rapor türleri
const REPORT_TYPES = [
  { 
    id: "idare", 
    label: "İdare Raporu", 
    icon: Building2, 
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    description: "Okul idaresine sunulacak resmi rapor"
  },
  { 
    id: "ogretmen", 
    label: "Öğretmen Raporu", 
    icon: GraduationCap, 
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
    description: "Sınıf öğretmenine bilgi notu"
  },
  { 
    id: "veli", 
    label: "Veli Raporu", 
    icon: Users, 
    color: "text-green-600",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
    description: "Veliye iletilecek görüşme özeti"
  },
  { 
    id: "rehberlik", 
    label: "Rehberlik Dosyası", 
    icon: Heart, 
    color: "text-rose-600",
    bgColor: "bg-rose-50",
    borderColor: "border-rose-200",
    description: "Rehberlik dosyasına eklenecek detaylı kayıt"
  }
];

// AI ile rapor oluşturma
const generateReportWithAI = (
  appointment: Appointment, 
  sessionNotes: string, 
  reportType: string
): string => {
  const date = formatDate(appointment.appointment_date);
  const studentName = appointment.participant_name;
  const studentClass = appointment.participant_class || "Belirtilmemiş";
  const topicTags = appointment.topic_tags?.join(", ") || "Genel görüşme";
  const purpose = appointment.purpose || "Rehberlik görüşmesi";
  const outcome = appointment.outcome_summary || "";
  const decisions = appointment.outcome_decision?.join(", ") || "";

  switch (reportType) {
    case "idare":
      return `DUMLUPINAR ORTAOKULU
REHBERLİK SERVİSİ - İDARE BİLGİLENDİRME RAPORU

Tarih: ${date}
Öğrenci: ${studentName}
Sınıf: ${studentClass}
Görüşme Konusu: ${topicTags}

GÖRÜŞME ÖZETİ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${sessionNotes}

DEĞERLENDİRME
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Öğrenci ile yapılan görüşmede yukarıda belirtilen konular ele alınmıştır. ${outcome ? `Görüşme sonucunda: ${outcome}` : ""}

${decisions ? `Alınan Kararlar: ${decisions}` : ""}

${sessionNotes.toLowerCase().includes("risk") || sessionNotes.toLowerCase().includes("tehlike") || sessionNotes.toLowerCase().includes("şiddet") 
  ? "⚠️ ÖNEMLİ NOT: Bu görüşmede risk faktörleri tespit edilmiştir. İlgili birimlerle koordineli çalışma önerilmektedir."
  : ""}

İDARİ İŞLEM ÖNERİLERİ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${sessionNotes.toLowerCase().includes("devamsızlık") 
  ? "• Devamsızlık takibi yapılması önerilmektedir.\n• Veli ile iletişime geçilmesi gerekmektedir." 
  : ""}
${sessionNotes.toLowerCase().includes("davranış") || sessionNotes.toLowerCase().includes("disiplin")
  ? "• Sınıf ortamında gözlem yapılması önerilmektedir.\n• Gerekli görülürse disiplin kurulu bilgilendirilmelidir."
  : ""}
${!sessionNotes.toLowerCase().includes("devamsızlık") && !sessionNotes.toLowerCase().includes("davranış") && !sessionNotes.toLowerCase().includes("disiplin")
  ? "• Rutin takip önerilmektedir.\n• Gerekli görüldüğünde tekrar görüşme planlanacaktır."
  : ""}

Bilgilerinize arz ederim.

Psikolojik Danışman
Mahmut Karadeniz`;

    case "ogretmen":
      return `📚 SINIF ÖĞRETMENİ BİLGİLENDİRME NOTU

Tarih: ${date}
Öğrenci: ${studentName}
Sınıf: ${studentClass}

Sayın Öğretmenim,

${studentName} ile rehberlik görüşmesi gerçekleştirilmiştir.

📋 GÖRÜŞME KONUSU
${topicTags}

📝 GÖRÜŞME NOTU
${sessionNotes}

${outcome ? `\n✅ SONUÇ: ${outcome}` : ""}

🎯 SINIF İÇİ ÖNERİLER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${sessionNotes.toLowerCase().includes("dikkat") || sessionNotes.toLowerCase().includes("odak")
  ? "• Öğrencinin ön sıralarda oturması önerilir.\n• Dikkat dağınıklığında nazikçe uyarılması faydalı olacaktır.\n• Kısa aralıklarla görev verilmesi motivasyonu artırabilir."
  : ""}
${sessionNotes.toLowerCase().includes("sosyal") || sessionNotes.toLowerCase().includes("arkadaş")
  ? "• Grup çalışmalarına dahil edilmesi önerilir.\n• Akran ilişkilerinin desteklenmesi faydalı olacaktır.\n• Sınıf içi sorumluluklarla özgüven geliştirilebilir."
  : ""}
${sessionNotes.toLowerCase().includes("akademik") || sessionNotes.toLowerCase().includes("ders")
  ? "• Öğrencinin güçlü olduğu alanlarda teşvik edilmesi önerilir.\n• Bireysel destek sağlanabilir.\n• Başarılarının takdir edilmesi motivasyonu artıracaktır."
  : ""}
${sessionNotes.toLowerCase().includes("kaygı") || sessionNotes.toLowerCase().includes("stres")
  ? "• Sınav ve performans durumlarında destekleyici yaklaşım önerilir.\n• Hatalarında anlayışlı davranılması önemlidir.\n• Cesaretlendirici geri bildirimler faydalı olacaktır."
  : ""}
${!sessionNotes.toLowerCase().includes("dikkat") && !sessionNotes.toLowerCase().includes("sosyal") && !sessionNotes.toLowerCase().includes("akademik") && !sessionNotes.toLowerCase().includes("kaygı")
  ? "• Öğrencinin genel durumunun takip edilmesi önerilir.\n• Olumlu davranışlarının pekiştirilmesi faydalı olacaktır.\n• Herhangi bir değişiklik gözlemlendiğinde bilgi verilmesi rica olunur."
  : ""}

📞 İLETİŞİM
Herhangi bir gözlem veya sorununuz olduğunda rehberlik servisi ile iletişime geçebilirsiniz.

Saygılarımla,
Psikolojik Danışman Mahmut Karadeniz`;

    case "veli":
      return `Sayın Veli,

${studentName}'in velisi olarak sizinle bu bilgilendirmeyi paylaşmak istiyoruz.

📅 Görüşme Tarihi: ${date}
👤 Öğrenci: ${studentName}
🏫 Sınıf: ${studentClass}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

GÖRÜŞME İÇERİĞİ

${sessionNotes}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🏠 EV ORTAMI İÇİN ÖNERİLER

${sessionNotes.toLowerCase().includes("ders") || sessionNotes.toLowerCase().includes("akademik")
  ? "• Düzenli ders çalışma saatleri oluşturulması önerilir.\n• Sessiz ve dikkat dağıtıcı unsurlardan uzak bir çalışma ortamı sağlanmalıdır.\n• Ödevlerin takip edilmesi faydalı olacaktır."
  : ""}
${sessionNotes.toLowerCase().includes("davranış") || sessionNotes.toLowerCase().includes("öfke")
  ? "• Çocuğunuzla düzenli ve kaliteli zaman geçirmeniz önerilir.\n• Olumlu davranışların takdir edilmesi önemlidir.\n• Tutarlı kurallar ve sınırlar belirlenmesi faydalı olacaktır."
  : ""}
${sessionNotes.toLowerCase().includes("sosyal") || sessionNotes.toLowerCase().includes("arkadaş")
  ? "• Akran ilişkilerinin desteklenmesi önerilir.\n• Sosyal aktivitelere katılımın teşvik edilmesi faydalı olacaktır.\n• Çocuğunuzun duygularını ifade etmesine fırsat verilmelidir."
  : ""}
${sessionNotes.toLowerCase().includes("kaygı") || sessionNotes.toLowerCase().includes("korku")
  ? "• Çocuğunuzu dinlemeniz ve duygularını anlamaya çalışmanız önerilir.\n• Güven verici ve sakin bir iletişim kurulması önemlidir.\n• Gerekli görüldüğünde uzman desteği alınabilir."
  : ""}
${!sessionNotes.toLowerCase().includes("ders") && !sessionNotes.toLowerCase().includes("davranış") && !sessionNotes.toLowerCase().includes("sosyal") && !sessionNotes.toLowerCase().includes("kaygı")
  ? "• Çocuğunuzla açık iletişim kurmanız önerilir.\n• Okul yaşantısı hakkında sohbet etmeniz faydalı olacaktır.\n• Olumlu ve destekleyici bir ev ortamı sağlanması önemlidir."
  : ""}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📞 İLETİŞİM

Herhangi bir soru veya görüşmeniz için rehberlik servisi ile iletişime geçebilirsiniz.
Çocuğunuzun gelişimi için iş birliğinize teşekkür ederiz.

Saygılarımızla,
Dumlupınar Ortaokulu Rehberlik Servisi
Psikolojik Danışman Mahmut Karadeniz`;

    case "rehberlik":
      return `═══════════════════════════════════════════════════════════════════
                     REHBERLİK DOSYASI - GÖRÜŞME KAYDI
═══════════════════════════════════════════════════════════════════

📋 GENEL BİLGİLER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Görüşme Tarihi    : ${date}
Öğrenci Adı       : ${studentName}
Sınıf             : ${studentClass}
Görüşme Amacı     : ${purpose}
Konu Etiketleri   : ${topicTags}
Görüşme Süresi    : ${appointment.duration || 15} dakika
Görüşme Yeri      : ${appointment.location === "guidance_office" ? "Rehberlik Odası" : appointment.location === "classroom" ? "Sınıf" : "Diğer"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 GÖRÜŞME İÇERİĞİ VE GÖZLEMLER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${sessionNotes}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 DEĞERLENDİRME
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${outcome || "Görüşme değerlendirmesi yapılacaktır."}

GÖZLEMLENEN DAVRANIŞSAL ÖZELLİKLER:
${sessionNotes.toLowerCase().includes("kaygı") ? "• Kaygı belirtileri gözlemlenmiştir.\n" : ""}
${sessionNotes.toLowerCase().includes("içe kapan") ? "• İçe kapanıklık eğilimi görülmüştür.\n" : ""}
${sessionNotes.toLowerCase().includes("saldırgan") || sessionNotes.toLowerCase().includes("öfke") ? "• Öfke kontrolü ile ilgili zorluklar tespit edilmiştir.\n" : ""}
${sessionNotes.toLowerCase().includes("dikkat") ? "• Dikkat ve odaklanma güçlüğü gözlemlenmiştir.\n" : ""}
${sessionNotes.toLowerCase().includes("özgüven") ? "• Özgüven ile ilgili çalışma gereksinimi belirlenmiştir.\n" : ""}
${sessionNotes.toLowerCase().includes("motivasyon") ? "• Motivasyon eksikliği tespit edilmiştir.\n" : ""}
• Genel değerlendirme devam etmektedir.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 MÜDAHALE PLANI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

KISA VADELİ HEDEFLER (1-2 Hafta):
${sessionNotes.toLowerCase().includes("kaygı") ? "• Gevşeme teknikleri öğretilecek\n• Kaygı tetikleyicileri belirlenecek\n" : ""}
${sessionNotes.toLowerCase().includes("akademik") ? "• Ders çalışma planı oluşturulacak\n• Öğrenme stratejileri üzerinde çalışılacak\n" : ""}
${sessionNotes.toLowerCase().includes("sosyal") ? "• Sosyal beceri çalışmaları yapılacak\n• Akran ilişkileri desteklenecek\n" : ""}
• Takip görüşmesi planlanacak

ORTA VADELİ HEDEFLER (1 Ay):
• Düzenli görüşmelerle ilerleme takip edilecek
• Gerekli görülürse veli görüşmesi yapılacak
• Sınıf öğretmeni ile iş birliği sürdürülecek

UZUN VADELİ HEDEFLER (Dönem Sonu):
• Davranışsal değişimlerin kalıcılığı değerlendirilecek
• Genel gelişim raporu hazırlanacak

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 ALINAN KARARLAR VE TAKİP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${decisions || "• Takip görüşmesi planlanacak"}

Sonraki Görüşme: ${appointment.next_action || "Planlanacak"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Kayıt Tarihi: ${new Date().toLocaleDateString("tr-TR")}
Psikolojik Danışman: Mehmet DALĞIN
İmza: _______________

═══════════════════════════════════════════════════════════════════`;

    default:
      return "Rapor türü seçilmedi.";
  }
};

export default function RandevuRaporlariPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [dateRange, setDateRange] = useState<"week" | "month" | "all">("month");
  const [searchTerm, setSearchTerm] = useState("");
  
  // Rapor oluşturma state'leri
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [sessionNotes, setSessionNotes] = useState("");
  const [generatedReports, setGeneratedReports] = useState<Record<string, string>>({});
  const [activeReportTab, setActiveReportTab] = useState("idare");
  const [generating, setGenerating] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  
  // Kaydedilmiş raporlar
  const [savedReports, setSavedReports] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [currentReportId, setCurrentReportId] = useState<string | null>(null);

  // Randevuları yükle
  useEffect(() => {
    const fetchAppointments = async () => {
      try {
        const response = await fetch("/api/appointments");
        if (response.ok) {
          const data = await response.json();
          setAppointments(data.appointments || data || []);
        }
      } catch (error) {
        console.error("Randevular yüklenirken hata:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAppointments();
  }, []);

  // Tarih filtreleme
  const filteredByDate = useMemo(() => {
    const now = new Date();
    const startDate = new Date();
    
    if (dateRange === "week") {
      startDate.setDate(now.getDate() - 7);
    } else if (dateRange === "month") {
      startDate.setMonth(now.getMonth() - 1);
    } else {
      startDate.setFullYear(2000);
    }

    return appointments.filter(apt => {
      const aptDate = new Date(apt.appointment_date);
      return aptDate >= startDate && aptDate <= now;
    });
  }, [appointments, dateRange]);

  // Durum bazlı filtreleme
  const filteredAppointments = useMemo(() => {
    let filtered = filteredByDate;

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(apt => 
        apt.participant_name?.toLowerCase().includes(search) ||
        apt.participant_class?.toLowerCase().includes(search) ||
        apt.purpose?.toLowerCase().includes(search) ||
        apt.outcome_summary?.toLowerCase().includes(search)
      );
    }

    if (activeTab !== "all") {
      filtered = filtered.filter(apt => apt.status === activeTab);
    } else {
      filtered = filtered.filter(apt => 
        apt.status === "attended" || 
        apt.status === "not_attended" || 
        apt.status === "postponed" || 
        apt.status === "cancelled"
      );
    }

    return filtered.sort((a, b) => new Date(b.created_at || b.appointment_date).getTime() - new Date(a.created_at || a.appointment_date).getTime());
  }, [filteredByDate, activeTab, searchTerm]);

  // İstatistikler
  const stats = useMemo(() => {
    const attended = filteredByDate.filter(a => a.status === "attended").length;
    const notAttended = filteredByDate.filter(a => a.status === "not_attended").length;
    const postponed = filteredByDate.filter(a => a.status === "postponed").length;
    const cancelled = filteredByDate.filter(a => a.status === "cancelled").length;
    const total = attended + notAttended + postponed + cancelled;

    return {
      attended,
      notAttended,
      postponed,
      cancelled,
      total,
      attendanceRate: total > 0 ? Math.round((attended / total) * 100) : 0
    };
  }, [filteredByDate]);

  // Rapor oluştur - Gemini API ile
  const handleGenerateReports = async () => {
    if (!selectedAppointment || !sessionNotes.trim()) {
      toast.error("Lütfen görüşme notlarını girin");
      return;
    }

    setGenerating(true);
    
    try {
      const reports: Record<string, string> = {};
      
      // Tüm rapor türleri için paralel API çağrıları yap
      const reportPromises = REPORT_TYPES.map(async (type) => {
        const response = await fetch("/api/generate-report", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            studentName: selectedAppointment.participant_name,
            studentClass: selectedAppointment.participant_class || "Belirtilmemiş",
            appointmentDate: formatDate(selectedAppointment.appointment_date),
            topicTags: selectedAppointment.topic_tags || [],
            purpose: selectedAppointment.purpose || "Rehberlik görüşmesi",
            outcome: selectedAppointment.outcome_summary || "",
            decisions: selectedAppointment.outcome_decision || [],
            sessionNotes: sessionNotes,
            reportType: type.id,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `${type.label} oluşturulamadı`);
        }

        const data = await response.json();
        return { id: type.id, report: data.report };
      });

      const results = await Promise.all(reportPromises);
      
      results.forEach(({ id, report }) => {
        reports[id] = report;
      });

      setGeneratedReports(reports);
      toast.success("4 rapor başarıyla oluşturuldu!");
    } catch (error) {
      console.error("Rapor oluşturma hatası:", error);
      toast.error(error instanceof Error ? error.message : "Raporlar oluşturulurken bir hata oluştu");
    } finally {
      setGenerating(false);
    }
  };

  // Raporu kopyala
  const copyReport = (reportId: string) => {
    const report = generatedReports[reportId];
    if (report) {
      navigator.clipboard.writeText(report);
      toast.success("Rapor panoya kopyalandı");
    }
  };

  // Raporu yazdır
  const printReport = (reportId: string) => {
    const report = generatedReports[reportId];
    if (report) {
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Rapor</title>
              <style>
                body { font-family: 'Segoe UI', Tahoma, sans-serif; padding: 40px; line-height: 1.6; }
                pre { white-space: pre-wrap; font-family: inherit; }
              </style>
            </head>
            <body>
              <pre>${report}</pre>
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.print();
      }
    }
  };

  // Raporu PDF olarak indir - Modern HTML tabanlı
  const downloadPDF = async (reportId: string) => {
    const report = generatedReports[reportId];
    const reportType = REPORT_TYPES.find(t => t.id === reportId);
    if (!report || !selectedAppointment) return;

    // Dinamik import for html2pdf (client-side only)
    const html2pdf = (await import("html2pdf.js")).default;

    const getReportColor = (id: string) => {
      switch(id) {
        case "idare": return { primary: "#2563eb", secondary: "#dbeafe", accent: "#1d4ed8" };
        case "ogretmen": return { primary: "#7c3aed", secondary: "#ede9fe", accent: "#6d28d9" };
        case "veli": return { primary: "#059669", secondary: "#d1fae5", accent: "#047857" };
        case "rehberlik": return { primary: "#e11d48", secondary: "#ffe4e6", accent: "#be123c" };
        default: return { primary: "#6b7280", secondary: "#f3f4f6", accent: "#4b5563" };
      }
    };

    const colors = getReportColor(reportId);
    const topicTags = selectedAppointment.topic_tags?.join(", ") || "Genel";
    const studentClass = selectedAppointment.participant_class || "Belirtilmemiş";
    
    // Parse session notes for display
    const formattedNotes = sessionNotes.split("\\n").map(line => `<p style="margin: 4px 0;">${line}</p>`).join("");

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; padding: 0; margin: 0; color: #1f2937; background: white;">
        <!-- Header Banner -->
        <div style="background-color: ${colors.primary}; color: white; padding: 30px; margin-bottom: 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="vertical-align: top;">
                <h1 style="margin: 0 0 8px 0; font-size: 24px; font-weight: bold;">${reportType?.label || "Rapor"}</h1>
                <p style="margin: 0; font-size: 14px; color: #e0e0e0;">Dumlupınar İlkokulu Rehberlik Servisi</p>
              </td>
              <td style="text-align: right; vertical-align: top;">
                <div style="background-color: ${colors.accent}; padding: 12px 16px; border-radius: 8px; display: inline-block;">
                  <p style="margin: 0; font-size: 12px; color: #e0e0e0;">Rapor Tarihi</p>
                  <p style="margin: 4px 0 0 0; font-size: 16px; font-weight: bold;">${new Date().toLocaleDateString("tr-TR")}</p>
                </div>
              </td>
            </tr>
          </table>
        </div>

        <!-- Student Info Card -->
        <div style="background-color: ${colors.secondary}; padding: 20px 30px; border-bottom: 3px solid ${colors.primary};">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding-right: 40px;">
                <p style="margin: 0; font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px;">Öğrenci</p>
                <p style="margin: 4px 0 0 0; font-size: 18px; font-weight: bold; color: ${colors.primary};">${selectedAppointment.participant_name}</p>
              </td>
              <td style="padding-right: 40px;">
                <p style="margin: 0; font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px;">Sınıf</p>
                <p style="margin: 4px 0 0 0; font-size: 18px; font-weight: bold; color: #374151;">${studentClass}</p>
              </td>
              <td>
                <p style="margin: 0; font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px;">Görüşme Tarihi</p>
                <p style="margin: 4px 0 0 0; font-size: 18px; font-weight: bold; color: #374151;">${formatDate(selectedAppointment.appointment_date)}</p>
              </td>
            </tr>
          </table>
        </div>

        <!-- Main Content -->
        <div style="padding: 30px;">
          <!-- Tags -->
          <div style="margin-bottom: 24px;">
            <p style="margin: 0 0 8px 0; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px;">Konu Etiketleri</p>
            <div>
              ${(selectedAppointment.topic_tags || ["Genel"]).map(tag => 
                `<span style="background-color: ${colors.secondary}; color: ${colors.primary}; padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: bold; display: inline-block; margin-right: 8px; margin-bottom: 8px;">${tag}</span>`
              ).join("")}
            </div>
          </div>

          <!-- Report Content -->
          <div style="background-color: #f9fafb; border-radius: 12px; padding: 24px; border: 1px solid #e5e7eb;">
            <pre style="white-space: pre-wrap; font-family: Arial, sans-serif; font-size: 13px; line-height: 1.7; margin: 0; color: #374151;">${report}</pre>
          </div>
        </div>

        <!-- Footer -->
        <div style="background-color: #f3f4f6; padding: 20px 30px; margin-top: 20px; border-top: 1px solid #e5e7eb;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td>
                <p style="margin: 0; font-size: 14px; font-weight: bold; color: #374151;">Psikolojik Danışman</p>
                <p style="margin: 4px 0 0 0; font-size: 13px; color: #6b7280;">Mahmut Karadeniz</p>
              </td>
              <td style="text-align: right;">
                <p style="margin: 0; font-size: 11px; color: #9ca3af;">Dumlupınar Ortaokulu</p>
                <p style="margin: 2px 0 0 0; font-size: 11px; color: #9ca3af;">Rehberlik Servisi © ${new Date().getFullYear()}</p>
              </td>
            </tr>
          </table>
        </div>
      </div>
    `;

    // Create an isolated iframe to avoid CSS conflicts
    const iframe = document.createElement("iframe");
    iframe.style.position = "absolute";
    iframe.style.left = "-9999px";
    iframe.style.top = "0";
    iframe.style.width = "210mm";
    iframe.style.height = "297mm";
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) {
      toast.error("PDF oluşturulamadı");
      document.body.removeChild(iframe);
      return;
    }

    iframeDoc.open();
    iframeDoc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, sans-serif; background: white; }
          </style>
        </head>
        <body>${htmlContent}</body>
      </html>
    `);
    iframeDoc.close();

    const opt = {
      margin: 0,
      filename: `${reportType?.label || "rapor"}-${selectedAppointment.participant_name}-${new Date().toISOString().split("T")[0]}.pdf`,
      image: { type: "jpeg" as const, quality: 0.98 },
      html2canvas: { 
        scale: 2, 
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false
      },
      jsPDF: { unit: "mm" as const, format: "a4" as const, orientation: "portrait" as const }
    };

    try {
      await html2pdf().set(opt).from(iframeDoc.body).save();
      toast.success("PDF indirildi");
    } finally {
      document.body.removeChild(iframe);
    }
  };

  // Raporu Word olarak indir - Modern tasarım
  const downloadWord = async (reportId: string) => {
    const report = generatedReports[reportId];
    const reportType = REPORT_TYPES.find(t => t.id === reportId);
    if (!report || !selectedAppointment) return;

    const getReportColor = (id: string) => {
      switch(id) {
        case "idare": return { primary: "2563eb", secondary: "dbeafe", accent: "1d4ed8" };
        case "ogretmen": return { primary: "7c3aed", secondary: "ede9fe", accent: "6d28d9" };
        case "veli": return { primary: "059669", secondary: "d1fae5", accent: "047857" };
        case "rehberlik": return { primary: "e11d48", secondary: "ffe4e6", accent: "be123c" };
        default: return { primary: "6b7280", secondary: "f3f4f6", accent: "4b5563" };
      }
    };

    const colors = getReportColor(reportId);
    const studentClass = selectedAppointment.participant_class || "Belirtilmemiş";
    const topicTags = selectedAppointment.topic_tags || ["Genel"];

    // Rapor içeriğini paragraflara ayır
    const reportParagraphs = report.split("\n").map(line => {
      // Boş satır
      if (!line.trim()) {
        return new Paragraph({ spacing: { before: 100, after: 100 } });
      }
      // Ayırıcı çizgiler
      if (line.includes("━") || line.includes("═") || line.includes("─")) {
        return new Paragraph({
          children: [new TextRun({ text: "─".repeat(60), color: "CCCCCC" })],
          spacing: { before: 150, after: 150 }
        });
      }
      // Emoji ile başlayan başlıklar
      if (line.match(/^[📋📝🔍🎯📌🏠📞📚✅⚠️💡🔔]/)) {
        return new Paragraph({
          children: [new TextRun({ text: line, bold: true, size: 26, color: colors.primary })],
          spacing: { before: 300, after: 150 }
        });
      }
      // Büyük harfli başlıklar
      if (line === line.toUpperCase() && line.length > 3 && !line.includes(":")) {
        return new Paragraph({
          children: [new TextRun({ text: line, bold: true, size: 26, color: colors.primary })],
          spacing: { before: 300, after: 150 }
        });
      }
      // Madde işaretli satırlar
      if (line.trim().startsWith("•") || line.trim().startsWith("-") || line.trim().startsWith("*")) {
        return new Paragraph({
          children: [new TextRun({ text: line, size: 22 })],
          spacing: { before: 50, after: 50 },
          indent: { left: 400 }
        });
      }
      // Normal satırlar
      return new Paragraph({
        children: [new TextRun({ text: line, size: 22 })],
        spacing: { before: 50, after: 50 }
      });
    });

    const doc = new Document({
      sections: [{
        properties: {
          page: {
            margin: { top: 720, right: 720, bottom: 720, left: 720 }
          }
        },
        children: [
          // Header Table - Başlık ve Tarih
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
              insideHorizontal: { style: BorderStyle.NONE },
              insideVertical: { style: BorderStyle.NONE }
            },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({ text: reportType?.label || "Rapor", bold: true, size: 36, color: colors.primary })
                        ]
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({ text: "Dumlupınar Ortaokulu Rehberlik Servisi", size: 20, color: "666666" })
                        ],
                        spacing: { before: 50 }
                      })
                    ],
                    width: { size: 70, type: WidthType.PERCENTAGE },
                    borders: {
                      top: { style: BorderStyle.NONE },
                      bottom: { style: BorderStyle.NONE },
                      left: { style: BorderStyle.NONE },
                      right: { style: BorderStyle.NONE }
                    }
                  }),
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({ text: "Rapor Tarihi", size: 18, color: "666666" })
                        ],
                        alignment: AlignmentType.RIGHT
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({ text: new Date().toLocaleDateString("tr-TR"), bold: true, size: 24, color: colors.primary })
                        ],
                        alignment: AlignmentType.RIGHT,
                        spacing: { before: 50 }
                      })
                    ],
                    width: { size: 30, type: WidthType.PERCENTAGE },
                    borders: {
                      top: { style: BorderStyle.NONE },
                      bottom: { style: BorderStyle.NONE },
                      left: { style: BorderStyle.NONE },
                      right: { style: BorderStyle.NONE }
                    }
                  })
                ]
              })
            ]
          }),

          // Ayırıcı çizgi
          new Paragraph({
            children: [new TextRun({ text: "─".repeat(80), color: colors.primary })],
            spacing: { before: 200, after: 200 }
          }),

          // Öğrenci Bilgileri Tablosu
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
              bottom: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
              left: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
              right: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
              insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
              insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" }
            },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [new TextRun({ text: "ÖĞRENCİ", size: 18, color: "666666" })]
                      }),
                      new Paragraph({
                        children: [new TextRun({ text: selectedAppointment.participant_name, bold: true, size: 24, color: colors.primary })],
                        spacing: { before: 50 }
                      })
                    ],
                    width: { size: 33, type: WidthType.PERCENTAGE },
                    shading: { fill: colors.secondary }
                  }),
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [new TextRun({ text: "SINIF", size: 18, color: "666666" })]
                      }),
                      new Paragraph({
                        children: [new TextRun({ text: studentClass, bold: true, size: 24 })],
                        spacing: { before: 50 }
                      })
                    ],
                    width: { size: 33, type: WidthType.PERCENTAGE },
                    shading: { fill: colors.secondary }
                  }),
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [new TextRun({ text: "GÖRÜŞME TARİHİ", size: 18, color: "666666" })]
                      }),
                      new Paragraph({
                        children: [new TextRun({ text: formatDate(selectedAppointment.appointment_date), bold: true, size: 24 })],
                        spacing: { before: 50 }
                      })
                    ],
                    width: { size: 34, type: WidthType.PERCENTAGE },
                    shading: { fill: colors.secondary }
                  })
                ]
              })
            ]
          }),

          // Boşluk
          new Paragraph({ spacing: { before: 200, after: 100 } }),

          // Konu Etiketleri
          new Paragraph({
            children: [new TextRun({ text: "KONU ETİKETLERİ", size: 20, color: "666666" })],
            spacing: { before: 100, after: 100 }
          }),
          new Paragraph({
            children: topicTags.map((tag, index) => 
              new TextRun({ 
                text: index === 0 ? `• ${tag}` : `   • ${tag}`, 
                bold: true, 
                size: 22, 
                color: colors.primary 
              })
            ),
            spacing: { after: 200 }
          }),

          // Ana ayırıcı
          new Paragraph({
            children: [new TextRun({ text: "─".repeat(80), color: "CCCCCC" })],
            spacing: { before: 100, after: 200 }
          }),

          // Rapor İçeriği Başlığı
          new Paragraph({
            children: [new TextRun({ text: "RAPOR İÇERİĞİ", bold: true, size: 28, color: colors.primary })],
            spacing: { before: 100, after: 200 }
          }),

          // Rapor içeriği
          ...reportParagraphs,

          // Footer ayırıcı
          new Paragraph({
            children: [new TextRun({ text: "─".repeat(80), color: "CCCCCC" })],
            spacing: { before: 400, after: 200 }
          }),

          // Footer
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
              insideHorizontal: { style: BorderStyle.NONE },
              insideVertical: { style: BorderStyle.NONE }
            },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [new TextRun({ text: "Psikolojik Danışman", bold: true, size: 22 })]
                      }),
                      new Paragraph({
                        children: [new TextRun({ text: "Mehmet DALĞIN", size: 20, color: "666666" })],
                        spacing: { before: 50 }
                      })
                    ],
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    borders: {
                      top: { style: BorderStyle.NONE },
                      bottom: { style: BorderStyle.NONE },
                      left: { style: BorderStyle.NONE },
                      right: { style: BorderStyle.NONE }
                    }
                  }),
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [new TextRun({ text: "Dumlupınar İlkokulu", size: 18, color: "999999" })],
                        alignment: AlignmentType.RIGHT
                      }),
                      new Paragraph({
                        children: [new TextRun({ text: `Rehberlik Servisi © ${new Date().getFullYear()}`, size: 18, color: "999999" })],
                        alignment: AlignmentType.RIGHT,
                        spacing: { before: 30 }
                      })
                    ],
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    borders: {
                      top: { style: BorderStyle.NONE },
                      bottom: { style: BorderStyle.NONE },
                      left: { style: BorderStyle.NONE },
                      right: { style: BorderStyle.NONE }
                    }
                  })
                ]
              })
            ]
          })
        ]
      }]
    });

    const blob = await Packer.toBlob(doc);
    const fileName = `${reportType?.label || "rapor"}-${selectedAppointment.participant_name}-${new Date().toISOString().split("T")[0]}.docx`;
    saveAs(blob, fileName);
    toast.success("Word dosyası indirildi");
  };

  // Raporu veritabanına kaydet
  const saveReport = async () => {
    if (!selectedAppointment || Object.keys(generatedReports).length === 0) {
      toast.error("Önce rapor oluşturmalısınız");
      return;
    }

    setSaving(true);
    try {
      const reportData = {
        appointment_id: selectedAppointment.id,
        student_name: selectedAppointment.participant_name,
        student_class: selectedAppointment.participant_class,
        appointment_date: selectedAppointment.appointment_date,
        session_notes: sessionNotes,
        reports: generatedReports,
        created_at: new Date().toISOString()
      };

      if (currentReportId) {
        // Güncelle
        const { error } = await supabase!
          .from("appointment_reports")
          .update(reportData)
          .eq("id", currentReportId);
        
        if (error) throw error;
        toast.success("Rapor güncellendi");
      } else {
        // Yeni kaydet
        const { data, error } = await supabase!
          .from("appointment_reports")
          .insert(reportData)
          .select()
          .single();
        
        if (error) throw error;
        setCurrentReportId(data.id);
        toast.success("Rapor kaydedildi");
      }
      
      // Kaydedilmiş raporları yenile
      loadSavedReports();
    } catch (error: any) {
      console.error("Rapor kaydedilirken hata:", error);
      toast.error("Rapor kaydedilemedi: " + (error.message || "Bilinmeyen hata"));
    } finally {
      setSaving(false);
    }
  };

  // Kaydedilmiş raporu sil
  const deleteReport = async () => {
    if (!currentReportId) {
      toast.error("Silinecek kayıtlı rapor yok");
      return;
    }

    if (!confirm("Bu raporu silmek istediğinizden emin misiniz?")) return;

    try {
      const { error } = await supabase!
        .from("appointment_reports")
        .delete()
        .eq("id", currentReportId);
      
      if (error) throw error;
      
      setCurrentReportId(null);
      toast.success("Rapor silindi");
      loadSavedReports();
    } catch (error: any) {
      console.error("Rapor silinirken hata:", error);
      toast.error("Rapor silinemedi");
    }
  };

  // Kaydedilmiş raporları yükle
  const loadSavedReports = async () => {
    if (!supabase) return;
    
    try {
      const { data, error } = await supabase
        .from("appointment_reports")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      setSavedReports(data || []);
    } catch (error) {
      console.error("Kaydedilmiş raporlar yüklenirken hata:", error);
    }
  };

  // Kaydedilmiş raporu yükle
  const loadSavedReport = (report: any) => {
    const apt = appointments.find(a => a.id === report.appointment_id);
    if (apt) {
      setSelectedAppointment(apt);
    }
    setSessionNotes(report.session_notes || "");
    setGeneratedReports(report.reports || {});
    setCurrentReportId(report.id);
    setShowReportModal(true);
  };

  // Sayfa yüklendiğinde kaydedilmiş raporları yükle
  useEffect(() => {
    loadSavedReports();
  }, []);

  // Görüşme seç
  const openReportModal = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setSessionNotes(appointment.outcome_summary || "");
    setGeneratedReports({});
    setActiveReportTab("idare");
    setCurrentReportId(null);
    
    // Bu randevu için kayıtlı rapor var mı kontrol et
    const existingReport = savedReports.find(r => r.appointment_id === appointment.id);
    if (existingReport) {
      setSessionNotes(existingReport.session_notes || "");
      setGeneratedReports(existingReport.reports || {});
      setCurrentReportId(existingReport.id);
    }
    
    setShowReportModal(true);
  };

  // CSV export
  const exportToCSV = () => {
    const headers = ["Tarih", "Saat", "Katılımcı", "Sınıf", "Katılımcı Türü", "Durum", "Özet", "Karar"];
    const rows = filteredAppointments.map(apt => [
      formatDate(apt.appointment_date),
      formatTime(apt.start_time),
      apt.participant_name,
      apt.participant_class || "-",
      getParticipantLabel(apt.participant_type),
      STATUS_INFO[apt.status as keyof typeof STATUS_INFO]?.label || apt.status,
      apt.outcome_summary || "-",
      apt.outcome_decision?.join(", ") || "-"
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `randevu-raporu-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <FileText className="w-7 h-7 text-orange-500" />
            Randevu Raporları
          </h1>
          <p className="text-slate-500 mt-1">Görüşme seçin ve AI destekli raporlar oluşturun</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={exportToCSV}
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            CSV İndir
          </Button>
        </div>
      </div>

      {/* Tarih Filtresi ve Arama */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex items-center gap-2 bg-white rounded-lg p-1 border shadow-sm">
          <Button
            variant={dateRange === "week" ? "default" : "ghost"}
            size="sm"
            onClick={() => setDateRange("week")}
            className={dateRange === "week" ? "bg-orange-500 hover:bg-orange-600" : ""}
          >
            Son 7 Gün
          </Button>
          <Button
            variant={dateRange === "month" ? "default" : "ghost"}
            size="sm"
            onClick={() => setDateRange("month")}
            className={dateRange === "month" ? "bg-orange-500 hover:bg-orange-600" : ""}
          >
            Son 30 Gün
          </Button>
          <Button
            variant={dateRange === "all" ? "default" : "ghost"}
            size="sm"
            onClick={() => setDateRange("all")}
            className={dateRange === "all" ? "bg-orange-500 hover:bg-orange-600" : ""}
          >
            Tümü
          </Button>
        </div>
        
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Katılımcı, sınıf veya amaç ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
      </div>

      {/* İstatistik Kartları */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="border-0 shadow-lg overflow-hidden">
          <div className={`h-1 bg-gradient-to-r ${STATUS_INFO.attended.bgGradient}`}></div>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Geldi</p>
                <p className="text-2xl font-bold text-emerald-600">{stats.attended}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg overflow-hidden">
          <div className={`h-1 bg-gradient-to-r ${STATUS_INFO.not_attended.bgGradient}`}></div>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Gelmedi</p>
                <p className="text-2xl font-bold text-red-600">{stats.notAttended}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <XCircle className="w-6 h-6 text-red-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg overflow-hidden">
          <div className={`h-1 bg-gradient-to-r ${STATUS_INFO.postponed.bgGradient}`}></div>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Ertelendi</p>
                <p className="text-2xl font-bold text-amber-600">{stats.postponed}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                <Clock className="w-6 h-6 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg overflow-hidden">
          <div className={`h-1 bg-gradient-to-r ${STATUS_INFO.cancelled.bgGradient}`}></div>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">İptal</p>
                <p className="text-2xl font-bold text-slate-600">{stats.cancelled}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                <Ban className="w-6 h-6 text-slate-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-blue-500 to-indigo-600"></div>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Katılım Oranı</p>
                <p className="text-2xl font-bold text-blue-600">%{stats.attendanceRate}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs ve Randevu Listesi */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5 bg-white border shadow-sm">
          <TabsTrigger value="all" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white">
            Tümü ({stats.total})
          </TabsTrigger>
          <TabsTrigger value="attended" className="data-[state=active]:bg-emerald-500 data-[state=active]:text-white">
            Geldi ({stats.attended})
          </TabsTrigger>
          <TabsTrigger value="not_attended" className="data-[state=active]:bg-red-500 data-[state=active]:text-white">
            Gelmedi ({stats.notAttended})
          </TabsTrigger>
          <TabsTrigger value="postponed" className="data-[state=active]:bg-amber-500 data-[state=active]:text-white">
            Ertelendi ({stats.postponed})
          </TabsTrigger>
          <TabsTrigger value="cancelled" className="data-[state=active]:bg-slate-500 data-[state=active]:text-white">
            İptal ({stats.cancelled})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {filteredAppointments.length === 0 ? (
            <Card className="border-0 shadow-lg">
              <CardContent className="py-12 text-center">
                <CalendarDays className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-600 mb-2">Randevu Bulunamadı</h3>
                <p className="text-slate-400">
                  {searchTerm 
                    ? "Arama kriterlerine uygun randevu bulunamadı."
                    : "Bu kategoride henüz randevu kaydı bulunmuyor."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredAppointments.map((appointment) => {
                const statusInfo = STATUS_INFO[appointment.status as keyof typeof STATUS_INFO];
                const StatusIcon = statusInfo?.icon || Calendar;

                return (
                  <Card 
                    key={appointment.id} 
                    className="border-0 shadow-md hover:shadow-lg transition-all cursor-pointer group"
                    onClick={() => openReportModal(appointment)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        {/* Durum ikonu */}
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                          statusInfo?.iconColor === "text-emerald-500" ? "bg-emerald-100" :
                          statusInfo?.iconColor === "text-red-500" ? "bg-red-100" :
                          statusInfo?.iconColor === "text-amber-500" ? "bg-amber-100" :
                          "bg-slate-100"
                        }`}>
                          <StatusIcon className={`w-5 h-5 ${statusInfo?.iconColor || "text-slate-500"}`} />
                        </div>

                        {/* İçerik */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h3 className="font-semibold text-slate-800">{appointment.participant_name}</h3>
                              <p className="text-sm text-slate-500 flex items-center gap-2 mt-1">
                                <Calendar className="w-4 h-4" />
                                {formatDate(appointment.appointment_date)} • {formatTime(appointment.start_time)}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge className={statusInfo?.color || ""}>
                                {statusInfo?.label || appointment.status}
                              </Badge>
                              <Button
                                size="sm"
                                className="opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openReportModal(appointment);
                                }}
                              >
                                <Sparkles className="w-4 h-4 mr-1" />
                                AI Rapor
                              </Button>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-3 mt-3">
                            {appointment.participant_class && (
                              <span className="text-sm text-slate-600 flex items-center gap-1">
                                <User className="w-4 h-4" />
                                {appointment.participant_class}
                              </span>
                            )}
                            <Badge variant="outline" className="text-xs">
                              {getParticipantLabel(appointment.participant_type)}
                            </Badge>
                            {appointment.topic_tags?.slice(0, 3).map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Rapor Oluşturma Modal */}
      {showReportModal && selectedAppointment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-orange-500 to-amber-500 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowReportModal(false)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors text-white"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="text-white">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <Sparkles className="w-6 h-6" />
                    AI Destekli Rapor Oluşturucu
                  </h2>
                  <p className="text-white/80 text-sm">
                    {selectedAppointment.participant_name} - {formatDate(selectedAppointment.appointment_date)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowReportModal(false)}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden flex">
              {/* Sol Panel - Input */}
              <div className="w-2/5 border-r p-6 overflow-y-auto">
                <div className="space-y-4">
                  {/* Görüşme Bilgileri */}
                  <Card className="border-orange-200 bg-orange-50">
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-orange-800 mb-2">Görüşme Bilgileri</h3>
                      <div className="space-y-1 text-sm text-orange-700">
                        <p><strong>Öğrenci:</strong> {selectedAppointment.participant_name}</p>
                        <p><strong>Sınıf:</strong> {selectedAppointment.participant_class || "Belirtilmemiş"}</p>
                        <p><strong>Konu:</strong> {selectedAppointment.topic_tags?.join(", ") || "Genel"}</p>
                        <p><strong>Amaç:</strong> {selectedAppointment.purpose || "Rehberlik görüşmesi"}</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Görüşme Notları Input */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Görüşme Nasıl Geçti? *
                    </label>
                    <textarea
                      value={sessionNotes}
                      onChange={(e) => setSessionNotes(e.target.value)}
                      placeholder="Görüşmede neler konuşuldu? Öğrencinin durumu nasıldı? Öne çıkan konular neler? Ne gözlemlediniz?

Örnek: Öğrenci ile devamsızlık konusunda görüştük. Son zamanlarda sabahları uyanmakta güçlük çektiğini, gece geç saatlere kadar telefon kullandığını belirtti. Akademik motivasyonu düşük görünüyor. Kaygılı bir hal sergiledi..."
                      rows={12}
                      className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-orange-500 resize-none text-sm"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Ne kadar detaylı yazarsanız, raporlar o kadar kapsamlı olur.
                    </p>
                  </div>

                  {/* Oluştur Butonu */}
                  <Button
                    onClick={handleGenerateReports}
                    disabled={generating || !sessionNotes.trim()}
                    className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 h-12 text-base"
                  >
                    {generating ? (
                      <>
                        <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                        Raporlar Oluşturuluyor...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5 mr-2" />
                        4 Rapor Oluştur
                      </>
                    )}
                  </Button>

                  {/* Kaydet ve Sil Butonları */}
                  {Object.keys(generatedReports).length > 0 && (
                    <div className="flex gap-2 mt-3">
                      <Button
                        onClick={saveReport}
                        disabled={saving}
                        className="flex-1 bg-green-600 hover:bg-green-700"
                      >
                        {saving ? (
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4 mr-2" />
                        )}
                        {currentReportId ? "Güncelle" : "Kaydet"}
                      </Button>
                      {currentReportId && (
                        <Button
                          onClick={deleteReport}
                          variant="outline"
                          className="text-red-600 hover:bg-red-50 border-red-200"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Sil
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Kayıt durumu göstergesi */}
                  {currentReportId && (
                    <div className="mt-2 text-xs text-green-600 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      Bu rapor kaydedilmiş
                    </div>
                  )}
                </div>
              </div>

              {/* Sağ Panel - Raporlar */}
              <div className="w-3/5 flex flex-col overflow-hidden">
                {/* Rapor Sekmeleri - Her zaman görünür */}
                <div className="flex border-b bg-slate-50 p-2 gap-1">
                  {REPORT_TYPES.map((type) => {
                    const Icon = type.icon;
                    const hasContent = generatedReports[type.id];
                    return (
                      <button
                        key={type.id}
                        onClick={() => setActiveReportTab(type.id)}
                        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                          activeReportTab === type.id
                            ? `${type.bgColor} ${type.color} ${type.borderColor} border-2`
                            : hasContent 
                              ? "hover:bg-white text-slate-600" 
                              : "hover:bg-white text-slate-400"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="hidden lg:inline">{type.label.split(" ")[0]}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Rapor İçeriği */}
                <div className="flex-1 overflow-y-auto p-4">
                  {Object.keys(generatedReports).length === 0 ? (
                    <div className="flex-1 flex items-center justify-center h-full">
                      <div className="text-center">
                        <div className="w-24 h-24 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                          <FileText className="w-12 h-12 text-slate-300" />
                        </div>
                        <h3 className="text-lg font-medium text-slate-600 mb-2">Rapor Henüz Oluşturulmadı</h3>
                        <p className="text-slate-400 text-sm max-w-xs">
                          Soldaki alana görüşme notlarınızı yazın ve &quot;4 Rapor Oluştur&quot; butonuna tıklayın.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      {REPORT_TYPES.map((type) => {
                        if (activeReportTab !== type.id) return null;
                        const Icon = type.icon;
                        
                        return (
                          <div key={type.id} className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className={`w-10 h-10 rounded-lg ${type.bgColor} flex items-center justify-center`}>
                                  <Icon className={`w-5 h-5 ${type.color}`} />
                                </div>
                                <div>
                                  <h3 className="font-semibold text-slate-800">{type.label}</h3>
                                  <p className="text-xs text-slate-500">{type.description}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 flex-wrap">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => copyReport(type.id)}
                                  className="gap-1"
                                  title="Kopyala"
                                >
                                  <Copy className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => printReport(type.id)}
                                  className="gap-1"
                                  title="Yazdır"
                                >
                                  <Printer className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => downloadPDF(type.id)}
                                  className="gap-1 text-red-600 hover:text-red-700"
                                  title="PDF İndir"
                                >
                                  <FileDown className="w-4 h-4" />
                                  PDF
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => downloadWord(type.id)}
                                  className="gap-1 text-blue-600 hover:text-blue-700"
                                  title="Word İndir"
                                >
                                  <File className="w-4 h-4" />
                                  Word
                                </Button>
                              </div>
                            </div>
                            
                            <div className={`p-4 rounded-xl border ${type.borderColor} ${type.bgColor} bg-opacity-30`}>
                              <pre className="whitespace-pre-wrap text-sm text-slate-700 font-sans leading-relaxed">
                                {generatedReports[type.id]}
                              </pre>
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
