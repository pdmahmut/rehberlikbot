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
  status?: string;
}

export const PARENT_REQUEST_TYPES = [
  { value: "gorusme", label: "Gorusme Talebi" },
  { value: "bilgilendirme", label: "Bilgilendirme Istegi" },
  { value: "destek", label: "Destek Talebi" },
  { value: "acil", label: "Acil Ihtiyac" },
  { value: "diger", label: "Diger" }
] as const;

export type ParentRequestType = "gorusme" | "bilgilendirme" | "destek" | "acil" | "diger";

export const PARENT_REQUEST_STATUSES = [
  { value: "new", label: "Yeni" },
  { value: "reviewing", label: "Inceleniyor" },
  { value: "scheduled", label: "Planlandi" },
  { value: "closed", label: "Kapatildi" }
] as const;

export type ParentRequestStatus = "new" | "reviewing" | "scheduled" | "closed";

export interface ParentMeetingRequestRecord {
  id?: string;
  created_at?: string;
  updated_at?: string;
  student_name: string;
  class_key?: string | null;
  class_display?: string | null;
  parent_name?: string | null;
  parent_relation?: string | null;
  parent_phone?: string | null;
  request_type: ParentRequestType;
  subject: string;
  detail: string;
  status: ParentRequestStatus;
  preferred_contact?: string | null;
}

export const APPLICATION_SOURCE_TYPES = [
  { value: "observation", label: "Gözlem Havuzu" },
  { value: "student_report", label: "Öğrenci Bildirimi" },
  { value: "teacher_referral", label: "Öğretmen Yönlendirmesi" },
  { value: "parent_request", label: "Veli Talebi" },
  { value: "self_application", label: "Bireysel Başvuru" }
] as const;

export type ApplicationSourceType = typeof APPLICATION_SOURCE_TYPES[number]["value"];

export const APPLICATION_STATUSES = [
  { value: "pending", label: "Bekliyor", color: "amber" },
  { value: "scheduled", label: "Randevu Verildi", color: "blue" },
  { value: "active_follow", label: "Aktif Takip", color: "cyan" },
  { value: "completed", label: "Görüşme Yapıldı", color: "emerald" }
] as const;

export type ApplicationStatus = typeof APPLICATION_STATUSES[number]["value"];

// Yönlendirme Kategorileri ve Alt Nedenler (Hiyerarşik Yapı)
export interface YonlendirmeKategori {
  id: string;
  baslik: string;
  icon: string;
  renk: string;
  altNedenler?: string[];
}

export const YONLENDIRME_KATEGORILERI: YonlendirmeKategori[] = [
  {
    id: "akademik",
    baslik: "Akademik",
    icon: "📚",
    renk: "blue"
  },
  {
    id: "davranissal",
    baslik: "Davranış Problemleri",
    icon: "⚠️",
    renk: "orange"
  },
  {
    id: "akran",
    baslik: "Akran İlişkileri ve Sosyal Problemler",
    icon: "👥",
    renk: "purple"
  },
  {
    id: "duygusal",
    baslik: "Duygusal Problemler",
    icon: "💭",
    renk: "pink"
  },
  {
    id: "aile",
    baslik: "Ailevi Sorunlar",
    icon: "🏠",
    renk: "teal"
  },
  {
    id: "devamsizlik",
    baslik: "Devamsızlık ve Okula Uyum Problemleri",
    icon: "📋",
    renk: "red"
  },
  {
    id: "riskli",
    baslik: "Riskli Durumlar",
    icon: "🚨",
    renk: "red"
  },
  {
    id: "gelisimsel",
    baslik: "Kimlik ve Gelişimsel Süreçler",
    icon: "⭐",
    renk: "amber"
  }
];

// Tüm nedenleri düz array olarak export et (geriye dönük uyumluluk için)
export const YONLENDIRME_NEDENLERI = YONLENDIRME_KATEGORILERI.map(k => k.baslik);

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

// Öğrenci bildirimi / akran şikayeti kaydı
export const INCIDENT_REPORTER_TYPES = [
  { value: 'student', label: 'Öğrenci' },
  { value: 'teacher', label: 'Öğretmen' },
  { value: 'parent', label: 'Veli' },
  { value: 'anonymous', label: 'Anonim' }
] as const;

export type IncidentReporterType = 'student' | 'teacher' | 'parent' | 'anonymous';

