import { NextRequest, NextResponse } from 'next/server';
import {
  buildTeacherSessionUser,
  COOKIE_NAME,
  createSessionToken,
  SESSION_COOKIE_OPTIONS,
} from '@/lib/auth';
import { verifyAdminPassword } from '@/lib/adminPassword';
import { getSupabaseAdmin, hasSupabaseAdmin } from '@/lib/supabaseAdmin';
import { decryptPassword, normalizePassword, passwordLookup, safeEqual } from '@/lib/password';
import {
  checkLoginRateLimit,
  clearLoginAttempts,
  getClientIp,
  recordFailedLogin,
} from '@/lib/loginRateLimit';

export const runtime = 'nodejs';

// Yanlis sifrede her zaman ayni mesaj donulur: hangi rolun var oldugunu
// veya sifrenin ne kadarinin dogru oldugunu sizdirmamak icin.
const INVALID_CREDENTIALS = 'Şifre hatalı';

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);

  try {
    const { role, password } = await request.json();
    const entered = String(password || '').trim();

    if (role !== 'admin' && role !== 'teacher') {
      return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 });
    }
    if (!entered) {
      return NextResponse.json({ error: 'Şifre gerekli' }, { status: 400 });
    }

    // Deneme siniri ile sifre dogrulamasi birbirini beklemez; ikisi birlikte
    // baslatilir. Sunucudan veritabanina her gidis-donus yarim saniyeye
    // yakin surdugu icin bu adimi sirali birakmak girisi belirgin sekilde
    // yavaslatiyordu. Sinir asilmissa sifre sonucu kullanilmadan atilir.
    const [limit, adminOk] = await Promise.all([
      checkLoginRateLimit(ip),
      role === 'admin' ? verifyAdminPassword(entered) : Promise.resolve(false),
    ]);

    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'Çok fazla hatalı deneme. Lütfen 15 dakika sonra tekrar deneyin.' },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds ?? 900) } }
      );
    }

    // --- Yonetici girisi ---
    if (role === 'admin') {
      if (!adminOk) {
        await recordFailedLogin(ip, 'admin');
        return NextResponse.json({ error: INVALID_CREDENTIALS }, { status: 401 });
      }

      // Temizlik girisin sonucunu etkilemez; kullaniciyi bekletmeye gerek yok.
      void clearLoginAttempts(ip);
      const token = await createSessionToken({ role: 'admin' });
      const response = NextResponse.json({ success: true, role: 'admin' });
      response.cookies.set(COOKIE_NAME, token, SESSION_COOKIE_OPTIONS);
      return response;
    }

    // --- Ogretmen girisi (sadece sifre) ---
    if (!hasSupabaseAdmin()) {
      return NextResponse.json({ error: 'Sunucu yapılandırma hatası' }, { status: 500 });
    }
    const supabase = getSupabaseAdmin();

    // Sifreyi dogrudan aramak yerine peppered kor indeks uzerinden arariz.
    const { data: teacher, error } = await supabase
      .from('teacher_users')
      .select('id, username, teacher_name, class_key, class_display, password_cipher')
      .eq('password_lookup', passwordLookup(entered))
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
    }

    // Kor indeks eslesse bile sifreyi cozup birebir dogrula.
    const storedPassword = teacher ? decryptPassword(teacher.password_cipher) : null;
    if (!teacher || !storedPassword || !safeEqual(normalizePassword(entered), normalizePassword(storedPassword))) {
      await recordFailedLogin(ip, 'teacher');
      return NextResponse.json({ error: INVALID_CREDENTIALS }, { status: 401 });
    }

    void clearLoginAttempts(ip);
    const token = await createSessionToken(
      await buildTeacherSessionUser({
        teacherId: teacher.id,
        username: teacher.username,
        teacherName: teacher.teacher_name,
        classKey: teacher.class_key || null,
        classDisplay: teacher.class_display || null,
      })
    );

    const response = NextResponse.json({ success: true, role: 'teacher' });
    response.cookies.set(COOKIE_NAME, token, SESSION_COOKIE_OPTIONS);
    return response;
  } catch {
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
  }
}
