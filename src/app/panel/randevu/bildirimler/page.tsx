"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Bell, 
  Copy, 
  Check, 
  User, 
  Users, 
  GraduationCap,
  Calendar,
  Clock,
  MapPin,
  MessageSquare,
  Send,
  FileText,
  Download,
  RefreshCw,
  Sparkles,
  Phone,
  Mail,
  ExternalLink,
  AlertCircle,
  CheckCircle,
  Settings,
  Wand2,
  ChevronDown,
  ChevronUp,
  FileDown
} from "lucide-react";
import { Appointment, PARTICIPANT_TYPES, APPOINTMENT_LOCATIONS } from "@/types";
import { toast } from "sonner";
import { Document, Paragraph, TextRun, Packer, AlignmentType, BorderStyle, Table, TableRow, TableCell, WidthType, HeadingLevel, Header, Footer, PageNumber, NumberFormat } from "docx";
import { saveAs } from "file-saver";

// Tarih formatlarÄ±
const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    weekday: "long"
  });
};

const formatShortDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long"
  });
};

const formatTime = (timeStr: string) => {
  return timeStr.slice(0, 5);
};

// Konum label
const getLocationLabel = (location: string) => {
  const found = APPOINTMENT_LOCATIONS.find(l => l.value === location);
  return found?.label || location;
};

// Bildirim ÅŸablonlarÄ±
interface NotificationTemplate {
  id: string;
  name: string;
  type: "student" | "parent" | "teacher";
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  template: (apt: Appointment, schoolName: string, counselorName: string, teacherName?: string) => string;
}

// Ã–ÄŸretmen kaydÄ± tipi
interface TeacherRecord {
  value: string;
  label: string;
  sinifSubeKey: string;
  sinifSubeDisplay: string;
}

