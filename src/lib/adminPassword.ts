import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { hashPassword, normalizePassword, validatePasswordStrength, verifyPassword } from "@/lib/password";

// Yonetici sifresi app_settings tablosunda hash'li olarak tutulur.
//
// Onceki surumde var/admin-password.json icinde DUZ METIN olarak sakalaniyordu;
// bu hem repoya sizmisti hem de Vercel'in salt-okunur dosya sisteminde
// sifre degisiklikleri kalici olmuyordu.

const HASH_KEY = "admin_password_hash";
const HISTORY_KEY = "admin_password_history";
const MAX_HISTORY = 20;

async function readSetting(key: string): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();

  if (error) throw error;
  return data?.value ?? null;
}

async function writeSetting(key: string, value: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("app_settings")
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });

  if (error) throw error;
}

async function readHistory(): Promise<string[]> {
  const raw = await readSetting(HISTORY_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Ilk kurulumda app_settings bos olur. Bu durumda ADMIN_PASSWORD ortam
 * degiskeni ile karsilastirilir ve dogruysa hash'i kaydedilir (tek seferlik).
 */
async function bootstrapFromEnv(password: string): Promise<boolean> {
  const envPassword = process.env.ADMIN_PASSWORD;
  if (!envPassword) return false;
  if (normalizePassword(password) !== normalizePassword(envPassword)) return false;

  await writeSetting(HASH_KEY, hashPassword(password));
  return true;
}

export async function verifyAdminPassword(password: string): Promise<boolean> {
  const entered = String(password || "").trim();
  if (!entered) return false;

  const stored = await readSetting(HASH_KEY);
  if (!stored) return bootstrapFromEnv(entered);

  return verifyPassword(entered, stored);
}

export async function updateAdminPassword(
  oldPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  const trimmedOld = String(oldPassword || "").trim();
  const trimmedNew = String(newPassword || "").trim();

  if (!trimmedOld || !trimmedNew) {
    return { success: false, error: "Tüm alanlar zorunlu" };
  }
  if (!(await verifyAdminPassword(trimmedOld))) {
    return { success: false, error: "Mevcut şifre yanlış" };
  }

  const strength = validatePasswordStrength(trimmedNew);
  if (!strength.ok) {
    return { success: false, error: strength.error };
  }
  if (normalizePassword(trimmedNew) === normalizePassword(trimmedOld)) {
    return { success: false, error: "Yeni şifre mevcut şifreyle aynı olamaz" };
  }

  const history = await readHistory();
  if (history.some((hash) => verifyPassword(trimmedNew, hash))) {
    return { success: false, error: "Bu şifre daha önce kullanılmış. Farklı bir şifre seçin." };
  }

  const currentHash = await readSetting(HASH_KEY);
  await writeSetting(HASH_KEY, hashPassword(trimmedNew));
  await writeSetting(
    HISTORY_KEY,
    JSON.stringify([currentHash, ...history].filter(Boolean).slice(0, MAX_HISTORY))
  );

  return { success: true };
}
