import { type SupabaseClient } from "@supabase/supabase-js";
import { normalizeTr } from "@/lib/teachers";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  decryptPassword,
  encryptPassword,
  generatePassword,
  passwordLookup,
} from "@/lib/password";

export interface TeacherUserRecord {
  id: string;
  username: string;
  teacher_name: string;
  class_key: string | null;
  class_display: string | null;
  password_cipher: string | null;
  created_at: string;
}

/** Yoneticiye donulen kayit: sifre cozulmus haliyle eklenir. */
export interface TeacherUserWithPassword extends TeacherUserRecord {
  password: string | null;
}

const TEACHER_USER_COLUMNS =
  "id, username, teacher_name, class_key, class_display, password_cipher, created_at";

/** Kaydi yoneticiye gosterilebilecek bicime cevirir (sifreyi cozer). */
export function withDecryptedPassword(user: TeacherUserRecord): TeacherUserWithPassword {
  return { ...user, password: decryptPassword(user.password_cipher) };
}

const isRlsPolicyError = (error: unknown) => {
  const message = String(
    (error as { message?: string; details?: string } | null)?.message ||
      (error as { details?: string } | null)?.details ||
      ""
  ).toLocaleLowerCase("en-US");

  return message.includes("row-level security policy");
};

const generateSystemUsername = (teacherName: string) => {
  const base =
    teacherName
      .toLocaleLowerCase("tr-TR")
      .trim()
      .replace(/\s+/g, ".")
      .replace(/[^a-z0-9.]/g, "")
      .slice(0, 24) || "ogretmen";

  return `${base}.${Date.now()}`;
};

export function getTeacherAccountsSupabase(): SupabaseClient {
  // teacher_users / teacher_password_history RLS ile kilitli; anon anahtar yetmez.
  return getSupabaseAdmin();
}

export async function findTeacherAccountByName(
  supabase: SupabaseClient,
  teacherName: string
): Promise<TeacherUserRecord | null> {
  const normalizedTarget = normalizeTr(teacherName);
  const { data, error } = await supabase
    .from("teacher_users")
    .select(TEACHER_USER_COLUMNS)
    .order("teacher_name");

  if (error) throw error;

  return (
    (data || []).find(
      (user) => normalizeTr(String(user.teacher_name || "")) === normalizedTarget
    ) || null
  );
}

/**
 * Kullanilmamis rastgele bir sifre uretir.
 *
 * Sadece-sifre girisi kullanildigi icin sifreler sistem genelinde benzersiz
 * olmak ZORUNDA: ayni sifreye sahip iki ogretmen olursa giriste hangisi
 * oldugu ayirt edilemez. Carpisma kontrolu kor indeks uzerinden yapilir,
 * gecmiste kullanilmis sifreler de haric tutulur.
 */
async function buildAutoPassword(supabase: SupabaseClient): Promise<string> {
  const [{ data: users, error: usersError }, { data: history, error: historyError }] =
    await Promise.all([
      supabase.from("teacher_users").select("password_lookup"),
      supabase.from("teacher_password_history").select("password_lookup"),
    ]);

  if (usersError) throw usersError;
  if (historyError && !isRlsPolicyError(historyError)) throw historyError;

  const used = new Set<string>();
  for (const user of users || []) {
    if (user.password_lookup) used.add(user.password_lookup);
  }
  for (const row of history || []) {
    if (row.password_lookup) used.add(row.password_lookup);
  }

  for (let attempt = 0; attempt < 50; attempt++) {
    const candidate = generatePassword();
    if (!used.has(passwordLookup(candidate))) return candidate;
  }

  throw new Error("Benzersiz şifre üretilemedi");
}

export async function ensureTeacherAccount(
  teacherName: string
): Promise<{ user: TeacherUserRecord; created: boolean }> {
  const trimmedTeacherName = String(teacherName || "").trim();
  if (!trimmedTeacherName) {
    throw new Error("Öğretmen adı zorunludur");
  }

  const supabase = getTeacherAccountsSupabase();
  const existingUser = await findTeacherAccountByName(supabase, trimmedTeacherName);

  if (existingUser) {
    return { user: existingUser, created: false };
  }

  const generatedPassword = await buildAutoPassword(supabase);
  const generatedUsername = generateSystemUsername(trimmedTeacherName);

  const { data, error } = await supabase
    .from("teacher_users")
    .insert({
      username: generatedUsername,
      password_lookup: passwordLookup(generatedPassword),
      password_cipher: encryptPassword(generatedPassword),
      teacher_name: trimmedTeacherName,
    })
    .select(TEACHER_USER_COLUMNS)
    .single();

  if (error) throw error;

  const { error: historyError } = await supabase.from("teacher_password_history").insert({
    teacher_user_id: data.id,
    password_lookup: passwordLookup(generatedPassword),
  });

  if (historyError && !isRlsPolicyError(historyError)) {
    await supabase.from("teacher_users").delete().eq("id", data.id);
    throw historyError;
  }

  return { user: data, created: true };
}

export async function syncTeacherAccountClassAssignment(
  teacherName: string,
  classKey: string,
  classDisplay: string
): Promise<void> {
  const trimmedTeacherName = String(teacherName || "").trim();
  if (!trimmedTeacherName || !classKey || !classDisplay) {
    throw new Error("Öğretmen ve sınıf bilgisi zorunludur");
  }

  const supabase = getTeacherAccountsSupabase();
  const ensuredAccount = await ensureTeacherAccount(trimmedTeacherName);

  const { error: clearClassError } = await supabase
    .from("teacher_users")
    .update({ class_key: null, class_display: null })
    .eq("class_key", classKey)
    .neq("id", ensuredAccount.user.id);

  if (clearClassError) throw clearClassError;

  const { error: updateTeacherError } = await supabase
    .from("teacher_users")
    .update({ class_key: classKey, class_display: classDisplay })
    .eq("id", ensuredAccount.user.id);

  if (updateTeacherError) throw updateTeacherError;
}

export async function clearTeacherAccountClassAssignment(
  teacherName: string
): Promise<void> {
  const trimmedTeacherName = String(teacherName || "").trim();
  if (!trimmedTeacherName) {
    throw new Error("Öğretmen adı zorunludur");
  }

  const supabase = getTeacherAccountsSupabase();
  const teacherAccount = await findTeacherAccountByName(supabase, trimmedTeacherName);

  if (!teacherAccount) {
    return;
  }

  const { error } = await supabase
    .from("teacher_users")
    .update({ class_key: null, class_display: null })
    .eq("id", teacherAccount.id);

  if (error) throw error;
}
