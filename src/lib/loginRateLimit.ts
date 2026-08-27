import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

// Giris denemesi sinirlamasi.
//
// Uygulama "sadece sifre" ile giris yaptigi icin kaba kuvvet riski normalden
// yuksek: saldirgan kimin hesabi oldugunu bilmeden dogru sifreyi bulmasi yeter.
// Bu yuzden hem IP bazli hem de genel (tum sistem) bir esik uygulanir.
//
// Sayaclar Supabase'de tutulur; serverless ortamda bellek ici sayac
// lambda'lar arasinda paylasilmadigi icin ise yaramaz.

const IP_MAX_FAILURES = 10;      // tek IP icin pencere basina basarisiz deneme
const GLOBAL_MAX_FAILURES = 100; // tum sistem icin pencere basina basarisiz deneme
const WINDOW_MINUTES = 15;

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

function windowStartIso(): string {
  return new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();
}

/** Ters proxy arkasindaki gercek istemci IP'si. */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}

export async function checkLoginRateLimit(ip: string): Promise<RateLimitResult> {
  try {
    const supabase = getSupabaseAdmin();
    const since = windowStartIso();

    const [{ count: ipCount }, { count: globalCount }] = await Promise.all([
      supabase
        .from("login_attempts")
        .select("id", { count: "exact", head: true })
        .eq("ip", ip)
        .gte("attempted_at", since),
      supabase
        .from("login_attempts")
        .select("id", { count: "exact", head: true })
        .gte("attempted_at", since),
    ]);

    if ((ipCount ?? 0) >= IP_MAX_FAILURES || (globalCount ?? 0) >= GLOBAL_MAX_FAILURES) {
      return { allowed: false, retryAfterSeconds: WINDOW_MINUTES * 60 };
    }
    return { allowed: true };
  } catch {
    // Sayac okunamiyorsa girisi engelleme; kilitlenme riski guvenlik faydasindan agir basar.
    return { allowed: true };
  }
}

export async function recordFailedLogin(ip: string, role: string): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    await supabase.from("login_attempts").insert({ ip, role });
  } catch {
    // sessizce gec - sayac tutulamamasi girisi bozmamali
  }
}

/** Basarili girişten sonra o IP'nin sayacini temizler. */
export async function clearLoginAttempts(ip: string): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    await supabase.from("login_attempts").delete().eq("ip", ip);
  } catch {
    // sessizce gec
  }
}
