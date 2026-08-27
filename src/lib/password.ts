import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

// Sifre saklama stratejisi.
//
// Uygulama "sadece sifre" ile giris yapar: ogretmen kullanici adi girmez.
// Bu yuzden veritabaninda "bu sifre kimin?" sorgusu yapilabilmeli. Ayrica
// yonetici, yil basinda dagitmak icin sifreleri okuyabilmeli. Bu iki gereksinim
// birlikte geri dondurulebilir saklama gerektirir:
//
//   password_lookup : HMAC-SHA256(pepper, normalize(sifre))  -> UNIQUE index, giriste arama
//   password_cipher : AES-256-GCM(sifre)                     -> yoneticinin okuyabilmesi icin
//
// Her iki anahtar da PASSWORD_SECRET'ten HKDF ile turetilir; veritabaninda
// tutulmaz. Veritabani tek basina sizarsa sifreler okunamaz.
//
// NOT: Bu, hash'lemeden (scrypt) daha zayiftir - PASSWORD_SECRET de sizarsa
// tum sifreler cozulur. Yonetici sifreleri gorebilsin diye bilincli secildi.
// Yonetici sifresi ise gosterilmesi gerekmedigi icin scrypt ile hash'lenir.

const AES_ALGO = "aes-256-gcm";

function getMasterSecret(): Buffer {
  const secret = process.env.PASSWORD_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "PASSWORD_SECRET tanimli degil veya 32 karakterden kisa. Sifre islemleri yapilamaz."
    );
  }
  return Buffer.from(secret, "utf8");
}

/** Tek ana sirdan amaca ozel anahtar turetir (ayni sir farkli amaclarda kullanilmasin diye). */
function deriveKey(purpose: string, length: number): Buffer {
  return Buffer.from(
    hkdfSync("sha256", getMasterSecret(), Buffer.alloc(0), Buffer.from(purpose, "utf8"), length)
  );
}

/** Turkce yerel ayara duyarli normalizasyon (giriste buyuk/kucuk harf fark etmesin). */
export function normalizePassword(value: string): string {
  return String(value || "").trim().toLocaleLowerCase("tr-TR");
}

/** Deterministik arama anahtari (kor indeks). Sifreyi geri vermez. */
export function passwordLookup(password: string): string {
  return createHmac("sha256", deriveKey("password-lookup-v1", 32))
    .update(normalizePassword(password))
    .digest("hex");
}

/** Ogretmen sifresini yoneticinin okuyabilecegi bicimde sifreler. */
export function encryptPassword(password: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(AES_ALGO, deriveKey("password-cipher-v1", 32), iv);
  const encrypted = Buffer.concat([cipher.update(String(password), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`;
}

/** Sifrelenmis ogretmen sifresini cozer. Bozuk/eksik veride null doner. */
export function decryptPassword(cipherText: string | null | undefined): string | null {
  if (!cipherText) return null;
  try {
    const [version, ivB64, tagB64, dataB64] = cipherText.split(".");
    if (version !== "v1") return null;

    const decipher = createDecipheriv(
      AES_ALGO,
      deriveKey("password-cipher-v1", 32),
      Buffer.from(ivB64, "base64")
    );
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));

    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

/** Sabit surede string karsilastirmasi. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

// --- Yonetici sifresi: gosterilmesi gerekmedigi icin geri dondurulemez hash ---

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(normalizePassword(password), salt, 32, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString("base64")}$${derived.toString("base64")}`;
}

export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  try {
    const parts = stored.split("$");
    if (parts.length !== 6 || parts[0] !== "scrypt") return false;

    const [, n, r, p, saltB64, hashB64] = parts;
    const expected = Buffer.from(hashB64, "base64");
    const derived = scryptSync(normalizePassword(password), Buffer.from(saltB64, "base64"), expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    });

    return derived.length === expected.length && timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

// --- Sifre uretimi ---

// Karistirilabilir karakterler cikarildi: 0/O, 1/l/I, 5/S, 2/Z
const ALPHABET = "abcdefghjkmnpqrtuvwxy34679";

/**
 * Sistem uretimi sifre.
 *
 * Sadece-sifre girisi kullanildigi icin sifrenin TAHMIN EDILEMEZ olmasi kritik:
 * saldirgan kimin hesabi oldugunu bilmeden dogru sifreyi bulursa o hesaba girer.
 * Bu yuzden isim tabanli sifre (ahmet, ahmet2 ...) UYGUN DEGILDIR.
 *
 * 8 karakter x 26 harflik alfabe ~= 2 x 10^11 olasilik.
 */
export function generatePassword(length = 8): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

/** Kullanicinin kendi sectigi sifre icin asgari kalite kontrolu. */
export function validatePasswordStrength(password: string): { ok: true } | { ok: false; error: string } {
  const normalized = normalizePassword(password);

  if (normalized.length < 8) {
    return { ok: false, error: "Şifre en az 8 karakter olmalı" };
  }
  if (/^(.)\1+$/.test(normalized)) {
    return { ok: false, error: "Şifre tek bir karakterin tekrarı olamaz" };
  }
  const banned = new Set([
    "12345678", "123456789", "1234567890", "password", "sifre123",
    "qwerty123", "11111111", "rehberlik", "ogretmen", "okul1234",
  ]);
  if (banned.has(normalized)) {
    return { ok: false, error: "Bu şifre çok yaygın, farklı bir şifre seçin" };
  }
  return { ok: true };
}
