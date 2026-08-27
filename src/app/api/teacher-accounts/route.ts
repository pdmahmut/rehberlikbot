import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/apiAuth";
import {
  findTeacherAccountByName,
  getTeacherAccountsSupabase,
  withDecryptedPassword,
  type TeacherUserRecord,
} from "@/lib/teacherAccounts";
import {
  encryptPassword,
  generatePassword,
  passwordLookup,
  validatePasswordStrength,
} from "@/lib/password";

export const runtime = "nodejs";

const isRlsPolicyError = (error: unknown) => {
  const message = String(
    (error as { message?: string; details?: string } | null)?.message ||
      (error as { details?: string } | null)?.details ||
      ""
  ).toLocaleLowerCase("en-US");

  return message.includes("row-level security policy");
};

const errorMessage = (err: unknown) =>
  err instanceof Error ? err.message : "Beklenmeyen hata";

/**
 * Sifrenin sistemde (aktif hesaplarda veya gecmiste) kullanilip kullanilmadigini
 * kor indeks uzerinden kontrol eder. Sadece-sifre girisi oldugu icin ayni sifreye
 * iki hesap sahip olamaz.
 */
async function findPasswordConflict(
  supabase: ReturnType<typeof getTeacherAccountsSupabase>,
  password: string,
  exceptUserId?: string
): Promise<string | null> {
  const lookup = passwordLookup(password);

  let userQuery = supabase.from("teacher_users").select("id").eq("password_lookup", lookup);
  if (exceptUserId) userQuery = userQuery.neq("id", exceptUserId);

  const { data: sameUser } = await userQuery.maybeSingle();
  if (sameUser) return "Bu şifre başka bir öğretmende kullanılıyor";

  const { data: inHistory } = await supabase
    .from("teacher_password_history")
    .select("id")
    .eq("password_lookup", lookup)
    .maybeSingle();
  if (inHistory) return "Bu şifre daha önce kullanılmış. Farklı bir şifre girin.";

  return null;
}

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const supabase = getTeacherAccountsSupabase();
    const { data, error } = await supabase
      .from("teacher_users")
      .select("id, username, teacher_name, class_key, class_display, password_cipher, created_at")
      .order("teacher_name");

    if (error) throw error;

    // Sifreler yoneticiye cozulmus halde donulur (dagitim icin).
    const users = (data as TeacherUserRecord[] | null || []).map(withDecryptedPassword);
    return NextResponse.json({ users });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const { password, teacher_name } = await request.json();

    if (!teacher_name) {
      return NextResponse.json({ error: "Öğretmen adı zorunludur" }, { status: 400 });
    }

    // Sifre verilmezse sistem rastgele uretir.
    const finalPassword = String(password || "").trim() || generatePassword();

    if (password) {
      const strength = validatePasswordStrength(finalPassword);
      if (!strength.ok) {
        return NextResponse.json({ error: strength.error }, { status: 400 });
      }
    }

    const supabase = getTeacherAccountsSupabase();
    const trimmedTeacherName = String(teacher_name).trim();

    if (await findTeacherAccountByName(supabase, trimmedTeacherName)) {
      return NextResponse.json({ error: "Bu öğretmen için zaten bir hesap var" }, { status: 409 });
    }

    const conflict = await findPasswordConflict(supabase, finalPassword);
    if (conflict) return NextResponse.json({ error: conflict }, { status: 409 });

    const usernameBase =
      trimmedTeacherName
        .toLocaleLowerCase("tr-TR")
        .trim()
        .replace(/\s+/g, ".")
        .replace(/[^a-z0-9.]/g, "")
        .slice(0, 24) || "ogretmen";

    const { data, error } = await supabase
      .from("teacher_users")
      .insert({
        username: `${usernameBase}.${Date.now()}`,
        password_lookup: passwordLookup(finalPassword),
        password_cipher: encryptPassword(finalPassword),
        teacher_name: trimmedTeacherName,
      })
      .select("id, username, teacher_name, class_key, class_display, password_cipher, created_at")
      .single();

    if (error) throw error;

    const { error: historyError } = await supabase.from("teacher_password_history").insert({
      teacher_user_id: data.id,
      password_lookup: passwordLookup(finalPassword),
    });

    if (historyError && !isRlsPolicyError(historyError)) {
      await supabase.from("teacher_users").delete().eq("id", data.id);
      throw historyError;
    }

    return NextResponse.json({
      success: true,
      user: withDecryptedPassword(data as TeacherUserRecord),
    });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const { id, password, action, class_key, class_display } = await request.json();
    if (!id) return NextResponse.json({ error: "ID zorunludur" }, { status: 400 });

    const supabase = getTeacherAccountsSupabase();

    if (action === "assign_class") {
      const { error } = await supabase
        .from("teacher_users")
        .update({ class_key: class_key || null, class_display: class_display || null })
        .eq("id", id);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    // Sifre verilmezse yeni bir tane uret (yoneticinin "yeni sifre" butonu).
    const nextPassword = String(password || "").trim() || generatePassword();

    if (password) {
      const strength = validatePasswordStrength(nextPassword);
      if (!strength.ok) {
        return NextResponse.json({ error: strength.error }, { status: 400 });
      }
    }

    const { data: existing } = await supabase
      .from("teacher_users")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    if (!existing) {
      return NextResponse.json({ error: "Öğretmen hesabı bulunamadı" }, { status: 404 });
    }

    const conflict = await findPasswordConflict(supabase, nextPassword, id);
    if (conflict) return NextResponse.json({ error: conflict }, { status: 409 });

    const { error } = await supabase
      .from("teacher_users")
      .update({
        password_lookup: passwordLookup(nextPassword),
        password_cipher: encryptPassword(nextPassword),
      })
      .eq("id", id);
    if (error) throw error;

    await supabase.from("teacher_password_history").insert({
      teacher_user_id: id,
      password_lookup: passwordLookup(nextPassword),
    });

    return NextResponse.json({ success: true, password: nextPassword });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: "ID zorunludur" }, { status: 400 });

    const supabase = getTeacherAccountsSupabase();
    const { error } = await supabase.from("teacher_users").delete().eq("id", id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
