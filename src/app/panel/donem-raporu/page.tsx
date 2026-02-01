"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  FileText,
  Download,
  Calendar,
  Users,
  AlertTriangle,
  ExternalLink,
  BarChart3,
  PieChart,
  TrendingUp,
  Clock,
  CheckCircle2,
  User,
  Printer,
  RefreshCw,
  Loader2,
  FileSpreadsheet,
  BookOpen,
  Target,
  Activity,
  MessageSquare,
  Heart
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

interface ReportData {
  period: string;
  startDate: string;
  endDate: string;
  
  // İstatistikler
  totalStudents: number;
  totalReferrals: number;
  totalDiscipline: number;
  totalAppointments: number;
  totalClassActivities: number;
  totalParentContacts: number;
  
  // Yönlendirme nedenleri
  referralsByReason: Record<string, number>;
  
  // Disiplin istatistikleri
  disciplineByType: Record<string, number>;
  
  // Sınıf dağılımları
  referralsByClass: Record<string, number>;
  disciplineByClass: Record<string, number>;
  
  // RAM
  ramReferrals: number;
  ramCompleted: number;
  ramPending: number;
  
  // Risk
  riskStudentsActive: number;
  riskStudentsCritical: number;
  
  // Etkinlikler
  activitiesByType: Record<string, number>;
}

// Dönem seçenekleri
const PERIOD_OPTIONS = [
  { value: '1-donem', label: '1. Dönem', startMonth: 9, endMonth: 1 },
  { value: '2-donem', label: '2. Dönem', startMonth: 2, endMonth: 6 },
  { value: 'yillik', label: 'Yıllık', startMonth: 9, endMonth: 6 }
];

// Yönlendirme nedenleri
const REASON_LABELS: Record<string, string> = {
  'akademik': 'Akademik Sorunlar',
  'davranis': 'Davranış Problemleri',
  'sosyal': 'Sosyal İlişki Sorunları',
  'ailevi': 'Aile Sorunları',
  'duygusal': 'Duygusal Sorunlar',
  'dikkat': 'Dikkat/Konsantrasyon',
  'kaygi': 'Kaygı/Stres',
  'zorbalik': 'Akran Zorbalığı',
  'diger': 'Diğer'
};

// Etkinlik tipleri
const ACTIVITY_LABELS: Record<string, string> = {
  'tanitim': 'Rehberlik Tanıtımı',
  'benlik': 'Benlik Gelişimi',
  'kariyer': 'Kariyer/Meslek',
  'akademik': 'Akademik Gelişim',
  'sosyal': 'Sosyal Beceriler',
  'duygusal': 'Duygusal Farkındalık',
  'guvenlik': 'Güvenlik/Koruma',
  'deger': 'Değerler Eğitimi',
  'diger': 'Diğer'
};

