import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

// "Yeni Döneme Başla" işlemi.
//
// Sene sonunda sistemi boşaltır: öğrenci verileri, sınıflar, geçmiş kayıtlar
// ve öğretmen kadrosu silinir. Yeni dönem sıfırdan kurulur.
//
// KORUNAN TABLOLAR (silinmemeli, aşağıdaki listeye ASLA eklenmemeli):
//   app_settings  -> yönetici şifresinin hash'i burada. Silinirse panele
//                    giriş yapılamaz.
//   login_attempts-> geçici sayaç, dönemle ilgisi yok
//   lesson_hours  -> okulun ders saatleri; öğrenci verisi değil, her yıl
//                    büyük ölçüde aynı. Programım ekranından düzenlenir.
//   student_imports -> yükleme geçmişi kaydı (denetim izi)

export interface ResetGroup {
  key: string;
  label: string;
  tables: string[];
}

export const RESET_GROUPS: ResetGroup[] = [
  {
    key: "students",
    label: "Öğrenci listesi ve sınıflar",
    tables: ["class_students", "classes"],
  },
  {
    key: "records",
    label: "Yönlendirme, randevu ve görüşme kayıtları",
    tables: [
      "referrals",
      "appointments",
      "appointment_tasks",
      "observation_pool",
      "individual_requests",
      "parent_meeting_requests",
      "student_incidents",
      "follow_ups",
    ],
  },
  {
    key: "guidance",
    label: "Sınıf rehberliği planları ve görevler",
    tables: ["guidance_plans", "guidance_topics", "tasks", "class_activities"],
  },
  {
    key: "requests",
    label: "Talepler ve bildirimler",
    tables: [
      "class_requests",
      "class_request_categories",
      "class_student_requests",
      "deletion_requests",
      "work_requests",
      "admin_notification_states",
    ],
  },
  {
    key: "teachers",
    label: "Öğretmen kadrosu ve giriş hesapları",
    tables: ["teacher_password_history", "teacher_users", "teachers"],
  },
];

/** Silinmesi yasak tablolar. Kod değişse bile bu tablolar korunur. */
const PROTECTED_TABLES = new Set([
  "app_settings",
  "login_attempts",
  "lesson_hours",
  "student_imports",
]);

export const ALL_RESET_TABLES = RESET_GROUPS.flatMap((g) => g.tables);

/** Her tablodaki kayıt sayısını döndürür (silmeden önce göstermek için). */
export async function getResetSummary(): Promise<
  Array<{ key: string; label: string; count: number; tables: Array<{ table: string; count: number }> }>
> {
  const supabase = getSupabaseAdmin();

  const result = [];
  for (const group of RESET_GROUPS) {
    const tables = [];
    let total = 0;

    for (const table of group.tables) {
      const { count, error } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true });

      // Tablo yoksa sessizce atla (şema sürümleri arasında fark olabilir)
      const n = error ? 0 : count ?? 0;
      tables.push({ table, count: n });
      total += n;
    }

    result.push({ key: group.key, label: group.label, count: total, tables });
  }

  return result;
}

export interface ResetResult {
  deleted: Array<{ table: string; count: number }>;
  failed: Array<{ table: string; error: string }>;
  totalDeleted: number;
}

/**
 * Tabloları boşaltır.
 *
 * Silme sırası önemli: önce çocuk kayıtlar (teacher_password_history),
 * sonra ana kayıtlar (teacher_users). RESET_GROUPS içindeki sıra buna göre.
 */
export async function performReset(): Promise<ResetResult> {
  const supabase = getSupabaseAdmin();
  const deleted: Array<{ table: string; count: number }> = [];
  const failed: Array<{ table: string; error: string }> = [];

  for (const table of ALL_RESET_TABLES) {
    if (PROTECTED_TABLES.has(table)) {
      failed.push({ table, error: "korumalı tablo — silinmedi" });
      continue;
    }

    try {
      const { count: before } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true });

      if (!before) {
        deleted.push({ table, count: 0 });
        continue;
      }

      // Tüm satırları sil. Her tabloda created_at bulunduğu doğrulandı;
      // PostgREST silme işlemi için bir koşul zorunlu kıldığından bu kullanılıyor.
      const { error } = await supabase.from(table).delete().gte("created_at", "1970-01-01");

      if (error) {
        failed.push({ table, error: error.message });
        continue;
      }

      const { count: after } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true });

      deleted.push({ table, count: (before ?? 0) - (after ?? 0) });
    } catch (err) {
      failed.push({ table, error: err instanceof Error ? err.message : "bilinmeyen hata" });
    }
  }

  return {
    deleted,
    failed,
    totalDeleted: deleted.reduce((n, d) => n + d.count, 0),
  };
}
