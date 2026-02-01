"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  FileText, 
  GraduationCap, 
  User, 
  RefreshCw,
  Send,
  FileType,
  FileDown,
  Mail,
  Phone,
  BookOpen,
  Building2,
  UserCircle,
  Check,
  Calendar,
  Clock,
  Save,
  RotateCcw,
  Trash2,
  Gavel,
  MessageCircle,
  Copy,
  Printer,
  History,
  Sparkles,
  TrendingUp,
  FileCheck,
  ClipboardCheck,
  Eye,
  Download,
  Share2,
  ChevronRight,
  Star,
  Zap,
  Wand2
} from "lucide-react";
import { toast } from "sonner";
import dynamic from "next/dynamic";

// RichTextEditor'u dinamik olarak yükle (SSR sorunlarını önlemek için)
const RichTextEditor = dynamic(
  () => import("@/components/RichTextEditor").then((mod) => mod.RichTextEditor),
  { 
    ssr: false,
    loading: () => (
      <div className="border border-slate-200 rounded-lg bg-white h-[500px] flex items-center justify-center text-slate-400">
        <RefreshCw className="h-5 w-5 animate-spin mr-2" />
        Editör yükleniyor...
      </div>
    )
  }
);

// ==================== INTERFACES ====================
interface Student {
  value: string;
  text: string;
}

interface ClassOption {
  value: string;
  text: string;
}

type DocumentType = "veli-mektubu" | "veli-cagrisi" | "ogretmen-mektubu" | "ogretmen-tavsiyesi" | "idare-mektubu" | "disiplin-kurulu";

interface DocumentTemplate {
  id: DocumentType;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bgGradient: string;
}

interface DocumentHistory {
  id: string;
  type: DocumentType;
  studentName: string;
  className: string;
  createdAt: Date;
}

// ==================== CONSTANTS ====================
const documentTemplates: DocumentTemplate[] = [
  { 
    id: "veli-mektubu", 
    label: "Veli Mektubu", 
    description: "Veli bilgilendirme yazısı",
    icon: Mail, 
    color: "text-blue-600",
    bgGradient: "from-blue-500 to-blue-600"
  },
  { 
    id: "veli-cagrisi", 
    label: "Veli Çağrısı", 
    description: "Görüşme daveti belgesi",
    icon: Phone, 
    color: "text-emerald-600",
    bgGradient: "from-emerald-500 to-emerald-600"
  },
  { 
    id: "ogretmen-mektubu", 
    label: "Öğretmen Mektubu", 
    description: "Öğretmen bilgi talebi",
    icon: BookOpen, 
    color: "text-purple-600",
    bgGradient: "from-purple-500 to-purple-600"
  },
  { 
    id: "ogretmen-tavsiyesi", 
    label: "Öğretmen Tavsiyesi", 
    description: "Değerlendirme formu",
    icon: UserCircle, 
    color: "text-amber-600",
    bgGradient: "from-amber-500 to-amber-600"
  },
  { 
    id: "idare-mektubu", 
    label: "İdare Mektubu", 
    description: "Yönetim bilgilendirme",
    icon: Building2, 
    color: "text-red-600",
    bgGradient: "from-red-500 to-red-600"
  },
  { 
    id: "disiplin-kurulu", 
    label: "Disiplin Kurulu", 
    description: "Toplantı çağrısı",
    icon: Gavel, 
    color: "text-rose-600",
    bgGradient: "from-rose-500 to-rose-600"
  },
];