const NOTIFICATION_TEMPLATES: NotificationTemplate[] = [
  // Ã–ÄŸrenci ÅŸablonlarÄ±
  {
    id: "student_formal",
    name: "Resmi Bildirim",
    type: "student",
    icon: GraduationCap,
    color: "blue",
    template: (apt, schoolName, counselorName) => `SayÄ±n ${apt.participant_name},

${schoolName} Rehberlik Servisi olarak sizinle bir gÃ¶rÃ¼ÅŸme planladÄ±k.

ğŸ“… Tarih: ${formatDate(apt.appointment_date)}
ğŸ• Saat: ${formatTime(apt.start_time)}
ğŸ“ Yer: ${getLocationLabel(apt.location)}
â±ï¸ SÃ¼re: ${apt.duration} dakika

${apt.purpose ? `ğŸ“‹ GÃ¶rÃ¼ÅŸme Konusu: ${apt.purpose}\n` : ""}
Belirtilen gÃ¼n ve saatte Rehberlik Servisine gelmenizi rica ederiz.

SorularÄ±nÄ±z iÃ§in bizimle iletiÅŸime geÃ§ebilirsiniz.

SaygÄ±larÄ±mÄ±zla,
${counselorName}
Rehber Ã–ÄŸretmen ve Psikolojik DanÄ±ÅŸman`
  },
  {
    id: "student_friendly",
    name: "Samimi Bildirim",
    type: "student",
    icon: GraduationCap,
    color: "cyan",
    template: (apt, schoolName, counselorName) => `Merhaba ${apt.participant_name} ğŸ‘‹

Seninle bir gÃ¶rÃ¼ÅŸme yapmak istiyorum.

ğŸ“… ${formatShortDate(apt.appointment_date)} ${formatTime(apt.start_time)}'da
ğŸ“ ${getLocationLabel(apt.location)}'nda buluÅŸalÄ±m.

${apt.purpose ? `Konumuz: ${apt.purpose}\n` : ""}
Seni bekliyorum! ğŸ˜Š

${counselorName}
Rehber Ã–ÄŸretmen ve Psikolojik DanÄ±ÅŸman`
  },
  {
    id: "student_reminder",
    name: "HatÄ±rlatma",
    type: "student",
    icon: GraduationCap,
    color: "amber",
    template: (apt, schoolName, counselorName) => `ğŸ”” Randevu HatÄ±rlatmasÄ±

${apt.participant_name}, yarÄ±n saat ${formatTime(apt.start_time)}'da gÃ¶rÃ¼ÅŸmemiz var.

ğŸ“ Yer: ${getLocationLabel(apt.location)}

GÃ¶rÃ¼ÅŸmek Ã¼zere!
${counselorName}
Rehber Ã–ÄŸretmen`
  },

  // Veli ÅŸablonlarÄ±
  {
    id: "parent_formal",
    name: "Resmi Davet",
    type: "parent",
    icon: Users,
    color: "emerald",
    template: (apt, schoolName, counselorName) => `SayÄ±n Veli,

${schoolName} Rehberlik Servisi olarak, Ã¶ÄŸrenciniz ${apt.participant_name} hakkÄ±nda sizinle bir gÃ¶rÃ¼ÅŸme yapmak istiyoruz.

ğŸ“… Tarih: ${formatDate(apt.appointment_date)}
ğŸ• Saat: ${formatTime(apt.start_time)}
ğŸ“ Yer: ${getLocationLabel(apt.location)}
â±ï¸ Tahmini SÃ¼re: ${apt.duration} dakika

${apt.purpose ? `ğŸ“‹ GÃ¶rÃ¼ÅŸme Konusu: ${apt.purpose}\n` : ""}
Bu gÃ¶rÃ¼ÅŸme, Ã¶ÄŸrencinizin eÄŸitim sÃ¼recini desteklemek amacÄ±yla planlanmÄ±ÅŸtÄ±r.

Randevuya katÄ±lÄ±mÄ±nÄ±z Ã¶nemlidir. Belirtilen tarih ve saatte uygun deÄŸilseniz, lÃ¼tfen Ã¶nceden bilgi veriniz.

SaygÄ±larÄ±mÄ±zla,
${counselorName}
Rehber Ã–ÄŸretmen ve Psikolojik DanÄ±ÅŸman`
  },
  {
    id: "parent_whatsapp",
    name: "WhatsApp MesajÄ±",
    type: "parent",
    icon: Users,
    color: "green",
    template: (apt, schoolName, counselorName) => `Merhaba ğŸ‘‹

${schoolName} Rehberlik Servisi'nden ${counselorName}.

${apt.participant_name}'Ä±n velisi olarak sizinle gÃ¶rÃ¼ÅŸmek istiyoruz.

ğŸ“… ${formatShortDate(apt.appointment_date)}
ğŸ• ${formatTime(apt.start_time)}
ğŸ“ ${getLocationLabel(apt.location)}

${apt.purpose ? `Konu: ${apt.purpose}\n` : ""}
UygunluÄŸunuzu teyit eder misiniz? âœ…`
  },
  {
    id: "parent_reminder",
    name: "Randevu HatÄ±rlatma",
    type: "parent",
    icon: Users,
    color: "orange",
    template: (apt, schoolName, counselorName) => `ğŸ”” Randevu HatÄ±rlatmasÄ±

SayÄ±n Veli,

YarÄ±n saat ${formatTime(apt.start_time)}'da ${apt.participant_name} iÃ§in planlanmÄ±ÅŸ gÃ¶rÃ¼ÅŸmemizi hatÄ±rlatmak isteriz.

ğŸ“ ${getLocationLabel(apt.location)}

GÃ¶rÃ¼ÅŸmek Ã¼zere,
${counselorName}
Rehber Ã–ÄŸretmen`
  },

  // Ã–ÄŸretmen ÅŸablonlarÄ±
  {
    id: "teacher_formal",
    name: "Resmi Bilgilendirme",
    type: "teacher",
    icon: User,
    color: "violet",
    template: (apt, schoolName, counselorName, teacherName) => `SayÄ±n ${teacherName || "Ã–ÄŸretmenim"} Ã–ÄŸretmenim,

Rehberlik Servisi olarak ${apt.participant_name.toUpperCase()} iÃ§in aÅŸaÄŸÄ±daki detaylarÄ± verilen bir gÃ¶rÃ¼ÅŸme planladÄ±k.

ğŸ“… Tarih: ${formatDate(apt.appointment_date)}
ğŸ• Saat: ${formatTime(apt.start_time)}
ğŸ“ Yer: ${getLocationLabel(apt.location)}
â±ï¸ SÃ¼re: ${apt.duration} dakika

${apt.purpose ? `ğŸ“‹ GÃ¶rÃ¼ÅŸme Konusu: ${apt.purpose}\n` : ""}
Ã–ÄŸrencinin belirtilen tarih ve zamanda katÄ±lÄ±mÄ±nÄ± saÄŸlamanÄ±zÄ± rica ederiz.

SaygÄ±larÄ±mÄ±zla,
${counselorName}
Rehber Ã–ÄŸretmen ve Psikolojik DanÄ±ÅŸman`
  },
  {
    id: "teacher_collaboration",
    name: "Ä°ÅŸ BirliÄŸi Daveti",
    type: "teacher",
    icon: User,
    color: "indigo",
    template: (apt, schoolName, counselorName, teacherName) => `Merhaba ${teacherName || "Ã–ÄŸretmenim"} Ã–ÄŸretmenim,

${apt.participant_class} sÄ±nÄ±fÄ±ndan ${apt.participant_name}'nÄ±n ${apt.purpose || "gÃ¶rÃ¼ÅŸme konusu"} ile ilgili sizinle kÄ±sa bir gÃ¶rÃ¼ÅŸme yapmak istiyorum.

ğŸ“… ${formatDate(apt.appointment_date)} â€“ ${formatTime(apt.start_time)}
ğŸ“ ${getLocationLabel(apt.location)}

EÄŸer bu saat sizin iÃ§in uygunsa gÃ¶rÃ¼ÅŸebiliriz. Uygun deÄŸilse, mÃ¼sait olduÄŸunuz bir gÃ¼n ve saat Ã¶nerirseniz takviminize gÃ¶re planlayalÄ±m.

TeÅŸekkÃ¼r ederim.

Mahmut Karadeniz
Rehber Ã–ÄŸretmen ve Psikolojik DanÄ±ÅŸman`
  },
  {
    id: "teacher_quick",
    name: "KÄ±sa Mesaj",
    type: "teacher",
    icon: User,
    color: "slate",
    template: (apt, schoolName, counselorName, teacherName) => `Merhaba ${teacherName || "Ã–ÄŸretmenim"} Ã–ÄŸretmenim,

${apt.participant_class} sÄ±nÄ±fÄ±ndan ${apt.participant_name}'nÄ±n ${apt.purpose || "gÃ¶rÃ¼ÅŸme konusu"} ile ilgili sizinle kÄ±sa bir gÃ¶rÃ¼ÅŸme yapmak istiyorum.

ğŸ“… ${formatDate(apt.appointment_date)} â€“ ${formatTime(apt.start_time)}
ğŸ“ ${getLocationLabel(apt.location)}

Bu zaman sizin iÃ§in uygunsa gÃ¶rÃ¼ÅŸebiliriz. Uygun deÄŸilse, mÃ¼sait olduÄŸunuz alternatif bir gÃ¼n ve saat Ã¶nerebilir misiniz? Takviminize gÃ¶re planlayayÄ±m.

TeÅŸekkÃ¼r ederim,
Mahmut Karadeniz
Rehber Ã–ÄŸretmen ve Psikolojik DanÄ±ÅŸman`
  },
  {
    id: "teacher_parent_meeting",
    name: "Veli GÃ¶rÃ¼ÅŸme Ã‡aÄŸrÄ±sÄ±",
    type: "teacher",
    icon: Users,
    color: "amber",
    template: (apt, schoolName, counselorName, teacherName) => `Merhaba ${teacherName || "Ã–ÄŸretmenim"} Ã–ÄŸretmenim,

Ã–ÄŸrenciniz ${apt.participant_name} ile ilgili ${apt.purpose || "gÃ¶rÃ¼ÅŸme konusu"} konusunda veliyle gÃ¶rÃ¼ÅŸme yapÄ±lmasÄ± gerekiyor. Veliye aÅŸaÄŸÄ±da belirtilen gÃ¶rÃ¼ÅŸme detaylarÄ±nÄ± iletirseniz sevinirim.

ğŸ“… ${formatDate(apt.appointment_date)} â€“ ${formatTime(apt.start_time)}
ğŸ“ ${getLocationLabel(apt.location)}

Bu zaman veli iÃ§in uygun olmazsa, velinin mÃ¼saitliÄŸine gÃ¶re alternatif bir gÃ¼n/saat de ayarlayabiliriz. Haber verirseniz planlayayÄ±m.

TeÅŸekkÃ¼r ederim.
Mahmut Karadeniz
Rehber Ã–ÄŸretmen ve Psikolojik DanÄ±ÅŸman`
  }
];

