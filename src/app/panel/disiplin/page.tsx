"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Gavel,
  GraduationCap, 
  User, 
  RefreshCw,
  FileType,
  FileDown,
  Calendar,
  Clock,
  Save,
  RotateCcw,
  Trash2,
  AlertTriangle,
  Plus,
  ChevronRight,
  ChevronLeft,
  Check,
  FileText,
  Send,
  MessageCircle,
  Printer,
  ClipboardList,
  Scale,
  UserX,
  FileWarning,
  BookOpen,
  ShieldAlert,
  FileSignature,
  Ban,
  Building2,
  Sparkles,
  TrendingUp,
  Activity,
  Zap,
  Eye,
  Copy,
  Download,
  Share2,
  History,
  Target,
  Award,
  Star,
  Timer,
  CheckCircle2,
  XCircle,
  Info,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2
} from "lucide-react";
import { toast } from "sonner";
import dynamic from "next/dynamic";
import { YONLENDIRME_NEDENLERI, DISIPLIN_CEZALARI } from "@/types";

// RichTextEditor'u dinamik olarak yükle
const RichTextEditor = dynamic(
  () => import("@/components/RichTextEditor").then((mod) => mod.RichTextEditor),
  { 
    ssr: false,
    loading: () => (
      <div className="border border-slate-200 rounded-lg bg-white h-[400px] flex items-center justify-center text-slate-400">
        <RefreshCw className="h-5 w-5 animate-spin mr-2" />
        Editör yükleniyor...
      </div>
    )
  }
);

interface Student {
  value: string;
  text: string;
}

interface ClassOption {
  value: string;
  text: string;
}

// Disiplin belge türleri
type DisiplinDocType = 
  | "ogrenci-ifade" 
  | "tanik-ifade" 
  | "veli-bilgilendirme" 
  | "disiplin-cagri" 
  | "disiplin-karar"
  | "uyari-belgesi"
  | "sozlu-uyari"
  | "ogrenci-sozlesmesi"
  | "kinama-belgesi"
  | "okul-degisikligi";

interface DisiplinDocument {
  id: DisiplinDocType;
  label: string;
  icon: React.ElementType;
  color: string;
  description: string;
}

const disiplinDocuments: DisiplinDocument[] = [
  { 
    id: "ogrenci-ifade", 
    label: "Öğrenci İfade Tutanağı", 
    icon: User, 
    color: "text-blue-600 bg-blue-50 border-blue-200",
    description: "Öğrencinin olaya ilişkin ifadesi"
  },
  { 
    id: "tanik-ifade", 
    label: "Tanık İfade Tutanağı", 
    icon: UserX, 
    color: "text-purple-600 bg-purple-50 border-purple-200",
    description: "Tanık öğrencilerin ifadeleri"
  },
  { 
    id: "veli-bilgilendirme", 
    label: "Veli Bilgilendirme Yazısı", 
    icon: FileWarning, 
    color: "text-amber-600 bg-amber-50 border-amber-200",
    description: "Veliye durum bildirimi"
  },
  { 
    id: "disiplin-cagri", 
    label: "Disiplin Kurulu Çağrısı", 
    icon: Gavel, 
    color: "text-rose-600 bg-rose-50 border-rose-200",
    description: "Kurul toplantısına davet"
  },
  { 
    id: "disiplin-karar", 
    label: "Disiplin Kurulu Kararı", 
    icon: Scale, 
    color: "text-red-600 bg-red-50 border-red-200",
    description: "Kurul karar tutanağı"
  },
  { 
    id: "uyari-belgesi", 
    label: "Uyarı Belgesi", 
    icon: AlertTriangle, 
    color: "text-orange-600 bg-orange-50 border-orange-200",
    description: "Öğrenci uyarı yazısı"
  },
];

// Ceza belgeleri
const cezaDocuments: DisiplinDocument[] = [
  { 
    id: "sozlu-uyari", 
    label: "Sözlü Uyarı Belgesi", 
    icon: ShieldAlert, 
    color: "text-yellow-600 bg-yellow-50 border-yellow-200",
    description: "Sözlü uyarı tutanağı"
  },
  { 
    id: "ogrenci-sozlesmesi", 
    label: "Öğrenci Sözleşmesi", 
    icon: FileSignature, 
    color: "text-cyan-600 bg-cyan-50 border-cyan-200",
    description: "Davranış sözleşmesi imzalama"
  },
  { 
    id: "kinama-belgesi", 
    label: "Kınama Belgesi", 
    icon: Ban, 
    color: "text-red-600 bg-red-50 border-red-200",
    description: "Resmi kınama cezası"
  },
  { 
    id: "okul-degisikligi", 
    label: "Okul Değişikliği Talebi", 
    icon: Building2, 
    color: "text-slate-600 bg-slate-50 border-slate-200",
    description: "Okul değişikliği talep yazısı"
  },
];

