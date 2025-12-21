"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  GraduationCap, 
  Search, 
  RefreshCw, 
  User, 
  Calendar, 
  FileText,
  X,
  UserCheck,
  ChevronRight,
  History,
  Send,
  FileDown,
  FileType,
  Users,
  BarChart3,
  SortAsc,
  SortDesc,
  Star,
  Sparkles,
  Activity,
  BookOpen,
  CheckCircle2
} from "lucide-react";
import { toast } from "sonner";
import { StudentSummaryCard, ReasonDistributionChart, TeacherDistributionChart, ReferralTimeline, MiniStatCard } from "@/components/charts/StudentCharts";

interface Student {
  value: string;
  text: string;
}

interface ClassOption {
  value: string;
  text: string;
}

interface ReferralHistory {
  id: string;
  reason: string;
  teacherName: string;
  classDisplay: string;
  date: string;
  notes: string | null;
}

interface StudentHistory {
  studentName: string;
  classDisplay: string;
  totalReferrals: number;
  referrals: ReferralHistory[];
  stats: {
    byReason: Record<string, number>;
    byTeacher: Record<string, number>;
    topReason: { name: string; count: number } | null;
  };
}

// Sınıf Seçim Kartı
function ClassSelectCard({ 
  classItem, 
  isSelected, 
  onClick
}: { 
  classItem: ClassOption; 
  isSelected: boolean; 
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        relative p-3 rounded-xl border-2 text-left transition-all duration-300 w-full
        ${isSelected 
          ? 'border-emerald-500 bg-gradient-to-br from-emerald-50 to-teal-50 shadow-lg shadow-emerald-500/10' 
          : 'border-slate-200 bg-white hover:border-emerald-300 hover:shadow-md'
        }
      `}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`
            p-2 rounded-lg
            ${isSelected 
              ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white' 
              : 'bg-slate-100 text-slate-500'
            }
          `}>
            <GraduationCap className="h-4 w-4" />
          </div>
          <span className={`font-medium text-sm ${isSelected ? 'text-emerald-700' : 'text-slate-700'}`}>
            {classItem.text}
          </span>
        </div>
      </div>
    </button>
  );
}

// Öğrenci Listesi Kartı
function StudentCard({
  student,
  index,
  isSelected,
  onClick,
  referralCount
}: {
  student: Student;
  index: number;
  isSelected: boolean;
  onClick: () => void;
  referralCount?: number;
}) {
  const hasReferrals = referralCount && referralCount > 0;
  
  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200
        ${isSelected 
          ? 'bg-gradient-to-r from-violet-50 to-purple-50 border-2 border-violet-400 shadow-md' 
          : 'bg-white hover:bg-slate-50 border border-slate-200 hover:border-violet-200'
        }
      `}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className={`
          w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold
          ${isSelected 
            ? 'bg-gradient-to-br from-violet-500 to-purple-600 text-white' 
            : 'bg-slate-100 text-slate-500'
          }
        `}>
          {index + 1}
        </div>
        <div className="text-left min-w-0">
          <p className={`font-medium text-sm truncate ${isSelected ? 'text-violet-800' : 'text-slate-700'}`}>
            {student.text}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {hasReferrals && (
          <span className={`
            text-xs font-bold px-2 py-1 rounded-full
            ${referralCount >= 5 
              ? 'bg-red-100 text-red-600' 
              : referralCount >= 3 
                ? 'bg-amber-100 text-amber-600'
                : 'bg-blue-100 text-blue-600'
            }
          `}>
            {referralCount}
          </span>
        )}
        <ChevronRight className={`h-4 w-4 ${isSelected ? 'text-violet-500' : 'text-slate-300'}`} />
      </div>
    </button>
  );
}