export default function RandevuBildirimlerPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [teachers, setTeachers] = useState<TeacherRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<NotificationTemplate | null>(null);
  const [generatedText, setGeneratedText] = useState("");
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"student" | "parent" | "teacher">("student");
  const [showSettings, setShowSettings] = useState(false);
  
  // Ayarlar
  const [schoolName, setSchoolName] = useState("DUMLUPINAR ORTAOKULU");
  const [counselorName, setCounselorName] = useState("Mahmut Karadeniz");

  // SÄ±nÄ±f/ÅŸube key veya display text'inden Ã¶ÄŸretmen adÄ±nÄ± bul
  const getTeacherByClass = (classKeyOrDisplay: string | undefined): string | undefined => {
    if (!classKeyOrDisplay || teachers.length === 0) {
      return undefined;
    }
    
    // Normalize fonksiyonu - TÃ¼rkÃ§e karakterleri ve Ã¶zel karakterleri temizle
    const normalize = (str: string) => str
      .toLowerCase()
      .replace(/[Ä±Ä°]/g, 'i')
      .replace(/[ÅŸÅ]/g, 's')
      .replace(/[Ã§Ã‡]/g, 'c')
      .replace(/[ÄŸÄ]/g, 'g')
      .replace(/[Ã¼Ãœ]/g, 'u')
      .replace(/[Ã¶Ã–]/g, 'o')
      .replace(/\s+/g, '')
      .replace(/[\/\-\.]/g, '');
    
    // Ã–nce key ile tam eÅŸleÅŸtir (Ã¶rn: "22602658#0", "22154388#1")
    let teacher = teachers.find(t => t.sinifSubeKey === classKeyOrDisplay);
    
    // Bulamazsa display text ile tam eÅŸleÅŸtir
    if (!teacher) {
      teacher = teachers.find(t => t.sinifSubeDisplay === classKeyOrDisplay);
    }
    
    // Hala bulamazsa normalize edilmiÅŸ karÅŸÄ±laÅŸtÄ±rma yap
    if (!teacher) {
      const normalizedInput = normalize(classKeyOrDisplay);
      teacher = teachers.find(t => {
        const normalizedDisplay = normalize(t.sinifSubeDisplay || '');
        return normalizedDisplay === normalizedInput;
      });
    }
    
    // Son Ã§are: kÄ±smi eÅŸleÅŸme yap (Ã¶rn: "1. SÄ±nÄ±f / A" -> "1. SÄ±nÄ±f / A Åubesi")
    if (!teacher) {
      const normalizedInput = normalize(classKeyOrDisplay);
      teacher = teachers.find(t => {
        const normalizedDisplay = normalize(t.sinifSubeDisplay || '');
        return normalizedDisplay.includes(normalizedInput) || normalizedInput.includes(normalizedDisplay);
      });
    }
    
    return teacher?.label || teacher?.value;
  };

  // RandevularÄ± ve Ã¶ÄŸretmenleri yÃ¼kle
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Paralel olarak randevularÄ± ve Ã¶ÄŸretmenleri Ã§ek
        const [appointmentsRes, teachersRes] = await Promise.all([
          fetch("/api/appointments?status=planned"),
          fetch("/api/teachers")
        ]);
        
        if (appointmentsRes.ok) {
          const data = await appointmentsRes.json();
          setAppointments(data.appointments || data || []);
        }
        
        if (teachersRes.ok) {
          const data = await teachersRes.json();
          setTeachers(data.teachers || []);
        }
      } catch (error) {
        console.error("Veriler yÃ¼klenirken hata:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Aktif tab'a gÃ¶re ÅŸablonlarÄ± filtrele
  const filteredTemplates = useMemo(() => {
    return NOTIFICATION_TEMPLATES.filter(t => t.type === activeTab);
  }, [activeTab]);

  // Bildirim metnini oluÅŸtur
  const generateNotification = (template: NotificationTemplate) => {
    if (!selectedAppointment) {
      toast.error("LÃ¼tfen Ã¶nce bir randevu seÃ§in");
      return;
    }
    
    setSelectedTemplate(template);
    
    // Ã–ÄŸretmen ÅŸablonlarÄ± iÃ§in sÄ±nÄ±ftan Ã¶ÄŸretmen adÄ±nÄ± Ã§ek
    let teacherName: string | undefined;
    if (template.type === "teacher" && selectedAppointment.participant_class) {
      teacherName = getTeacherByClass(selectedAppointment.participant_class);
    }
    
    const text = template.template(selectedAppointment, schoolName, counselorName, teacherName);
    setGeneratedText(text);
  };

  // Metni kopyala
  const copyToClipboard = async () => {
    if (!generatedText) return;
    
    try {
      await navigator.clipboard.writeText(generatedText);
      setCopied(true);
      toast.success("Metin panoya kopyalandÄ±!");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Kopyalama baÅŸarÄ±sÄ±z oldu");
    }
  };

  // WhatsApp paylaÅŸÄ±mÄ±
  const shareWhatsApp = () => {
    if (!generatedText) return;
    const encoded = encodeURIComponent(generatedText);
    window.open(`https://wa.me/?text=${encoded}`, "_blank");
  };

  // SMS linki (telefon uygulamasÄ± aÃ§ar)
  const openSMS = () => {
    if (!generatedText) return;
    const encoded = encodeURIComponent(generatedText);
    window.open(`sms:?body=${encoded}`, "_blank");
  };

  // E-posta linki
  const openEmail = () => {
    if (!generatedText || !selectedAppointment) return;
    const subject = encodeURIComponent(`Randevu Bildirimi - ${formatShortDate(selectedAppointment.appointment_date)}`);
    const body = encodeURIComponent(generatedText);
    window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
  };

  // Metin dosyasÄ± olarak indir
  const downloadAsText = () => {
    if (!generatedText || !selectedAppointment) return;
    
    const blob = new Blob([generatedText], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `randevu-bildirimi-${selectedAppointment.participant_name.replace(/\s+/g, "-")}.txt`;
    link.click();
    toast.success("Dosya indirildi");
  };

  // PDF olarak indir - TarayÄ±cÄ± yazdÄ±rma ile (TÃ¼rkÃ§e karakter tam desteÄŸi)
  const downloadAsPDF = () => {
    if (!generatedText || !selectedAppointment) return;
    
    try {
      // Yeni pencere oluÅŸtur
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast.error("Pop-up engelleyici aktif olabilir");
        return;
      }

      const appointmentDate = formatDate(selectedAppointment.appointment_date);
      const appointmentTime = formatTime(selectedAppointment.start_time);
      const participantType = PARTICIPANT_TYPES.find(p => p.value === selectedAppointment.participant_type)?.label || "";
      const location = APPOINTMENT_LOCATIONS.find(l => l.value === selectedAppointment.location)?.label || "";

      // HTML iÃ§eriÄŸi oluÅŸtur
      const htmlContent = `
        <!DOCTYPE html>
        <html lang="tr">
        <head>
          <meta charset="UTF-8">
          <title>Randevu Bildirimi - ${selectedAppointment.participant_name}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
            
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            body {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              line-height: 1.6;
              color: #1e293b;
              background: white;
              padding: 40px;
              max-width: 800px;
              margin: 0 auto;
            }
            
            .header {
              text-align: center;
              padding-bottom: 24px;
              border-bottom: 3px solid #8b5cf6;
              margin-bottom: 32px;
            }
            
            .logo-area {
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 16px;
              margin-bottom: 16px;
            }
            
            .logo-icon {
              width: 56px;
              height: 56px;
              background: linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%);
              border-radius: 12px;
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-size: 24px;
              font-weight: bold;
            }
            
            .school-name {
              font-size: 18px;
              font-weight: 600;
              color: #4b5563;
            }
            
            .title {
              font-size: 28px;
              font-weight: 700;
              color: #8b5cf6;
              margin-bottom: 8px;
            }
            
            .subtitle {
              font-size: 14px;
              color: #64748b;
            }
            
            .info-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 16px;
              margin-bottom: 32px;
              background: #f8fafc;
              padding: 20px;
              border-radius: 12px;
              border: 1px solid #e2e8f0;
            }
            
            .info-item {
              display: flex;
              align-items: flex-start;
              gap: 12px;
            }
            
            .info-icon {
              width: 36px;
              height: 36px;
              background: white;
              border-radius: 8px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 16px;
              box-shadow: 0 1px 3px rgba(0,0,0,0.1);
              flex-shrink: 0;
            }
            
            .info-content {
              flex: 1;
            }
            
            .info-label {
              font-size: 11px;
              font-weight: 600;
              color: #94a3b8;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 2px;
            }
            
            .info-value {
              font-size: 14px;
              font-weight: 500;
              color: #1e293b;
            }
            
            .content-section {
              background: white;
              border: 1px solid #e2e8f0;
              border-radius: 12px;
              padding: 24px;
              margin-bottom: 24px;
            }
            
            .section-title {
              font-size: 12px;
              font-weight: 600;
              color: #8b5cf6;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 16px;
              padding-bottom: 8px;
              border-bottom: 2px solid #f1f5f9;
            }
            
            .message-text {
              font-size: 14px;
              line-height: 1.8;
              color: #334155;
              white-space: pre-wrap;
            }
            
            .footer {
              text-align: center;
              padding-top: 24px;
              border-top: 1px solid #e2e8f0;
              margin-top: 32px;
            }
            
            .footer-text {
              font-size: 12px;
              color: #94a3b8;
            }
            
            .badge {
              display: inline-block;
              padding: 4px 12px;
              background: #f0fdf4;
              color: #16a34a;
              border-radius: 20px;
              font-size: 12px;
              font-weight: 500;
              margin-top: 8px;
            }
            
            @media print {
              body {
                padding: 20px;
              }
              .no-print {
                display: none !important;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo-area">
              <div class="logo-icon">ğŸ“‹</div>
              <div class="school-name">${schoolName}</div>
            </div>
            <h1 class="title">Randevu Bildirimi</h1>
            <p class="subtitle">Rehberlik ve Psikolojik DanÄ±ÅŸmanlÄ±k Servisi</p>
          </div>
          
          <div class="info-grid">
            <div class="info-item">
              <div class="info-icon">ğŸ‘¤</div>
              <div class="info-content">
                <div class="info-label">KatÄ±lÄ±mcÄ±</div>
                <div class="info-value">${selectedAppointment.participant_name}</div>
              </div>
            </div>
            <div class="info-item">
              <div class="info-icon">ğŸ«</div>
              <div class="info-content">
                <div class="info-label">SÄ±nÄ±f</div>
                <div class="info-value">${selectedAppointment.participant_class || "-"}</div>
              </div>
            </div>
            <div class="info-item">
              <div class="info-icon">ğŸ“…</div>
              <div class="info-content">
                <div class="info-label">Tarih</div>
                <div class="info-value">${appointmentDate}</div>
              </div>
            </div>
            <div class="info-item">
              <div class="info-icon">â°</div>
              <div class="info-content">
                <div class="info-label">Saat</div>
                <div class="info-value">${appointmentTime}</div>
              </div>
            </div>
            <div class="info-item">
              <div class="info-icon">ğŸ“</div>
              <div class="info-content">
                <div class="info-label">Konum</div>
                <div class="info-value">${location}</div>
              </div>
            </div>
            <div class="info-item">
              <div class="info-icon">ğŸ·ï¸</div>
              <div class="info-content">
                <div class="info-label">KatÄ±lÄ±mcÄ± Tipi</div>
                <div class="info-value">${participantType}</div>
              </div>
            </div>
          </div>
          
          <div class="content-section">
            <h2 class="section-title">Bildirim Metni</h2>
            <div class="message-text">${generatedText.replace(/\n/g, '<br>')}</div>
          </div>
          
          <div class="footer">
            <p class="footer-text">Bu belge ${new Date().toLocaleDateString('tr-TR')} tarihinde oluÅŸturulmuÅŸtur.</p>
            <span class="badge">âœ“ Rehberlik Servisi</span>
          </div>
          
          <div class="no-print" style="text-align: center; margin-top: 24px;">
            <button onclick="window.print()" style="
              background: linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%);
              color: white;
              border: none;
              padding: 12px 32px;
              border-radius: 8px;
              font-size: 14px;
              font-weight: 600;
              cursor: pointer;
              margin-right: 12px;
            ">ğŸ“„ PDF Olarak Kaydet</button>
            <button onclick="window.close()" style="
              background: #f1f5f9;
              color: #64748b;
              border: none;
              padding: 12px 32px;
              border-radius: 8px;
              font-size: 14px;
              font-weight: 600;
              cursor: pointer;
            ">âœ• Kapat</button>
          </div>
        </body>
        </html>
      `;

      printWindow.document.write(htmlContent);
      printWindow.document.close();
      toast.success("PDF penceresi aÃ§Ä±ldÄ± - Kaydetmek iÃ§in yazdÄ±r butonuna basÄ±n");
    } catch (error) {
      console.error("PDF oluÅŸturma hatasÄ±:", error);
      toast.error("PDF oluÅŸturulamadÄ±");
    }
  };

  // Word olarak indir - Profesyonel tasarÄ±m
  const downloadAsWord = async () => {
    if (!generatedText || !selectedAppointment) return;
    
    try {
      const appointmentDate = formatDate(selectedAppointment.appointment_date);
      const appointmentTime = formatTime(selectedAppointment.start_time);
      const participantType = PARTICIPANT_TYPES.find(p => p.value === selectedAppointment.participant_type)?.label || "";
      const location = APPOINTMENT_LOCATIONS.find(l => l.value === selectedAppointment.location)?.label || "";

      // Metin paragraflarÄ±nÄ± oluÅŸtur
      const contentParagraphs = generatedText.split('\n').filter(line => line.trim()).map(line => {
        return new Paragraph({
          children: [
            new TextRun({
              text: line,
              size: 24, // 12pt
              font: "Calibri",
            }),
          ],
          spacing: { after: 200, line: 360 },
        });
      });

      const doc = new Document({
        sections: [{
          properties: {
            page: {
              margin: {
                top: 1440, // 1 inch
                right: 1440,
                bottom: 1440,
                left: 1440,
              },
            },
          },
          headers: {
            default: new Header({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: schoolName,
                      size: 20,
                      color: "666666",
                      font: "Calibri",
                    }),
                  ],
                  alignment: AlignmentType.CENTER,
                }),
              ],
            }),
          },
          footers: {
            default: new Footer({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "Rehberlik ve Psikolojik DanÄ±ÅŸmanlÄ±k Servisi | ",
                      size: 18,
                      color: "999999",
                      font: "Calibri",
                    }),
                    new TextRun({
                      text: `OluÅŸturulma: ${new Date().toLocaleDateString('tr-TR')}`,
                      size: 18,
                      color: "999999",
                      font: "Calibri",
                    }),
                  ],
                  alignment: AlignmentType.CENTER,
                }),
              ],
            }),
          },
          children: [
            // BaÅŸlÄ±k
            new Paragraph({
              children: [
                new TextRun({
                  text: "RANDEVU BÄ°LDÄ°RÄ°MÄ°",
                  bold: true,
                  size: 36, // 18pt
                  color: "7C3AED",
                  font: "Calibri",
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 },
              border: {
                bottom: {
                  color: "7C3AED",
                  space: 10,
                  size: 20,
                  style: BorderStyle.SINGLE,
                },
              },
            }),
            
            // BoÅŸluk
            new Paragraph({ spacing: { after: 300 } }),
            
            // Bilgi tablosu
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
                bottom: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
                left: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
                right: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
                insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
                insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
              },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      children: [new Paragraph({
                        children: [new TextRun({ text: "ğŸ“‹ KatÄ±lÄ±mcÄ±", bold: true, size: 22, font: "Calibri" })],
                        spacing: { before: 100, after: 100 },
                      })],
                      width: { size: 25, type: WidthType.PERCENTAGE },
                      shading: { fill: "F8FAFC" },
                    }),
                    new TableCell({
                      children: [new Paragraph({
                        children: [new TextRun({ text: selectedAppointment.participant_name, size: 22, font: "Calibri" })],
                        spacing: { before: 100, after: 100 },
                      })],
                      width: { size: 25, type: WidthType.PERCENTAGE },
                    }),
                    new TableCell({
                      children: [new Paragraph({
                        children: [new TextRun({ text: "ğŸ« SÄ±nÄ±f", bold: true, size: 22, font: "Calibri" })],
                        spacing: { before: 100, after: 100 },
                      })],
                      width: { size: 25, type: WidthType.PERCENTAGE },
                      shading: { fill: "F8FAFC" },
                    }),
                    new TableCell({
                      children: [new Paragraph({
                        children: [new TextRun({ text: selectedAppointment.participant_class || "-", size: 22, font: "Calibri" })],
                        spacing: { before: 100, after: 100 },
                      })],
                      width: { size: 25, type: WidthType.PERCENTAGE },
                    }),
                  ],
                }),
                new TableRow({
                  children: [
                    new TableCell({
                      children: [new Paragraph({
                        children: [new TextRun({ text: "ğŸ“… Tarih", bold: true, size: 22, font: "Calibri" })],
                        spacing: { before: 100, after: 100 },
                      })],
                      shading: { fill: "F8FAFC" },
                    }),
                    new TableCell({
                      children: [new Paragraph({
                        children: [new TextRun({ text: appointmentDate, size: 22, font: "Calibri" })],
                        spacing: { before: 100, after: 100 },
                      })],
                    }),
                    new TableCell({
                      children: [new Paragraph({
                        children: [new TextRun({ text: "â° Saat", bold: true, size: 22, font: "Calibri" })],
                        spacing: { before: 100, after: 100 },
                      })],
                      shading: { fill: "F8FAFC" },
                    }),
                    new TableCell({
                      children: [new Paragraph({
                        children: [new TextRun({ text: appointmentTime, size: 22, font: "Calibri" })],
                        spacing: { before: 100, after: 100 },
                      })],
                    }),
                  ],
                }),
                new TableRow({
                  children: [
                    new TableCell({
                      children: [new Paragraph({
                        children: [new TextRun({ text: "ğŸ“ Konum", bold: true, size: 22, font: "Calibri" })],
                        spacing: { before: 100, after: 100 },
                      })],
                      shading: { fill: "F8FAFC" },
                    }),
                    new TableCell({
                      children: [new Paragraph({
                        children: [new TextRun({ text: location, size: 22, font: "Calibri" })],
                        spacing: { before: 100, after: 100 },
                      })],
                    }),
                    new TableCell({
                      children: [new Paragraph({
                        children: [new TextRun({ text: "ğŸ·ï¸ Tip", bold: true, size: 22, font: "Calibri" })],
                        spacing: { before: 100, after: 100 },
                      })],
                      shading: { fill: "F8FAFC" },
                    }),
                    new TableCell({
                      children: [new Paragraph({
                        children: [new TextRun({ text: participantType, size: 22, font: "Calibri" })],
                        spacing: { before: 100, after: 100 },
                      })],
                    }),
                  ],
                }),
              ],
            }),
            
            // BoÅŸluk
            new Paragraph({ spacing: { after: 400 } }),
            
            // Bildirim Metni baÅŸlÄ±ÄŸÄ±
            new Paragraph({
              children: [
                new TextRun({
                  text: "BÄ°LDÄ°RÄ°M METNÄ°",
                  bold: true,
                  size: 24,
                  color: "7C3AED",
                  font: "Calibri",
                }),
              ],
              spacing: { after: 200 },
              border: {
                bottom: {
                  color: "E5E7EB",
                  space: 5,
                  size: 10,
                  style: BorderStyle.SINGLE,
                },
              },
            }),
            
            // BoÅŸluk
            new Paragraph({ spacing: { after: 200 } }),
            
            // Ä°Ã§erik paragraflarÄ±
            ...contentParagraphs,
          ],
        }],
      });

      const blob = await Packer.toBlob(doc);
      const fileName = `randevu-bildirimi-${selectedAppointment.participant_name.replace(/\s+/g, "-")}.docx`;
      saveAs(blob, fileName);
      toast.success("Word dosyasÄ± indirildi");
    } catch (error) {
      console.error("Word oluÅŸturma hatasÄ±:", error);
      toast.error("Word dosyasÄ± oluÅŸturulamadÄ±");
    }
  };

  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Bell className="w-7 h-7 text-purple-500" />
            Randevu Bildirimleri
          </h1>
          <p className="text-slate-500 mt-1">Ã–ÄŸrenci, veli ve Ã¶ÄŸretmenler iÃ§in bildirim metinleri oluÅŸturun</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowSettings(!showSettings)}
          className="gap-2"
        >
          <Settings className="w-4 h-4" />
          Ayarlar
          {showSettings ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </Button>
      </div>

      {/* Ayarlar Panel */}
      {showSettings && (
        <Card className="border-0 shadow-lg bg-gradient-to-r from-purple-50 to-pink-50">
          <CardContent className="pt-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700">Okul AdÄ±</label>
                <input
                  type="text"
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Okul adÄ±nÄ± girin"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">DanÄ±ÅŸman AdÄ±</label>
                <input
                  type="text"
                  value={counselorName}
                  onChange={(e) => setCounselorName(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="DanÄ±ÅŸman adÄ±nÄ± girin"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Sol Panel - Randevu SeÃ§imi */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="w-5 h-5 text-purple-500" />
                Randevu SeÃ§in
              </CardTitle>
              <CardDescription>
                Bildirim oluÅŸturmak iÃ§in bir randevu seÃ§in
              </CardDescription>
            </CardHeader>
            <CardContent>
              {appointments.length === 0 ? (
                <div className="text-center py-8">
                  <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">PlanlanmÄ±ÅŸ randevu bulunamadÄ±</p>
                  <p className="text-sm text-slate-400 mt-1">Ã–nce bir randevu oluÅŸturun</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                  {appointments.map((apt) => (
                    <div
                      key={apt.id}
                      onClick={() => {
                        setSelectedAppointment(apt);
                        setGeneratedText("");
                        setSelectedTemplate(null);
                      }}
                      className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        selectedAppointment?.id === apt.id
                          ? "border-purple-500 bg-purple-50"
                          : "border-transparent bg-slate-50 hover:bg-slate-100"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-slate-800">{apt.participant_name}</p>
                          <p className="text-sm text-slate-500">{apt.participant_class}</p>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {PARTICIPANT_TYPES.find(p => p.value === apt.participant_type)?.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatShortDate(apt.appointment_date)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTime(apt.start_time)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* SeÃ§ili Randevu DetayÄ± */}
          {selectedAppointment && (
            <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-500 to-pink-500 text-white">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">SeÃ§ili Randevu</span>
                </div>
                <h3 className="text-xl font-bold">{selectedAppointment.participant_name}</h3>
                <p className="text-purple-100">{selectedAppointment.participant_class}</p>
                <div className="mt-3 space-y-1 text-sm text-purple-100">
                  <p className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    {formatDate(selectedAppointment.appointment_date)}
                  </p>
                  <p className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    {formatTime(selectedAppointment.start_time)} ({selectedAppointment.duration} dk)
                  </p>
                  <p className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    {getLocationLabel(selectedAppointment.location)}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Orta ve SaÄŸ Panel - Åablonlar ve Ã–nizleme */}
        <div className="lg:col-span-2 space-y-4">
          {/* Åablon SeÃ§imi */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Wand2 className="w-5 h-5 text-purple-500" />
                Åablon SeÃ§in
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
                <TabsList className="grid w-full grid-cols-3 mb-4">
                  <TabsTrigger value="student" className="gap-2 data-[state=active]:bg-blue-500 data-[state=active]:text-white">
                    <GraduationCap className="w-4 h-4" />
                    Ã–ÄŸrenci
                  </TabsTrigger>
                  <TabsTrigger value="parent" className="gap-2 data-[state=active]:bg-emerald-500 data-[state=active]:text-white">
                    <Users className="w-4 h-4" />
                    Veli
                  </TabsTrigger>
                  <TabsTrigger value="teacher" className="gap-2 data-[state=active]:bg-violet-500 data-[state=active]:text-white">
                    <User className="w-4 h-4" />
                    Ã–ÄŸretmen
                  </TabsTrigger>
                </TabsList>

                <TabsContent value={activeTab}>
                  <div className="grid sm:grid-cols-3 gap-3">
                    {filteredTemplates.map((template) => {
                      const Icon = template.icon;
                      const isSelected = selectedTemplate?.id === template.id;
                      
                      return (
                        <button
                          key={template.id}
                          onClick={() => generateNotification(template)}
                          disabled={!selectedAppointment}
                          className={`p-4 rounded-xl border-2 text-left transition-all ${
                            !selectedAppointment
                              ? "opacity-50 cursor-not-allowed border-slate-200"
                              : isSelected
                              ? `border-${template.color}-500 bg-${template.color}-50`
                              : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          <div className={`w-10 h-10 rounded-lg bg-${template.color}-100 flex items-center justify-center mb-2`}>
                            <Icon className={`w-5 h-5 text-${template.color}-600`} />
                          </div>
                          <p className="font-medium text-slate-800">{template.name}</p>
                          <p className="text-xs text-slate-500 mt-1">
                            {template.type === "student" ? "Ã–ÄŸrenci iÃ§in" : 
                             template.type === "parent" ? "Veli iÃ§in" : "Ã–ÄŸretmen iÃ§in"}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Ã–nizleme ve PaylaÅŸÄ±m */}
          {generatedText && (
            <Card className="border-0 shadow-lg">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-purple-500" />
                    OluÅŸturulan Bildirim
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => selectedTemplate && generateNotification(selectedTemplate)}
                      className="gap-1"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Yenile
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Metin Ã–nizleme */}
                <div className="bg-slate-50 rounded-xl p-4 mb-4 max-h-[300px] overflow-y-auto">
                  <pre className="whitespace-pre-wrap font-sans text-sm text-slate-700">
                    {generatedText}
                  </pre>
                </div>

                {/* DÃ¼zenleme */}
                <div className="mb-4">
                  <label className="text-sm font-medium text-slate-700 mb-2 block">
                    Metni DÃ¼zenle (isteÄŸe baÄŸlÄ±)
                  </label>
                  <textarea
                    value={generatedText}
                    onChange={(e) => setGeneratedText(e.target.value)}
                    className="w-full h-32 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                  />
                </div>

                {/* PaylaÅŸÄ±m ButonlarÄ± */}
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={copyToClipboard}
                    className={`gap-2 ${copied ? "bg-green-500 hover:bg-green-600" : "bg-purple-500 hover:bg-purple-600"}`}
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? "KopyalandÄ±!" : "Kopyala"}
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={downloadAsPDF}
                    className="gap-2 border-red-500 text-red-600 hover:bg-red-50"
                  >
                    <FileDown className="w-4 h-4" />
                    PDF
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={downloadAsWord}
                    className="gap-2 border-blue-500 text-blue-600 hover:bg-blue-50"
                  >
                    <FileText className="w-4 h-4" />
                    Word
                  </Button>
                  
                  
                  <Button
                    variant="outline"
                    onClick={shareWhatsApp}
                    className="gap-2 border-green-500 text-green-600 hover:bg-green-50"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    WhatsApp
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={openSMS}
                    className="gap-2"
                  >
                    <Phone className="w-4 h-4" />
                    SMS
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={openEmail}
                    className="gap-2"
                  >
                    <Mail className="w-4 h-4" />
                    E-posta
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* BoÅŸ Durum */}
          {!generatedText && selectedAppointment && (
            <Card className="shadow-lg border-dashed border-2 border-slate-200">
              <CardContent className="py-12 text-center">
                <Sparkles className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-600 mb-2">Åablon SeÃ§in</h3>
                <p className="text-slate-400">
                  YukarÄ±dan bir bildirim ÅŸablonu seÃ§erek metin oluÅŸturun
                </p>
              </CardContent>
            </Card>
          )}

          {!selectedAppointment && (
            <Card className="shadow-lg border-dashed border-2 border-slate-200">
              <CardContent className="py-12 text-center">
                <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-600 mb-2">Randevu SeÃ§in</h3>
                <p className="text-slate-400">
                  Bildirim oluÅŸturmak iÃ§in sol panelden bir randevu seÃ§in
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Ä°puÃ§larÄ± */}
      <Card className="border-0 shadow-lg bg-gradient-to-r from-purple-50 to-pink-50">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-4 h-4 text-purple-600" />
            </div>
            <div>
              <h4 className="font-medium text-slate-800 mb-1">Ä°pucu</h4>
              <p className="text-sm text-slate-600">
                OluÅŸturulan bildirimi dÃ¼zenleyebilir, kiÅŸiselleÅŸtirebilir ve farklÄ± kanallardan paylaÅŸabilirsiniz. 
                WhatsApp butonu ile doÄŸrudan mesaj gÃ¶nderebilir, SMS ile telefona aktarabilirsiniz.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
