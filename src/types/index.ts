export interface SinifSube {
  value: string;
  text: string;
}

export interface Ogrenci {
  value: string;
  text: string;
}

export interface StudentData {
  Sinif_Sube: SinifSube[];
  [key: string]: SinifSube[] | Ogrenci[];
}

export interface YonlendirmeFormu {
  ogretmenAdi: string;
  sinifSube: string;
  ogrenciler: string[];
  yonlendirmeNedeni: string;
}

export interface YonlendirilenOgrenci {
  id: string;
  ogretmenAdi: string;
  ogretmenKey?: string;
  sinifSube: string;
  sinifSubeKey?: string;
  ogrenciAdi: string;
  ogrenciKey?: string;
  yonlendirmeNedenleri: string[];
  yonlendirmeNedeni: string;
  not?: string;
  tarih: string;
}

// Supabase referrals tablosu için temel tip
export interface ReferralRecord {
  id?: string;
  created_at?: string;
  teacher_name: string;
  class_key: string;
  class_display: string;
  student_name: string;
  reason: string;
  note?: string | null;
  source?: string;
}

// Yönlendirme Kategorileri ve Alt Nedenler (Hiyerarşik Yapı)
export interface YonlendirmeKategori {
  id: string;
  baslik: string;
  icon: string;
  renk: string;
  altNedenler: string[];
}

export const YONLENDIRME_KATEGORILERI: YonlendirmeKategori[] = [
  {
    id: "akademik",
    baslik: "Akademik / Okula Uyum Kaynaklı Nedenler",
    icon: "📚",
    renk: "blue",
    altNedenler: [
      "Akademik başarısızlık",
      "Derslere ilgisizlik / motivasyon düşüklüğü",
      "Ödev yapmama / sorumluluk almama",
      "Dikkat ve odaklanma güçlüğü",
      "Sınav kaygısı",
      "Okula uyum sorunu"
    ]
  },
  {
    id: "davranissal",
    baslik: "Davranışsal Nedenler",
    icon: "⚠️",
    renk: "orange",
    altNedenler: [
      "Sınıf kurallarına uymama",
      "Arkadaşlarını rahatsız etme",
      "Öğretmene karşı saygısız davranış",
      "Öfke kontrolü güçlüğü",
      "İnatlaşma / karşı gelme"
    ]
  },
  {
    id: "akran",
    baslik: "Akran İlişkileri",
    icon: "👥",
    renk: "purple",
    altNedenler: [
      "Zorbalığa maruz kalan",
      "Zorbalık yapan",
      "Sosyal iletişim güçlüğü"
    ]
  },
  {
    id: "duygusal",
    baslik: "Duygusal – Psikolojik Nedenler",
    icon: "💭",
    renk: "pink",
    altNedenler: [
      "Duygusal – Psikolojik sorunlar"
    ]
  },
  {
    id: "aile",
    baslik: "Aile Kaynaklı Nedenler",
    icon: "🏠",
    renk: "teal",
    altNedenler: [
      "Aile içi iletişim sorunları",
      "Boşanma süreci / aile değişimi",
      "Aile tutumlarıyla ilgili sorunlar",
      "Ev ortamına bağlı ders çalışma güçlüğü"
    ]
  },
  {
    id: "devamsizlik",
    baslik: "Devamsızlık ve Okul Disiplini",
    icon: "📋",
    renk: "red",
    altNedenler: [
      "Devamsızlık",
      "Geç kalma",
      "Okul kurallarına uymama",
      "Okul eşyalarına zarar verme",
      "Disipline yönlendirme"
    ]
  },
  {
    id: "dijital",
    baslik: "Dijital / Güncel Sorun Alanları",
    icon: "📱",
    renk: "indigo",
    altNedenler: [
      "Aşırı ekran kullanımı",
      "Dijital oyun bağımlılığı",
      "Sosyal medya kaynaklı sorunlar",
      "Siber zorbalık"
    ]
  },
  {
    id: "ozel",
    baslik: "Özel Durumlar",
    icon: "⭐",
    renk: "amber",
    altNedenler: [
      "Sağlık sorunlarına bağlı uyum güçlüğü",
      "Özel gereksinim şüphesi",
      "Travmatik yaşantı (kayıp, hastalık vb.)",
      "Rehberlik servisi tarafından takip edilen öğrenci"
    ]
  }
];

// Tüm alt nedenleri düz array olarak export et (geriye dönük uyumluluk için)
export const YONLENDIRME_NEDENLERI = YONLENDIRME_KATEGORILERI.flatMap(k => k.altNedenler);

export type YonlendirmeNedeni = string;

// Disiplin Ceza Türleri
export const DISIPLIN_CEZALARI = [
  "Sözlü Uyarı",
  "Öğrenci Sözleşmesi İmzalama",
  "Kınama",
  "Okul Değişikliği Talebi"
] as const;

export type DisiplinCezasi = typeof DISIPLIN_CEZALARI[number];

// Disiplin kaydı için tip
export interface DisiplinRecord {
  id?: string;
  created_at?: string;
  student_id: string;
  student_name: string;
  class_key: string;
  class_display: string;
  event_date: string;
  reason: string;
  penalty_type: DisiplinCezasi;
  notes?: string | null;
}

// =============================================
// Randevu (Appointments) Tipleri
// =============================================

// Katılımcı türleri
export const PARTICIPANT_TYPES = [
  { value: 'student', label: 'Öğrenci' },
  { value: 'parent', label: 'Veli' },
  { value: 'teacher', label: 'Öğretmen' }
] as const;