export default function OgrenciListesiPage() {
  const searchParams = useSearchParams();
  const urlStudent = searchParams.get("student");
  const urlClass = searchParams.get("class");

  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [classSearchTerm, setClassSearchTerm] = useState("");
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Öğrenci detay modal
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentHistory, setStudentHistory] = useState<StudentHistory | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  // URL'den gelen öğrenci için işlem yapıldı mı?
  const [urlProcessed, setUrlProcessed] = useState(false);

  // Export işlemleri için state'ler
  const [sendingTelegram, setSendingTelegram] = useState(false);
  const [exportingWord, setExportingWord] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  // Sınıfları yükle
  useEffect(() => {
    const loadClasses = async () => {
      try {
        const res = await fetch("/api/data");
        if (res.ok) {
          const data = await res.json();
          setClasses(data.sinifSubeList || []);
        }
      } catch (error) {
        console.error("Classes load error:", error);
        toast.error("Sınıflar yüklenemedi");
      } finally {
        setLoadingClasses(false);
      }
    };
    loadClasses();
  }, []);

  // URL'den gelen öğrenciyi direkt yükle
  useEffect(() => {
    if (urlStudent && !urlProcessed && !loadingClasses) {
      setUrlProcessed(true);
      loadStudentHistoryDirect(urlStudent, urlClass || undefined);
    }
  }, [urlStudent, urlClass, urlProcessed, loadingClasses]);

  // Direkt öğrenci geçmişi yükle (sınıf seçmeden)
  const loadStudentHistoryDirect = async (studentName: string, classDisplay?: string) => {
    setSelectedStudent({ value: studentName, text: studentName });
    setLoadingHistory(true);
    setStudentHistory(null);

    try {
      let url = `/api/student-history?studentName=${encodeURIComponent(studentName)}`;
      if (classDisplay) {
        url += `&classDisplay=${encodeURIComponent(classDisplay)}`;
      }

      const res = await fetch(url);

      if (res.ok) {
        const data = await res.json();
        setStudentHistory(data);
        toast.success(`${studentName} geçmişi yüklendi`, { icon: '📚' });
      } else {
        toast.error("Öğrenci geçmişi yüklenemedi");
      }
    } catch (error) {
      console.error("Student history error:", error);
      toast.error("Öğrenci geçmişi yüklenirken hata oluştu");
    } finally {
      setLoadingHistory(false);
    }
  };

  // Öğrencileri yükle
  const loadStudents = async (classKey: string) => {
    if (!classKey) return;
    
    setLoadingStudents(true);
    try {
      const res = await fetch(`/api/students?sinifSube=${encodeURIComponent(classKey)}`);
      if (res.ok) {
        const data = await res.json();
        setStudents(data || []);
      } else {
        setStudents([]);
        toast.error("Öğrenciler yüklenemedi");
      }
    } catch (error) {
      console.error("Students load error:", error);
      setStudents([]);
      toast.error("Öğrenciler yüklenirken hata oluştu");
    } finally {
      setLoadingStudents(false);
    }
  };

  // Sınıf seçimi
  const handleClassChange = (value: string) => {
    setSelectedClass(value);
    setSearchTerm("");
    setSelectedStudent(null);
    setStudentHistory(null);
    const classText = classes.find(c => c.value === value)?.text || value;
    toast.success(`${classText} seçildi`, { icon: '🎓' });
    loadStudents(value);
  };

  // Öğrenci detayını yükle
  const loadStudentHistory = async (student: Student) => {
    setSelectedStudent(student);
    setLoadingHistory(true);
    setStudentHistory(null);

    try {
      const studentName = student.text.replace(/^\d+\s+/, '').trim();
      const classDisplay = classes.find(c => c.value === selectedClass)?.text || '';

      const res = await fetch(
        `/api/student-history?studentName=${encodeURIComponent(studentName)}&classDisplay=${encodeURIComponent(classDisplay)}`
      );

      if (res.ok) {
        const data = await res.json();
        setStudentHistory(data);
      } else {
        toast.error("Öğrenci geçmişi yüklenemedi");
      }
    } catch (error) {
      console.error("Student history error:", error);
      toast.error("Öğrenci geçmişi yüklenirken hata oluştu");
    } finally {
      setLoadingHistory(false);
    }
  };

  // Filtrelenmiş sınıflar
  const filteredClasses = useMemo(() => {
    if (!classSearchTerm.trim()) return classes;
    return classes.filter(c => c.text.toLowerCase().includes(classSearchTerm.toLowerCase()));
  }, [classes, classSearchTerm]);

  // Filtrelenmiş ve sıralı öğrenciler
  const filteredStudents = useMemo(() => {
    let result = students.filter(s => 
      s.text.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    if (sortOrder === "desc") {
      result = [...result].reverse();
    }
    
    return result;
  }, [students, searchTerm, sortOrder]);

  // Tarih formatla
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Neden rengi
  const getReasonColor = (reason: string) => {
    const reasonLower = reason.toLowerCase();
    if (reasonLower.includes('devamsızlık')) return 'bg-red-100 text-red-700 border-red-200';
    if (reasonLower.includes('kavga') || reasonLower.includes('şiddet')) return 'bg-orange-100 text-orange-700 border-orange-200';
    if (reasonLower.includes('ders')) return 'bg-blue-100 text-blue-700 border-blue-200';
    if (reasonLower.includes('sosyal') || reasonLower.includes('uyum')) return 'bg-purple-100 text-purple-700 border-purple-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  // Öğrenci geçmişi mesaj formatı
  const formatHistoryMessage = () => {
    if (!selectedStudent || !studentHistory) return "";
    
    const classDisplay = urlClass || classes.find(c => c.value === selectedClass)?.text || "";
    let message = `📋 *ÖĞRENCİ GEÇMİŞİ RAPORU*\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    message += `👤 *Öğrenci:* ${selectedStudent.text}\n`;
    message += `🏫 *Sınıf:* ${classDisplay}\n`;
    message += `📊 *Toplam Yönlendirme:* ${studentHistory.totalReferrals}\n`;
    
    if (studentHistory.stats.topReason) {
      message += `⚠️ *En Sık Neden:* ${studentHistory.stats.topReason.name} (${studentHistory.stats.topReason.count})\n`;
    }
    
    message += `\n━━━━━━━━━━━━━━━━━━━━━━\n`;
    
    if (studentHistory.totalReferrals === 0) {
      message += `\n✅ Bu öğrenci için yönlendirme kaydı bulunmuyor.\n`;
    } else {
      message += `\n📝 *Yönlendirme Detayları:*\n\n`;
      
      studentHistory.referrals.forEach((r, idx) => {
        const date = new Date(r.date);
        const dateStr = date.toLocaleDateString('tr-TR');
        message += `*${idx + 1}.* ${r.reason}\n`;
        message += `   👨‍🏫 ${r.teacherName} | 📅 ${dateStr}\n`;
        if (r.notes) {
          message += `   📌 ${r.notes}\n`;
        }
        if (idx < studentHistory.referrals.length - 1) {
          message += `───────────────────\n`;
        }
      });
    }
    
    message += `\n━━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `_Rapor Tarihi: ${new Date().toLocaleDateString('tr-TR')}_`;
    
    return message;
  };

  // Telegram'a gönder
  const sendToTelegram = async () => {
    if (!selectedStudent || !studentHistory) return;
    
    setSendingTelegram(true);
    toast.loading("Telegram'a gönderiliyor...", { id: "telegram-send" });
    
    try {
      const message = formatHistoryMessage();
      const res = await fetch("/api/telegram-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      
      if (res.ok) {
        toast.success("Öğrenci geçmişi Telegram'a gönderildi!", { id: "telegram-send" });
      } else {
        toast.error("Telegram'a gönderilemedi", { id: "telegram-send" });
      }
    } catch (error) {
      console.error("Telegram send error:", error);
      toast.error("Telegram gönderiminde hata oluştu", { id: "telegram-send" });
    } finally {
      setSendingTelegram(false);
    }
  };

  // Word olarak indir
  const downloadAsWord = () => {
    if (!selectedStudent || !studentHistory) return;
    
    setExportingWord(true);
    toast.loading("Word dosyası hazırlanıyor...", { id: "word-export" });
    
    try {
      const classDisplay = urlClass || classes.find(c => c.value === selectedClass)?.text || "";
      
      let htmlContent = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
        <head><meta charset="utf-8"><title>Öğrenci Geçmişi</title></head>
        <body style="font-family: Arial, sans-serif;">
        <h1 style="color: #1e40af; border-bottom: 2px solid #1e40af; padding-bottom: 10px;">ÖĞRENCİ GEÇMİŞİ RAPORU</h1>
        <table style="width: 100%; margin-bottom: 20px;">
          <tr><td style="font-weight: bold; width: 150px;">Öğrenci:</td><td>${selectedStudent.text}</td></tr>
          <tr><td style="font-weight: bold;">Sınıf:</td><td>${classDisplay}</td></tr>
          <tr><td style="font-weight: bold;">Toplam Yönlendirme:</td><td>${studentHistory.totalReferrals}</td></tr>
          ${studentHistory.stats.topReason ? `<tr><td style="font-weight: bold;">En Sık Neden:</td><td>${studentHistory.stats.topReason.name} (${studentHistory.stats.topReason.count})</td></tr>` : ''}
          <tr><td style="font-weight: bold;">Rapor Tarihi:</td><td>${new Date().toLocaleDateString('tr-TR')}</td></tr>
        </table>
      `;
      
      if (studentHistory.totalReferrals === 0) {
        htmlContent += `<p style="color: #059669; font-style: italic;">Bu öğrenci için yönlendirme kaydı bulunmuyor.</p>`;
      } else {
        htmlContent += `<h2 style="color: #374151; margin-top: 30px;">Yönlendirme Detayları</h2>`;
        htmlContent += `<table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
          <tr style="background-color: #f3f4f6;">
            <th style="border: 1px solid #d1d5db; padding: 8px; text-align: left;">#</th>
            <th style="border: 1px solid #d1d5db; padding: 8px; text-align: left;">Tarih</th>
            <th style="border: 1px solid #d1d5db; padding: 8px; text-align: left;">Neden</th>
            <th style="border: 1px solid #d1d5db; padding: 8px; text-align: left;">Öğretmen</th>
            <th style="border: 1px solid #d1d5db; padding: 8px; text-align: left;">Not</th>
          </tr>`;
        
        studentHistory.referrals.forEach((r, idx) => {
          const date = new Date(r.date);
          htmlContent += `
            <tr>
              <td style="border: 1px solid #d1d5db; padding: 8px;">${idx + 1}</td>
              <td style="border: 1px solid #d1d5db; padding: 8px;">${date.toLocaleDateString('tr-TR')}</td>
              <td style="border: 1px solid #d1d5db; padding: 8px;">${r.reason}</td>
              <td style="border: 1px solid #d1d5db; padding: 8px;">${r.teacherName}</td>
              <td style="border: 1px solid #d1d5db; padding: 8px;">${r.notes || '-'}</td>
            </tr>`;
        });
        
        htmlContent += `</table>`;
      }
      
      htmlContent += `</body></html>`;
      
      const blob = new Blob([htmlContent], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedStudent.text.replace(/\s+/g, '_')}_gecmis.doc`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success("Word dosyası indirildi!", { id: "word-export" });
    } catch (error) {
      console.error("Word export error:", error);
      toast.error("Word dosyası oluşturulamadı", { id: "word-export" });
    } finally {
      setExportingWord(false);
    }
  };

  // PDF olarak indir
  const downloadAsPdf = () => {
    if (!selectedStudent || !studentHistory) return;
    
    setExportingPdf(true);
    toast.loading("PDF dosyası hazırlanıyor...", { id: "pdf-export" });
    
    try {
      const classDisplay = urlClass || classes.find(c => c.value === selectedClass)?.text || "";
      
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast.error("Pop-up engelleyici aktif olabilir", { id: "pdf-export" });
        setExportingPdf(false);
        return;
      }
      
      let htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Öğrenci Geçmişi - ${selectedStudent.text}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
            h1 { color: #1e40af; border-bottom: 2px solid #1e40af; padding-bottom: 10px; }
            .info-table { width: 100%; margin-bottom: 20px; }
            .info-table td { padding: 5px 0; }
            .info-table td:first-child { font-weight: bold; width: 180px; }
            h2 { color: #374151; margin-top: 30px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { background-color: #f3f4f6; border: 1px solid #d1d5db; padding: 8px; text-align: left; }
            td { border: 1px solid #d1d5db; padding: 8px; }
            .no-records { color: #059669; font-style: italic; }
            .footer { margin-top: 30px; font-size: 12px; color: #6b7280; text-align: center; }
            @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
          </style>
        </head>
        <body>
          <h1>ÖĞRENCİ GEÇMİŞİ RAPORU</h1>
          <table class="info-table">
            <tr><td>Öğrenci:</td><td>${selectedStudent.text}</td></tr>
            <tr><td>Sınıf:</td><td>${classDisplay}</td></tr>
            <tr><td>Toplam Yönlendirme:</td><td>${studentHistory.totalReferrals}</td></tr>
            ${studentHistory.stats.topReason ? `<tr><td>En Sık Neden:</td><td>${studentHistory.stats.topReason.name} (${studentHistory.stats.topReason.count})</td></tr>` : ''}
            <tr><td>Rapor Tarihi:</td><td>${new Date().toLocaleDateString('tr-TR')}</td></tr>
          </table>
      `;
      
      if (studentHistory.totalReferrals === 0) {
        htmlContent += `<p class="no-records">Bu öğrenci için yönlendirme kaydı bulunmuyor.</p>`;
      } else {
        htmlContent += `<h2>Yönlendirme Detayları</h2>`;
        htmlContent += `<table>
          <tr>
            <th>#</th>
            <th>Tarih</th>
            <th>Neden</th>
            <th>Öğretmen</th>
            <th>Not</th>
          </tr>`;
        
        studentHistory.referrals.forEach((r, idx) => {
          const date = new Date(r.date);
          htmlContent += `
            <tr>
              <td>${idx + 1}</td>
              <td>${date.toLocaleDateString('tr-TR')}</td>
              <td>${r.reason}</td>
              <td>${r.teacherName}</td>
              <td>${r.notes || '-'}</td>
            </tr>`;
        });
        
        htmlContent += `</table>`;
      }
      
      htmlContent += `
          <div class="footer">Bu rapor RPD Yönlendirme Sistemi tarafından oluşturulmuştur.</div>
        </body>
        </html>
      `;
      
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      
      setTimeout(() => {
        printWindow.print();
        toast.success("PDF olarak kaydetmek için 'PDF olarak kaydet' seçeneğini kullanın", { id: "pdf-export" });
      }, 500);
      
    } catch (error) {
      console.error("PDF export error:", error);
      toast.error("PDF dosyası oluşturulamadı", { id: "pdf-export" });
    } finally {
      setExportingPdf(false);
    }
  };

  const lastReferralDate = studentHistory?.referrals[0]?.date 
    ? formatDate(studentHistory.referrals[0].date) 
    : undefined;

  return (
    <div className="space-y-6">
      {/* Modern Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-600 via-blue-600 to-indigo-700 p-6 text-white shadow-xl">
        <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,transparent,rgba(255,255,255,0.5))]" />
        
        {/* Animated Background Elements */}
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-blue-300/20 blur-3xl animate-float-slow" />
        <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-indigo-300/20 blur-3xl animate-float-reverse" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-cyan-400/10 blur-3xl animate-pulse-glow" />
        
        {/* Floating Particles */}
        <div className="absolute top-10 right-20 h-2 w-2 rounded-full bg-blue-200/60 animate-float animation-delay-100" />
        <div className="absolute top-20 right-40 h-1.5 w-1.5 rounded-full bg-cyan-200/60 animate-float animation-delay-300" />
        <div className="absolute bottom-16 left-32 h-2 w-2 rounded-full bg-indigo-200/60 animate-float animation-delay-500" />
        <div className="absolute top-1/3 left-1/4 h-1 w-1 rounded-full bg-white/40 animate-sparkle animation-delay-200" />
        <div className="absolute bottom-1/3 right-1/4 h-1.5 w-1.5 rounded-full bg-blue-300/50 animate-sparkle animation-delay-700" />
        
        <div className="relative">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm shadow-lg">
                <Users className="h-7 w-7" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Öğrenci Listesi</h1>
                <p className="text-cyan-100">Sınıf seçin ve öğrenci geçmişlerini görüntüleyin</p>
              </div>
            </div>
            
            {/* Hızlı İstatistikler */}
            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-2 rounded-lg bg-white/10 backdrop-blur-sm px-3 py-2 border border-white/10 hover:bg-white/20 transition-all cursor-default">
                <GraduationCap className="h-4 w-4 text-cyan-200" />
                <div>
                  <p className="text-[10px] text-cyan-200 uppercase tracking-wider">Sınıf</p>
                  <p className="text-lg font-bold leading-none">{classes.length}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-white/10 backdrop-blur-sm px-3 py-2 border border-white/10 hover:bg-white/20 transition-all cursor-default">
                <User className="h-4 w-4 text-indigo-200" />
                <div>
                  <p className="text-[10px] text-cyan-200 uppercase tracking-wider">Öğrenci</p>
                  <p className="text-lg font-bold leading-none">{students.length}</p>
                </div>
              </div>
              {studentHistory && (
                <div className="flex items-center gap-2 rounded-lg bg-emerald-500/30 backdrop-blur-sm px-3 py-2 border border-emerald-400/30 hover:bg-emerald-500/40 transition-all cursor-default">
                  <History className="h-4 w-4 text-emerald-200" />
                  <div>
                    <p className="text-[10px] text-emerald-200 uppercase tracking-wider">Yönlendirme</p>
                    <p className="text-lg font-bold leading-none">{studentHistory.totalReferrals}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Alt bilgi çubuğu - Geliştirilmiş */}
          <div className="mt-4 pt-4 border-t border-white/20 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {/* Sıralama */}
              <div className="flex items-center bg-white/10 rounded-lg p-1">
                <button
                  onClick={() => setSortOrder("asc")}
                  className={`px-2 py-1 rounded text-xs font-medium transition-all flex items-center gap-1 ${
                    sortOrder === "asc" 
                      ? "bg-white text-blue-600 shadow-sm" 
                      : "text-white/80 hover:text-white"
                  }`}
                >
                  <SortAsc className="h-3 w-3" />
                  A-Z
                </button>
                <button
                  onClick={() => setSortOrder("desc")}
                  className={`px-2 py-1 rounded text-xs font-medium transition-all flex items-center gap-1 ${
                    sortOrder === "desc" 
                      ? "bg-white text-blue-600 shadow-sm" 
                      : "text-white/80 hover:text-white"
                  }`}
                >
                  <SortDesc className="h-3 w-3" />
                  Z-A
                </button>
              </div>
              
              {/* Seçili Öğrenci */}
              {selectedStudent && (
                <Badge className="bg-emerald-500/30 text-white border-emerald-400/30 hover:bg-emerald-500/40">
                  <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-300" />
                  {selectedStudent.text}
                </Badge>
              )}
              
              {/* Seçili Sınıf */}
              {selectedClass && (
                <Badge className="bg-white/20 text-white border-0 hover:bg-white/30">
                  <BookOpen className="h-3 w-3 mr-1" />
                  {classes.find(c => c.value === selectedClass)?.text}
                </Badge>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              {/* Excel Export */}
              {students.length > 0 && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    const classText = classes.find(c => c.value === selectedClass)?.text || "sinif";
                    const csvContent = "No,Öğrenci Adı\n" + 
                      students.map((s, i) => `${i + 1},"${s.text}"`).join("\n");
                    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `ogrenci-listesi-${classText}-${new Date().toISOString().slice(0, 10)}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                    toast.success("Öğrenci listesi indirildi");
                  }}
                  className="bg-white/10 hover:bg-white/20 text-white border-0"
                >
                  <FileDown className="h-4 w-4 mr-1" />
                  Liste
                </Button>
              )}
              
              {/* Seçimi Temizle */}
              {selectedStudent && (
                <Button 
                  variant="secondary" 
                  size="sm" 
                  onClick={() => {
                    setSelectedStudent(null);
                    setStudentHistory(null);
                  }}
                  className="bg-red-500/20 hover:bg-red-500/30 text-white border-0"
                >
                  <X className="h-4 w-4 mr-1" />
                  Temizle
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Özet Kartları */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white border-0 shadow-xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-200 text-xs font-medium">Toplam Sınıf</p>
                <p className="text-3xl font-bold mt-1">{classes.length}</p>
              </div>
              <div className="p-3 bg-white/20 rounded-xl">
                <GraduationCap className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-violet-500 to-purple-600 text-white border-0 shadow-xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-violet-200 text-xs font-medium">Seçili Sınıf</p>
                <p className="text-lg font-bold mt-1 truncate">
                  {selectedClass ? classes.find(c => c.value === selectedClass)?.text : "-"}
                </p>
              </div>
              <div className="p-3 bg-white/20 rounded-xl">
                <BookOpen className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-cyan-500 to-blue-600 text-white border-0 shadow-xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-cyan-200 text-xs font-medium">Öğrenci Sayısı</p>
                <p className="text-3xl font-bold mt-1">{filteredStudents.length}</p>
              </div>
              <div className="p-3 bg-white/20 rounded-xl">
                <User className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500 to-orange-600 text-white border-0 shadow-xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-amber-200 text-xs font-medium">Seçili Öğrenci</p>
                <p className="text-lg font-bold mt-1 truncate">
                  {selectedStudent?.text || "-"}
                </p>
              </div>
              <div className="p-3 bg-white/20 rounded-xl">
                <Star className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sınıf Seçimi */}
      <Card className="bg-white/80 backdrop-blur border-0 shadow-lg overflow-hidden">
        <CardHeader className="border-b bg-gradient-to-r from-emerald-50 to-teal-50 pb-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600">
                <GraduationCap className="h-3.5 w-3.5 text-white" />
              </div>
              Sınıf Seçin
              <span className="ml-2 px-2 py-0.5 rounded-full bg-emerald-100 text-xs font-medium text-emerald-600">
                {filteredClasses.length} sınıf
              </span>
            </CardTitle>
            
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Sınıf ara..."
                value={classSearchTerm}
                onChange={(e) => setClassSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent w-full md:w-48 transition-all"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          {loadingClasses ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-emerald-500" />
            </div>
          ) : (
            <div className="grid gap-2 grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 max-h-[200px] overflow-y-auto">
              {filteredClasses.map((classItem) => (
                <ClassSelectCard
                  key={classItem.value}
                  classItem={classItem}
                  isSelected={selectedClass === classItem.value}
                  onClick={() => handleClassChange(selectedClass === classItem.value ? "" : classItem.value)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Sol Panel - Öğrenci Listesi */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="bg-white/80 backdrop-blur border-0 shadow-lg overflow-hidden">
            <CardHeader className="border-b bg-gradient-to-r from-violet-50 to-purple-50 pb-4">
              <div className="flex flex-col gap-3">
                <CardTitle className="text-sm font-medium text-slate-700 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600">
                      <User className="h-3.5 w-3.5 text-white" />
                    </div>
                    Öğrenciler
                  </span>
                  {selectedClass && !loadingStudents && (
                    <Badge className="bg-violet-100 text-violet-700 border-0">
                      {filteredStudents.length} öğrenci
                    </Badge>
                  )}
                </CardTitle>
                
                {selectedClass && (
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        placeholder="Öğrenci ara..."
                        className="pl-9 h-9 bg-white"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                    >
                      {sortOrder === "asc" ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-3">
              <div className="h-[500px] overflow-y-auto space-y-2">
                {!selectedClass ? (
                  <div className="h-full flex items-center justify-center text-slate-400 px-4">
                    <div className="text-center">
                      <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                        <GraduationCap className="h-10 w-10 text-slate-400" />
                      </div>
                      <p className="font-medium text-slate-600">Sınıf Seçin</p>
                      <p className="text-xs mt-1">Yukarıdan bir sınıf seçerek<br/>öğrenci listesini görüntüleyin</p>
                    </div>
                  </div>
                ) : loadingStudents ? (
                  <div className="h-full flex items-center justify-center text-slate-400">
                    <RefreshCw className="h-6 w-6 animate-spin text-violet-500 mr-2" />
                    Öğrenciler yükleniyor...
                  </div>
                ) : filteredStudents.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-400 px-4">
                    <div className="text-center">
                      <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                        <User className="h-10 w-10 text-slate-400" />
                      </div>
                      <p className="font-medium text-slate-600">Öğrenci Bulunamadı</p>
                      <p className="text-xs mt-1">
                        {searchTerm ? `"${searchTerm}" ile eşleşen öğrenci yok` : "Bu sınıfta öğrenci bulunmuyor"}
                      </p>
                    </div>
                  </div>
                ) : (
                  filteredStudents.map((student, idx) => (
                    <StudentCard
                      key={student.value}
                      student={student}
                      index={idx}
                      isSelected={selectedStudent?.value === student.value}
                      onClick={() => loadStudentHistory(student)}
                    />
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sağ Panel - Öğrenci Detayı */}
        <div className="lg:col-span-3 space-y-4">
          {!selectedStudent ? (
            <Card className="bg-white/80 backdrop-blur border-0 shadow-lg h-full">
              <CardContent className="h-[600px] flex items-center justify-center">
                <div className="text-center">
                  <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center">
                    <Sparkles className="h-12 w-12 text-violet-400" />
                  </div>
                  <p className="font-semibold text-slate-700 text-lg">Öğrenci Seçin</p>
                  <p className="text-sm text-slate-500 mt-2 max-w-xs mx-auto">
                    Listeden bir öğrenciye tıklayarak yönlendirme geçmişini ve detaylı analizleri görüntüleyin
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : loadingHistory ? (
            <Card className="bg-white/80 backdrop-blur border-0 shadow-lg h-full">
              <CardContent className="h-[600px] flex items-center justify-center">
                <div className="text-center">
                  <RefreshCw className="h-8 w-8 animate-spin text-violet-500 mx-auto mb-4" />
                  <p className="text-slate-500">Öğrenci geçmişi yükleniyor...</p>
                </div>
              </CardContent>
            </Card>
          ) : studentHistory ? (
            <div className="space-y-4">
              {/* Özet Kart */}
              <StudentSummaryCard
                totalReferrals={studentHistory.totalReferrals}
                topReason={studentHistory.stats.topReason}
                teacherCount={Object.keys(studentHistory.stats.byTeacher).length}
                lastReferralDate={lastReferralDate}
              />

              {/* Mini İstatistikler */}
              <div className="grid gap-3 md:grid-cols-2">
                <MiniStatCard
                  title="Farklı Neden"
                  value={Object.keys(studentHistory.stats.byReason).length}
                  icon={<FileText className="h-4 w-4 text-white" />}
                  color="bg-gradient-to-br from-amber-500 to-orange-600"
                  bgColor="bg-amber-50"
                />
                <MiniStatCard
                  title="Farklı Öğretmen"
                  value={Object.keys(studentHistory.stats.byTeacher).length}
                  icon={<UserCheck className="h-4 w-4 text-white" />}
                  color="bg-gradient-to-br from-cyan-500 to-blue-600"
                  bgColor="bg-cyan-50"
                />
              </div>

              {/* Export Butonları */}
              <Card className="bg-white/80 backdrop-blur border-0 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50"
                      onClick={sendToTelegram}
                      disabled={sendingTelegram}
                    >
                      {sendingTelegram ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Send className="h-3.5 w-3.5" />
                      )}
                      Telegram'a Gönder
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                      onClick={downloadAsWord}
                      disabled={exportingWord}
                    >
                      {exportingWord ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <FileType className="h-3.5 w-3.5" />
                      )}
                      Word İndir
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
                      onClick={downloadAsPdf}
                      disabled={exportingPdf}
                    >
                      {exportingPdf ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <FileDown className="h-3.5 w-3.5" />
                      )}
                      PDF İndir
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Grafikler */}
              {studentHistory.totalReferrals > 0 && (
                <div className="grid gap-4 md:grid-cols-2">
                  <Card className="bg-white/80 backdrop-blur border-0 shadow-lg">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-violet-500" />
                        Neden Dağılımı
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ReasonDistributionChart data={studentHistory.stats.byReason} />
                    </CardContent>
                  </Card>

                  <Card className="bg-white/80 backdrop-blur border-0 shadow-lg">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
                        <UserCheck className="h-4 w-4 text-cyan-500" />
                        Öğretmen Dağılımı
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <TeacherDistributionChart data={studentHistory.stats.byTeacher} />
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Zaman Çizelgesi */}
              {studentHistory.totalReferrals > 0 && (
                <Card className="bg-white/80 backdrop-blur border-0 shadow-lg">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
                      <Activity className="h-4 w-4 text-emerald-500" />
                      Son 30 Gün Aktivitesi
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ReferralTimeline referrals={studentHistory.referrals} />
                  </CardContent>
                </Card>
              )}

              {/* Yönlendirme Listesi */}
              <Card className="bg-white/80 backdrop-blur border-0 shadow-lg">
                <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-slate-100 pb-4">
                  <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-gradient-to-br from-slate-600 to-slate-800">
                      <History className="h-3.5 w-3.5 text-white" />
                    </div>
                    Yönlendirme Geçmişi
                    <span className="ml-2 px-2 py-0.5 rounded-full bg-slate-200 text-xs font-medium text-slate-600">
                      {studentHistory.totalReferrals} kayıt
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {studentHistory.totalReferrals === 0 ? (
                    <div className="p-8 text-center text-slate-400">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-emerald-100 to-green-100 flex items-center justify-center">
                        <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                      </div>
                      <p className="font-medium text-slate-600">Yönlendirme Kaydı Yok</p>
                      <p className="text-xs mt-1">Bu öğrenci için henüz yönlendirme yapılmamış</p>
                    </div>
                  ) : (
                    <div className="max-h-[400px] overflow-y-auto divide-y divide-slate-100">
                      {studentHistory.referrals.map((referral, idx) => (
                        <div key={referral.id} className="p-4 hover:bg-slate-50/50 transition-colors">
                          <div className="flex items-start gap-3">
                            <div className={`
                              flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold
                              ${idx === 0 
                                ? 'bg-gradient-to-br from-violet-500 to-purple-600 text-white' 
                                : 'bg-slate-100 text-slate-500'
                              }
                            `}>
                              {studentHistory.totalReferrals - idx}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge className={`${getReasonColor(referral.reason)} border text-xs`}>
                                  {referral.reason}
                                </Badge>
                                {idx === 0 && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-500 text-white">
                                    SON
                                  </span>
                                )}
                              </div>
                              <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
                                <span className="flex items-center gap-1">
                                  <UserCheck className="h-3.5 w-3.5" />
                                  {referral.teacherName}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3.5 w-3.5" />
                                  {formatDateTime(referral.date)}
                                </span>
                              </div>
                              {referral.notes && (
                                <p className="mt-2 text-sm text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                  📝 {referral.notes}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
