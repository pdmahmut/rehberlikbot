import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { SinifSube } from "@/types";

// Sinif listesi.
//
// Onceden data.json icindeki sabit "Sinif_Sube" dizisinden geliyordu; yeni bir
// sube acmak dosyayi duzenleyip yeniden deploy etmeyi gerektiriyordu.
// Artik `classes` tablosunda ve PDF yuklemesiyle olusuyor.

const TABLE = "classes";

export interface ClassRecord {
  class_key: string;
  class_display: string;
  grade: number | null;
  section: string | null;
  sort_order: number;
}

/** "6A" -> { grade: 6, section: "A" } ; cozulemezse null doner. */
export function splitClassKey(classKey: string): { grade: number | null; section: string | null } {
  const m = String(classKey || "").match(/^(\d+)[-]?([A-Z0-9]*)$/i);
  if (!m) return { grade: null, section: null };
  return {
    grade: Number(m[1]),
    section: m[2] ? m[2].toLocaleUpperCase("tr-TR") : null,
  };
}

/** Siniflari dogal sirada (5A, 5B, 6A ...) siralamak icin anahtar uretir. */
export function classSortOrder(classKey: string): number {
  const { grade, section } = splitClassKey(classKey);
  const g = grade ?? 99;
  const s = section ? section.charCodeAt(0) - 64 : 0;
  return g * 100 + (s > 0 && s < 100 ? s : 50);
}

export async function listClasses(): Promise<ClassRecord[]> {
  const { data, error } = await getSupabaseAdmin()
    .from(TABLE)
    .select("class_key, class_display, grade, section, sort_order")
    .order("sort_order")
    .order("class_key");

  if (error) throw error;
  return (data || []) as ClassRecord[];
}

/** Uygulamanin her yerinde kullanilan { value, text } bicimi. */
export async function getClassOptions(): Promise<SinifSube[]> {
  const rows = await listClasses();
  return rows.map((c) => ({ value: c.class_key, text: c.class_display }));
}

export async function getClassDisplay(classKey: string): Promise<string | null> {
  const { data, error } = await getSupabaseAdmin()
    .from(TABLE)
    .select("class_display")
    .eq("class_key", classKey)
    .maybeSingle();

  if (error) throw error;
  return data?.class_display ?? null;
}

export async function upsertClasses(
  classes: Array<{ classKey: string; classDisplay: string }>
): Promise<void> {
  if (classes.length === 0) return;

  const rows = classes.map((c) => {
    const { grade, section } = splitClassKey(c.classKey);
    return {
      class_key: c.classKey,
      class_display: c.classDisplay,
      grade,
      section,
      sort_order: classSortOrder(c.classKey),
      updated_at: new Date().toISOString(),
    };
  });

  const { error } = await getSupabaseAdmin()
    .from(TABLE)
    .upsert(rows, { onConflict: "class_key" });

  if (error) throw error;
}

/** Verilen anahtarlar disindaki tum siniflari siler. */
export async function deleteClassesNotIn(keepKeys: string[]): Promise<number> {
  const supabase = getSupabaseAdmin();
  const { data: existing, error } = await supabase.from(TABLE).select("class_key");
  if (error) throw error;

  const keep = new Set(keepKeys);
  const toDelete = (existing || []).map((r) => r.class_key).filter((k) => !keep.has(k));
  if (toDelete.length === 0) return 0;

  const { error: delError } = await supabase.from(TABLE).delete().in("class_key", toDelete);
  if (delError) throw delError;
  return toDelete.length;
}