export type ParticipantType = 'student' | 'parent' | 'teacher';

// Randevu durumları
export const APPOINTMENT_STATUS = [
  { value: 'planned', label: 'Planlandı', color: 'blue' },
  { value: 'attended', label: 'Geldi', color: 'green' },
  { value: 'not_attended', label: 'Gelmedi', color: 'red' },
  { value: 'postponed', label: 'Ertelendi', color: 'amber' },
  { value: 'cancelled', label: 'İptal', color: 'slate' }
] as const;

export type AppointmentStatus = 'planned' | 'attended' | 'not_attended' | 'postponed' | 'cancelled';

// Öncelik seviyeleri
export const PRIORITY_LEVELS = [
  { value: 'normal', label: 'Normal', color: 'slate' },
  { value: 'urgent', label: 'Acil', color: 'red' }
] as const;

export type PriorityLevel = 'normal' | 'urgent';

// Görüşme yerleri
export const APPOINTMENT_LOCATIONS = [
  { value: 'guidance_office', label: 'Rehberlik Servisi' },
  { value: 'classroom', label: 'Sınıf' },
  { value: 'admin', label: 'İdare' },
  { value: 'phone', label: 'Telefon' },
  { value: 'online', label: 'Online' },
  { value: 'other', label: 'Diğer' }
] as const;

export type AppointmentLocation = 'guidance_office' | 'classroom' | 'admin' | 'phone' | 'online' | 'other';

// Ders saatleri
export const LESSON_SLOTS = [
  { value: '1. Ders', label: '1. Ders' },
  { value: '2. Ders', label: '2. Ders' },
  { value: '3. Ders', label: '3. Ders' },
  { value: '4. Ders', label: '4. Ders' },
  { value: '5. Ders', label: '5. Ders' },
  { value: '6. Ders', label: '6. Ders' },
  { value: '7. Ders', label: '7. Ders' },
] as const;

// Konu etiketleri
export const TOPIC_TAGS = [
  'Devamsızlık',
  'Akran zorbalığı',
  'Davranış düzenleme',
  'Dikkat/odak',
  'Kaygı',
  'Öfke',
  'Aile içi iletişim',
  'Akademik motivasyon',
  'Uyum/sınıf iklimi',
  'Risk',
  'Duygu-durum',
  'Arkadaşlık',
  'Ders motivasyonu',
  'Bilgilendirme',
  'Yönlendirme',
  'İş birliği',
  'Ev ortamı',
  'Davranış gözlemi',
  'Akademik durum',
  'Sosyal uyum',
  'Sınıf iklimi'
] as const;

export type TopicTag = typeof TOPIC_TAGS[number];

// Karar/yönlendirme seçenekleri
export const OUTCOME_DECISIONS = [
  'Bilgilendirme yapıldı',
  'Takip görüşmesi planlandı',
  'Sınıf öğretmeniyle iş birliği',
  'RAM / dış yönlendirme',
  'İdare bilgilendirildi',
  'Veli bilgilendirilecek',
  'Evde uygulanacak öneriler verildi',
  'Sınıf içi müdahale önerildi',
  'Gözlem devam edecek'
] as const;

export type OutcomeDecision = typeof OUTCOME_DECISIONS[number];

// Ana randevu tipi
export interface Appointment {
  id: string;
  created_at: string;
  updated_at: string;

  // Temel randevu bilgileri
  appointment_date: string;
  start_time: string;       // "1. Ders", "2. Ders" vb.
  duration?: number;        // artık kullanılmıyor, opsiyonel bırakıldı

  // Kiminle görüşme
  participant_type: ParticipantType;
  participant_name: string;
  participant_class?: string;
  participant_phone?: string;

  // Görüşme detayları
  topic_tags: string[];
  location: AppointmentLocation;
  purpose?: string;
  preparation_note?: string;

  // Durum ve öncelik
  status: AppointmentStatus;
  priority: PriorityLevel;

  // Görüşme sonrası
  outcome_summary?: string;
  outcome_decision?: string[];
  next_action?: string;
  next_appointment_id?: string;

  // Hatırlatma
  reminder_sent: boolean;

  // Şablon
  template_type?: ParticipantType;
}

// Randevu oluşturma formu için tip
export interface AppointmentFormData {
  appointment_date: string;
  start_time: string;       // "1. Ders", "2. Ders" vb.
  duration?: number;
  participant_type: ParticipantType;
  participant_name: string;
  participant_class?: string;
  participant_phone?: string;
  topic_tags: string[];
  location: AppointmentLocation;
  purpose?: string;
  preparation_note?: string;
  priority: PriorityLevel;
}

// Görüşme kapanış formu için tip
export interface AppointmentClosureData {
  status: AppointmentStatus;
  outcome_summary?: string;
  outcome_decision?: string[];
  next_action?: string;
  create_follow_up?: boolean;
}

// Randevu görevi
export interface AppointmentTask {
  id: string;
  created_at: string;
  appointment_id: string;
  task_description: string;
  is_completed: boolean;
  due_date?: string;
}

// Randevu şablonu
export interface AppointmentTemplate {
  id: string;
  created_at: string;
  template_name: string;
  template_type: ParticipantType;
  default_topic_tags: string[];
  default_duration: number;
  default_location: AppointmentLocation;
  purpose_template?: string;
  outcome_options: string[];
}
