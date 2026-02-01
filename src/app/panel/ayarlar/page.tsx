"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Settings,
  Building2,
  User,
  Bell,
  Palette,
  FileText,
  Save,
  RefreshCw,
  Check,
  X,
  Phone,
  MapPin,
  Calendar,
  Mail,
  MessageSquare,
  Moon,
  Sun,
  Monitor,
  Loader2,
  Shield,
  Key,
  Database,
  Info,
  AlertCircle,
  CheckCircle2
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

// Ayar tipi
interface Setting {
  setting_key: string;
  setting_value: unknown;
  category: string;
}

// Varsayılan ayarlar
const DEFAULT_SETTINGS = {
  // Okul bilgileri
  school_name: 'DUMLUPINAR ORTAOKULU',
  school_address: '',
  school_phone: '',
  school_email: '',
  school_principal: '',
  
  // Danışman bilgileri
  counselor_name: 'Mahmut Karadeniz',
  counselor_title: 'Rehber Öğretmen ve Psikolojik Danışman',
  counselor_phone: '',
  counselor_email: '',
  
  // Akademik yıl
  academic_year: '2025-2026',
  semester: '1',
  
  // Bildirim ayarları
  telegram_notifications: true,
  email_notifications: false,
  daily_summary: true,
  appointment_reminder: true,
  reminder_hours: 24,
  
  // Görünüm ayarları
  theme: 'light',
  sidebar_collapsed: false,
  compact_mode: false,
  
  // Şablon ayarları
  signature_text: 'Mahmut Karadeniz\nRehber Öğretmen ve Psikolojik Danışman',
  document_header: 'DUMLUPINAR ORTAOKULU\nREHBERLİK SERVİSİ',
  document_footer: ''
};