export const INCIDENT_TYPES = [
  { value: 'bullying', label: 'Zorbalık' },
  { value: 'conflict', label: 'Akran Çatışması' },
  { value: 'threat', label: 'Tehdit' },
  { value: 'verbal', label: 'Sözlü Saldırı' },
  { value: 'physical', label: 'Fiziksel Müdahale' },
  { value: 'damage', label: 'Eşya Zarar Verme' },
  { value: 'theft', label: 'Eşya Alma / Kaybetme' },
  { value: 'other', label: 'Diğer' }
] as const;

export type IncidentType = 'bullying' | 'conflict' | 'threat' | 'verbal' | 'physical' | 'damage' | 'theft' | 'other';

export const INCIDENT_SEVERITIES = [
  { value: 'low', label: 'Düşük' },
  { value: 'medium', label: 'Orta' },
  { value: 'high', label: 'Yüksek' },
  { value: 'critical', label: 'Kritik' }
] as const;

export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';

export const INCIDENT_STATUSES = [
  { value: 'new', label: 'Yeni' },
  { value: 'reviewing', label: 'İnceleniyor' },
  { value: 'resolved', label: 'Çözüldü' },
  { value: 'dismissed', label: 'Kapatıldı' }
] as const;

export type IncidentStatus = 'new' | 'reviewing' | 'resolved' | 'dismissed';

export interface StudentIncidentRecord {
  id?: string;
  created_at?: string;
  updated_at?: string;
  case_group_id?: string | null;
  record_role?: 'main' | 'linked_reporter';
  linked_from_id?: string | null;
  incident_date: string;
  reporter_type: IncidentReporterType;
  reporter_student_name?: string | null;
  reporter_class_key?: string | null;
  reporter_class_display?: string | null;
  target_student_name: string;
  target_class_key?: string | null;
  target_class_display?: string | null;
  incident_type: IncidentType;
  severity: IncidentSeverity;
  description: string;
  location?: string | null;
  status: IncidentStatus;
  action_taken?: string | null;
  follow_up_date?: string | null;
  notes?: string | null;
  is_confidential: boolean;
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
  { value: '1', label: '1. Ders' },
  { value: '2', label: '2. Ders' },
  { value: '3', label: '3. Ders' },
  { value: '4', label: '4. Ders' },
  { value: '5', label: '5. Ders' },
  { value: '6', label: '6. Ders' },
  { value: '7', label: '7. Ders' },
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

// Gözlem havuzu seçenekleri
export const OBSERVATION_TYPES = [
  { value: 'behavior', label: 'Davranış' },
  { value: 'academic', label: 'Akademik' },
  { value: 'social', label: 'Sosyal' },
  { value: 'emotional', label: 'Duygusal' }
] as const;

export type ObservationType = 'behavior' | 'academic' | 'social' | 'emotional';

export const OBSERVATION_PRIORITIES = [
  { value: 'low', label: 'Düşük', color: 'slate' },
  { value: 'medium', label: 'Orta', color: 'amber' },
  { value: 'high', label: 'Yüksek', color: 'red' }
] as const;

export type ObservationPriority = 'low' | 'medium' | 'high';

export const OBSERVATION_STATUSES = APPLICATION_STATUSES;

export type ObservationStatus = ApplicationStatus | 'converted' | 'randevu_verildi';

export interface ObservationPoolRecord {
  id: string;
  created_at: string;
  updated_at: string;
  observed_at: string;
  student_name: string;
  student_number?: string | null;
  class_key?: string | null;
  class_display?: string | null;
  observation_type: ObservationType;
  priority: ObservationPriority;
  note: string;
  status: ObservationStatus;
  source_type?: ApplicationSourceType;
  source_record_id?: string | null;
  source_record_table?: string | null;
  completed_at?: string | null;
  converted_at?: string | null;
  appointment_id?: string | null;
}

export interface ObservationPoolFormData {
  student_name: string;
  student_number: string;
  class_key: string;
  class_display: string;
  observation_type: ObservationType;
  priority: ObservationPriority;
  note: string;
  observed_at: string;
  source_type?: ApplicationSourceType;
}

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
  source_individual_request_id?: string;
  source_application_id?: string;
  source_application_type?: ApplicationSourceType;

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
  source_individual_request_id?: string;
  source_application_id?: string;
  source_application_type?: ApplicationSourceType;
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
// Bireysel Başvuru Kaydı
export interface IndividualRequestRecord {
  id?: string;
  created_at?: string;
  updated_at?: string;
  student_name: string;
  class_key?: string | null;
  class_display?: string | null;
  request_date: string;
  note?: string | null;
  status: 'pending' | 'scheduled' | 'completed' | 'cancelled';
}