export default function DonemRaporuPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('1-donem');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [reportData, setReportData] = useState<ReportData | null>(null);
  
  // Rapor tarihi hesapla
  const getReportDates = useCallback(() => {
    const period = PERIOD_OPTIONS.find(p => p.value === selectedPeriod);
    if (!period) return { startDate: '', endDate: '' };
    
    let startYear = selectedYear;
    let endYear = selectedYear;
    
    // 1. dönem için: Eylül başı - Ocak sonu
    if (selectedPeriod === '1-donem') {
      endYear = selectedYear + 1;
    }
    // Yıllık için: Eylül başı - Haziran sonu
    if (selectedPeriod === 'yillik') {
      endYear = selectedYear + 1;
    }
    
    const startDate = `${startYear}-${String(period.startMonth).padStart(2, '0')}-01`;
    const endDate = `${endYear}-${String(period.endMonth).padStart(2, '0')}-30`;
    
    return { startDate, endDate };
  }, [selectedPeriod, selectedYear]);
  
  // Rapor verilerini yükle
  const loadReportData = async () => {
    setIsLoading(true);
    const { startDate, endDate } = getReportDates();
    
    try {
      // Paralel olarak tüm verileri çek
      const [
        referralsRes,
        disciplineRes,
        ramRes,
        riskRes,
        activitiesRes,
        parentContactsRes
      ] = await Promise.all([
        // Yönlendirmeler
        supabase
          .from('referrals')
          .select('*')
          .gte('created_at', startDate)
          .lte('created_at', endDate),
        
        // Disiplin
        supabase
          .from('discipline')
          .select('*')
          .gte('created_at', startDate)
          .lte('created_at', endDate),
        
        // RAM
        supabase
          .from('ram_referrals')
          .select('*')
          .gte('created_at', startDate)
          .lte('created_at', endDate),
        
        // Risk
        supabase
          .from('risk_students')
          .select('*')
          .eq('status', 'active'),
        
        // Sınıf etkinlikleri
        supabase
          .from('class_activities')
          .select('*')
          .gte('activity_date', startDate)
          .lte('activity_date', endDate),
        
        // Veli iletişim
        supabase
          .from('parent_contacts')
          .select('*')
          .gte('contact_date', startDate)
          .lte('contact_date', endDate)
      ]);
      
      const referrals = referralsRes.data || [];
      const discipline = disciplineRes.data || [];
      const ram = ramRes.data || [];
      const risk = riskRes.data || [];
      const activities = activitiesRes.data || [];
      const parentContacts = parentContactsRes.data || [];
      
      // Veri analizi
      const referralsByReason: Record<string, number> = {};
      const referralsByClass: Record<string, number> = {};
      
      referrals.forEach((ref: any) => {
        // Neden bazlı
        const reason = ref.reason || 'diger';
        referralsByReason[reason] = (referralsByReason[reason] || 0) + 1;
        
        // Sınıf bazlı
        const cls = ref.class_display || 'Belirtilmemiş';
        referralsByClass[cls] = (referralsByClass[cls] || 0) + 1;
      });
      
      const disciplineByType: Record<string, number> = {};
      const disciplineByClass: Record<string, number> = {};
      
      discipline.forEach((d: any) => {
        const type = d.type || 'diger';
        disciplineByType[type] = (disciplineByType[type] || 0) + 1;
        
        const cls = d.class_display || 'Belirtilmemiş';
        disciplineByClass[cls] = (disciplineByClass[cls] || 0) + 1;
      });
      
      const activitiesByType: Record<string, number> = {};
      activities.forEach((a: any) => {
        const type = a.activity_type || 'diger';
        activitiesByType[type] = (activitiesByType[type] || 0) + 1;
      });
      
      // Benzersiz öğrenci sayısı
      const uniqueStudents = new Set([
        ...referrals.map((r: any) => r.student_name),
        ...discipline.map((d: any) => d.student_name)
      ]);
      
      setReportData({
        period: PERIOD_OPTIONS.find(p => p.value === selectedPeriod)?.label || '',
        startDate,
        endDate,
        totalStudents: uniqueStudents.size,
        totalReferrals: referrals.length,
        totalDiscipline: discipline.length,
        totalAppointments: referrals.filter((r: any) => r.status === 'completed').length,
        totalClassActivities: activities.length,
        totalParentContacts: parentContacts.length,
        referralsByReason,
        disciplineByType,
        referralsByClass,
        disciplineByClass,
        ramReferrals: ram.length,
        ramCompleted: ram.filter((r: any) => r.status === 'sonuclandi').length,
        ramPending: ram.filter((r: any) => r.status !== 'sonuclandi' && r.status !== 'iptal').length,
        riskStudentsActive: risk.length,
        riskStudentsCritical: risk.filter((r: any) => r.risk_level === 'critical' || r.risk_level === 'high').length,
        activitiesByType
      });
      
    } catch (error) {
      console.error('Rapor verileri yüklenemedi:', error);
      toast.error('Veriler yüklenirken hata oluştu');
    } finally {
      setIsLoading(false);
    }
  };
  
  // PDF oluştur
  const generatePDF = async () => {
    if (!reportData) {
      toast.error('Önce rapor verilerini yükleyin');
      return;
    }
    
    setIsGenerating(true);
    
    try {
      // jsPDF dinamik import
      const { default: jsPDF } = await import('jspdf');
      
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      let y = 20;
      
      // Başlık
      doc.setFontSize(18);
      doc.text('DUMLUPINAR ILKOKULU', pageWidth / 2, y, { align: 'center' });
      y += 8;
      doc.setFontSize(14);
      doc.text('Rehberlik ve Psikolojik Danismanlik Hizmetleri', pageWidth / 2, y, { align: 'center' });
      y += 8;
      doc.text(`${reportData.period} Raporu`, pageWidth / 2, y, { align: 'center' });
      y += 6;
      doc.setFontSize(10);
      doc.text(`(${new Date(reportData.startDate).toLocaleDateString('tr-TR')} - ${new Date(reportData.endDate).toLocaleDateString('tr-TR')})`, pageWidth / 2, y, { align: 'center' });
      y += 15;
      
      // Genel İstatistikler
      doc.setFontSize(12);
      doc.text('GENEL ISTATISTIKLER', 14, y);
      y += 8;
      doc.setFontSize(10);
      
      const stats = [
        `Toplam Gorulen Ogrenci: ${reportData.totalStudents}`,
        `Toplam Yonlendirme: ${reportData.totalReferrals}`,
        `Tamamlanan Gorusme: ${reportData.totalAppointments}`,
        `Disiplin Olaylari: ${reportData.totalDiscipline}`,
        `Sinif Etkinlikleri: ${reportData.totalClassActivities}`,
        `Veli Iletisimleri: ${reportData.totalParentContacts}`
      ];
      
      stats.forEach(stat => {
        doc.text(stat, 20, y);
        y += 6;
      });
      
      y += 5;
      
      // RAM Yönlendirmeleri
      doc.setFontSize(12);
      doc.text('RAM YONLENDIRMELERI', 14, y);
      y += 8;
      doc.setFontSize(10);
      doc.text(`Toplam RAM Basvurusu: ${reportData.ramReferrals}`, 20, y);
      y += 6;
      doc.text(`Sonuclanan: ${reportData.ramCompleted}`, 20, y);
      y += 6;
      doc.text(`Devam Eden: ${reportData.ramPending}`, 20, y);
      y += 10;
      
      // Risk Durumu
      doc.setFontSize(12);
      doc.text('RISK TAKIBI', 14, y);
      y += 8;
      doc.setFontSize(10);
      doc.text(`Aktif Risk Takibindeki Ogrenci: ${reportData.riskStudentsActive}`, 20, y);
      y += 6;
      doc.text(`Yuksek/Kritik Risk: ${reportData.riskStudentsCritical}`, 20, y);
      y += 10;
      
      // Yönlendirme Nedenleri
      if (Object.keys(reportData.referralsByReason).length > 0) {
        doc.setFontSize(12);
        doc.text('YONLENDIRME NEDENLERI', 14, y);
        y += 8;
        doc.setFontSize(10);
        
        Object.entries(reportData.referralsByReason).forEach(([reason, count]) => {
          const label = REASON_LABELS[reason] || reason;
          doc.text(`${label}: ${count}`, 20, y);
          y += 6;
        });
        y += 5;
      }
      
      // Sınıf Etkinlikleri
      if (Object.keys(reportData.activitiesByType).length > 0) {
        // Sayfa kontrolü
        if (y > 250) {
          doc.addPage();
          y = 20;
        }
        
        doc.setFontSize(12);
        doc.text('SINIF ETKINLIKLERI', 14, y);
        y += 8;
        doc.setFontSize(10);
        
        Object.entries(reportData.activitiesByType).forEach(([type, count]) => {
          const label = ACTIVITY_LABELS[type] || type;
          doc.text(`${label}: ${count}`, 20, y);
          y += 6;
        });
        y += 5;
      }
      
      // Alt bilgi
      const pageCount = doc.internal.pages.length - 1;
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text(
          `Olusturma Tarihi: ${new Date().toLocaleDateString('tr-TR')} - Sayfa ${i}/${pageCount}`,
          pageWidth / 2,
          290,
          { align: 'center' }
        );
      }
      
      // PDF'i indir
      doc.save(`RPD_${reportData.period.replace(' ', '_')}_Raporu_${selectedYear}.pdf`);
      toast.success('PDF raporu oluşturuldu');
      
    } catch (error) {
      console.error('PDF oluşturulamadı:', error);
      toast.error('PDF oluşturulurken hata oluştu');
    } finally {
      setIsGenerating(false);
    }
  };
  
  // Yazdır
  const handlePrint = () => {
    window.print();
  };
  
  // Yıl seçenekleri
  const yearOptions = [];
  const currentYear = new Date().getFullYear();
  for (let i = currentYear - 5; i <= currentYear + 1; i++) {
    yearOptions.push(i);
  }

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Başlık */}
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg">
            <FileText className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Dönem Raporu</h1>
            <p className="text-sm text-slate-500">MEB format dönemsel rapor oluşturma</p>
          </div>
        </div>
      </div>
      
      {/* Filtreler */}
      <Card className="print:hidden">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="space-y-2">
              <Label>Öğretim Yılı</Label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="px-3 py-2 border rounded-lg min-w-[150px]"
              >
                {yearOptions.map(year => (
                  <option key={year} value={year}>{year}-{year + 1}</option>
                ))}
              </select>
            </div>
            
            <div className="space-y-2">
              <Label>Dönem</Label>
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="px-3 py-2 border rounded-lg min-w-[150px]"
              >
                {PERIOD_OPTIONS.map(period => (
                  <option key={period.value} value={period.value}>{period.label}</option>
                ))}
              </select>
            </div>
            
            <Button onClick={loadReportData} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Rapor Oluştur
            </Button>
            
            {reportData && (
              <>
                <Button onClick={generatePDF} disabled={isGenerating} variant="outline">
                  {isGenerating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                  PDF İndir
                </Button>
                
                <Button onClick={handlePrint} variant="outline">
                  <Printer className="h-4 w-4 mr-2" />
                  Yazdır
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Rapor İçeriği */}
      {isLoading ? (
        <Card>
          <CardContent className="py-12 flex items-center justify-center">
            <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
            <span className="ml-3 text-slate-600">Rapor verileri yükleniyor...</span>
          </CardContent>
        </Card>
      ) : reportData ? (
        <div className="space-y-6" id="report-content">
          {/* Başlık - Yazdırma için */}
          <div className="hidden print:block text-center mb-8">
            <h1 className="text-xl font-bold">DUMLUPINAR ORTAOKULU</h1>
            <h2 className="text-lg">Rehberlik ve Psikolojik Danışmanlık Hizmetleri</h2>
            <h3 className="text-lg font-medium">{reportData.period} Raporu</h3>
            <p className="text-sm text-slate-600">
              ({new Date(reportData.startDate).toLocaleDateString('tr-TR')} - {new Date(reportData.endDate).toLocaleDateString('tr-TR')})
            </p>
          </div>
          
          {/* Genel İstatistikler */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-indigo-600" />
                Genel İstatistikler
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-xl">
                  <User className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-blue-600">{reportData.totalStudents}</p>
                  <p className="text-xs text-slate-600">Görülen Öğrenci</p>
                </div>
                
                <div className="text-center p-4 bg-purple-50 rounded-xl">
                  <Target className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-purple-600">{reportData.totalReferrals}</p>
                  <p className="text-xs text-slate-600">Yönlendirme</p>
                </div>
                
                <div className="text-center p-4 bg-green-50 rounded-xl">
                  <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-green-600">{reportData.totalAppointments}</p>
                  <p className="text-xs text-slate-600">Tamamlanan Görüşme</p>
                </div>
                
                <div className="text-center p-4 bg-amber-50 rounded-xl">
                  <AlertTriangle className="h-8 w-8 text-amber-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-amber-600">{reportData.totalDiscipline}</p>
                  <p className="text-xs text-slate-600">Disiplin Olayı</p>
                </div>
                
                <div className="text-center p-4 bg-cyan-50 rounded-xl">
                  <Users className="h-8 w-8 text-cyan-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-cyan-600">{reportData.totalClassActivities}</p>
                  <p className="text-xs text-slate-600">Sınıf Etkinliği</p>
                </div>
                
                <div className="text-center p-4 bg-pink-50 rounded-xl">
                  <MessageSquare className="h-8 w-8 text-pink-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-pink-600">{reportData.totalParentContacts}</p>
                  <p className="text-xs text-slate-600">Veli İletişimi</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* RAM ve Risk */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ExternalLink className="h-5 w-5 text-purple-600" />
                  RAM Yönlendirmeleri
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                    <span>Toplam Başvuru</span>
                    <Badge className="bg-purple-100 text-purple-700">{reportData.ramReferrals}</Badge>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                    <span>Sonuçlanan</span>
                    <Badge className="bg-green-100 text-green-700">{reportData.ramCompleted}</Badge>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-amber-50 rounded-lg">
                    <span>Devam Eden</span>
                    <Badge className="bg-amber-100 text-amber-700">{reportData.ramPending}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  Risk Takibi
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                    <span>Aktif Takipteki Öğrenci</span>
                    <Badge className="bg-slate-200 text-slate-700">{reportData.riskStudentsActive}</Badge>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                    <span>Yüksek/Kritik Risk</span>
                    <Badge className="bg-red-100 text-red-700">{reportData.riskStudentsCritical}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Yönlendirme Nedenleri */}
          {Object.keys(reportData.referralsByReason).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5 text-blue-600" />
                  Yönlendirme Nedenleri Dağılımı
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {Object.entries(reportData.referralsByReason)
                    .sort(([,a], [,b]) => b - a)
                    .map(([reason, count]) => (
                      <div key={reason} className="p-3 bg-slate-50 rounded-lg">
                        <p className="text-sm text-slate-600">{REASON_LABELS[reason] || reason}</p>
                        <p className="text-xl font-bold text-slate-800">{count}</p>
                        <p className="text-xs text-slate-400">
                          %{((count / reportData.totalReferrals) * 100).toFixed(1)}
                        </p>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Sınıf Etkinlikleri Dağılımı */}
          {Object.keys(reportData.activitiesByType).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-cyan-600" />
                  Sınıf Etkinlikleri Dağılımı
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {Object.entries(reportData.activitiesByType)
                    .sort(([,a], [,b]) => b - a)
                    .map(([type, count]) => (
                      <div key={type} className="p-3 bg-cyan-50 rounded-lg">
                        <p className="text-sm text-slate-600">{ACTIVITY_LABELS[type] || type}</p>
                        <p className="text-xl font-bold text-cyan-700">{count}</p>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Sınıf Dağılımları */}
          {Object.keys(reportData.referralsByClass).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-green-600" />
                  Sınıflara Göre Yönlendirmeler
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {Object.entries(reportData.referralsByClass)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([cls, count]) => (
                      <div key={cls} className="p-3 bg-green-50 rounded-lg text-center">
                        <p className="text-sm font-medium text-slate-700">{cls}</p>
                        <p className="text-xl font-bold text-green-600">{count}</p>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Rapor Alt Bilgi */}
          <Card className="print:hidden">
            <CardContent className="p-4 text-center text-sm text-slate-500">
              <p>Rapor Oluşturma Tarihi: {new Date().toLocaleDateString('tr-TR')} {new Date().toLocaleTimeString('tr-TR')}</p>
              <p className="mt-1">DUMLUPINAR ORTAOKULU - Rehberlik ve Psikolojik Danışmanlık Servisi</p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">Rapor oluşturmak için dönem seçin ve "Rapor Oluştur" butonuna tıklayın</p>
          </CardContent>
        </Card>
      )}
      
      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #report-content, #report-content * {
            visibility: visible;
          }
          #report-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:block {
            display: block !important;
          }
        }
      `}</style>
    </div>
  );
}
