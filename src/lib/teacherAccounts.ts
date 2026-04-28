import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { normalizeTr } from "@/lib/teachers";

export interface TeacherUserRecord {
  id: string;
  username: string;
  teacher_name: string;
  class_key: string | null;
  class_display: string | null;
  password_hash: string | null;
  created_at: string;
}

const TEACHER_USER_COLUMNS =
  "id, username, teacher_name, class_key, class_display, password_hash, created_at";

const normalizeTeacherPassword = (value: string) =>
  String(value || "").trim().toLocaleLowerCase("tr-TR");

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

const getPasswordBaseFromTeacherName = (teacherName: string) => {
  const firstName =
    String(teacherName || "")
      .trim()
      .split(/\s+/)[0]
      ?.toLocaleLowerCase("tr-TR")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/gi, "") || "ogretmen";

  if (firstName.length >= 4) {
    return firstName;
  }

  return `${firstName}${"1234".slice(0, 4 - firstName.length)}`;
};

export function getTeacherAccountsSupabase(): SupabaseClient {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Supabase yapılandırması eksik");
  }

  return createClient(url, key);
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

async function buildAutoPassword(supabase: SupabaseClient, teacherName: string) {
  const base = getPasswordBaseFromTeacherName(teacherName);

  const [{ data: users, error: usersError }, { data: history, error: historyError }] =
    await Promise.all([
      supabase.from("teacher_users").select("password_hash"),
      supabase.from("teacher_password_history").select("normalized_password"),
    ]);

  if (usersError) throw usersError;
  if (historyError && !isRlsPolicyError(historyError)) throw historyError;

  const usedPasswords = new Set<string>();

  for (const user of users || []) {
    if (user.password_hash?.trim()) {
      usedPasswords.add(normalizeTeacherPassword(user.password_hash));
    }
  }

  for (const row of history || []) {
    if (row.normalized_password?.trim()) {
      usedPasswords.add(normalizeTeacherPassword(row.normalized_password));
    }
  }

  let candidate = base;
  let suffix = 1;

  while (usedPasswords.has(normalizeTeacherPassword(candidate))) {
    suffix += 1;
    candidate = `${base}${suffix}`;
  }

  return candidate;
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

  const generatedPassword = await buildAutoPassword(supabase, trimmedTeacherName);
  const generatedUsername = generateSystemUsername(trimmedTeacherName);

  const { data, error } = await supabase
    .from("teacher_users")
    .insert({
      username: generatedUsername,
      password_hash: generatedPassword,
      teacher_name: trimmedTeacherName,
    })
    .select(TEACHER_USER_COLUMNS)
    .single();

  if (error) throw error;

  const { error: historyError } = await supabase.from("teacher_password_history").insert({
    teacher_user_id: data.id,
    normalized_password: normalizeTeacherPassword(generatedPassword),
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
