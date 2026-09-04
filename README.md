# RPD Rehberlik Paneli

Ortaokul rehberlik servisi için öğrenci takip ve yönlendirme sistemi.
Öğretmenler öğrenci yönlendirir, rehber öğretmen başvuruları takip eder,
görüşme planlar ve kayıt tutar.

## Ne yapar

**Öğretmen tarafı**
- Öğrenci yönlendirme (kendi sınıfı dışındaki sınıflardan da yapabilir)
- Yaptığı yönlendirmelerin durumunu izleme
- Sınıf rehber öğretmeni ise kendi sınıfını görüntüleme, öğrenci ekleme,
  silme/sınıf değişikliği talebi oluşturma

**Rehber öğretmen (yönetici) tarafı**
- Başvuru takibi: öğretmen yönlendirmeleri, bireysel başvurular, veli
  talepleri, öğrenci olayları
- Randevu ve görüşme planlama, ders saatine göre program
- Sınıf rehberliği konu ve plan takibi
- Öğrenci listesi ve geçmişi
- Öğretmen kadrosu ve giriş hesapları
- PDF'ten toplu öğrenci yükleme
- Sene sonu sıfırlama

## Kurulum

Gereksinimler: Node.js 18+, bir Supabase projesi

```bash
npm install
cp .env.example .env.local
```

`.env.local` içindeki değerleri doldurun. Güvenlik anahtarlarını üretmek için:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Ardından `supabase/migrations/` altındaki SQL dosyalarını numara sırasına göre
Supabase SQL Editor'de çalıştırın.

```bash
npm run dev
```

## Ortam değişkenleri

| Değişken | Açıklama |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase proje adresi |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon anahtarı |
| `SUPABASE_SERVICE_ROLE_KEY` | **Zorunlu.** Sunucu tarafı erişim. Asla `NEXT_PUBLIC_` yapmayın |
| `SESSION_SECRET` | Oturum çerezlerini imzalar (en az 32 karakter) |
| `PASSWORD_SECRET` | Öğretmen şifrelerini şifreler (en az 32 karakter, **değiştirmeyin**) |
| `ADMIN_PASSWORD` | Yalnızca ilk kurulumda; sonrasında panelden değiştirilir |

## Güvenlik notları

- Tüm veritabanı tabloları anon erişimine kapalıdır (RLS). Tarayıcı
  veritabanına doğrudan bağlanmaz; sorgular `/api/db` geçidinden geçer ve
  orada oturum ile yetki kontrolünden geçirilir.
- Öğretmen sorgularına sunucu tarafında sınıf filtresi eklenir; istemci
  bunu kaldıramaz.
- Oturum çerezleri HMAC ile imzalanır.
- Öğretmen şifreleri şifrelenmiş saklanır; arama için ayrı bir kör indeks
  kullanılır.
- Giriş denemeleri IP ve sistem geneli olarak sınırlandırılır.
- `PASSWORD_SECRET` değişirse tüm öğretmen şifreleri geçersiz olur.

## Teknoloji

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS ·
shadcn/ui · Supabase (PostgreSQL) · pdfjs-dist

## Dizin yapısı

```
src/
├── app/
│   ├── api/          API rotaları (hepsi oturum korumalı)
│   ├── panel/        Yönetici ve öğretmen sayfaları
│   └── login/
├── components/
├── lib/              Veri erişimi, kimlik doğrulama, PDF okuma
└── types/
supabase/migrations/  Veritabanı şeması (sırayla çalıştırılır)
scripts/              Yardımcı betikler
```

## Lisans

[MIT](LICENSE)