export default function DisiplinPage() {
  // Seçim state'leri
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedClassText, setSelectedClassText] = useState<string>("");
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  
  // Tarih ve neden seçimi
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedReason, setSelectedReason] = useState<string>("");
  const [selectedPenalty, setSelectedPenalty] = useState<string>("");
  const [savingPenalty, setSavingPenalty] = useState(false);
  
  // Toplantı bilgileri
  const [meetingDate, setMeetingDate] = useState<string>("");
  const [meetingTime, setMeetingTime] = useState<string>("");
  
  // Belge state'leri
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedDocument, setSelectedDocument] = useState<DisiplinDocType>("ogrenci-ifade");
  const [documentContent, setDocumentContent] = useState<string>("");
  const [exportingWord, setExportingWord] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  
  // Kaydedilen belgeler
  const [savedDocuments, setSavedDocuments] = useState<Record<DisiplinDocType, string>>({
    "ogrenci-ifade": "",
    "tanik-ifade": "",
    "veli-bilgilendirme": "",
    "disiplin-cagri": "",
    "disiplin-karar": "",
    "uyari-belgesi": "",
    "sozlu-uyari": "",
    "ogrenci-sozlesmesi": "",
    "kinama-belgesi": "",
    "okul-degisikligi": ""
  });

  // Animasyon ve UI state'leri
  const [isAnimating, setIsAnimating] = useState(true);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [showQuickActions, setShowQuickActions] = useState(true);
  const [recentActivity, setRecentActivity] = useState<Array<{action: string; time: Date; doc?: string}>>([]);
  const [animatedStats, setAnimatedStats] = useState({ completed: 0, total: 0, progress: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState<'disiplin' | 'ceza'>('disiplin');
  const [searchQuery, setSearchQuery] = useState("");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [previewMode, setPreviewMode] = useState(false);

  // Tarih formatları
  const today = new Date();
  const formattedToday = today.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  // Animasyonlu istatistikler
  useEffect(() => {
    const totalDocs = disiplinDocuments.length + cezaDocuments.length;
    const completedDocs = Object.values(savedDocuments).filter(doc => doc && doc.trim() !== "").length;
    
    // Animate stats
    const duration = 1000;
    const steps = 30;
    const stepDuration = duration / steps;
    let currentStep = 0;
    
    const interval = setInterval(() => {
      currentStep++;
      const progress = currentStep / steps;
      const easeOut = 1 - Math.pow(1 - progress, 3);
      
      setAnimatedStats({
        completed: Math.round(completedDocs * easeOut),
        total: totalDocs,
        progress: Math.round((completedDocs / totalDocs) * 100 * easeOut)
      });
      
      if (currentStep >= steps) {
        clearInterval(interval);
      }
    }, stepDuration);
    
    return () => clearInterval(interval);
  }, [savedDocuments]);

  // Activity log
  const addActivity = useCallback((action: string, doc?: string) => {
    setRecentActivity(prev => [{action, time: new Date(), doc}, ...prev.slice(0, 4)]);
  }, []);

  // Auto-save
  useEffect(() => {
    if (autoSaveEnabled && documentContent && selectedDocument) {
      const timeout = setTimeout(() => {
        setSavedDocuments(prev => ({
          ...prev,
          [selectedDocument]: documentContent
        }));
        setLastSaved(new Date());
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, [documentContent, selectedDocument, autoSaveEnabled]);

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

  // Sınıf seçimi
  const handleClassChange = (value: string) => {
    setSelectedClass(value);
    const classText = classes.find(c => c.value === value)?.text || value;
    setSelectedClassText(classText);
    setSelectedStudent(null);
    loadStudents(value);
  };

  // Öğrenci seçimi
  const handleStudentChange = (value: string) => {
    const student = students.find(s => s.value === value);
    if (student) {
      setSelectedStudent(student);
    }
  };

  // Belge şablonları oluştur
  const generateDocumentContent = (type: DisiplinDocType): string => {
    const studentName = selectedStudent?.text || "[Öğrenci Seçilmedi]";
    const className = selectedClassText || "[Sınıf Seçilmedi]";
    const reason = selectedReason || "[Neden Seçilmedi]";
    const eventDate = selectedDate 
      ? new Date(selectedDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
      : "[Tarih Seçilmedi]";
    const meetingDateFormatted = meetingDate 
      ? new Date(meetingDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
      : "____/____/________";
    const meetingTimeFormatted = meetingTime || "____:____";

    const header = `<p style="text-align: center; margin-bottom: 0;"><strong>T.C.</strong></p>
<p style="text-align: center; margin-bottom: 0;"><strong>BİRECİK KAYMAKAMLIĞI</strong></p>
<p style="text-align: center; margin-bottom: 0;"><strong>DUMLUPINAR İLKOKULU MÜDÜRLÜĞÜ</strong></p>
<p style="text-align: center; margin-bottom: 20px;"><strong>ÖĞRENCİ DAVRANIŞLARINI DEĞERLENDİRME KURULU</strong></p>`;

    const signature = `<p style="margin-top: 40px;"></p>
<p style="text-align: right; margin-bottom: 0;"><strong>____________________</strong></p>
<p style="text-align: right; margin-bottom: 0;">Okul Müdürü</p>
<p style="text-align: right; margin-bottom: 0;">Mühür / Kaşe</p>`;

    const templates: Record<DisiplinDocType, string> = {
      "ogrenci-ifade": `${header}
<p style="text-align: center; margin-bottom: 20px;"><strong>ÖĞRENCİ İFADE TUTANAĞI</strong></p>
<table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
<tr>
<td style="width: 50%; padding: 5px 0;"><strong>Tutanak Tarihi:</strong> ${formattedToday}</td>
<td style="width: 50%; padding: 5px 0;"><strong>Sayı:</strong> ____________________</td>
</tr>
<tr>
<td style="padding: 5px 0;"><strong>Olay Tarihi:</strong> ${eventDate}</td>
<td style="padding: 5px 0;"><strong>Olay Saati:</strong> ____:____</td>
</tr>
</table>
<p style="margin-bottom: 10px; border-bottom: 1px solid #ccc; padding-bottom: 10px;"><strong>İFADE VEREN ÖĞRENCİ BİLGİLERİ</strong></p>
<table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
<tr>
<td style="width: 50%; padding: 5px 0;"><strong>Adı Soyadı:</strong> ${studentName}</td>
<td style="width: 50%; padding: 5px 0;"><strong>Sınıfı/Şubesi:</strong> ${className}</td>
</tr>
<tr>
<td style="padding: 5px 0;"><strong>Okul Numarası:</strong> ____________________</td>
<td style="padding: 5px 0;"><strong>T.C. Kimlik No:</strong> ____________________</td>
</tr>
</table>
<p style="margin-bottom: 5px;"><strong>OLAY KONUSU:</strong></p>
<p style="margin-bottom: 15px; padding: 10px; background-color: #f5f5f5; border-radius: 5px;">${reason}</p>
<p style="margin-bottom: 5px;"><strong>OLAYIN GERÇEKLEŞTİĞİ YER:</strong> ____________________</p>
<p style="margin-bottom: 15px;"></p>
<p style="margin-bottom: 10px; border-bottom: 1px solid #ccc; padding-bottom: 10px;"><strong>ÖĞRENCİ İFADESİ</strong></p>
<p style="margin-bottom: 5px;"><em>"Olayı kendi bakış açımdan, başından sonuna kadar anlatıyorum:"</em></p>
<p style="margin-bottom: 10px;">________________________________________________________________________</p>
<p style="margin-bottom: 10px;">________________________________________________________________________</p>
<p style="margin-bottom: 10px;">________________________________________________________________________</p>
<p style="margin-bottom: 10px;">________________________________________________________________________</p>
<p style="margin-bottom: 10px;">________________________________________________________________________</p>
<p style="margin-bottom: 10px;">________________________________________________________________________</p>
<p style="margin-bottom: 10px;">________________________________________________________________________</p>
<p style="margin-bottom: 10px;">________________________________________________________________________</p>
<p style="margin-bottom: 10px;">________________________________________________________________________</p>
<p style="margin-bottom: 10px;">________________________________________________________________________</p>
<p style="margin-bottom: 20px;"></p>
<p style="margin-bottom: 15px; padding: 10px; background-color: #fff3cd; border-radius: 5px; border-left: 4px solid #ffc107;"><em>Yukarıdaki ifademin tamamen kendi isteğimle, hiçbir baskı altında kalmadan ve doğru olarak verildiğini, okudum/okutuldum, anladım ve kabul ediyorum.</em></p>
<p style="margin-bottom: 40px;"></p>
<table style="width: 100%; border-collapse: collapse; border-top: 2px solid #333; padding-top: 20px;">
<tr>
<td style="width: 50%; padding: 20px 10px; text-align: center; vertical-align: top;">
<p style="margin-bottom: 5px;"><strong>İFADE VEREN ÖĞRENCİ</strong></p>
<p style="margin-bottom: 30px;">${studentName}</p>
<p style="margin-bottom: 5px;">Tarih: ____/____/________</p>
<p>İmza: ____________________</p>
</td>
<td style="width: 50%; padding: 20px 10px; text-align: center; vertical-align: top; border-left: 1px solid #ccc;">
<p style="margin-bottom: 5px;"><strong>İFADE ALAN YETKİLİ</strong></p>
<p style="margin-bottom: 30px;">____________________</p>
<p style="margin-bottom: 5px;">Tarih: ____/____/________</p>
<p>İmza: ____________________</p>
</td>
</tr>
</table>`,

      "tanik-ifade": `${header}
<p style="text-align: center; margin-bottom: 20px;"><strong>TANIK İFADE TUTANAĞI</strong></p>
<table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
<tr>
<td style="width: 50%; padding: 5px 0;"><strong>Tutanak Tarihi:</strong> ${formattedToday}</td>
<td style="width: 50%; padding: 5px 0;"><strong>Sayı:</strong> ____________________</td>
</tr>
<tr>
<td style="padding: 5px 0;"><strong>Olay Tarihi:</strong> ${eventDate}</td>
<td style="padding: 5px 0;"><strong>Olay Saati:</strong> ____:____</td>
</tr>
</table>
<p style="margin-bottom: 10px; border-bottom: 1px solid #ccc; padding-bottom: 10px;"><strong>SORUŞTURMA KONUSU OLAY BİLGİLERİ</strong></p>
<table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
<tr>
<td style="width: 50%; padding: 5px 0;"><strong>İlgili Öğrenci:</strong> ${studentName}</td>
<td style="width: 50%; padding: 5px 0;"><strong>Sınıfı:</strong> ${className}</td>
</tr>
</table>
<p style="margin-bottom: 5px;"><strong>OLAY KONUSU:</strong></p>
<p style="margin-bottom: 15px; padding: 10px; background-color: #f5f5f5; border-radius: 5px;">${reason}</p>
<p style="margin-bottom: 10px; border-bottom: 1px solid #ccc; padding-bottom: 10px;"><strong>TANIK ÖĞRENCİ BİLGİLERİ</strong></p>
<table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
<tr>
<td style="width: 50%; padding: 5px 0;"><strong>Adı Soyadı:</strong> ____________________</td>
<td style="width: 50%; padding: 5px 0;"><strong>Sınıfı/Şubesi:</strong> ____________________</td>
</tr>
<tr>
<td style="padding: 5px 0;"><strong>Okul Numarası:</strong> ____________________</td>
<td style="padding: 5px 0;"><strong>İlgili Öğrenci ile İlişkisi:</strong> ____________________</td>
</tr>
</table>
<p style="margin-bottom: 10px; border-bottom: 1px solid #ccc; padding-bottom: 10px;"><strong>TANIK İFADESİ</strong></p>
<p style="margin-bottom: 5px;"><em>"Olayı gördüğüm/duyduğum şekliyle anlatıyorum:"</em></p>
<p style="margin-bottom: 10px;">________________________________________________________________________</p>
<p style="margin-bottom: 10px;">________________________________________________________________________</p>
<p style="margin-bottom: 10px;">________________________________________________________________________</p>
<p style="margin-bottom: 10px;">________________________________________________________________________</p>
<p style="margin-bottom: 10px;">________________________________________________________________________</p>
<p style="margin-bottom: 10px;">________________________________________________________________________</p>
<p style="margin-bottom: 10px;">________________________________________________________________________</p>
<p style="margin-bottom: 10px;">________________________________________________________________________</p>
<p style="margin-bottom: 20px;"></p>
<p style="margin-bottom: 5px;"><strong>Ek Sorular:</strong></p>
<p style="margin-bottom: 5px;">1. Olayı nereden gördünüz/duydunuz? ________________________________________________</p>
<p style="margin-bottom: 5px;">2. Başka tanık var mıydı? ________________________________________________</p>
<p style="margin-bottom: 15px;">3. Eklemek istediğiniz başka bir şey var mı? ________________________________________________</p>
<p style="margin-bottom: 15px; padding: 10px; background-color: #fff3cd; border-radius: 5px; border-left: 4px solid #ffc107;"><em>Yukarıdaki ifademin tamamen doğru olduğunu, hiçbir baskı altında kalmadan ve kendi isteğimle verdiğimi beyan ederim.</em></p>
<p style="margin-bottom: 40px;"></p>
<table style="width: 100%; border-collapse: collapse; border-top: 2px solid #333; padding-top: 20px;">
<tr>
<td style="width: 50%; padding: 20px 10px; text-align: center; vertical-align: top;">
<p style="margin-bottom: 5px;"><strong>İFADE VEREN TANIK</strong></p>
<p style="margin-bottom: 30px;">____________________</p>
<p style="margin-bottom: 5px;">Tarih: ____/____/________</p>
<p>İmza: ____________________</p>
</td>
<td style="width: 50%; padding: 20px 10px; text-align: center; vertical-align: top; border-left: 1px solid #ccc;">
<p style="margin-bottom: 5px;"><strong>İFADE ALAN YETKİLİ</strong></p>
<p style="margin-bottom: 30px;">____________________</p>
<p style="margin-bottom: 5px;">Tarih: ____/____/________</p>
<p>İmza: ____________________</p>
</td>
</tr>
</table>`,

      "veli-bilgilendirme": `${header}
<p style="text-align: center; margin-bottom: 20px;"><strong>VELİ BİLGİLENDİRME YAZISI</strong></p>
<table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
<tr>
<td style="width: 50%; padding: 5px 0;"><strong>Tarih:</strong> ${formattedToday}</td>
<td style="width: 50%; padding: 5px 0;"><strong>Sayı:</strong> ____________________</td>
</tr>
</table>
<p style="margin-bottom: 5px;"><strong>Konu:</strong> Disiplin Olayı Hakkında Veli Bilgilendirmesi</p>
<p style="margin-bottom: 20px;"></p>
<p style="margin-bottom: 15px;"><strong>SAYIN VELİ,</strong></p>
<p style="margin-bottom: 15px; text-align: justify;">Okulumuz ${className} sınıfı öğrencisi "<strong>${studentName}</strong>" hakkında ${eventDate} tarihinde yaşanan disiplin olayı nedeniyle sizleri resmi olarak bilgilendirmek istiyoruz.</p>
<p style="margin-bottom: 10px; border-bottom: 1px solid #ccc; padding-bottom: 10px;"><strong>OLAY BİLGİLERİ</strong></p>
<table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
<tr>
<td style="width: 30%; padding: 5px 0;"><strong>Olay Tarihi:</strong></td>
<td style="width: 70%; padding: 5px 0;">${eventDate}</td>
</tr>
<tr>
<td style="padding: 5px 0;"><strong>Olay Yeri:</strong></td>
<td style="padding: 5px 0;">____________________</td>
</tr>
<tr>
<td style="padding: 5px 0;"><strong>Olay Konusu:</strong></td>
<td style="padding: 5px 0;">${reason}</td>
</tr>
</table>
<p style="margin-bottom: 5px;"><strong>OLAY ÖZETİ:</strong></p>
<p style="margin-bottom: 10px; padding: 10px; background-color: #f5f5f5; border-radius: 5px;">________________________________________________________________________</p>
<p style="margin-bottom: 10px; padding: 10px; background-color: #f5f5f5; border-radius: 5px;">________________________________________________________________________</p>
<p style="margin-bottom: 10px; padding: 10px; background-color: #f5f5f5; border-radius: 5px;">________________________________________________________________________</p>
<p style="margin-bottom: 10px; border-bottom: 1px solid #ccc; padding-bottom: 10px;"><strong>YAPILAN VE YAPILACAK İŞLEMLER</strong></p>
<ul style="margin-bottom: 15px; padding-left: 20px;">
<li style="margin-bottom: 8px;">Öğrencinin yazılı ifadesi usulüne uygun şekilde alınmıştır.</li>
<li style="margin-bottom: 8px;">Varsa tanık öğrenci ifadeleri değerlendirilmiştir.</li>
<li style="margin-bottom: 8px;">Rehberlik servisi tarafından öğrenci ile görüşme yapılmıştır.</li>
<li style="margin-bottom: 8px;">Okul yönetimi tarafından gerekli önleyici tedbirler alınmaktadır.</li>
<li style="margin-bottom: 8px;">Duruma göre disiplin kurulu toplantısı planlanabilecektir.</li>
</ul>
<p style="margin-bottom: 10px; border-bottom: 1px solid #ccc; padding-bottom: 10px;"><strong>VELİDEN BEKLENENLER</strong></p>
<p style="margin-bottom: 15px; text-align: justify;">Öğrencinizin eğitim hayatının sağlıklı ve başarılı bir şekilde devam edebilmesi için veli-okul işbirliğinin büyük önem taşıdığına inanmaktayız. Bu doğrultuda:</p>
<ul style="margin-bottom: 15px; padding-left: 20px;">
<li style="margin-bottom: 8px;">En kısa sürede okul idaresi veya rehberlik servisi ile iletişime geçmenizi,</li>
<li style="margin-bottom: 8px;">Evde öğrencinizle bu konu hakkında yapıcı bir görüşme yapmanızı,</li>
<li style="margin-bottom: 8px;">Benzer durumların önlenmesi için birlikte çalışmamızı</li>
</ul>
<p style="margin-bottom: 15px;">rica ederiz.</p>
<p style="margin-bottom: 5px;">Bilgilerinize saygıyla sunarız.</p>
${signature}
<p style="margin-top: 40px; border-top: 2px solid #333; padding-top: 20px;"></p>
<p style="margin-bottom: 10px;"><strong>VELİ TEBLİĞ BÖLÜMÜ</strong></p>
<table style="width: 100%; border-collapse: collapse;">
<tr>
<td style="width: 50%; padding: 10px 0;"><strong>Veli Adı Soyadı:</strong> ____________________</td>
<td style="width: 50%; padding: 10px 0;"><strong>Yakınlık Derecesi:</strong> ____________________</td>
</tr>
<tr>
<td style="padding: 10px 0;"><strong>Telefon:</strong> ____________________</td>
<td style="padding: 10px 0;"><strong>Tebliğ Tarihi:</strong> ____/____/________</td>
</tr>
<tr>
<td colspan="2" style="padding: 10px 0;"><strong>Veli İmzası:</strong> ____________________</td>
</tr>
</table>`,

      "disiplin-cagri": `${header}
<p style="text-align: center; margin-bottom: 20px;"><strong>DİSİPLİN KURULU TOPLANTISINA ÇAĞRI</strong></p>
<table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
<tr>
<td style="width: 50%; padding: 5px 0;"><strong>Tarih:</strong> ${formattedToday}</td>
<td style="width: 50%; padding: 5px 0;"><strong>Sayı:</strong> ____________________</td>
</tr>
</table>
<p style="margin-bottom: 5px;"><strong>Konu:</strong> Disiplin Kurulu Toplantısına Davet</p>
<p style="margin-bottom: 20px;"></p>
<p style="margin-bottom: 15px;"><strong>SAYIN VELİ,</strong></p>
<p style="margin-bottom: 15px; text-align: justify;">Okulumuz ${className} sınıfı öğrencisi "<strong>${studentName}</strong>" hakkında ${eventDate} tarihinde yaşanan "<strong>${reason}</strong>" konulu olay nedeniyle başlatılan disiplin soruşturması kapsamında, ilgili mevzuat gereği öğrenci velisi olarak Disiplin Kurulu toplantısına katılmanız gerekmektedir.</p>
<p style="margin-bottom: 10px; border-bottom: 1px solid #ccc; padding-bottom: 10px;"><strong>TOPLANTI BİLGİLERİ</strong></p>
<table style="width: 100%; border-collapse: collapse; margin-bottom: 15px; border: 1px solid #ddd;">
<tr style="background-color: #f5f5f5;">
<td style="width: 30%; padding: 10px; border: 1px solid #ddd;"><strong>Toplantı Tarihi:</strong></td>
<td style="width: 70%; padding: 10px; border: 1px solid #ddd;">${meetingDateFormatted}</td>
</tr>
<tr>
<td style="padding: 10px; border: 1px solid #ddd;"><strong>Toplantı Saati:</strong></td>
<td style="padding: 10px; border: 1px solid #ddd;">${meetingTimeFormatted}</td>
</tr>
<tr style="background-color: #f5f5f5;">
<td style="padding: 10px; border: 1px solid #ddd;"><strong>Toplantı Yeri:</strong></td>
<td style="padding: 10px; border: 1px solid #ddd;">Okul Müdürlüğü / Toplantı Salonu</td>
</tr>
</table>
<p style="margin-bottom: 10px; border-bottom: 1px solid #ccc; padding-bottom: 10px;"><strong>SORUŞTURMA KONUSU</strong></p>
<p style="margin-bottom: 5px;"><strong>Olay Tarihi:</strong> ${eventDate}</p>
<p style="margin-bottom: 5px;"><strong>Olay Konusu:</strong> ${reason}</p>
<p style="margin-bottom: 15px;"><strong>İlgili Öğrenci:</strong> ${studentName} - ${className}</p>
<p style="margin-bottom: 10px; border-bottom: 1px solid #ccc; padding-bottom: 10px;"><strong>ÖNEMLİ BİLGİLER</strong></p>
<ul style="margin-bottom: 15px; padding-left: 20px;">
<li style="margin-bottom: 8px;"><strong>Kimlik belgesi</strong> (Nüfus cüzdanı veya ehliyet) ile gelmeniz zorunludur.</li>
<li style="margin-bottom: 8px;">Toplantıda öğrenciniz adına <strong>savunma yapma hakkınız</strong> bulunmaktadır.</li>
<li style="margin-bottom: 8px;">Varsa olaya ilişkin <strong>yazılı belge ve delilleri</strong> yanınızda getirebilirsiniz.</li>
<li style="margin-bottom: 8px;">İsterseniz bir <strong>avukat eşliğinde</strong> toplantıya katılabilirsiniz.</li>
<li style="margin-bottom: 8px;">Belirtilen tarihte gelememeniz durumunda <strong>en az 1 gün önce yazılı mazeret</strong> bildirmeniz gerekmektedir.</li>
</ul>
<p style="margin-bottom: 15px; padding: 10px; background-color: #ffebee; border-radius: 5px; border-left: 4px solid #f44336;"><strong>UYARI:</strong> Mazeretsiz olarak toplantıya katılım sağlanmaması halinde, Milli Eğitim Bakanlığı ilgili yönetmelik hükümleri gereğince disiplin işlemleri gıyabınızda gerçekleştirilecektir.</p>
<p style="margin-bottom: 5px;">Bilgilerinize önemle rica ederim.</p>
${signature}
<p style="margin-top: 40px; border-top: 2px solid #333; padding-top: 20px;"></p>
<p style="margin-bottom: 10px;"><strong>VELİ TEBLİĞ BÖLÜMÜ</strong></p>
<p style="margin-bottom: 10px;"><em>Bu çağrı yazısını tebliğ aldım, belirtilen tarih ve saatte toplantıya katılacağımı beyan ederim.</em></p>
<table style="width: 100%; border-collapse: collapse;">
<tr>
<td style="width: 50%; padding: 10px 0;"><strong>Veli Adı Soyadı:</strong> ____________________</td>
<td style="width: 50%; padding: 10px 0;"><strong>Tebliğ Tarihi:</strong> ____/____/________</td>
</tr>
<tr>
<td style="padding: 10px 0;"><strong>Telefon:</strong> ____________________</td>
<td style="padding: 10px 0;"><strong>Veli İmzası:</strong> ____________________</td>
</tr>
</table>`,

      "disiplin-karar": `${header}
<p style="text-align: center; margin-bottom: 20px;"><strong>DİSİPLİN KURULU KARAR TUTANAĞI</strong></p>
<table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
<tr>
<td style="width: 50%; padding: 5px 0;"><strong>Karar Tarihi:</strong> ${formattedToday}</td>
<td style="width: 50%; padding: 5px 0;"><strong>Karar No:</strong> ____________________</td>
</tr>
<tr>
<td style="padding: 5px 0;"><strong>Toplantı Saati:</strong> ____:____</td>
<td style="padding: 5px 0;"><strong>Toplantı Yeri:</strong> Okul Müdürlüğü</td>
</tr>
</table>
<p style="margin-bottom: 10px; border-bottom: 1px solid #ccc; padding-bottom: 10px;"><strong>KURUL ÜYELERİ</strong></p>
<p style="margin-bottom: 15px; text-align: justify;">Okulumuz Disiplin Kurulu, aşağıda isimleri yazılı üyelerin katılımıyla ${formattedToday} tarihinde usulüne uygun olarak toplanmış ve gündemdeki disiplin konusunu görüşmüştür.</p>
<table style="width: 100%; border-collapse: collapse; margin-bottom: 15px; border: 1px solid #ddd;">
<tr style="background-color: #f5f5f5;">
<th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Sıra</th>
<th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Adı Soyadı</th>
<th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Görevi</th>
<th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Katılım</th>
</tr>
<tr>
<td style="padding: 10px; border: 1px solid #ddd;">1</td>
<td style="padding: 10px; border: 1px solid #ddd;">____________________</td>
<td style="padding: 10px; border: 1px solid #ddd;">Okul Müdürü (Başkan)</td>
<td style="padding: 10px; border: 1px solid #ddd; text-align: center;">☐ Katıldı</td>
</tr>
<tr style="background-color: #f9f9f9;">
<td style="padding: 10px; border: 1px solid #ddd;">2</td>
<td style="padding: 10px; border: 1px solid #ddd;">____________________</td>
<td style="padding: 10px; border: 1px solid #ddd;">Müdür Yardımcısı</td>
<td style="padding: 10px; border: 1px solid #ddd; text-align: center;">☐ Katıldı</td>
</tr>
<tr>
<td style="padding: 10px; border: 1px solid #ddd;">3</td>
<td style="padding: 10px; border: 1px solid #ddd;">____________________</td>
<td style="padding: 10px; border: 1px solid #ddd;">Sınıf Öğretmeni</td>
<td style="padding: 10px; border: 1px solid #ddd; text-align: center;">☐ Katıldı</td>
</tr>
<tr style="background-color: #f9f9f9;">
<td style="padding: 10px; border: 1px solid #ddd;">4</td>
<td style="padding: 10px; border: 1px solid #ddd;">____________________</td>
<td style="padding: 10px; border: 1px solid #ddd;">Öğretmen</td>
<td style="padding: 10px; border: 1px solid #ddd; text-align: center;">☐ Katıldı</td>
</tr>
<tr>
<td style="padding: 10px; border: 1px solid #ddd;">5</td>
<td style="padding: 10px; border: 1px solid #ddd;">____________________</td>
<td style="padding: 10px; border: 1px solid #ddd;">Rehber Öğretmen/PDR</td>
<td style="padding: 10px; border: 1px solid #ddd; text-align: center;">☐ Katıldı</td>
</tr>
</table>
<p style="margin-bottom: 10px; border-bottom: 1px solid #ccc; padding-bottom: 10px;"><strong>GÖRÜŞÜLEN KONU</strong></p>
<table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
<tr>
<td style="width: 30%; padding: 5px 0;"><strong>İlgili Öğrenci:</strong></td>
<td style="width: 70%; padding: 5px 0;">${studentName}</td>
</tr>
<tr>
<td style="padding: 5px 0;"><strong>Sınıfı/Şubesi:</strong></td>
<td style="padding: 5px 0;">${className}</td>
</tr>
<tr>
<td style="padding: 5px 0;"><strong>Olay Tarihi:</strong></td>
<td style="padding: 5px 0;">${eventDate}</td>
</tr>
<tr>
<td style="padding: 5px 0;"><strong>Olay Konusu:</strong></td>
<td style="padding: 5px 0;">${reason}</td>
</tr>
<tr>
<td style="padding: 5px 0;"><strong>Veli Katılımı:</strong></td>
<td style="padding: 5px 0;">☐ Katıldı &nbsp;&nbsp; ☐ Katılmadı (Mazeretli) &nbsp;&nbsp; ☐ Katılmadı (Mazeretsiz)</td>
</tr>
</table>
<p style="margin-bottom: 5px;"><strong>OLAY ÖZETİ:</strong></p>
<p style="margin-bottom: 10px; padding: 10px; background-color: #f5f5f5; border-radius: 5px;">________________________________________________________________________</p>
<p style="margin-bottom: 10px; padding: 10px; background-color: #f5f5f5; border-radius: 5px;">________________________________________________________________________</p>
<p style="margin-bottom: 10px; padding: 10px; background-color: #f5f5f5; border-radius: 5px;">________________________________________________________________________</p>
<p style="margin-bottom: 10px; border-bottom: 1px solid #ccc; padding-bottom: 10px;"><strong>DEĞERLENDİRME VE İNCELEME</strong></p>
<p style="margin-bottom: 15px; text-align: justify;">Kurul tarafından; öğrenci ifadesi, tanık ifadeleri, toplanan deliller, öğrencinin özlük dosyası, önceki disiplin kayıtları ve rehberlik servisi görüşü incelenmiştir. İlgili mevzuat hükümleri (MEB Okul Öncesi Eğitim ve İlköğretim Kurumları Yönetmeliği) çerçevesinde değerlendirme yapılmıştır.</p>
<p style="margin-bottom: 5px;"><strong>Veli/Öğrenci Savunması Özeti:</strong></p>
<p style="margin-bottom: 15px; padding: 10px; background-color: #f5f5f5; border-radius: 5px;">________________________________________________________________________</p>
<p style="margin-bottom: 10px; border-bottom: 1px solid #ccc; padding-bottom: 10px;"><strong>KARAR</strong></p>
<p style="margin-bottom: 15px;">Yapılan müzakere ve değerlendirmeler sonucunda;</p>
<table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
<tr>
<td style="padding: 8px; vertical-align: top;">☐</td>
<td style="padding: 8px;">Öğrenciye <strong>SÖZLÜ UYARI</strong> verilmesine,</td>
</tr>
<tr style="background-color: #f9f9f9;">
<td style="padding: 8px; vertical-align: top;">☐</td>
<td style="padding: 8px;">Öğrenciye <strong>ÖĞRENCİ SÖZLEŞMESİ İMZALATILMASINA</strong>,</td>
</tr>
<tr>
<td style="padding: 8px; vertical-align: top;">☐</td>
<td style="padding: 8px;">Öğrenciye <strong>KINAMA</strong> cezası verilmesine,</td>
</tr>
<tr style="background-color: #f9f9f9;">
<td style="padding: 8px; vertical-align: top;">☐</td>
<td style="padding: 8px;">Öğrencinin <strong>OKUL DEĞİŞİKLİĞİ</strong> talebinde bulunulmasına,</td>
</tr>
<tr>
<td style="padding: 8px; vertical-align: top;">☐</td>
<td style="padding: 8px;">Ceza verilmesine <strong>YER OLMADIĞINA</strong>,</td>
</tr>
</table>
<p style="margin-bottom: 15px;"><strong>☐ Oybirliği / ☐ Oyçokluğu</strong> ile karar verilmiştir.</p>
<p style="margin-bottom: 5px;"><strong>Karşı Oy Gerekçesi (varsa):</strong> ________________________________________________</p>
<p style="margin-bottom: 20px;"></p>
<p style="margin-bottom: 10px; border-bottom: 1px solid #ccc; padding-bottom: 10px;"><strong>KURUL ÜYELERİ İMZALARI</strong></p>
<table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
<tr>
<td style="width: 33%; padding: 15px; text-align: center; vertical-align: top; border: 1px solid #ddd;">
<p style="margin-bottom: 5px;"><strong>1. ____________________</strong></p>
<p style="margin-bottom: 20px; font-size: 11px;">Okul Müdürü (Başkan)</p>
<p>İmza: ____________</p>
</td>
<td style="width: 33%; padding: 15px; text-align: center; vertical-align: top; border: 1px solid #ddd;">
<p style="margin-bottom: 5px;"><strong>2. ____________________</strong></p>
<p style="margin-bottom: 20px; font-size: 11px;">Müdür Yardımcısı</p>
<p>İmza: ____________</p>
</td>
<td style="width: 33%; padding: 15px; text-align: center; vertical-align: top; border: 1px solid #ddd;">
<p style="margin-bottom: 5px;"><strong>3. ____________________</strong></p>
<p style="margin-bottom: 20px; font-size: 11px;">Sınıf Öğretmeni</p>
<p>İmza: ____________</p>
</td>
</tr>
<tr>
<td style="padding: 15px; text-align: center; vertical-align: top; border: 1px solid #ddd;">
<p style="margin-bottom: 5px;"><strong>4. ____________________</strong></p>
<p style="margin-bottom: 20px; font-size: 11px;">Öğretmen</p>
<p>İmza: ____________</p>
</td>
<td style="padding: 15px; text-align: center; vertical-align: top; border: 1px solid #ddd;">
<p style="margin-bottom: 5px;"><strong>5. ____________________</strong></p>
<p style="margin-bottom: 20px; font-size: 11px;">Rehber Öğretmen/PDR</p>
<p>İmza: ____________</p>
</td>
<td style="padding: 15px; text-align: center; vertical-align: top; border: 1px solid #ddd;"></td>
</tr>
</table>`,

      "uyari-belgesi": `${header}
<p style="text-align: center; margin-bottom: 20px;"><strong>ÖĞRENCİ UYARI BELGESİ</strong></p>
<table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
<tr>
<td style="width: 50%; padding: 5px 0;"><strong>Tarih:</strong> ${formattedToday}</td>
<td style="width: 50%; padding: 5px 0;"><strong>Sayı:</strong> ____________________</td>
</tr>
</table>
<p style="margin-bottom: 10px; border-bottom: 1px solid #ccc; padding-bottom: 10px;"><strong>ÖĞRENCİ BİLGİLERİ</strong></p>
<table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
<tr>
<td style="width: 50%; padding: 5px 0;"><strong>Adı Soyadı:</strong> ${studentName}</td>
<td style="width: 50%; padding: 5px 0;"><strong>Sınıfı/Şubesi:</strong> ${className}</td>
</tr>
<tr>
<td style="padding: 5px 0;"><strong>Okul Numarası:</strong> ____________________</td>
<td style="padding: 5px 0;"><strong>Veli Telefonu:</strong> ____________________</td>
</tr>
</table>
<p style="margin-bottom: 10px; border-bottom: 1px solid #ccc; padding-bottom: 10px;"><strong>UYARI KONUSU OLAY</strong></p>
<table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
<tr>
<td style="width: 30%; padding: 5px 0;"><strong>Olay Tarihi:</strong></td>
<td style="width: 70%; padding: 5px 0;">${eventDate}</td>
</tr>
<tr>
<td style="padding: 5px 0;"><strong>Olay Yeri:</strong></td>
<td style="padding: 5px 0;">____________________</td>
</tr>
<tr>
<td style="padding: 5px 0;"><strong>Uyarı Konusu:</strong></td>
<td style="padding: 5px 0;">${reason}</td>
</tr>
</table>
<p style="margin-bottom: 5px;"><strong>OLAY AÇIKLAMASI:</strong></p>
<p style="margin-bottom: 10px; padding: 10px; background-color: #f5f5f5; border-radius: 5px;">________________________________________________________________________</p>
<p style="margin-bottom: 10px; padding: 10px; background-color: #f5f5f5; border-radius: 5px;">________________________________________________________________________</p>
<p style="margin-bottom: 10px; padding: 10px; background-color: #f5f5f5; border-radius: 5px;">________________________________________________________________________</p>
<p style="margin-bottom: 10px; border-bottom: 1px solid #ccc; padding-bottom: 10px;"><strong>UYARI VE BEKLENTİLER</strong></p>
<p style="margin-bottom: 15px; padding: 10px; background-color: #fff3cd; border-radius: 5px; border-left: 4px solid #ffc107; text-align: justify;">Yukarıda belirtilen davranışın okul kurallarına ve eğitim ortamının düzenine aykırı olduğu öğrenciye açıklanmış ve sözlü olarak uyarılmıştır. Benzer davranışların tekrarlanması halinde:</p>
<ul style="margin-bottom: 15px; padding-left: 20px;">
<li style="margin-bottom: 8px;">Velinin okula çağrılacağı,</li>
<li style="margin-bottom: 8px;">Resmi disiplin işlemi başlatılacağı,</li>
<li style="margin-bottom: 8px;">Disiplin kuruluna sevk edilebileceği,</li>
<li style="margin-bottom: 8px;">Bu uyarının öğrenci dosyasına işleneceği</li>
</ul>
<p style="margin-bottom: 15px;">bildirilmiştir.</p>
<p style="margin-bottom: 10px; border-bottom: 1px solid #ccc; padding-bottom: 10px;"><strong>ÖĞRENCİDEN BEKLENEN DAVRANIŞLAR</strong></p>
<ul style="margin-bottom: 15px; padding-left: 20px;">
<li style="margin-bottom: 8px;">Okul kurallarına ve sınıf düzenine uyması,</li>
<li style="margin-bottom: 8px;">Öğretmen ve arkadaşlarına saygılı davranması,</li>
<li style="margin-bottom: 8px;">Derslerine ve sorumluluklarına özen göstermesi,</li>
<li style="margin-bottom: 8px;">Benzer olumsuz davranışları tekrarlamaması</li>
</ul>
<p style="margin-bottom: 15px;">beklenmektedir.</p>
<p style="margin-top: 30px; border-top: 2px solid #333; padding-top: 20px;"></p>
<table style="width: 100%; border-collapse: collapse;">
<tr>
<td style="width: 33%; padding: 15px; text-align: center; vertical-align: top;">
<p style="margin-bottom: 5px;"><strong>ÖĞRENCİ</strong></p>
<p style="margin-bottom: 20px;">${studentName}</p>
<p style="margin-bottom: 5px;">Tarih: ____/____/____</p>
<p>İmza: ____________</p>
</td>
<td style="width: 33%; padding: 15px; text-align: center; vertical-align: top; border-left: 1px solid #ccc;">
<p style="margin-bottom: 5px;"><strong>SINIF ÖĞRETMENİ</strong></p>
<p style="margin-bottom: 20px;">____________________</p>
<p style="margin-bottom: 5px;">Tarih: ____/____/____</p>
<p>İmza: ____________</p>
</td>
<td style="width: 33%; padding: 15px; text-align: center; vertical-align: top; border-left: 1px solid #ccc;">
<p style="margin-bottom: 5px;"><strong>OKUL MÜDÜRÜ</strong></p>
<p style="margin-bottom: 20px;">____________________</p>
<p style="margin-bottom: 5px;">Tarih: ____/____/____</p>
<p>İmza / Mühür</p>
</td>
</tr>
</table>
<p style="margin-top: 30px; border-top: 2px solid #333; padding-top: 20px;"></p>
<p style="margin-bottom: 10px;"><strong>VELİ BİLGİLENDİRME BÖLÜMÜ</strong></p>
<p style="margin-bottom: 10px;"><em>Yukarıdaki uyarı belgesini tebliğ aldım, içeriği okudum ve anladım.</em></p>
<table style="width: 100%; border-collapse: collapse;">
<tr>
<td style="width: 50%; padding: 10px 0;"><strong>Veli Adı Soyadı:</strong> ____________________</td>
<td style="width: 50%; padding: 10px 0;"><strong>Yakınlık Derecesi:</strong> ____________________</td>
</tr>
<tr>
<td style="padding: 10px 0;"><strong>Tebliğ Tarihi:</strong> ____/____/________</td>
<td style="padding: 10px 0;"><strong>Veli İmzası:</strong> ____________________</td>
</tr>
</table>`,

      // CEZA BELGELERİ
      "sozlu-uyari": `${header}
<p style="text-align: center; margin-bottom: 20px;"><strong>SÖZLÜ UYARI CEZASI BELGESİ</strong></p>
<table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
<tr>
<td style="width: 50%; padding: 5px 0;"><strong>Belge Tarihi:</strong> ${formattedToday}</td>
<td style="width: 50%; padding: 5px 0;"><strong>Sayı:</strong> ____________________</td>
</tr>
</table>
<p style="margin-bottom: 10px; border-bottom: 1px solid #ccc; padding-bottom: 10px;"><strong>ÖĞRENCİ BİLGİLERİ</strong></p>
<table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
<tr>
<td style="width: 50%; padding: 5px 0;"><strong>Adı Soyadı:</strong> ${studentName}</td>
<td style="width: 50%; padding: 5px 0;"><strong>Sınıfı/Şubesi:</strong> ${className}</td>
</tr>
<tr>
<td style="padding: 5px 0;"><strong>Okul Numarası:</strong> ____________________</td>
<td style="padding: 5px 0;"><strong>T.C. Kimlik No:</strong> ____________________</td>
</tr>
</table>
<p style="margin-bottom: 10px; border-bottom: 1px solid #ccc; padding-bottom: 10px;"><strong>CEZAYA KONU OLAY</strong></p>
<table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
<tr>
<td style="width: 30%; padding: 5px 0;"><strong>Olay Tarihi:</strong></td>
<td style="width: 70%; padding: 5px 0;">${eventDate}</td>
</tr>
<tr>
<td style="padding: 5px 0;"><strong>Olay Konusu:</strong></td>
<td style="padding: 5px 0;">${reason}</td>
</tr>
</table>
<p style="margin-bottom: 15px; padding: 15px; background-color: #fff3cd; border-radius: 5px; border: 2px solid #ffc107; text-align: center;">
<strong>VERİLEN CEZA: SÖZLÜ UYARI</strong>
</p>
<p style="margin-bottom: 10px; border-bottom: 1px solid #ccc; padding-bottom: 10px;"><strong>CEZA GEREKÇESİ</strong></p>
<p style="margin-bottom: 15px; text-align: justify;">Yukarıda kimlik bilgileri yer alan öğrencimiz, belirtilen tarihte gerçekleştirdiği "<strong>${reason}</strong>" eylemi nedeniyle değerlendirilmiştir. Öğrencinin bu davranışı; okul disiplin yönetmeliği, sınıf kuralları ve eğitim ortamının düzeni açısından uygunsuz bulunmuştur.</p>
<p style="margin-bottom: 15px; text-align: justify;">Yapılan değerlendirme sonucunda, öğrencinin yaşı, gelişim düzeyi, olayın mahiyeti ve öğrencinin daha önce benzer bir disiplin cezası almamış olması göz önünde bulundurularak <strong>SÖZLÜ UYARI</strong> cezası verilmesine karar verilmiştir.</p>
<p style="margin-bottom: 10px; border-bottom: 1px solid #ccc; padding-bottom: 10px;"><strong>YASAL DAYANAK</strong></p>
<p style="margin-bottom: 15px;">Milli Eğitim Bakanlığı Okul Öncesi Eğitim ve İlköğretim Kurumları Yönetmeliği ilgili maddeleri</p>
<p style="margin-bottom: 10px; border-bottom: 1px solid #ccc; padding-bottom: 10px;"><strong>UYARI VE BİLGİLENDİRME</strong></p>
<ul style="margin-bottom: 15px; padding-left: 20px;">
<li style="margin-bottom: 8px;">Bu ceza öğrencinin disiplin dosyasına işlenmiştir.</li>
<li style="margin-bottom: 8px;">Benzer davranışların tekrarı halinde daha üst düzey disiplin cezaları uygulanacaktır.</li>
<li style="margin-bottom: 8px;">Öğrencinin bundan sonraki süreçte okul kurallarına uyması beklenmektedir.</li>
<li style="margin-bottom: 8px;">Bu belge veliye tebliğ edilmek üzere düzenlenmiştir.</li>
</ul>
<p style="margin-top: 30px; border-top: 2px solid #333; padding-top: 20px;"></p>
<table style="width: 100%; border-collapse: collapse;">
<tr>
<td style="width: 50%; padding: 15px; text-align: center; vertical-align: top;">
<p style="margin-bottom: 5px;"><strong>ÖĞRENCİ</strong></p>
<p style="margin-bottom: 20px;">${studentName}</p>
<p style="margin-bottom: 5px;">Tarih: ____/____/____</p>
<p>İmza: ____________</p>
</td>
<td style="width: 50%; padding: 15px; text-align: center; vertical-align: top; border-left: 1px solid #ccc;">
<p style="margin-bottom: 5px;"><strong>OKUL MÜDÜRÜ</strong></p>
<p style="margin-bottom: 20px;">____________________</p>
<p style="margin-bottom: 5px;">Tarih: ____/____/____</p>
<p>İmza / Mühür</p>
</td>
</tr>
</table>
<p style="margin-top: 30px; border-top: 2px solid #333; padding-top: 20px;"></p>
<p style="margin-bottom: 10px;"><strong>VELİ TEBLİĞ BÖLÜMÜ</strong></p>
<p style="margin-bottom: 10px;"><em>Öğrencime verilen sözlü uyarı cezasını tebliğ aldım.</em></p>
<table style="width: 100%; border-collapse: collapse;">
<tr>
<td style="width: 50%; padding: 10px 0;"><strong>Veli Adı Soyadı:</strong> ____________________</td>
<td style="width: 50%; padding: 10px 0;"><strong>Yakınlık Derecesi:</strong> ____________________</td>
</tr>
<tr>
<td style="padding: 10px 0;"><strong>Tebliğ Tarihi:</strong> ____/____/________</td>
<td style="padding: 10px 0;"><strong>Veli İmzası:</strong> ____________________</td>
</tr>
</table>`,

      "ogrenci-sozlesmesi": `${header}
<p style="text-align: center; margin-bottom: 20px;"><strong>ÖĞRENCİ DAVRANIŞ SÖZLEŞMESİ</strong></p>
<table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
<tr>
<td style="width: 50%; padding: 5px 0;"><strong>Sözleşme Tarihi:</strong> ${formattedToday}</td>
<td style="width: 50%; padding: 5px 0;"><strong>Sayı:</strong> ____________________</td>
</tr>
</table>
<p style="margin-bottom: 10px; border-bottom: 1px solid #ccc; padding-bottom: 10px;"><strong>ÖĞRENCİ BİLGİLERİ</strong></p>
<table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
<tr>
<td style="width: 50%; padding: 5px 0;"><strong>Adı Soyadı:</strong> ${studentName}</td>
<td style="width: 50%; padding: 5px 0;"><strong>Sınıfı/Şubesi:</strong> ${className}</td>
</tr>
<tr>
<td style="padding: 5px 0;"><strong>Okul Numarası:</strong> ____________________</td>
<td style="padding: 5px 0;"><strong>Doğum Tarihi:</strong> ____/____/________</td>
</tr>
</table>
<p style="margin-bottom: 10px; border-bottom: 1px solid #ccc; padding-bottom: 10px;"><strong>SÖZLEŞMEYE KONU OLAY</strong></p>
<table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
<tr>
<td style="width: 30%; padding: 5px 0;"><strong>Olay Tarihi:</strong></td>
<td style="width: 70%; padding: 5px 0;">${eventDate}</td>
</tr>
<tr>
<td style="padding: 5px 0;"><strong>Olay Konusu:</strong></td>
<td style="padding: 5px 0;">${reason}</td>
</tr>
</table>
<p style="margin-bottom: 15px; padding: 15px; background-color: #e3f2fd; border-radius: 5px; border: 2px solid #2196f3; text-align: center;">
<strong>VERİLEN CEZA: ÖĞRENCİ SÖZLEŞMESİ İMZALAMA</strong>
</p>
<p style="margin-bottom: 20px; text-align: center; font-size: 14px;"><strong>TAAHHÜTNAME</strong></p>
<p style="margin-bottom: 15px; text-align: justify;">Ben, <strong>${studentName}</strong>, ${className} sınıfı öğrencisi olarak, ${eventDate} tarihinde gerçekleştirdiğim "<strong>${reason}</strong>" davranışımın yanlış olduğunu anladım ve bundan sonra aşağıdaki kurallara uyacağımı taahhüt ediyorum:</p>
<p style="margin-bottom: 10px; border-bottom: 1px solid #ccc; padding-bottom: 10px;"><strong>TAAHHÜT ETTİĞİM KURALLAR</strong></p>
<table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
<tr>
<td style="padding: 10px; vertical-align: top; border-bottom: 1px solid #eee;">☑️</td>
<td style="padding: 10px; border-bottom: 1px solid #eee;">Okul kurallarına ve sınıf düzenine eksiksiz uyacağıma,</td>
</tr>
<tr>
<td style="padding: 10px; vertical-align: top; border-bottom: 1px solid #eee;">☑️</td>
<td style="padding: 10px; border-bottom: 1px solid #eee;">Öğretmenlerime, okul personeline ve idarecilere saygılı davranacağıma,</td>
</tr>
<tr>
<td style="padding: 10px; vertical-align: top; border-bottom: 1px solid #eee;">☑️</td>
<td style="padding: 10px; border-bottom: 1px solid #eee;">Arkadaşlarıma karşı hoşgörülü, anlayışlı ve saygılı olacağıma,</td>
</tr>
<tr>
<td style="padding: 10px; vertical-align: top; border-bottom: 1px solid #eee;">☑️</td>
<td style="padding: 10px; border-bottom: 1px solid #eee;">Okulun fiziki yapısına, eşya ve malzemelerine zarar vermeyeceğime,</td>
</tr>
<tr>
<td style="padding: 10px; vertical-align: top; border-bottom: 1px solid #eee;">☑️</td>
<td style="padding: 10px; border-bottom: 1px solid #eee;">Derslere düzenli katılacağıma ve verilen görevleri yapacağıma,</td>
</tr>
<tr>
<td style="padding: 10px; vertical-align: top; border-bottom: 1px solid #eee;">☑️</td>
<td style="padding: 10px; border-bottom: 1px solid #eee;">Şiddet, zorbalık ve her türlü olumsuz davranıştan uzak duracağıma,</td>
</tr>
<tr>
<td style="padding: 10px; vertical-align: top; border-bottom: 1px solid #eee;">☑️</td>
<td style="padding: 10px; border-bottom: 1px solid #eee;">Benzer olumsuz davranışları bir daha tekrarlamayacağıma,</td>
</tr>
<tr>
<td style="padding: 10px; vertical-align: top;">☑️</td>
<td style="padding: 10px;">Sorunlarımı şiddet yerine diyalog yoluyla çözeceğime,</td>
</tr>
</table>
<p style="margin-bottom: 15px; text-align: justify;"><strong>söz veriyor</strong> ve bu taahhütlere uymam halinde hakkımda disiplin soruşturması başlatılacağını, daha ağır yaptırımlarla karşılaşacağımı biliyorum.</p>
<p style="margin-bottom: 15px; padding: 10px; background-color: #ffebee; border-radius: 5px; border-left: 4px solid #f44336;"><strong>NOT:</strong> Bu sözleşmenin ihlali halinde Kınama veya Okul Değişikliği cezası verilebilir.</p>
<p style="margin-top: 30px; border-top: 2px solid #333; padding-top: 20px;"></p>
<table style="width: 100%; border-collapse: collapse;">
<tr>
<td style="width: 33%; padding: 15px; text-align: center; vertical-align: top;">
<p style="margin-bottom: 5px;"><strong>ÖĞRENCİ</strong></p>
<p style="margin-bottom: 20px;">${studentName}</p>
<p style="margin-bottom: 5px;">Tarih: ____/____/____</p>
<p>İmza: ____________</p>
</td>
<td style="width: 33%; padding: 15px; text-align: center; vertical-align: top; border-left: 1px solid #ccc;">
<p style="margin-bottom: 5px;"><strong>VELİ</strong></p>
<p style="margin-bottom: 20px;">____________________</p>
<p style="margin-bottom: 5px;">Tarih: ____/____/____</p>
<p>İmza: ____________</p>
</td>
<td style="width: 33%; padding: 15px; text-align: center; vertical-align: top; border-left: 1px solid #ccc;">
<p style="margin-bottom: 5px;"><strong>OKUL MÜDÜRÜ</strong></p>
<p style="margin-bottom: 20px;">____________________</p>
<p style="margin-bottom: 5px;">Tarih: ____/____/____</p>
<p>İmza / Mühür</p>
</td>
</tr>
</table>
<p style="margin-top: 20px;"></p>
<p style="margin-bottom: 5px;"><strong>Rehber Öğretmen Görüşü:</strong></p>
<p style="padding: 10px; background-color: #f5f5f5; border-radius: 5px;">________________________________________________________________________</p>
<p style="margin-top: 10px; text-align: right;"><strong>Rehber Öğretmen:</strong> ____________________ &nbsp;&nbsp; <strong>İmza:</strong> ____________</p>`,

      "kinama-belgesi": `${header}
<p style="text-align: center; margin-bottom: 20px;"><strong>KINAMA CEZASI BELGESİ</strong></p>
<table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
<tr>
<td style="width: 50%; padding: 5px 0;"><strong>Belge Tarihi:</strong> ${formattedToday}</td>
<td style="width: 50%; padding: 5px 0;"><strong>Sayı:</strong> ____________________</td>
</tr>
<tr>
<td style="padding: 5px 0;"><strong>Karar No:</strong> ____________________</td>
<td style="padding: 5px 0;"><strong>Karar Tarihi:</strong> ____/____/________</td>
</tr>
</table>
<p style="margin-bottom: 10px; border-bottom: 1px solid #ccc; padding-bottom: 10px;"><strong>ÖĞRENCİ BİLGİLERİ</strong></p>
<table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
<tr>
<td style="width: 50%; padding: 5px 0;"><strong>Adı Soyadı:</strong> ${studentName}</td>
<td style="width: 50%; padding: 5px 0;"><strong>Sınıfı/Şubesi:</strong> ${className}</td>
</tr>
<tr>
<td style="padding: 5px 0;"><strong>Okul Numarası:</strong> ____________________</td>
<td style="padding: 5px 0;"><strong>T.C. Kimlik No:</strong> ____________________</td>
</tr>
<tr>
<td style="padding: 5px 0;"><strong>Veli Adı:</strong> ____________________</td>
<td style="padding: 5px 0;"><strong>Veli Telefonu:</strong> ____________________</td>
</tr>
</table>
<p style="margin-bottom: 10px; border-bottom: 1px solid #ccc; padding-bottom: 10px;"><strong>CEZAYA KONU OLAY</strong></p>
<table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
<tr>
<td style="width: 30%; padding: 5px 0;"><strong>Olay Tarihi:</strong></td>
<td style="width: 70%; padding: 5px 0;">${eventDate}</td>
</tr>
<tr>
<td style="padding: 5px 0;"><strong>Olay Yeri:</strong></td>
<td style="padding: 5px 0;">____________________</td>
</tr>
<tr>
<td style="padding: 5px 0;"><strong>Olay Konusu:</strong></td>
<td style="padding: 5px 0;">${reason}</td>
</tr>
</table>
<p style="margin-bottom: 15px; padding: 15px; background-color: #ffebee; border-radius: 5px; border: 2px solid #f44336; text-align: center;">
<strong>VERİLEN CEZA: KINAMA</strong>
</p>
<p style="margin-bottom: 10px; border-bottom: 1px solid #ccc; padding-bottom: 10px;"><strong>OLAY ÖZETİ VE DEĞERLENDİRME</strong></p>
<p style="margin-bottom: 15px; text-align: justify;">Yukarıda kimlik bilgileri yer alan öğrencimiz, ${eventDate} tarihinde gerçekleştirdiği "<strong>${reason}</strong>" eylemi nedeniyle disiplin soruşturmasına tabi tutulmuştur.</p>
<p style="margin-bottom: 5px;"><strong>Olayın Detaylı Açıklaması:</strong></p>
<p style="margin-bottom: 10px; padding: 10px; background-color: #f5f5f5; border-radius: 5px;">________________________________________________________________________</p>
<p style="margin-bottom: 10px; padding: 10px; background-color: #f5f5f5; border-radius: 5px;">________________________________________________________________________</p>
<p style="margin-bottom: 15px; text-align: justify;">Yapılan soruşturma kapsamında öğrenci ifadesi, tanık ifadeleri, varsa deliller ve öğrencinin özlük dosyası incelenmiştir. Disiplin Kurulu tarafından yapılan değerlendirme sonucunda, olayın ciddiyeti ve öğrencinin davranışlarının eğitim ortamına verdiği zarar göz önünde bulundurularak <strong>KINAMA</strong> cezası verilmesine karar verilmiştir.</p>
<p style="margin-bottom: 10px; border-bottom: 1px solid #ccc; padding-bottom: 10px;"><strong>YASAL DAYANAK</strong></p>
<p style="margin-bottom: 15px;">Bu karar; Milli Eğitim Bakanlığı Okul Öncesi Eğitim ve İlköğretim Kurumları Yönetmeliği'nin ilgili maddeleri uyarınca verilmiştir.</p>
<p style="margin-bottom: 10px; border-bottom: 1px solid #ccc; padding-bottom: 10px;"><strong>CEZANIN SONUÇLARI</strong></p>
<ul style="margin-bottom: 15px; padding-left: 20px;">
<li style="margin-bottom: 8px;">Bu ceza öğrencinin disiplin dosyasına kalıcı olarak işlenmiştir.</li>
<li style="margin-bottom: 8px;">Kınama cezası, öğrencinin okul karnesi ve nakil belgelerinde belirtilecektir.</li>
<li style="margin-bottom: 8px;">Benzer davranışların tekrarı halinde "Okul Değişikliği Talebi" cezası verilebilir.</li>
<li style="margin-bottom: 8px;">Ceza süresince öğrencinin davranışları yakından takip edilecektir.</li>
</ul>
<p style="margin-bottom: 15px; padding: 10px; background-color: #e3f2fd; border-radius: 5px; border-left: 4px solid #2196f3;"><strong>İTİRAZ HAKKI:</strong> Bu karara karşı tebliğ tarihinden itibaren <strong>5 (beş) iş günü</strong> içerisinde İlçe Milli Eğitim Müdürlüğü'ne yazılı olarak itiraz edilebilir. İtiraz, cezanın uygulanmasını durdurmaz.</p>
${signature}
<p style="margin-top: 40px; border-top: 2px solid #333; padding-top: 20px;"></p>
<p style="margin-bottom: 10px;"><strong>TEBLİĞ BİLGİLERİ</strong></p>
<p style="margin-bottom: 10px;"><em>Yukarıda belirtilen kınama cezasını tebliğ aldım, içeriği okudum ve anladım.</em></p>
<table style="width: 100%; border-collapse: collapse;">
<tr>
<td style="width: 50%; padding: 15px; text-align: center; vertical-align: top; border: 1px solid #ddd;">
<p style="margin-bottom: 5px;"><strong>ÖĞRENCİ</strong></p>
<p style="margin-bottom: 20px;">${studentName}</p>
<p style="margin-bottom: 5px;">Tebliğ Tarihi: ____/____/____</p>
<p>İmza: ____________</p>
</td>
<td style="width: 50%; padding: 15px; text-align: center; vertical-align: top; border: 1px solid #ddd;">
<p style="margin-bottom: 5px;"><strong>VELİ</strong></p>
<p style="margin-bottom: 20px;">____________________</p>
<p style="margin-bottom: 5px;">Tebliğ Tarihi: ____/____/____</p>
<p>İmza: ____________</p>
</td>
</tr>
</table>`,

      "okul-degisikligi": `${header}
<p style="text-align: center; margin-bottom: 20px;"><strong>OKUL DEĞİŞİKLİĞİ TALEBİ BELGESİ</strong></p>
<table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
<tr>
<td style="width: 50%; padding: 5px 0;"><strong>Belge Tarihi:</strong> ${formattedToday}</td>
<td style="width: 50%; padding: 5px 0;"><strong>Sayı:</strong> ____________________</td>
</tr>
<tr>
<td style="padding: 5px 0;"><strong>Karar No:</strong> ____________________</td>
<td style="padding: 5px 0;"><strong>Karar Tarihi:</strong> ____/____/________</td>
</tr>
</table>
<p style="margin-bottom: 10px; border-bottom: 1px solid #ccc; padding-bottom: 10px;"><strong>ÖĞRENCİ BİLGİLERİ</strong></p>
<table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
<tr>
<td style="width: 50%; padding: 5px 0;"><strong>Adı Soyadı:</strong> ${studentName}</td>
<td style="width: 50%; padding: 5px 0;"><strong>Sınıfı/Şubesi:</strong> ${className}</td>
</tr>
<tr>
<td style="padding: 5px 0;"><strong>Okul Numarası:</strong> ____________________</td>
<td style="padding: 5px 0;"><strong>T.C. Kimlik No:</strong> ____________________</td>
</tr>
<tr>
<td style="padding: 5px 0;"><strong>Veli Adı:</strong> ____________________</td>
<td style="padding: 5px 0;"><strong>Veli Telefonu:</strong> ____________________</td>
</tr>
<tr>
<td colspan="2" style="padding: 5px 0;"><strong>İkametgah Adresi:</strong> ________________________________________________________________________</td>
</tr>
</table>
<p style="margin-bottom: 10px; border-bottom: 1px solid #ccc; padding-bottom: 10px;"><strong>CEZAYA KONU OLAY(LAR)</strong></p>
<table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
<tr>
<td style="width: 30%; padding: 5px 0;"><strong>Olay Tarihi:</strong></td>
<td style="width: 70%; padding: 5px 0;">${eventDate}</td>
</tr>
<tr>
<td style="padding: 5px 0;"><strong>Olay Konusu:</strong></td>
<td style="padding: 5px 0;">${reason}</td>
</tr>
</table>
<p style="margin-bottom: 15px; padding: 15px; background-color: #37474f; color: white; border-radius: 5px; text-align: center;">
<strong>VERİLEN CEZA: OKUL DEĞİŞİKLİĞİ TALEBİ</strong>
</p>
<p style="margin-bottom: 10px; border-bottom: 1px solid #ccc; padding-bottom: 10px;"><strong>OLAY ÖZETİ VE SORUŞTURMA SÜRECİ</strong></p>
<p style="margin-bottom: 15px; text-align: justify;">Yukarıda kimlik bilgileri yer alan öğrencimiz hakkında, ${eventDate} tarihinde gerçekleştirdiği "<strong>${reason}</strong>" eylemi ve/veya önceki disiplin ihlalleri nedeniyle kapsamlı bir disiplin soruşturması yürütülmüştür.</p>
<p style="margin-bottom: 5px;"><strong>Olayların Kronolojik Özeti:</strong></p>
<p style="margin-bottom: 10px; padding: 10px; background-color: #f5f5f5; border-radius: 5px;">________________________________________________________________________</p>
<p style="margin-bottom: 10px; padding: 10px; background-color: #f5f5f5; border-radius: 5px;">________________________________________________________________________</p>
<p style="margin-bottom: 10px; padding: 10px; background-color: #f5f5f5; border-radius: 5px;">________________________________________________________________________</p>
<p style="margin-bottom: 10px; border-bottom: 1px solid #ccc; padding-bottom: 10px;"><strong>ÖNCEKİ DİSİPLİN KAYITLARI</strong></p>
<table style="width: 100%; border-collapse: collapse; margin-bottom: 15px; border: 1px solid #ddd;">
<tr style="background-color: #f5f5f5;">
<th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Tarih</th>
<th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Olay</th>
<th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Verilen Ceza</th>
</tr>
<tr>
<td style="padding: 10px; border: 1px solid #ddd;">____/____/____</td>
<td style="padding: 10px; border: 1px solid #ddd;">____________________</td>
<td style="padding: 10px; border: 1px solid #ddd;">____________________</td>
</tr>
<tr>
<td style="padding: 10px; border: 1px solid #ddd;">____/____/____</td>
<td style="padding: 10px; border: 1px solid #ddd;">____________________</td>
<td style="padding: 10px; border: 1px solid #ddd;">____________________</td>
</tr>
</table>
<p style="margin-bottom: 10px; border-bottom: 1px solid #ccc; padding-bottom: 10px;"><strong>DEĞERLENDİRME VE KARAR GEREKÇESİ</strong></p>
<p style="margin-bottom: 15px; text-align: justify;">Disiplin Kurulu tarafından yapılan kapsamlı değerlendirme sonucunda:</p>
<ul style="margin-bottom: 15px; padding-left: 20px;">
<li style="margin-bottom: 8px;">Öğrencinin tekrarlayan disiplin ihlalleri,</li>
<li style="margin-bottom: 8px;">Daha önce uygulanan tedbirlerin etkisiz kalması,</li>
<li style="margin-bottom: 8px;">Olayların okul ortamında diğer öğrenciler üzerindeki olumsuz etkisi,</li>
<li style="margin-bottom: 8px;">Eğitim-öğretim faaliyetlerinin ciddi şekilde aksatılması,</li>
<li style="margin-bottom: 8px;">Öğrencinin mevcut okul ortamında eğitimine sağlıklı devam edemeyeceği kanaati</li>
</ul>
<p style="margin-bottom: 15px; text-align: justify;">göz önünde bulundurularak, öğrencinin eğitim hayatına farklı bir eğitim kurumunda devam etmesinin hem kendisi hem de okul ortamı için daha uygun olacağına karar verilmiştir.</p>
<p style="margin-bottom: 10px; border-bottom: 1px solid #ccc; padding-bottom: 10px;"><strong>YASAL DAYANAK</strong></p>
<p style="margin-bottom: 15px;">Bu karar; Milli Eğitim Bakanlığı Okul Öncesi Eğitim ve İlköğretim Kurumları Yönetmeliği'nin ilgili maddeleri uyarınca verilmiştir.</p>
<p style="margin-bottom: 10px; border-bottom: 1px solid #ccc; padding-bottom: 10px;"><strong>YAPILACAK İŞLEMLER</strong></p>
<ul style="margin-bottom: 15px; padding-left: 20px;">
<li style="margin-bottom: 8px;">Bu karar, İlçe Milli Eğitim Müdürlüğü'ne bildirilecektir.</li>
<li style="margin-bottom: 8px;">Öğrencinin nakil işlemleri İlçe MEM koordinasyonunda gerçekleştirilecektir.</li>
<li style="margin-bottom: 8px;">Yeni okul, öğrencinin ikametine uygun olarak belirlenecektir.</li>
<li style="margin-bottom: 8px;">Nakil gerçekleşene kadar öğrenci eğitimine mevcut okulda devam edecektir.</li>
</ul>
<p style="margin-bottom: 15px; padding: 10px; background-color: #e3f2fd; border-radius: 5px; border-left: 4px solid #2196f3;"><strong>İTİRAZ HAKKI:</strong> Bu karara karşı tebliğ tarihinden itibaren <strong>5 (beş) iş günü</strong> içerisinde İl Milli Eğitim Müdürlüğü'ne yazılı olarak itiraz edilebilir.</p>
${signature}
<p style="margin-top: 40px; border-top: 2px solid #333; padding-top: 20px;"></p>
<p style="margin-bottom: 10px;"><strong>TEBLİĞ BİLGİLERİ</strong></p>
<p style="margin-bottom: 10px;"><em>Yukarıda belirtilen Okul Değişikliği Talebi kararını tebliğ aldım, içeriği ve itiraz haklarımı okudum ve anladım.</em></p>
<table style="width: 100%; border-collapse: collapse;">
<tr>
<td style="width: 50%; padding: 15px; text-align: center; vertical-align: top; border: 1px solid #ddd;">
<p style="margin-bottom: 5px;"><strong>ÖĞRENCİ</strong></p>
<p style="margin-bottom: 20px;">${studentName}</p>
<p style="margin-bottom: 5px;">Tebliğ Tarihi: ____/____/____</p>
<p>İmza: ____________</p>
</td>
<td style="width: 50%; padding: 15px; text-align: center; vertical-align: top; border: 1px solid #ddd;">
<p style="margin-bottom: 5px;"><strong>VELİ</strong></p>
<p style="margin-bottom: 20px;">____________________</p>
<p style="margin-bottom: 5px;">Tebliğ Tarihi: ____/____/____</p>
<p>İmza: ____________</p>
</td>
</tr>
</table>`,
    };

    return templates[type] || "";
  };

  // Belge içeriğini güncelle
  const updateDocumentContent = (type: DisiplinDocType) => {
    // Eğer kaydedilmiş içerik varsa onu kullan
    if (savedDocuments[type]) {
      setDocumentContent(savedDocuments[type]);
    } else {
      const content = generateDocumentContent(type);
      setDocumentContent(content);
    }
  };

  // Belge tipi değiştiğinde
  const handleDocumentChange = (type: DisiplinDocType) => {
    // Mevcut içeriği kaydet
    setSavedDocuments(prev => ({
      ...prev,
      [selectedDocument]: documentContent
    }));
    
    setSelectedDocument(type);
    updateDocumentContent(type);
  };

  // Seçimler değiştiğinde belgeyi yeniden oluştur
  useEffect(() => {
    if (selectedStudent && selectedReason && selectedDate) {
      const content = generateDocumentContent(selectedDocument);
      setDocumentContent(content);
    }
  }, [selectedStudent, selectedReason, selectedDate, meetingDate, meetingTime]);

  // İlk yüklemede
  useEffect(() => {
    updateDocumentContent(selectedDocument);
  }, []);

  // İçeriği kaydet
  const handleSaveContent = () => {
    setSavedDocuments(prev => ({
      ...prev,
      [selectedDocument]: documentContent
    }));
    setLastSaved(new Date());
    addActivity("Belge kaydedildi", selectedDocument);
    toast.success("Belge kaydedildi!");
  };

  // Şablona sıfırla
  const handleResetContent = () => {
    const content = generateDocumentContent(selectedDocument);
    setDocumentContent(content);
    addActivity("Belge sıfırlandı", selectedDocument);
    toast.info("Belge şablona sıfırlandı");
  };

  // İçeriği temizle
  const handleClearContent = () => {
    setDocumentContent("");
    addActivity("Belge temizlendi", selectedDocument);
    toast.info("Belge içeriği temizlendi");
  };

  // Belgeyi kopyala
  const handleCopyContent = async () => {
    if (!documentContent) return;
    const plainText = htmlToPlainText(documentContent);
    await navigator.clipboard.writeText(plainText);
    addActivity("Belge kopyalandı", selectedDocument);
    toast.success("Belge panoya kopyalandı!");
  };

  // Tüm belgeleri dışa aktar
  const handleExportAll = () => {
    const allDocs = Object.entries(savedDocuments)
      .filter(([_, content]) => content && content.trim() !== "")
      .map(([id, content]) => {
        const doc = [...disiplinDocuments, ...cezaDocuments].find(d => d.id === id);
        return `=== ${doc?.label || id} ===\n\n${htmlToPlainText(content)}\n\n`;
      })
      .join("\n" + "=".repeat(50) + "\n\n");
    
    const blob = new Blob([allDocs], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Disiplin_Belgeleri_${selectedStudent?.text || 'Tüm'}_${new Date().toLocaleDateString('tr-TR')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    addActivity("Tüm belgeler dışa aktarıldı");
    toast.success("Tüm belgeler dışa aktarıldı!");
  };

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

  // WhatsApp'ta paylaş
  const shareOnWhatsApp = () => {
    if (!documentContent) return;
    const plainText = htmlToPlainText(documentContent);
    const encodedText = encodeURIComponent(plainText);
    window.open(`https://wa.me/?text=${encodedText}`, '_blank');
    addActivity("WhatsApp paylaşıldı", selectedDocument);
    toast.success("WhatsApp açılıyor...");
  };

  // Telegram'da paylaş
  const shareOnTelegram = () => {
    if (!documentContent) return;
    const plainText = htmlToPlainText(documentContent);
    const encodedText = encodeURIComponent(plainText);
    window.open(`https://t.me/share/url?text=${encodedText}`, '_blank');
    addActivity("Telegram paylaşıldı", selectedDocument);
    toast.success("Telegram açılıyor...");
  };

  // Word olarak indir
  const downloadAsWord = () => {
    if (!documentContent) return;
    setExportingWord(true);
    
    try {
      const selectedDoc = disiplinDocuments.find(d => d.id === selectedDocument) || cezaDocuments.find(d => d.id === selectedDocument);
      const fileName = `${selectedDoc?.label || 'Belge'}_${selectedStudent?.text || 'Öğrenci'}.doc`.replace(/\s+/g, '_');
      
      const processedContent = documentContent
        .replace(/<p><\/p>/g, '<p>&nbsp;</p>')
        .replace(/<p>\s*<br\s*\/?>\s*<\/p>/g, '<p>&nbsp;</p>');
      
      const htmlContent = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta charset="utf-8">
          <title>${selectedDoc?.label}</title>
          <style>
            body { font-family: 'Times New Roman', Times, serif; font-size: 12pt; line-height: 1.8; padding: 40px; }
            p { margin: 0; padding: 0; min-height: 1.2em; }
            table { border-collapse: collapse; width: 100%; }
            td, th { padding: 8px; vertical-align: top; }
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
      
      addActivity("Word indirildi", selectedDocument);
      toast.success("Word dosyası indirildi!");
    } catch (error) {
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
      const selectedDoc = disiplinDocuments.find(d => d.id === selectedDocument) || cezaDocuments.find(d => d.id === selectedDocument);
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
          <title>${selectedDoc?.label} - ${selectedStudent?.text || 'Öğrenci'}</title>
          <style>
            body { font-family: 'Times New Roman', Times, serif; font-size: 12pt; line-height: 1.8; padding: 40px; color: #333; }
            p { margin: 0; padding: 0; min-height: 1.2em; }
            table { border-collapse: collapse; width: 100%; }
            td, th { padding: 8px; vertical-align: top; }
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
        addActivity("PDF indirildi", selectedDocument);
        toast.success("PDF olarak kaydetmek için 'PDF olarak kaydet' seçin");
      }, 500);
    } catch (error) {
      toast.error("PDF dosyası oluşturulamadı");
    } finally {
      setExportingPdf(false);
    }
  };

  // Cezayı öğrenci geçmişine kaydet
  const handleSavePenalty = async () => {
    if (!selectedStudent || !selectedPenalty || !selectedDate || !selectedReason) {
      toast.error("Lütfen öğrenci, ceza türü, tarih ve olay nedeni seçin");
      return;
    }

    setSavingPenalty(true);
    try {
      const response = await fetch('/api/discipline', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          student_id: selectedStudent.value,
          student_name: selectedStudent.text,
          class_key: selectedClass,
          class_display: selectedClassText,
          event_date: selectedDate,
          reason: selectedReason,
          penalty_type: selectedPenalty,
          notes: null,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        addActivity("Ceza kaydedildi", selectedPenalty);
        toast.success(`${selectedPenalty} cezası öğrenci geçmişine kaydedildi`);
      } else {
        toast.error(result.error || "Ceza kaydedilemedi");
      }
    } catch (error) {
      console.error("Save penalty error:", error);
      toast.error("Ceza kaydedilirken bir hata oluştu");
    } finally {
      setSavingPenalty(false);
    }
  };

  // Adım kontrolleri
  const canProceed = selectedStudent && selectedReason && selectedDate;
  const canSavePenalty = selectedStudent && selectedPenalty && selectedDate && selectedReason;

  // Tamamlanan belge sayısı
  const completedDocCount = Object.values(savedDocuments).filter(doc => doc && doc.trim() !== "").length;
  const totalDocCount = disiplinDocuments.length + cezaDocuments.length;

  // Filtered documents based on search
  const filteredDisiplinDocs = useMemo(() => 
    disiplinDocuments.filter(d => 
      d.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.description.toLowerCase().includes(searchQuery.toLowerCase())
    ), [searchQuery]
  );
  
  const filteredCezaDocs = useMemo(() => 
    cezaDocuments.filter(d => 
      d.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.description.toLowerCase().includes(searchQuery.toLowerCase())
    ), [searchQuery]
  );

  return (
    <div className="space-y-6">
      {/* Modern Başlık - Animated Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-rose-600 via-red-600 to-orange-500 p-6 text-white shadow-xl">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAzMHYySDI0di0yaDF6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
        
        {/* Animated Background Elements */}
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-orange-400/20 blur-3xl animate-float-slow" />
        <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-rose-400/20 blur-3xl animate-float-reverse" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-red-400/10 blur-3xl animate-pulse-glow" />
        
        {/* Floating Particles */}
        <div className="absolute top-8 right-16 h-2 w-2 rounded-full bg-orange-300/60 animate-float animation-delay-100" />
        <div className="absolute top-16 right-32 h-1.5 w-1.5 rounded-full bg-rose-300/60 animate-float animation-delay-300" />
        <div className="absolute bottom-12 left-24 h-2 w-2 rounded-full bg-red-300/60 animate-float animation-delay-500" />
        <div className="absolute top-1/3 left-1/5 h-1 w-1 rounded-full bg-white/40 animate-sparkle animation-delay-200" />
        <div className="absolute bottom-1/4 right-1/5 h-1.5 w-1.5 rounded-full bg-amber-300/50 animate-sparkle animation-delay-700" />
        
        {/* Live Indicator */}
        <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-full">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-xs font-medium">Canlı</span>
        </div>
        
        <div className="relative z-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm animate-float">
                <Gavel className="h-8 w-8" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl md:text-3xl font-bold">
                    Öğrenci Davranışlarını Değerlendirme Kurulu
                  </h1>
                  <Sparkles className="h-5 w-5 text-amber-300 animate-pulse" />
                </div>
                <p className="text-white/80 mt-1 flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Disiplin süreçleri için belge oluşturun ve yönetin
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Animated Stats */}
              <div className="px-4 py-2 bg-white/20 rounded-xl backdrop-blur-sm text-center group hover:bg-white/30 transition-all cursor-default">
                <p className="text-2xl font-bold transition-transform group-hover:scale-110">{animatedStats.completed}</p>
                <p className="text-xs text-white/80 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Tamamlanan
                </p>
              </div>
              <div className="px-4 py-2 bg-white/20 rounded-xl backdrop-blur-sm text-center group hover:bg-white/30 transition-all cursor-default">
                <p className="text-2xl font-bold transition-transform group-hover:scale-110">{animatedStats.total}</p>
                <p className="text-xs text-white/80 flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  Toplam Belge
                </p>
              </div>
              <div className="px-4 py-2 bg-gradient-to-br from-emerald-500/30 to-emerald-600/30 rounded-xl backdrop-blur-sm text-center border border-emerald-400/30">
                <p className="text-2xl font-bold">{animatedStats.progress}%</p>
                <p className="text-xs text-emerald-200 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  İlerleme
                </p>
              </div>
            </div>
          </div>
          
          {/* İlerleme Çubuğu - Animated */}
          <div className="mt-4">
            <div className="flex justify-between text-xs text-white/80 mb-1">
              <span className="flex items-center gap-1">
                <Timer className="h-3 w-3" />
                Belge Tamamlama Durumu
              </span>
              <span className="font-medium">{animatedStats.progress}%</span>
            </div>
            <div className="w-full h-3 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm">
              <div 
                className="h-full bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500 rounded-full transition-all duration-1000 ease-out relative"
                style={{ width: `${animatedStats.progress}%` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
              </div>
            </div>
          </div>
          
          {/* Last Saved Indicator */}
          {lastSaved && (
            <div className="mt-3 flex items-center gap-2 text-xs text-white/70">
              <Save className="h-3 w-3" />
              <span>Son kayıt: {lastSaved.toLocaleTimeString('tr-TR')}</span>
              {autoSaveEnabled && (
                <Badge className="bg-emerald-500/30 text-emerald-200 border-emerald-400/30 text-xs py-0">
                  <Zap className="h-3 w-3 mr-1" />
                  Otomatik Kayıt Açık
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Hızlı İstatistikler - Enhanced with Animations */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="group p-4 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 cursor-default overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-400/0 via-blue-400/10 to-blue-400/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
          <div className="flex items-center gap-3 relative z-10">
            <div className="p-2 bg-blue-500/10 rounded-lg group-hover:bg-blue-500/20 transition-colors group-hover:scale-110 transform duration-300">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-blue-600 font-medium">Disiplin Belgeleri</p>
              <p className="text-xl font-bold text-blue-900 group-hover:text-blue-700 transition-colors">{disiplinDocuments.length}</p>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-400 to-blue-600 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
        </Card>
        
        <Card className="group p-4 rounded-xl bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 cursor-default overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-r from-orange-400/0 via-orange-400/10 to-orange-400/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
          <div className="flex items-center gap-3 relative z-10">
            <div className="p-2 bg-orange-500/10 rounded-lg group-hover:bg-orange-500/20 transition-colors group-hover:scale-110 transform duration-300">
              <ShieldAlert className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-xs text-orange-600 font-medium">Ceza Belgeleri</p>
              <p className="text-xl font-bold text-orange-900 group-hover:text-orange-700 transition-colors">{cezaDocuments.length}</p>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-400 to-orange-600 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
        </Card>
        
        <Card className="group p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 cursor-default overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-400/0 via-emerald-400/10 to-emerald-400/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
          <div className="flex items-center gap-3 relative z-10">
            <div className="p-2 bg-emerald-500/10 rounded-lg group-hover:bg-emerald-500/20 transition-colors group-hover:scale-110 transform duration-300">
              <Check className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-emerald-600 font-medium">Tamamlanan</p>
              <p className="text-xl font-bold text-emerald-900 group-hover:text-emerald-700 transition-colors">{completedDocCount}</p>
            </div>
          </div>
          {completedDocCount > 0 && (
            <div className="absolute top-2 right-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            </div>
          )}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 to-emerald-600 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
        </Card>
        
        <Card className="group p-4 rounded-xl bg-gradient-to-br from-violet-50 to-violet-100 border border-violet-200 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 cursor-default overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-r from-violet-400/0 via-violet-400/10 to-violet-400/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
          <div className="flex items-center gap-3 relative z-10">
            <div className="p-2 bg-violet-500/10 rounded-lg group-hover:bg-violet-500/20 transition-colors group-hover:scale-110 transform duration-300">
              <Clock className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <p className="text-xs text-violet-600 font-medium">Kalan</p>
              <p className="text-xl font-bold text-violet-900 group-hover:text-violet-700 transition-colors">{totalDocCount - completedDocCount}</p>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-400 to-violet-600 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
        </Card>
      </div>

      {/* Quick Actions Bar */}
      {showQuickActions && (
        <Card className="bg-gradient-to-r from-slate-50 via-white to-slate-50 border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Zap className="h-4 w-4 text-amber-500" />
              <span>Hızlı İşlemler:</span>
            </div>
            
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportAll}
              disabled={completedDocCount === 0}
              className="gap-1.5 border-indigo-200 text-indigo-600 hover:bg-indigo-50 hover:border-indigo-300 transition-all"
            >
              <Download className="h-3.5 w-3.5" />
              Tümünü Dışa Aktar
            </Button>
            
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAutoSaveEnabled(!autoSaveEnabled)}
              className={`gap-1.5 transition-all ${autoSaveEnabled ? 'border-emerald-200 text-emerald-600 hover:bg-emerald-50' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
            >
              <Zap className={`h-3.5 w-3.5 ${autoSaveEnabled ? 'text-emerald-500' : ''}`} />
              Otomatik Kayıt {autoSaveEnabled ? 'Açık' : 'Kapalı'}
            </Button>
            
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPreviewMode(!previewMode)}
              className="gap-1.5 border-sky-200 text-sky-600 hover:bg-sky-50 hover:border-sky-300 transition-all"
            >
              <Eye className="h-3.5 w-3.5" />
              {previewMode ? 'Düzenleme Modu' : 'Önizleme Modu'}
            </Button>
            
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="gap-1.5 border-slate-200 text-slate-600 hover:bg-slate-50 transition-all ml-auto"
            >
              {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              {isFullscreen ? 'Küçült' : 'Tam Ekran'}
            </Button>
          </div>
          
          {/* Recent Activity */}
          {recentActivity.length > 0 && (
            <div className="px-4 pb-3 pt-0">
              <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                <History className="h-3 w-3" />
                <span>Son İşlemler:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {recentActivity.slice(0, 3).map((activity, idx) => (
                  <Badge 
                    key={idx} 
                    variant="outline" 
                    className="bg-slate-50 text-slate-600 border-slate-200 text-xs py-0.5 animate-fade-in"
                    style={{ animationDelay: `${idx * 100}ms` }}
                  >
                    {activity.action}
                    {activity.doc && ` - ${activity.doc.slice(0, 15)}...`}
                    <span className="text-slate-400 ml-1">
                      {activity.time.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Ana İçerik */}
      <div className={`grid gap-6 ${isFullscreen ? '' : 'lg:grid-cols-12'}`}>
        {/* Sol Panel - Seçimler */}
        {!isFullscreen && (
        <div className="lg:col-span-4 space-y-4">
          {/* Olay Bilgileri - Enhanced */}
          <Card className="bg-gradient-to-br from-rose-50 to-white border-rose-200 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-rose-200/20 rounded-full -translate-y-16 translate-x-16 group-hover:scale-150 transition-transform duration-500" />
            <CardHeader className="pb-3 relative">
              <CardTitle className="text-base font-semibold text-rose-800 flex items-center gap-2">
                <div className="p-1.5 bg-rose-100 rounded-lg group-hover:bg-rose-200 transition-colors">
                  <ClipboardList className="h-5 w-5 text-rose-600" />
                </div>
                Olay Bilgileri
                <div className="ml-auto flex items-center gap-1">
                  {canProceed && (
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">
                      <Check className="h-3 w-3 mr-1" />
                      Hazır
                    </Badge>
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 relative">
              {/* Tarih Seçimi */}
              <div className="space-y-2 group/field">
                <Label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-rose-500 group-hover/field:rotate-12 transition-transform" />
                  Olay Tarihi
                </Label>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="h-10 border-rose-200 focus:border-rose-400 focus:ring-rose-400 hover:border-rose-300 transition-colors"
                />
              </div>

              {/* Sınıf Seçimi */}
              <div className="space-y-2 group/field">
                <Label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-rose-500 group-hover/field:scale-110 transition-transform" />
                  Sınıf / Şube
                </Label>
                <Select
                  disabled={loadingClasses}
                  value={selectedClass}
                  onValueChange={handleClassChange}
                >
                  <SelectTrigger className="h-10 border-rose-200 focus:border-rose-400 hover:border-rose-300 transition-colors">
                    <SelectValue placeholder={loadingClasses ? "Yükleniyor..." : "Sınıf seçin"} />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.text}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Öğrenci Seçimi */}
              <div className="space-y-2 group/field">
                <Label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <User className="h-4 w-4 text-rose-500 group-hover/field:scale-110 transition-transform" />
                  Öğrenci
                  {loadingStudents && (
                    <RefreshCw className="h-3 w-3 animate-spin text-rose-400" />
                  )}
                </Label>
                <Select
                  disabled={!selectedClass || loadingStudents}
                  value={selectedStudent?.value || ""}
                  onValueChange={handleStudentChange}
                >
                  <SelectTrigger className="h-10 border-rose-200 focus:border-rose-400 hover:border-rose-300 transition-colors">
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
              </div>

              {/* Yönlendirme Nedeni */}
              <div className="space-y-2 group/field">
                <Label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-rose-500 group-hover/field:animate-pulse" />
                  Olay Nedeni
                </Label>
                <Select
                  value={selectedReason}
                  onValueChange={setSelectedReason}
                >
                  <SelectTrigger className="h-10 border-rose-200 focus:border-rose-400 hover:border-rose-300 transition-colors">
                    <SelectValue placeholder="Neden seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {YONLENDIRME_NEDENLERI.map((neden) => (
                      <SelectItem key={neden} value={neden}>
                        {neden}
                      </SelectItem>
                    ))}
                    <SelectItem value="Diğer">Diğer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Verilen Ceza */}
              <div className="space-y-2 group/field">
                <Label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-rose-500 group-hover/field:scale-110 transition-transform" />
                  Verilen Ceza
                </Label>
                <Select
                  value={selectedPenalty}
                  onValueChange={setSelectedPenalty}
                >
                  <SelectTrigger className="h-10 border-rose-200 focus:border-rose-400 hover:border-rose-300 transition-colors">
                    <SelectValue placeholder="Ceza türü seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {DISIPLIN_CEZALARI.map((ceza) => (
                      <SelectItem key={ceza} value={ceza}>
                        {ceza}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Seçili Bilgiler - Animated */}
              {selectedStudent && (
                <div className="p-3 bg-gradient-to-br from-rose-100 to-rose-50 rounded-xl border border-rose-200 animate-fade-in">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-rose-200 rounded-lg">
                      <User className="h-4 w-4 text-rose-700" />
                    </div>
                    <span className="text-sm font-medium text-rose-800">
                      {selectedStudent.text}
                    </span>
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 ml-auto" />
                  </div>
                  <p className="text-xs text-rose-600 mt-1 ml-8">{selectedClassText}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2 ml-8">
                    {selectedReason && (
                      <Badge className="bg-rose-200 text-rose-700 border-rose-300 text-xs">
                        {selectedReason.length > 20 ? selectedReason.slice(0, 20) + '...' : selectedReason}
                      </Badge>
                    )}
                    {selectedPenalty && (
                      <Badge className="bg-orange-200 text-orange-700 border-orange-300 text-xs">
                        {selectedPenalty}
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {/* Cezayı Kaydet Butonu - Enhanced */}
              {selectedPenalty && (
                <Button
                  onClick={handleSavePenalty}
                  disabled={!canSavePenalty || savingPenalty}
                  className="w-full bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-600 hover:to-rose-600 text-white gap-2 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5"
                >
                  {savingPenalty ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Kaydediliyor...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Cezayı Geçmişe Kaydet
                    </>
                  )}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Toplantı Bilgileri (Çağrı ve Karar için) - Enhanced */}
          {(selectedDocument === "disiplin-cagri" || selectedDocument === "disiplin-karar") && (
            <Card className="bg-gradient-to-br from-amber-50 to-white border-amber-200 shadow-sm hover:shadow-md transition-all duration-300 animate-fade-in overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-amber-200/20 rounded-full -translate-y-12 translate-x-12 group-hover:scale-150 transition-transform duration-500" />
              <CardHeader className="pb-3 relative">
                <CardTitle className="text-base font-semibold text-amber-800 flex items-center gap-2">
                  <div className="p-1.5 bg-amber-100 rounded-lg group-hover:bg-amber-200 transition-colors">
                    <Clock className="h-5 w-5 text-amber-600" />
                  </div>
                  Toplantı Bilgileri
                  <Sparkles className="h-4 w-4 text-amber-500 ml-auto animate-pulse" />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 relative">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">Toplantı Tarihi</Label>
                  <Input
                    type="date"
                    value={meetingDate}
                    onChange={(e) => setMeetingDate(e.target.value)}
                    className="h-10 border-amber-200 hover:border-amber-300 focus:border-amber-400 transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">Toplantı Saati</Label>
                  <Input
                    type="time"
                    value={meetingTime}
                    onChange={(e) => setMeetingTime(e.target.value)}
                    className="h-10 border-amber-200 hover:border-amber-300 focus:border-amber-400 transition-colors"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Belge Türleri - Tabbed & Searchable */}
          <Card className="bg-white/80 backdrop-blur shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
            {/* Search Bar */}
            <div className="p-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
              <div className="relative">
                <Input
                  placeholder="Belge ara..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 pl-9 text-sm border-slate-200"
                />
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <XCircle className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
            
            {/* Tabs */}
            <div className="flex border-b border-slate-100">
              <button
                onClick={() => setActiveTab('disiplin')}
                className={`flex-1 py-2.5 text-sm font-medium transition-all relative ${
                  activeTab === 'disiplin' 
                    ? 'text-blue-600 bg-blue-50/50' 
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <FileText className="h-4 w-4" />
                  Disiplin
                  <Badge variant="outline" className="text-xs py-0 bg-blue-50 text-blue-600 border-blue-200">
                    {filteredDisiplinDocs.length}
                  </Badge>
                </div>
                {activeTab === 'disiplin' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
                )}
              </button>
              <button
                onClick={() => setActiveTab('ceza')}
                className={`flex-1 py-2.5 text-sm font-medium transition-all relative ${
                  activeTab === 'ceza' 
                    ? 'text-orange-600 bg-orange-50/50' 
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <ShieldAlert className="h-4 w-4" />
                  Ceza
                  <Badge variant="outline" className="text-xs py-0 bg-orange-50 text-orange-600 border-orange-200">
                    {filteredCezaDocs.length}
                  </Badge>
                </div>
                {activeTab === 'ceza' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-500" />
                )}
              </button>
            </div>

            <CardContent className="p-3 space-y-2 max-h-[400px] overflow-y-auto">
              {activeTab === 'disiplin' ? (
                filteredDisiplinDocs.length > 0 ? (
                  filteredDisiplinDocs.map((doc, idx) => {
                    const Icon = doc.icon;
                    const isSelected = selectedDocument === doc.id;
                    const hasSaved = savedDocuments[doc.id] !== "";
                    
                    return (
                      <button
                        key={doc.id}
                        onClick={() => handleDocumentChange(doc.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left border group animate-fade-in ${
                          isSelected
                            ? doc.color + " border-current shadow-md scale-[1.02]"
                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300 hover:shadow-sm"
                        }`}
                        style={{ animationDelay: `${idx * 50}ms` }}
                      >
                        <div className={`p-1.5 rounded-lg transition-all ${isSelected ? 'bg-white/50 scale-110' : 'bg-slate-100 group-hover:bg-slate-200 group-hover:scale-110'}`}>
                          <Icon className="h-4 w-4 flex-shrink-0" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate">{doc.label}</span>
                            {hasSaved && (
                              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" title="Kayıtlı" />
                            )}
                          </div>
                          <p className={`text-xs truncate ${isSelected ? 'opacity-70' : 'text-slate-400'}`}>{doc.description}</p>
                        </div>
                        {isSelected && <Check className="h-4 w-4 flex-shrink-0 animate-scale-in" />}
                      </button>
                    );
                  })
                ) : (
                  <div className="text-center py-6 text-slate-400">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Belge bulunamadı</p>
                  </div>
                )
              ) : (
                filteredCezaDocs.length > 0 ? (
                  filteredCezaDocs.map((doc, idx) => {
                    const Icon = doc.icon;
                    const isSelected = selectedDocument === doc.id;
                    const hasSaved = savedDocuments[doc.id] !== "";
                    
                    return (
                      <button
                        key={doc.id}
                        onClick={() => handleDocumentChange(doc.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left border group animate-fade-in ${
                          isSelected
                            ? doc.color + " border-current shadow-md scale-[1.02]"
                            : "bg-white text-slate-600 border-slate-200 hover:bg-orange-50 hover:border-orange-200 hover:shadow-sm"
                        }`}
                        style={{ animationDelay: `${idx * 50}ms` }}
                      >
                        <div className={`p-1.5 rounded-lg transition-all ${isSelected ? 'bg-white/50 scale-110' : 'bg-slate-100 group-hover:bg-orange-100 group-hover:scale-110'}`}>
                          <Icon className="h-4 w-4 flex-shrink-0" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate">{doc.label}</span>
                            {hasSaved && (
                              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" title="Kayıtlı" />
                            )}
                          </div>
                          <p className={`text-xs truncate ${isSelected ? 'opacity-70' : 'text-slate-400'}`}>{doc.description}</p>
                        </div>
                        {isSelected && <Check className="h-4 w-4 flex-shrink-0 animate-scale-in" />}
                      </button>
                    );
                  })
                ) : (
                  <div className="text-center py-6 text-slate-400">
                    <ShieldAlert className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Belge bulunamadı</p>
                  </div>
                )
              )}
            </CardContent>
          </Card>
        </div>
        )}

        {/* Sağ Panel - Belge Editörü - Enhanced */}
        <div className={isFullscreen ? 'col-span-full' : 'lg:col-span-8'}>
          <Card className="bg-white/80 backdrop-blur h-full shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
            <CardHeader className="pb-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-slate-50 relative overflow-hidden">
              {/* Animated Background */}
              <div className="absolute inset-0 bg-gradient-to-r from-rose-500/5 via-transparent to-orange-500/5" />
              <div className="absolute top-0 right-0 w-32 h-32 bg-rose-100/20 rounded-full blur-2xl -translate-y-16 translate-x-16" />
              
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between relative z-10">
                <div className="flex items-center gap-3">
                  {(() => {
                    const doc = disiplinDocuments.find(d => d.id === selectedDocument) || cezaDocuments.find(d => d.id === selectedDocument);
                    const Icon = doc?.icon || FileText;
                    return (
                      <div className="p-2 bg-gradient-to-br from-rose-500 to-orange-500 rounded-xl text-white shadow-lg group-hover:shadow-xl transition-shadow animate-float">
                        <Icon className="h-5 w-5" />
                      </div>
                    );
                  })()}
                  <div>
                    <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
                      {disiplinDocuments.find(d => d.id === selectedDocument)?.label || cezaDocuments.find(d => d.id === selectedDocument)?.label || "Belge"}
                      {savedDocuments[selectedDocument] && (
                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">
                          <Check className="h-3 w-3 mr-1" />
                          Kayıtlı
                        </Badge>
                      )}
                    </CardTitle>
                    <p className="text-xs text-slate-500">
                      {disiplinDocuments.find(d => d.id === selectedDocument)?.description || cezaDocuments.find(d => d.id === selectedDocument)?.description}
                    </p>
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-2 mt-3 sm:mt-0">
                  {/* Ana İşlem Butonları */}
                  <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1 text-emerald-600 hover:bg-emerald-100 transition-all h-8 px-2"
                      onClick={handleSaveContent}
                      disabled={!documentContent}
                      title="Kaydet"
                    >
                      <Save className="h-4 w-4" />
                      <span className="hidden md:inline text-xs">Kaydet</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1 text-amber-600 hover:bg-amber-100 transition-all h-8 px-2"
                      onClick={handleResetContent}
                      title="Sıfırla"
                    >
                      <RotateCcw className="h-4 w-4" />
                      <span className="hidden md:inline text-xs">Sıfırla</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1 text-sky-600 hover:bg-sky-100 transition-all h-8 px-2"
                      onClick={handleCopyContent}
                      disabled={!documentContent}
                      title="Kopyala"
                    >
                      <Copy className="h-4 w-4" />
                      <span className="hidden md:inline text-xs">Kopyala</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1 text-slate-600 hover:bg-slate-200 transition-all h-8 px-2"
                      onClick={handleClearContent}
                      disabled={!documentContent}
                      title="Temizle"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="hidden md:inline text-xs">Temizle</span>
                    </Button>
                  </div>
                  
                  {/* Export Butonları */}
                  <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                    <Button
                      size="sm"
                      className="gap-1 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm hover:shadow-md transition-all h-8 px-2"
                      onClick={downloadAsWord}
                      disabled={exportingWord || !documentContent}
                      title="Word olarak indir"
                    >
                      {exportingWord ? <RefreshCw className="h-4 w-4 animate-spin" /> : <FileType className="h-4 w-4" />}
                      <span className="hidden md:inline text-xs">Word</span>
                    </Button>
                    <Button
                      size="sm"
                      className="gap-1 bg-red-600 hover:bg-red-700 text-white shadow-sm hover:shadow-md transition-all h-8 px-2"
                      onClick={downloadAsPdf}
                      disabled={exportingPdf || !documentContent}
                      title="PDF olarak indir"
                    >
                      {exportingPdf ? <RefreshCw className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                      <span className="hidden md:inline text-xs">PDF</span>
                    </Button>
                  </div>
                  
                  {/* Paylaşım Butonları */}
                  <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1 text-green-600 hover:bg-green-100 transition-all h-8 px-2"
                      onClick={shareOnWhatsApp}
                      disabled={!documentContent}
                      title="WhatsApp'ta paylaş"
                    >
                      <MessageCircle className="h-4 w-4" />
                      <span className="hidden lg:inline text-xs">WhatsApp</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1 text-sky-600 hover:bg-sky-100 transition-all h-8 px-2"
                      onClick={shareOnTelegram}
                      disabled={!documentContent}
                      title="Telegram'da paylaş"
                    >
                      <Send className="h-4 w-4" />
                      <span className="hidden lg:inline text-xs">Telegram</span>
                    </Button>
                  </div>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="p-4">
              {/* Seçili öğrenci bilgisi - Enhanced */}
              {selectedStudent && (
                <div className="mb-4 p-3 bg-gradient-to-r from-rose-50 via-white to-orange-50 rounded-xl border border-rose-100 shadow-sm animate-fade-in">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge variant="outline" className="bg-rose-100 text-rose-700 border-rose-200 shadow-sm">
                      <User className="h-3 w-3 mr-1" />
                      {selectedStudent.text}
                    </Badge>
                    <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-200 shadow-sm">
                      <GraduationCap className="h-3 w-3 mr-1" />
                      {selectedClassText}
                    </Badge>
                    {selectedReason && (
                      <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200 shadow-sm">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        {selectedReason.length > 25 ? selectedReason.slice(0, 25) + '...' : selectedReason}
                      </Badge>
                    )}
                    {selectedDate && (
                      <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200 shadow-sm">
                        <Calendar className="h-3 w-3 mr-1" />
                        {new Date(selectedDate).toLocaleDateString('tr-TR')}
                      </Badge>
                    )}
                    {selectedPenalty && (
                      <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-200 shadow-sm">
                        <ShieldAlert className="h-3 w-3 mr-1" />
                        {selectedPenalty}
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {/* Uyarı - Seçim yapılmadıysa - Enhanced */}
              {!canProceed && (
                <div className="mb-4 p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200 shadow-sm animate-fade-in">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-amber-100 rounded-lg flex-shrink-0">
                      <AlertTriangle className="h-5 w-5 text-amber-600 animate-pulse" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-amber-800">Belge Oluşturma</p>
                      <p className="text-xs text-amber-700 mt-1">
                        Belge oluşturmak için lütfen sol panelden sınıf, öğrenci, tarih ve olay nedenini seçin.
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        {!selectedClass && <Badge variant="outline" className="text-xs bg-amber-100 text-amber-700 border-amber-200">Sınıf seçilmedi</Badge>}
                        {!selectedStudent && <Badge variant="outline" className="text-xs bg-amber-100 text-amber-700 border-amber-200">Öğrenci seçilmedi</Badge>}
                        {!selectedReason && <Badge variant="outline" className="text-xs bg-amber-100 text-amber-700 border-amber-200">Neden seçilmedi</Badge>}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Zengin Metin Editörü */}
              <div className={`transition-all duration-300 ${previewMode ? 'pointer-events-none opacity-80' : ''}`}>
                <RichTextEditor
                  content={documentContent}
                  onChange={setDocumentContent}
                  placeholder="Belge içeriği burada görünecek..."
                />
              </div>

              {/* Bilgilendirme - Enhanced */}
              <div className="mt-4 p-4 bg-gradient-to-r from-rose-50 via-pink-50 to-orange-50 rounded-xl border border-rose-200 shadow-sm overflow-hidden relative group">
                {/* Animated Background */}
                <div className="absolute inset-0 bg-gradient-to-r from-rose-500/0 via-rose-500/5 to-rose-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                
                <div className="flex items-start gap-3 relative z-10">
                  <div className="p-2 bg-rose-100 rounded-lg flex-shrink-0 group-hover:bg-rose-200 transition-colors">
                    <Info className="h-4 w-4 text-rose-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-rose-800">Belge Yönetimi İpuçları</p>
                    <ul className="text-xs text-rose-700 mt-1 space-y-1">
                      <li className="flex items-center gap-1">
                        <Check className="h-3 w-3 text-rose-500" />
                        Tüm belgeleri sırayla doldurun, her belge türü için içerik otomatik olarak kaydedilir
                      </li>
                      <li className="flex items-center gap-1">
                        <Check className="h-3 w-3 text-rose-500" />
                        Word veya PDF olarak indirip resmi işlemlerinizde kullanabilirsiniz
                      </li>
                      <li className="flex items-center gap-1">
                        <Check className="h-3 w-3 text-rose-500" />
                        WhatsApp veya Telegram ile hızlıca paylaşabilirsiniz
                      </li>
                    </ul>
                    
                    {/* Keyboard Shortcuts */}
                    <div className="mt-3 pt-3 border-t border-rose-200">
                      <p className="text-xs font-medium text-rose-700 mb-1">Kısayollar:</p>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="text-xs bg-white/50 text-rose-600 border-rose-200">
                          <kbd className="font-mono">Ctrl+S</kbd> Kaydet
                        </Badge>
                        <Badge variant="outline" className="text-xs bg-white/50 text-rose-600 border-rose-200">
                          <kbd className="font-mono">Ctrl+P</kbd> Yazdır
                        </Badge>
                      </div>
                    </div>
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