// ==================== MAIN COMPONENT ====================
export default function BelgePage() {
  // Temel state'ler
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedClassText, setSelectedClassText] = useState<string>("");
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  
  // Belge state'leri
  const [selectedDocument, setSelectedDocument] = useState<DocumentType>("veli-mektubu");
  const [documentContent, setDocumentContent] = useState<string>("");
  const [exportingWord, setExportingWord] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);
  
  // Veli Çağrısı için tarih ve saat
  const [meetingDate, setMeetingDate] = useState<string>("");
  const [meetingTime, setMeetingTime] = useState<string>("");
  
  // Kaydedilen içerik ve geçmiş
  const [savedContent, setSavedContent] = useState<string>("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [documentHistory, setDocumentHistory] = useState<DocumentHistory[]>([]);
  
  // İstatistikler
  const [stats, setStats] = useState({
    totalDocuments: 0,
    todayDocuments: 0,
    mostUsedTemplate: "veli-mektubu" as DocumentType,
    lastCreated: null as Date | null
  });

  // Tarih formatı
  const today = new Date();
  const formattedDate = today.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  // ==================== DATA LOADING ====================
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
    
    // LocalStorage'dan geçmişi yükle
    const savedHistory = localStorage.getItem("documentHistory");
    if (savedHistory) {
      try {
        const history = JSON.parse(savedHistory);
        setDocumentHistory(history.map((h: DocumentHistory) => ({
          ...h,
          createdAt: new Date(h.createdAt)
        })));
        
        // İstatistikleri hesapla
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayDocs = history.filter((h: DocumentHistory) => new Date(h.createdAt) >= todayStart);
        
        // En çok kullanılan şablonu bul
        const templateCounts: Record<string, number> = {};
        history.forEach((h: DocumentHistory) => {
          templateCounts[h.type] = (templateCounts[h.type] || 0) + 1;
        });
        const mostUsed = Object.entries(templateCounts).sort((a, b) => b[1] - a[1])[0];
        
        setStats({
          totalDocuments: history.length,
          todayDocuments: todayDocs.length,
          mostUsedTemplate: (mostUsed?.[0] || "veli-mektubu") as DocumentType,
          lastCreated: history.length > 0 ? new Date(history[0].createdAt) : null
        });
      } catch (e) {
        console.error("History parse error:", e);
      }
    }
  }, []);

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
      }
    } catch (error) {
      console.error("Students load error:", error);
      setStudents([]);
    } finally {
      setLoadingStudents(false);
    }
  };

  // ==================== HANDLERS ====================
  // Sınıf seçimi
  const handleClassChange = (value: string) => {
    setSelectedClass(value);
    const classText = classes.find(c => c.value === value)?.text || value;
    setSelectedClassText(classText);
    setSelectedStudent(null);
    loadStudents(value);
    toast.success(`${classText} sınıfı seçildi`);
  };

  // Öğrenci seçimi
  const handleStudentChange = (value: string) => {
    const student = students.find(s => s.value === value);
    if (student) {
      setSelectedStudent(student);
      toast.success(`${student.text} seçildi`);
      updateDocumentContent(selectedDocument, student.text, selectedClassText, meetingDate, meetingTime);
    }
  };

  // ==================== DOCUMENT TEMPLATES ====================
  const generateDocumentContent = (type: DocumentType, studentName: string, className: string, date?: string, time?: string): string => {
    const header = `<p style="text-align: center"><strong>T.C.</strong></p>
<p style="text-align: center"><strong>BİRECİK KAYMAKAMLIĞI</strong></p>
<p style="text-align: center"><strong>DUMLUPINAR ORTAOKULU MÜDÜRLÜĞÜ</strong></p>
<p style="text-align: center"><strong>REHBERLİK SERVİSİ</strong></p>
<p></p>`;

    const signature = `<p></p>
<p>Saygılarımızla,</p>
<p></p>
<p>${formattedDate}</p>
<p></p>
<p style="text-align: right"><strong>MAHMUT KARADENİZ</strong></p>
<p style="text-align: right">Rehber Öğretmen ve Psikolojik Danışman</p>`;

    const formattedMeetingDate = date 
      ? new Date(date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
      : "____/____/________";
    const formattedMeetingTime = time || "____:____";

    const templates: Record<DocumentType, string> = {
      "veli-mektubu": `${header}
<p style="text-align: center"><strong>VELİ BİLGİLENDİRME MEKTUBU</strong></p>
<p></p>
<p>SAYIN VELİ,</p>
<p></p>
<p>Okulumuz ${className} sınıfı öğrencisi "<strong>${studentName}</strong>" ile ilgili olarak sizinle görüşme ihtiyacı doğmuştur.</p>
<p></p>
<p>Öğrencinizin okul sürecinde daha başarılı ve mutlu olabilmesi için veli-okul işbirliğinin önemli olduğuna inanmaktayız. Bu nedenle en kısa sürede okul rehberlik servisimizi ziyaret etmenizi rica ederiz.</p>
<p></p>
<p>Görüşme için uygun olduğunuz gün ve saati belirtmeniz halinde randevu ayarlamamız mümkün olacaktır.</p>
<p></p>
<p>Anlayışınız ve işbirliğiniz için teşekkür ederiz.</p>
${signature}`,

      "veli-cagrisi": `${header}
<p style="text-align: center"><strong>VELİ ÇAĞRI BELGESİ</strong></p>
<p></p>
<p>Tarih: ${formattedDate}</p>
<p></p>
<p>SAYIN VELİ,</p>
<p></p>
<p>Okulumuz ${className} sınıfı öğrencisi "<strong>${studentName}</strong>" velisi olarak aşağıda belirtilen tarih ve saatte okul rehberlik servisine gelmeniz gerekmektedir.</p>
<p></p>
<p><strong>Görüşme Konusu:</strong> Öğrenci takibi ve değerlendirme</p>
<p><strong>Görüşme Yeri:</strong> Okul Rehberlik Servisi</p>
<p><strong>Görüşme Tarihi:</strong> ${formattedMeetingDate}</p>
<p><strong>Görüşme Saati:</strong> ${formattedMeetingTime}</p>
<p></p>
<p>Bu görüşme öğrencinizin eğitim sürecinin daha verimli geçmesi için büyük önem taşımaktadır. Belirtilen tarihte gelememeniz durumunda lütfen önceden bilgi veriniz.</p>
<p></p>
<p>Katılımınız için teşekkür ederiz.</p>
${signature}`,

      "ogretmen-mektubu": `${header}
<p style="text-align: center"><strong>ÖĞRETMEN BİLGİ TALEBİ</strong></p>
<p></p>
<p>SAYIN ÖĞRETMEN,</p>
<p></p>
<p>${className} sınıfı öğrencisi "<strong>${studentName}</strong>" hakkında sizden bilgi ve değerlendirme talep etmekteyiz.</p>
<p></p>
<p>Öğrencinin;</p>
<ul>
<li>Ders içi performansı ve katılımı</li>
<li>Sınıf içi davranışları</li>
<li>Akran ilişkileri</li>
<li>Dikkat çeken olumlu/olumsuz durumlar</li>
</ul>
<p></p>
<p>konularında görüşlerinizi paylaşmanızı rica ederiz.</p>
<p></p>
<p>Öğrenciye yönelik ortak bir çalışma planı oluşturabilmemiz için görüşleriniz büyük önem taşımaktadır.</p>
<p></p>
<p>İşbirliğiniz için teşekkür ederiz.</p>
${signature}`,

      "ogretmen-tavsiyesi": `${header}
<p style="text-align: center"><strong>ÖĞRETMEN TAVSİYE FORMU</strong></p>
<p></p>
<p><strong>Tarih:</strong> ${formattedDate}</p>
<p><strong>Öğrenci:</strong> ${studentName}</p>
<p><strong>Sınıf:</strong> ${className}</p>
<p></p>
<p>SAYIN ÖĞRETMEN,</p>
<p></p>
<p>Aşağıda bilgileri verilen öğrenci için önerilerinizi ve tavsiyelerinizi paylaşmanızı rica ederiz.</p>
<p></p>
<p><strong>AKADEMİK DURUM:</strong></p>
<p>☐ Çok Başarılı&nbsp;&nbsp;&nbsp;&nbsp;☐ Başarılı&nbsp;&nbsp;&nbsp;&nbsp;☐ Orta&nbsp;&nbsp;&nbsp;&nbsp;☐ Geliştirilmeli</p>
<p></p>
<p><strong>DAVRANIŞ DURUMU:</strong></p>
<p>☐ Çok İyi&nbsp;&nbsp;&nbsp;&nbsp;☐ İyi&nbsp;&nbsp;&nbsp;&nbsp;☐ Orta&nbsp;&nbsp;&nbsp;&nbsp;☐ Geliştirilmeli</p>
<p></p>
<p><strong>KATILIM:</strong></p>
<p>☐ Aktif&nbsp;&nbsp;&nbsp;&nbsp;☐ Normal&nbsp;&nbsp;&nbsp;&nbsp;☐ Pasif</p>
<p></p>
<p><strong>ÖNERİLERİNİZ:</strong></p>
<p>________________________________________________________________________</p>
<p>________________________________________________________________________</p>
<p>________________________________________________________________________</p>
<p></p>
<p>Formu doldurduğunuz için teşekkür ederiz.</p>
${signature}`,

      "idare-mektubu": `${header}
<p style="text-align: center"><strong>İDARE BİLGİLENDİRME YAZISI</strong></p>
<p></p>
<p><strong>Tarih:</strong> ${formattedDate}</p>
<p><strong>Konu:</strong> Öğrenci Hakkında Bilgilendirme</p>
<p></p>
<p>SAYIN MÜDÜRÜM,</p>
<p></p>
<p>${className} sınıfı öğrencisi "<strong>${studentName}</strong>" hakkında aşağıdaki hususları bilgilerinize sunmak istiyorum.</p>
<p></p>
<p><strong>DURUM DEĞERLENDİRMESİ:</strong></p>
<p>Öğrencinin mevcut durumu ve izleme süreci hakkında bilgi vermek amacıyla bu yazı hazırlanmıştır.</p>
<p></p>
<p><strong>YAPILAN ÇALIŞMALAR:</strong></p>
<ul>
<li>Bireysel görüşmeler yapılmıştır</li>
<li>Veli ile iletişime geçilmiştir</li>
<li>Sınıf öğretmenleri ile koordinasyon sağlanmıştır</li>
</ul>
<p></p>
<p><strong>ÖNERİLER:</strong></p>
<p>Öğrencinin eğitim sürecinin daha verimli geçmesi için aşağıdaki öneriler sunulmaktadır:</p>
<ol>
<li>________________________________________________________________</li>
<li>________________________________________________________________</li>
<li>________________________________________________________________</li>
</ol>
<p></p>
<p>Bilgilerinize arz ederim.</p>
${signature}`,

      "disiplin-kurulu": `${header}
<p style="text-align: center"><strong>DİSİPLİN KURULU TOPLANTI ÇAĞRISI</strong></p>
<p></p>
<p><strong>Tarih:</strong> ${formattedDate}</p>
<p><strong>Sayı:</strong> ____________________</p>
<p><strong>Konu:</strong> Disiplin Kurulu Toplantısına Çağrı</p>
<p></p>
<p>SAYIN VELİ,</p>
<p></p>
<p>Okulumuz ${className} sınıfı öğrencisi "<strong>${studentName}</strong>" hakkında açılan disiplin soruşturması kapsamında, öğrenci velisi olarak aşağıda belirtilen tarih ve saatte okulumuz Disiplin Kurulu toplantısına katılmanız gerekmektedir.</p>
<p></p>
<p><strong>Toplantı Tarihi:</strong> ${formattedMeetingDate}</p>
<p><strong>Toplantı Saati:</strong> ${formattedMeetingTime}</p>
<p><strong>Toplantı Yeri:</strong> Okul Müdürlüğü / Toplantı Salonu</p>
<p></p>
<p><strong>Soruşturma Konusu:</strong></p>
<p>________________________________________________________________________</p>
<p>________________________________________________________________________</p>
<p></p>
<p><strong>ÖNEMLİ NOTLAR:</strong></p>
<ul>
<li>Toplantıya kimlik belgenizle birlikte gelmeniz gerekmektedir.</li>
<li>Toplantıda öğrencinizin savunmasını yapma hakkınız bulunmaktadır.</li>
<li>Belirtilen tarihte gelememeniz durumunda yazılı mazeret bildirmeniz gerekmektedir.</li>
<li>Mazeretsiz katılım sağlanmaması halinde işlemler giyabınızda yapılacaktır.</li>
</ul>
<p></p>
<p>Bilgilerinize önemle rica ederim.</p>
${signature}`,
    };

    return templates[type] || "";
  };

  // Belge içeriğini güncelle
  const updateDocumentContent = (type: DocumentType, studentName?: string, className?: string, date?: string, time?: string) => {
    const name = studentName || selectedStudent?.text || "[Öğrenci Seçilmedi]";
    const cls = className || selectedClassText || "[Sınıf Seçilmedi]";
    const meetingDateVal = date !== undefined ? date : meetingDate;
    const meetingTimeVal = time !== undefined ? time : meetingTime;
    const content = generateDocumentContent(type, name, cls, meetingDateVal, meetingTimeVal);
    setDocumentContent(content);
  };

  // Tarih değiştiğinde
  const handleMeetingDateChange = (date: string) => {
    setMeetingDate(date);
    if (selectedDocument === "veli-cagrisi" || selectedDocument === "disiplin-kurulu") {
      updateDocumentContent(selectedDocument, undefined, undefined, date, meetingTime);
    }
    const formattedDate = new Date(date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
    toast.success(`Görüşme tarihi: ${formattedDate}`);
  };

  // Saat değiştiğinde
  const handleMeetingTimeChange = (time: string) => {
    setMeetingTime(time);
    if (selectedDocument === "veli-cagrisi" || selectedDocument === "disiplin-kurulu") {
      updateDocumentContent(selectedDocument, undefined, undefined, meetingDate, time);
    }
    toast.success(`Görüşme saati: ${time}`);
  };

  // Belge tipi değiştiğinde
  const handleDocumentChange = (type: DocumentType) => {
    setSelectedDocument(type);
    updateDocumentContent(type, undefined, undefined, meetingDate, meetingTime);
    const templateName = documentTemplates.find(t => t.id === type)?.label || type;
    toast.success(`${templateName} şablonu oluşturuldu`);
  };

  // İçeriği kaydet
  const handleSaveContent = () => {
    setSavedContent(documentContent);
    setHasUnsavedChanges(false);
    
    // Geçmişe ekle
    if (selectedStudent) {
      const newHistory: DocumentHistory = {
        id: Date.now().toString(),
        type: selectedDocument,
        studentName: selectedStudent.text,
        className: selectedClassText,
        createdAt: new Date()
      };
      const updatedHistory = [newHistory, ...documentHistory].slice(0, 20); // Son 20 belge
      setDocumentHistory(updatedHistory);
      localStorage.setItem("documentHistory", JSON.stringify(updatedHistory));
      
      // İstatistikleri güncelle
      setStats(prev => ({
        ...prev,
        totalDocuments: prev.totalDocuments + 1,
        todayDocuments: prev.todayDocuments + 1,
        lastCreated: new Date()
      }));
    }
    
    toast.success("Belge içeriği kaydedildi!");
  };

  // Şablona sıfırla
  const handleResetContent = () => {
    updateDocumentContent(selectedDocument, undefined, undefined, meetingDate, meetingTime);
    setHasUnsavedChanges(false);
    toast.info("Belge şablona sıfırlandı");
  };

  // İçeriği temizle
  const handleClearContent = () => {
    setDocumentContent("");
    setHasUnsavedChanges(true);
    toast.info("Belge içeriği temizlendi");
  };

  // İçerik değiştiğinde
  const handleContentChange = (content: string) => {
    setDocumentContent(content);
    setHasUnsavedChanges(savedContent !== content);
  };

  // ==================== EXPORT FUNCTIONS ====================
  // HTML'den düz metin çıkar
  const htmlToPlainText = (html: string): string => {
    let text = html
      .replace(/<p><\/p>/g, '\n')
      .replace(/<p[^>]*>/g, '')
      .replace(/<\/p>/g, '\n')
      .replace(/<br\s*\/?>/g, '\n')
      .replace(/<li>/g, '\u2022 ')
      .replace(/<\/li>/g, '\n')
      .replace(/<ul>|<\/ul>|<ol>|<\/ol>/g, '')
      .replace(/<strong>|<\/strong>|<b>|<\/b>/g, '*')
      .replace(/<em>|<\/em>|<i>|<\/i>/g, '_')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    return text;
  };

  // Panoya kopyala
  const copyToClipboard = async () => {
    if (!documentContent) return;
    
    try {
      const plainText = htmlToPlainText(documentContent);
      await navigator.clipboard.writeText(plainText);
      toast.success("Belge panoya kopyalandı!");
    } catch (error) {
      console.error("Clipboard error:", error);
      toast.error("Kopyalama başarısız");
    }
  };

  // Yazdır
  const printDocument = () => {
    if (!documentContent) return;
    
    const selectedTemplate = documentTemplates.find(t => t.id === selectedDocument);
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error("Pop-up engelleyici aktif olabilir");
      return;
    }
    
    const processedContent = documentContent
      .replace(/<p><\/p>/g, '<p>&nbsp;</p>')
      .replace(/<p>\s*<br\s*\/?>\s*<\/p>/g, '<p>&nbsp;</p>');
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${selectedTemplate?.label} - ${selectedStudent?.text || 'Öğrenci'}</title>
        <style>
          body { 
            font-family: 'Times New Roman', Times, serif; 
            font-size: 12pt; 
            line-height: 1.8; 
            padding: 40px;
            color: #333;
          }
          p { margin: 0; padding: 0; min-height: 1.2em; }
          p:empty::before { content: "\\00a0"; }
          h1 { font-size: 18pt; font-weight: bold; margin: 0.5em 0; }
          h2 { font-size: 16pt; font-weight: bold; margin: 0.5em 0; }
          h3 { font-size: 14pt; font-weight: bold; margin: 0.5em 0; }
          strong, b { font-weight: bold; }
          em, i { font-style: italic; }
          u { text-decoration: underline; }
          ul, ol { margin: 0.5em 0; padding-left: 1.5em; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>${processedContent}</body>
      </html>
    `;
    
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    setTimeout(() => {
      printWindow.print();
      toast.success("Yazdırma penceresi açıldı");
    }, 500);
  };

  // WhatsApp'ta paylaş
  const shareOnWhatsApp = () => {
    if (!documentContent) return;
    const plainText = htmlToPlainText(documentContent);
    const encodedText = encodeURIComponent(plainText);
    window.open(`https://wa.me/?text=${encodedText}`, '_blank');
    toast.success("WhatsApp açılıyor...");
  };

  // Telegram'da paylaş
  const shareOnTelegram = () => {
    if (!documentContent) return;
    const plainText = htmlToPlainText(documentContent);
    const encodedText = encodeURIComponent(plainText);
    window.open(`https://t.me/share/url?text=${encodedText}`, '_blank');
    toast.success("Telegram açılıyor...");
  };

  // AI ile belgeyi geliştir
  const generateWithAI = async () => {
    if (!documentContent) {
      toast.error("Önce bir belge içeriği oluşturun");
      return;
    }

    setGeneratingAI(true);
    
    try {
      const response = await fetch("/api/generate-document", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          documentType: selectedDocument,
          currentContent: documentContent,
          studentName: selectedStudent?.text || "",
          studentClass: selectedClassText || "",
          meetingDate: meetingDate || undefined,
          meetingTime: meetingTime || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Belge oluşturulamadı");
      }

      const data = await response.json();
      
      if (data.document) {
        setDocumentContent(data.document);
        setHasUnsavedChanges(true);
        toast.success("Belge AI ile geliştirildi! ✨");
      }
    } catch (error) {
      console.error("AI generation error:", error);
      toast.error(error instanceof Error ? error.message : "AI ile belge oluşturulamadı");
    } finally {
      setGeneratingAI(false);
    }
  };

  // Word olarak indir
  const downloadAsWord = () => {
    if (!documentContent) return;
    
    setExportingWord(true);
    
    try {
      const selectedTemplate = documentTemplates.find(t => t.id === selectedDocument);
      const fileName = `${selectedTemplate?.label || 'Belge'}_${selectedStudent?.text || 'Öğrenci'}.doc`.replace(/\s+/g, '_');
      
      const processedContent = documentContent
        .replace(/<p><\/p>/g, '<p>&nbsp;</p>')
        .replace(/<p>\s*<br\s*\/?>\s*<\/p>/g, '<p>&nbsp;</p>');
      
      const htmlContent = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta charset="utf-8">
          <title>${selectedTemplate?.label}</title>
          <style>
            body { font-family: 'Times New Roman', Times, serif; font-size: 12pt; line-height: 1.8; padding: 40px; }
            p { margin: 0; padding: 0; min-height: 1.2em; }
            strong, b { font-weight: bold; }
            em, i { font-style: italic; }
            ul, ol { margin: 0.5em 0; padding-left: 1.5em; }
          </style>
        </head>
        <body>${processedContent}</body>
        </html>
      `;
      
      const blob = new Blob([htmlContent], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success("Word dosyası indirildi!");
    } catch (error) {
      console.error("Word export error:", error);
      toast.error("Word dosyası oluşturulamadı");
    } finally {
      setExportingWord(false);
    }
  };

  // PDF olarak indir
  const downloadAsPdf = () => {
    if (!documentContent) return;
    
    setExportingPdf(true);
    
    try {
      const selectedTemplate = documentTemplates.find(t => t.id === selectedDocument);
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast.error("Pop-up engelleyici aktif olabilir");
        setExportingPdf(false);
        return;
      }
      
      const processedContent = documentContent
        .replace(/<p><\/p>/g, '<p>&nbsp;</p>')
        .replace(/<p>\s*<br\s*\/?>\s*<\/p>/g, '<p>&nbsp;</p>');
      
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>${selectedTemplate?.label} - ${selectedStudent?.text || 'Öğrenci'}</title>
          <style>
            body { font-family: 'Times New Roman', Times, serif; font-size: 12pt; line-height: 1.8; padding: 40px; color: #333; }
            p { margin: 0; padding: 0; min-height: 1.2em; }
            p:empty::before { content: "\\00a0"; }
            strong, b { font-weight: bold; }
            em, i { font-style: italic; }
            ul, ol { margin: 0.5em 0; padding-left: 1.5em; }
            @media print { body { padding: 20px; } }
          </style>
        </head>
        <body>${processedContent}</body>
        </html>
      `;
      
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      
      setTimeout(() => {
        printWindow.print();
        toast.success("PDF olarak kaydetmek için 'PDF olarak kaydet' seçin");
      }, 500);
    } catch (error) {
      console.error("PDF export error:", error);
      toast.error("PDF dosyası oluşturulamadı");
    } finally {
      setExportingPdf(false);
    }
  };

  // İlk yüklemede varsayılan içerik
  useEffect(() => {
    if (!documentContent) {
      updateDocumentContent(selectedDocument);
    }
  }, []);

  // ==================== RENDER ====================
  return (
    <div className="space-y-6">
      {/* Modern Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 p-6 text-white shadow-xl">
        <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,transparent,rgba(255,255,255,0.5))]" />
        
        {/* Animated Background Elements */}
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-purple-400/20 blur-3xl animate-float-slow" />
        <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-indigo-400/20 blur-3xl animate-float-reverse" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-violet-400/10 blur-3xl animate-pulse-glow" />
        
        {/* Floating Particles */}
        <div className="absolute top-10 right-20 h-2 w-2 rounded-full bg-purple-300/60 animate-float animation-delay-100" />
        <div className="absolute top-20 right-40 h-1.5 w-1.5 rounded-full bg-pink-300/60 animate-float animation-delay-300" />
        <div className="absolute bottom-16 left-32 h-2 w-2 rounded-full bg-indigo-300/60 animate-float animation-delay-500" />
        <div className="absolute top-1/3 left-1/4 h-1 w-1 rounded-full bg-white/40 animate-sparkle animation-delay-200" />
        <div className="absolute bottom-1/3 right-1/4 h-1.5 w-1.5 rounded-full bg-violet-300/50 animate-sparkle animation-delay-700" />
        
        <div className="relative">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                <FileText className="h-7 w-7" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Belge Oluşturucu</h1>
                <p className="text-violet-200">Profesyonel belgeler oluşturun ve paylaşın</p>
              </div>
            </div>
            
            {/* Hızlı İstatistikler */}
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2 rounded-lg bg-white/10 backdrop-blur-sm px-4 py-2">
                <FileCheck className="h-5 w-5 text-violet-200" />
                <div>
                  <p className="text-xs text-violet-200">Toplam Belge</p>
                  <p className="text-lg font-bold">{stats.totalDocuments}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-white/10 backdrop-blur-sm px-4 py-2">
                <TrendingUp className="h-5 w-5 text-emerald-300" />
                <div>
                  <p className="text-xs text-violet-200">Bugün</p>
                  <p className="text-lg font-bold">{stats.todayDocuments}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-white/10 backdrop-blur-sm px-4 py-2">
                <Star className="h-5 w-5 text-amber-300" />
                <div>
                  <p className="text-xs text-violet-200">En Çok Kullanılan</p>
                  <p className="text-sm font-semibold">
                    {documentTemplates.find(t => t.id === stats.mostUsedTemplate)?.label || "Veli Mektubu"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Belge Türleri - Kartlar */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {documentTemplates.map((template) => {
          const Icon = template.icon;
          const isSelected = selectedDocument === template.id;
          
          return (
            <button
              key={template.id}
              onClick={() => handleDocumentChange(template.id)}
              className={`relative group flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-300 ${
                isSelected
                  ? `bg-gradient-to-br ${template.bgGradient} text-white border-transparent shadow-lg scale-105`
                  : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-md"
              }`}
            >
              <div className={`p-2 rounded-lg ${isSelected ? "bg-white/20" : "bg-slate-100"}`}>
                <Icon className={`h-5 w-5 ${isSelected ? "text-white" : template.color}`} />
              </div>
              <span className={`text-xs font-medium text-center ${isSelected ? "text-white" : "text-slate-700"}`}>
                {template.label}
              </span>
              {isSelected && (
                <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-white flex items-center justify-center">
                  <Check className="h-3 w-3 text-violet-600" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Sol Panel - Öğrenci Seçimi ve Ayarlar */}
        <div className="lg:col-span-1 space-y-4">
          {/* Sınıf Seçimi */}
          <Card className="bg-white/80 backdrop-blur border-slate-200/50 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-100">
                  <GraduationCap className="h-4 w-4 text-blue-600" />
                </div>
                Sınıf / Şube
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                disabled={loadingClasses}
                value={selectedClass}
                onValueChange={handleClassChange}
              >
                <SelectTrigger className="h-11 bg-white">
                  <SelectValue placeholder={loadingClasses ? "Yükleniyor..." : "Sınıf/Şube seçin"} />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.text}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Öğrenci Seçimi */}
          <Card className="bg-white/80 backdrop-blur border-slate-200/50 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-100">
                  <User className="h-4 w-4 text-emerald-600" />
                </div>
                Öğrenci
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select
                disabled={!selectedClass || loadingStudents}
                value={selectedStudent?.value || ""}
                onValueChange={handleStudentChange}
              >
                <SelectTrigger className="h-11 bg-white">
                  <SelectValue placeholder={
                    loadingStudents ? "Yükleniyor..." : 
                    !selectedClass ? "Önce sınıf seçin" : 
                    "Öğrenci seçin"
                  } />
                </SelectTrigger>
                <SelectContent>
                  {students.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.text}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedStudent && (
                <div className="p-3 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg border border-emerald-200">
                  <div className="flex items-center gap-2">
                    <div className="p-1 rounded-full bg-emerald-100">
                      <Check className="h-3 w-3 text-emerald-600" />
                    </div>
                    <span className="text-sm font-semibold text-emerald-800">
                      {selectedStudent.text}
                    </span>
                  </div>
                  <p className="text-xs text-emerald-600 mt-1 ml-6">{selectedClassText}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tarih ve Saat - Sadece ilgili belgeler için */}
          {(selectedDocument === "veli-cagrisi" || selectedDocument === "disiplin-kurulu") && (
            <Card className={`bg-white/80 backdrop-blur border-slate-200/50 shadow-sm ${
              selectedDocument === "disiplin-kurulu" ? "ring-2 ring-rose-200" : "ring-2 ring-emerald-200"
            }`}>
              <CardHeader className="pb-3">
                <CardTitle className={`text-sm font-semibold flex items-center gap-2 ${
                  selectedDocument === "disiplin-kurulu" ? "text-rose-800" : "text-emerald-800"
                }`}>
                  <div className={`p-1.5 rounded-lg ${
                    selectedDocument === "disiplin-kurulu" ? "bg-rose-100" : "bg-emerald-100"
                  }`}>
                    <Calendar className={`h-4 w-4 ${
                      selectedDocument === "disiplin-kurulu" ? "text-rose-600" : "text-emerald-600"
                    }`} />
                  </div>
                  {selectedDocument === "disiplin-kurulu" ? "Toplantı Zamanı" : "Görüşme Zamanı"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="meetingDate" className="text-xs font-medium text-slate-600">
                    Tarih
                  </Label>
                  <Input
                    id="meetingDate"
                    type="date"
                    value={meetingDate}
                    onChange={(e) => handleMeetingDateChange(e.target.value)}
                    className="h-10 bg-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="meetingTime" className="text-xs font-medium text-slate-600">
                    Saat
                  </Label>
                  <Input
                    id="meetingTime"
                    type="time"
                    value={meetingTime}
                    onChange={(e) => handleMeetingTimeChange(e.target.value)}
                    className="h-10 bg-white"
                  />
                </div>
                {(meetingDate || meetingTime) && (
                  <div className={`p-3 rounded-lg ${
                    selectedDocument === "disiplin-kurulu" 
                      ? "bg-rose-50 border border-rose-200" 
                      : "bg-emerald-50 border border-emerald-200"
                  }`}>
                    <p className={`text-xs font-medium ${
                      selectedDocument === "disiplin-kurulu" ? "text-rose-600" : "text-emerald-600"
                    }`}>
                      Seçilen Zaman:
                    </p>
                    <p className={`text-sm mt-1 font-semibold ${
                      selectedDocument === "disiplin-kurulu" ? "text-rose-800" : "text-emerald-800"
                    }`}>
                      {meetingDate 
                        ? new Date(meetingDate).toLocaleDateString('tr-TR', { 
                            day: 'numeric', 
                            month: 'long', 
                            year: 'numeric', 
                            weekday: 'long' 
                          })
                        : "Tarih seçilmedi"
                      }
                      {meetingTime && ` - ${meetingTime}`}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Son Belgeler */}
          {documentHistory.length > 0 && (
            <Card className="bg-white/80 backdrop-blur border-slate-200/50 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-amber-100">
                    <History className="h-4 w-4 text-amber-600" />
                  </div>
                  Son Belgeler
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {documentHistory.slice(0, 5).map((doc) => {
                    const template = documentTemplates.find(t => t.id === doc.type);
                    const Icon = template?.icon || FileText;
                    return (
                      <div
                        key={doc.id}
                        className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer text-xs"
                        onClick={() => {
                          handleDocumentChange(doc.type);
                          toast.info(`${template?.label} şablonu yüklendi`);
                        }}
                      >
                        <Icon className={`h-3.5 w-3.5 ${template?.color || "text-slate-500"}`} />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-700 truncate">{doc.studentName}</p>
                          <p className="text-slate-500 truncate">{doc.className}</p>
                        </div>
                        <ChevronRight className="h-3 w-3 text-slate-400" />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sağ Panel - Belge Editörü */}
        <div className="lg:col-span-2">
          <Card className="bg-white/80 backdrop-blur border-slate-200/50 shadow-sm h-full">
            <CardHeader className="pb-3 border-b border-slate-100">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-gradient-to-br ${
                    documentTemplates.find(t => t.id === selectedDocument)?.bgGradient || "from-violet-500 to-purple-600"
                  }`}>
                    {(() => {
                      const Icon = documentTemplates.find(t => t.id === selectedDocument)?.icon || FileText;
                      return <Icon className="h-5 w-5 text-white" />;
                    })()}
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold text-slate-800">
                      {documentTemplates.find(t => t.id === selectedDocument)?.label || "Belge"} Önizleme
                    </CardTitle>
                    {selectedStudent && (
                      <p className="text-xs text-slate-500 mt-0.5">
                        {selectedStudent.text} - {selectedClassText}
                      </p>
                    )}
                  </div>
                  {hasUnsavedChanges && (
                    <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">
                      <Sparkles className="h-3 w-3 mr-1" />
                      Kaydedilmemiş
                    </Badge>
                  )}
                </div>
                
                {/* Eylem Butonları */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {/* AI ile Geliştir */}
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1 bg-gradient-to-r from-violet-500 to-purple-600 text-white border-0 hover:from-violet-600 hover:to-purple-700 shadow-sm"
                    onClick={generateWithAI}
                    disabled={generatingAI || !documentContent}
                    title="AI ile belgeyi geliştir"
                  >
                    {generatingAI ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        <span className="hidden sm:inline">Gemini...</span>
                      </>
                    ) : (
                      <>
                        <Wand2 className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">AI Geliştir</span>
                      </>
                    )}
                  </Button>
                  
                  <div className="w-px h-6 bg-slate-200 mx-1 hidden sm:block" />
                  
                  {/* Düzenleme */}
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1 text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                    onClick={handleSaveContent}
                    disabled={!documentContent}
                  >
                    <Save className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Kaydet</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1 text-amber-600 border-amber-200 hover:bg-amber-50"
                    onClick={handleResetContent}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Sıfırla</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1 text-slate-600 border-slate-200 hover:bg-slate-50"
                    onClick={handleClearContent}
                    disabled={!documentContent}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                  
                  <div className="w-px h-6 bg-slate-200 mx-1 hidden sm:block" />
                  
                  {/* Kopyala & Yazdır */}
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1 text-slate-600 border-slate-200 hover:bg-slate-50"
                    onClick={copyToClipboard}
                    disabled={!documentContent}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1 text-slate-600 border-slate-200 hover:bg-slate-50"
                    onClick={printDocument}
                    disabled={!documentContent}
                  >
                    <Printer className="h-3.5 w-3.5" />
                  </Button>
                  
                  <div className="w-px h-6 bg-slate-200 mx-1 hidden sm:block" />
                  
                  {/* Export */}
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                    onClick={downloadAsWord}
                    disabled={exportingWord || !documentContent}
                  >
                    {exportingWord ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <FileType className="h-3.5 w-3.5" />
                    )}
                    <span className="hidden sm:inline">Word</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1 text-red-600 border-red-200 hover:bg-red-50"
                    onClick={downloadAsPdf}
                    disabled={exportingPdf || !documentContent}
                  >
                    {exportingPdf ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <FileDown className="h-3.5 w-3.5" />
                    )}
                    <span className="hidden sm:inline">PDF</span>
                  </Button>
                  
                  <div className="w-px h-6 bg-slate-200 mx-1 hidden sm:block" />
                  
                  {/* Paylaşım */}
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1 text-green-600 border-green-200 hover:bg-green-50"
                    onClick={shareOnWhatsApp}
                    disabled={!documentContent}
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1 text-sky-600 border-sky-200 hover:bg-sky-50"
                    onClick={shareOnTelegram}
                    disabled={!documentContent}
                  >
                    <Send className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              {/* Zengin Metin Editörü */}
              <RichTextEditor
                content={documentContent}
                onChange={handleContentChange}
                placeholder="Önce öğrenci seçin..."
              />

              {/* Bilgilendirme */}
              <div className="mt-4 p-3 bg-gradient-to-r from-violet-50 to-purple-50 rounded-lg border border-violet-200">
                <div className="flex items-start gap-2">
                  <Zap className="h-4 w-4 text-violet-600 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-violet-700">
                    <p className="font-medium">İpuçları</p>
                    <ul className="mt-1 space-y-0.5 text-violet-600">
                      <li>• Editörde <strong>kalın</strong>, <em>italik</em>, altı çizili metin kullanabilirsiniz</li>
                      <li>• Word veya PDF olarak indirebilir, WhatsApp/Telegram ile paylaşabilirsiniz</li>
                      <li>• Belge değişikliklerinizi kaydetmeyi unutmayın</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