export default function AyarlarPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState<Record<string, unknown>>(DEFAULT_SETTINGS);
  const [hasChanges, setHasChanges] = useState(false);
  const [activeTab, setActiveTab] = useState('okul');
  
  // Ayarları yükle
  useEffect(() => {
    loadSettings();
  }, []);
  
  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*');
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        const loadedSettings: Record<string, unknown> = { ...DEFAULT_SETTINGS };
        data.forEach((s: Setting) => {
          // JSON değerini parse et
          try {
            loadedSettings[s.setting_key] = typeof s.setting_value === 'string' 
              ? JSON.parse(s.setting_value) 
              : s.setting_value;
          } catch {
            loadedSettings[s.setting_key] = s.setting_value;
          }
        });
        setSettings(loadedSettings);
      }
    } catch (error) {
      console.error('Ayarlar yüklenemedi:', error);
      toast.error('Ayarlar yüklenirken hata oluştu');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Ayar değişikliği
  const handleChange = (key: string, value: unknown) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };
  
  // Ayarları kaydet
  const saveSettings = async () => {
    setIsSaving(true);
    try {
      // Her ayarı ayrı ayrı upsert et
      const settingsArray = Object.entries(settings).map(([key, value]) => ({
        setting_key: key,
        setting_value: JSON.stringify(value),
        category: getCategoryForKey(key),
        updated_at: new Date().toISOString()
      }));
      
      for (const setting of settingsArray) {
        const { error } = await supabase
          .from('settings')
          .upsert(setting, { onConflict: 'setting_key' });
        
        if (error) throw error;
      }
      
      toast.success('Ayarlar başarıyla kaydedildi');
      setHasChanges(false);
    } catch (error) {
      console.error('Ayarlar kaydedilemedi:', error);
      toast.error('Ayarlar kaydedilirken hata oluştu');
    } finally {
      setIsSaving(false);
    }
  };
  
  // Anahtar için kategori belirle
  const getCategoryForKey = (key: string): string => {
    if (key.startsWith('school_')) return 'okul';
    if (key.startsWith('counselor_')) return 'okul';
    if (key.startsWith('academic_') || key === 'semester') return 'genel';
    if (key.includes('notification') || key.includes('reminder') || key === 'daily_summary') return 'bildirim';
    if (key === 'theme' || key.includes('_mode') || key.includes('sidebar')) return 'gorunum';
    if (key.includes('signature') || key.includes('document_')) return 'sablon';
    return 'genel';
  };
  
  // Varsayılanlara sıfırla
  const resetToDefaults = () => {
    if (confirm('Tüm ayarlar varsayılan değerlere sıfırlanacak. Emin misiniz?')) {
      setSettings(DEFAULT_SETTINGS);
      setHasChanges(true);
      toast.info('Ayarlar varsayılanlara sıfırlandı. Kaydetmeyi unutmayın!');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 text-slate-500 animate-spin" />
        <span className="ml-3 text-slate-600">Ayarlar yükleniyor...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-slate-600 to-slate-800 rounded-xl shadow-lg">
            <Settings className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Ayarlar</h1>
            <p className="text-sm text-slate-500">Sistem ve uygulama ayarlarını yönetin</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {hasChanges && (
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
              <AlertCircle className="h-3 w-3 mr-1" />
              Kaydedilmemiş değişiklikler
            </Badge>
          )}
          <Button variant="outline" onClick={resetToDefaults}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Sıfırla
          </Button>
          <Button 
            onClick={saveSettings} 
            disabled={!hasChanges || isSaving}
            className="bg-gradient-to-r from-slate-600 to-slate-800"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Kaydet
          </Button>
        </div>
      </div>
      
      {/* Ayar Sekmeleri */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-5 w-full max-w-2xl">
          <TabsTrigger value="okul" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">Okul</span>
          </TabsTrigger>
          <TabsTrigger value="danisman" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Danışman</span>
          </TabsTrigger>
          <TabsTrigger value="bildirim" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Bildirim</span>
          </TabsTrigger>
          <TabsTrigger value="gorunum" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            <span className="hidden sm:inline">Görünüm</span>
          </TabsTrigger>
          <TabsTrigger value="sablon" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Şablon</span>
          </TabsTrigger>
        </TabsList>
        
        {/* Okul Bilgileri */}
        <TabsContent value="okul" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-slate-600" />
                Okul Bilgileri
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="school_name">Okul Adı</Label>
                  <Input
                    id="school_name"
                    value={settings.school_name as string}
                    onChange={(e) => handleChange('school_name', e.target.value)}
                    placeholder="Okul adını girin"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="school_principal">Okul Müdürü</Label>
                  <Input
                    id="school_principal"
                    value={settings.school_principal as string}
                    onChange={(e) => handleChange('school_principal', e.target.value)}
                    placeholder="Müdür adını girin"
                  />
                </div>
                
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="school_address">Adres</Label>
                  <Input
                    id="school_address"
                    value={settings.school_address as string}
                    onChange={(e) => handleChange('school_address', e.target.value)}
                    placeholder="Okul adresini girin"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="school_phone">Telefon</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      id="school_phone"
                      value={settings.school_phone as string}
                      onChange={(e) => handleChange('school_phone', e.target.value)}
                      placeholder="0XXX XXX XX XX"
                      className="pl-10"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="school_email">E-posta</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      id="school_email"
                      type="email"
                      value={settings.school_email as string}
                      onChange={(e) => handleChange('school_email', e.target.value)}
                      placeholder="okul@meb.gov.tr"
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>
              
              <div className="pt-4 border-t">
                <h3 className="text-sm font-medium text-slate-700 mb-4 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Akademik Dönem
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="academic_year">Öğretim Yılı</Label>
                    <Input
                      id="academic_year"
                      value={settings.academic_year as string}
                      onChange={(e) => handleChange('academic_year', e.target.value)}
                      placeholder="2025-2026"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Dönem</Label>
                    <div className="flex gap-2">
                      {['1', '2'].map(sem => (
                        <button
                          key={sem}
                          onClick={() => handleChange('semester', sem)}
                          className={`flex-1 py-2 px-4 rounded-lg border-2 font-medium transition-all ${
                            settings.semester === sem
                              ? 'border-slate-800 bg-slate-800 text-white'
                              : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          {sem}. Dönem
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Danışman Bilgileri */}
        <TabsContent value="danisman" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-slate-600" />
                Danışman Bilgileri
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="counselor_name">Ad Soyad</Label>
                  <Input
                    id="counselor_name"
                    value={settings.counselor_name as string}
                    onChange={(e) => handleChange('counselor_name', e.target.value)}
                    placeholder="Ad Soyad"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="counselor_title">Unvan</Label>
                  <Input
                    id="counselor_title"
                    value={settings.counselor_title as string}
                    onChange={(e) => handleChange('counselor_title', e.target.value)}
                    placeholder="Rehber Öğretmen ve Psikolojik Danışman"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="counselor_phone">Telefon</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      id="counselor_phone"
                      value={settings.counselor_phone as string}
                      onChange={(e) => handleChange('counselor_phone', e.target.value)}
                      placeholder="0XXX XXX XX XX"
                      className="pl-10"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="counselor_email">E-posta</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      id="counselor_email"
                      type="email"
                      value={settings.counselor_email as string}
                      onChange={(e) => handleChange('counselor_email', e.target.value)}
                      placeholder="danışman@meb.gov.tr"
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>
              
              <div className="p-4 bg-slate-50 rounded-xl">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-slate-500 mt-0.5" />
                  <div>
                    <p className="text-sm text-slate-600">
                      Bu bilgiler belge şablonlarında ve bildirimlerde kullanılacaktır.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Bildirim Ayarları */}
        <TabsContent value="bildirim" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-slate-600" />
                Bildirim Ayarları
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <MessageSquare className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-800">Telegram Bildirimleri</p>
                      <p className="text-sm text-slate-500">Yönlendirmeler için Telegram bildirimi gönder</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleChange('telegram_notifications', !settings.telegram_notifications)}
                    className={`w-12 h-6 rounded-full transition-all ${
                      settings.telegram_notifications ? 'bg-blue-500' : 'bg-slate-300'
                    }`}
                  >
                    <span className={`block w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      settings.telegram_notifications ? 'translate-x-6' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <Mail className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-800">E-posta Bildirimleri</p>
                      <p className="text-sm text-slate-500">Önemli olaylar için e-posta gönder</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleChange('email_notifications', !settings.email_notifications)}
                    className={`w-12 h-6 rounded-full transition-all ${
                      settings.email_notifications ? 'bg-green-500' : 'bg-slate-300'
                    }`}
                  >
                    <span className={`block w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      settings.email_notifications ? 'translate-x-6' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <Calendar className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-800">Günlük Özet</p>
                      <p className="text-sm text-slate-500">Her gün sonunda özet bildirim gönder</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleChange('daily_summary', !settings.daily_summary)}
                    className={`w-12 h-6 rounded-full transition-all ${
                      settings.daily_summary ? 'bg-purple-500' : 'bg-slate-300'
                    }`}
                  >
                    <span className={`block w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      settings.daily_summary ? 'translate-x-6' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-100 rounded-lg">
                      <Bell className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-800">Randevu Hatırlatıcı</p>
                      <p className="text-sm text-slate-500">Randevudan önce hatırlatma gönder</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleChange('appointment_reminder', !settings.appointment_reminder)}
                    className={`w-12 h-6 rounded-full transition-all ${
                      settings.appointment_reminder ? 'bg-amber-500' : 'bg-slate-300'
                    }`}
                  >
                    <span className={`block w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      settings.appointment_reminder ? 'translate-x-6' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>
                
                {Boolean(settings.appointment_reminder) && (
                  <div className="ml-16 p-4 bg-amber-50 rounded-xl border border-amber-200">
                    <Label htmlFor="reminder_hours" className="text-sm">Kaç saat önce hatırlat?</Label>
                    <div className="flex items-center gap-2 mt-2">
                      <Input
                        id="reminder_hours"
                        type="number"
                        min="1"
                        max="72"
                        value={settings.reminder_hours as number}
                        onChange={(e) => handleChange('reminder_hours', parseInt(e.target.value) || 24)}
                        className="w-20"
                      />
                      <span className="text-sm text-slate-600">saat</span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Görünüm Ayarları */}
        <TabsContent value="gorunum" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5 text-slate-600" />
                Görünüm Ayarları
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium mb-3 block">Tema</Label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { value: 'light', label: 'Açık', icon: Sun },
                      { value: 'dark', label: 'Koyu', icon: Moon },
                      { value: 'system', label: 'Sistem', icon: Monitor }
                    ].map(theme => (
                      <button
                        key={theme.value}
                        onClick={() => handleChange('theme', theme.value)}
                        className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${
                          settings.theme === theme.value
                            ? 'border-slate-800 bg-slate-50'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <theme.icon className={`h-6 w-6 ${
                          settings.theme === theme.value ? 'text-slate-800' : 'text-slate-400'
                        }`} />
                        <span className={`text-sm font-medium ${
                          settings.theme === theme.value ? 'text-slate-800' : 'text-slate-500'
                        }`}>{theme.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                  <div>
                    <p className="font-medium text-slate-800">Kompakt Mod</p>
                    <p className="text-sm text-slate-500">Daha az boşlukla daha fazla içerik</p>
                  </div>
                  <button
                    onClick={() => handleChange('compact_mode', !settings.compact_mode)}
                    className={`w-12 h-6 rounded-full transition-all ${
                      settings.compact_mode ? 'bg-slate-800' : 'bg-slate-300'
                    }`}
                  >
                    <span className={`block w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      settings.compact_mode ? 'translate-x-6' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Şablon Ayarları */}
        <TabsContent value="sablon" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-slate-600" />
                Belge Şablonları
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="document_header">Belge Üst Bilgi</Label>
                  <textarea
                    id="document_header"
                    value={settings.document_header as string}
                    onChange={(e) => handleChange('document_header', e.target.value)}
                    rows={3}
                    className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                    placeholder="Belge başlığında görünecek metin"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="signature_text">İmza Metni</Label>
                  <textarea
                    id="signature_text"
                    value={settings.signature_text as string}
                    onChange={(e) => handleChange('signature_text', e.target.value)}
                    rows={3}
                    className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                    placeholder="Belge sonunda görünecek imza"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="document_footer">Belge Alt Bilgi</Label>
                  <textarea
                    id="document_footer"
                    value={settings.document_footer as string}
                    onChange={(e) => handleChange('document_footer', e.target.value)}
                    rows={2}
                    className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                    placeholder="Belge altında görünecek metin (opsiyonel)"
                  />
                </div>
              </div>
              
              {/* Önizleme */}
              <div className="pt-4 border-t">
                <Label className="text-sm font-medium mb-3 block">Önizleme</Label>
                <div className="p-6 bg-white border-2 border-dashed rounded-xl">
                  <div className="text-center mb-6">
                    <pre className="text-sm text-slate-600 whitespace-pre-wrap font-sans">
                      {settings.document_header as string}
                    </pre>
                  </div>
                  <div className="h-20 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 text-sm">
                    [Belge İçeriği]
                  </div>
                  <div className="text-right mt-6">
                    <pre className="text-sm text-slate-600 whitespace-pre-wrap font-sans">
                      {settings.signature_text as string}
                    </pre>
                  </div>
                  {Boolean(settings.document_footer) && (
                    <div className="text-center mt-4 pt-4 border-t">
                      <pre className="text-xs text-slate-400 whitespace-pre-wrap font-sans">
                        {settings.document_footer as string}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Sistem Bilgisi */}
      <Card className="bg-slate-50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-4 text-slate-500">
              <span className="flex items-center gap-1">
                <Database className="h-4 w-4" />
                Supabase
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Bağlı
              </span>
            </div>
            <div className="text-slate-400">
              RPD App v2.0
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
