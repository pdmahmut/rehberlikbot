import { installPdfNodePolyfills } from "@/lib/pdfNodePolyfill";

// MEB sinif listesi PDF'ini okur.
//
// Neden koordinat bazli:
//   Duz metin cikarma (pdftotext -layout vb.) ile okundugunda her sinifin ILK
//   ogrencisinin soyadi kayboluyor, sonraki tum soyadlar bir satir yukari
//   kayiyordu -- yani herkes yanlis soyadla eslesiyordu ve bu ekranda hata
//   gibi gorunmuyordu. Bu yuzden kelimeler x/y koordinatlariyla okunuyor,
//   sutun sinirlari her sayfanin kendi baslik satirindan hesaplaniyor.
//
// Turkce harf sorunu:
//   PDF'te "ABDULKADİR" gibi kelimeler yaziciya "ABDULKAD" + "İ" + "R"
//   seklinde parcali geliyor. Parcalar arasindaki bosluga bakilarak
//   birlestiriliyor.

export interface ParsedStudent {
  sira: number;
  ogrenciNo: string;
  ad: string;
  soyad: string;
}

export interface ParsedClass {
  classKey: string;
  classDisplay: string;
  students: ParsedStudent[];
}

interface Frag {
  x: number;
  y: number;
  width: number;
  text: string;
}

const ROW_TOLERANCE = 4;   // ayni satir sayilacak dikey mesafe
const SPACE_GAP = 1.2;     // bu kadar bosluk varsa kelimeler ayri

/** Ayni satirdaki parcalari, aralarindaki bosluga gore kelimelere birlestirir. */
function joinFragments(frags: Frag[]): string {
  const sorted = [...frags].sort((a, b) => a.x - b.x);
  let out = "";
  let prevEnd: number | null = null;

  for (const f of sorted) {
    if (prevEnd !== null && f.x - prevEnd > SPACE_GAP) out += " ";
    out += f.text;
    prevEnd = f.x + f.width;
  }
  return out.replace(/\s+/g, " ").trim();
}

/** Turkce harfleri ASCII karsiliklarina cevirir (anahtar uretimi icin). */
function toAscii(value: string): string {
  const map: Record<string, string> = {
    Ç: "C", Ğ: "G", İ: "I", I: "I", Ö: "O", Ş: "S", Ü: "U",
    ç: "C", ğ: "G", i: "I", ı: "I", ö: "O", ş: "S", ü: "U",
  };
  return value
    .split("")
    .map((ch) => map[ch] ?? ch)
    .join("")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}
/** "6. Sınıf / A Şubesi" -> "6A" ; sube harfi yoksa okunabilir bir anahtar uretir. */
export function normalizeClassKey(display: string): string {
  const t = display.replace(/\s+/g, " ").replace(/\s*Sınıf Listesi\s*$/i, "").trim();

  const withSection = t.match(/^(\d+)\.\s*Sınıf\s*\/\s*([A-ZÇĞİÖŞÜ])\s*Şubesi$/i);
  if (withSection) return `${withSection[1]}${withSection[2].toLocaleUpperCase("tr-TR")}`;

  const gradeOnly = t.match(/^(\d+)\.\s*Sınıf\s*\/\s*(.+)$/i);
  if (gradeOnly) {
    // Sinif anahtari veritabaninda ve URL'lerde kullanildigi icin Turkce
    // harfler ASCII karsiliklarina cevriliyor (GEÇİCİ -> GECICI).
    const slug = toAscii(gradeOnly[2]).slice(0, 8) || "SUBE";
    return `${gradeOnly[1]}-${slug}`;
  }
  return t.replace(/[^A-Za-z0-9]/g, "").slice(0, 12) || "BILINMEYEN";
}

interface PdfTextItem {
  str: string;
  width: number;
  transform: number[];
}

interface PdfPage {
  getTextContent(): Promise<{ items: unknown[] }>;
}

interface PdfDoc {
  numPages: number;
  getPage(n: number): Promise<PdfPage>;
}

async function parsePage(page: PdfPage): Promise<ParsedClass | null> {
  const content = await page.getTextContent();

  const frags: Frag[] = [];
  for (const raw of content.items) {
    const it = raw as PdfTextItem;
    if (!it.str || !it.str.trim()) continue;
    frags.push({
      x: it.transform[4],
      y: it.transform[5],
      width: it.width || 0,
      text: it.str,
    });
  }
  if (frags.length === 0) return null;

  // satirlara ayir (y azalan sirada = yukaridan asagi)
  const rows: Frag[][] = [];
  for (const f of [...frags].sort((a, b) => b.y - a.y || a.x - b.x)) {
    const last = rows[rows.length - 1];
    if (last && Math.abs(last[0].y - f.y) <= ROW_TOLERANCE) last.push(f);
    else rows.push([f]);
  }

  // sinif basligi
  let classDisplay: string | null = null;
  for (const row of rows.slice(0, 8)) {
    const line = joinFragments(row);
    if (/Sınıf Listesi/i.test(line)) {
      classDisplay = line.replace(/\s*Sınıf Listesi\s*$/i, "").trim();
      break;
    }
  }
  if (!classDisplay) return null;

  // baslik satiri ve sutun sinirlari
  let headerIdx = -1;
  let bounds: { sno: number; no: number; ad: number; soyad: number } | null = null;

  for (let i = 0; i < rows.length; i++) {
    const line = joinFragments(rows[i]);
    if (!/S\.No/i.test(line) || !/Cinsiyeti/i.test(line)) continue;

    const at = (needle: RegExp) => {
      const hit = rows[i].find((f) => needle.test(f.text));
      return hit ? hit.x : null;
    };
    const xSno = at(/^S\.No/i);
    const xNo = at(/^Ö/) ?? at(/renci/i);
    const xAd = at(/^Ad/);
    const xSoyad = at(/^Soyad/);
    const xCins = at(/^Cinsiyeti/i);

    if (xSno === null || xAd === null || xSoyad === null || xCins === null) continue;

    const noX = xNo ?? (xSno + xAd) / 2;
    headerIdx = i;
    bounds = {
      sno: (xSno + noX) / 2,
      no: (noX + xAd) / 2,
      ad: (xAd + xSoyad) / 2,
      soyad: (xSoyad + xCins) / 2,
    };
    break;
  }

  if (headerIdx < 0 || !bounds) {
    return { classKey: normalizeClassKey(classDisplay), classDisplay, students: [] };
  }

  const students: ParsedStudent[] = [];
  for (const row of rows.slice(headerIdx + 1)) {
    const cols: Record<"sno" | "no" | "ad" | "soyad", Frag[]> = {
      sno: [], no: [], ad: [], soyad: [],
    };
    for (const f of row) {
      if (f.x < bounds.sno) cols.sno.push(f);
      else if (f.x < bounds.no) cols.no.push(f);
      else if (f.x < bounds.ad) cols.ad.push(f);
      else if (f.x < bounds.soyad) cols.soyad.push(f);
      // cinsiyet sutunu kullanilmiyor
    }

    const sira = joinFragments(cols.sno);
    const ogrenciNo = joinFragments(cols.no);
    const ad = joinFragments(cols.ad);
    const soyad = joinFragments(cols.soyad);

    if (!/^\d+$/.test(sira)) continue;                 // veri satiri degil
    if (/^(Adı|Soyadı|Cinsiyeti)$/i.test(ad)) continue; // baslik tekrari
    if (!ad && !soyad) continue;

    students.push({ sira: Number(sira), ogrenciNo, ad, soyad });
  }

  return { classKey: normalizeClassKey(classDisplay), classDisplay, students };
}

/** PDF icerigini sinif + ogrenci listesine cevirir. */
export async function parseClassListPdf(data: Uint8Array): Promise<ParsedClass[]> {
  // pdfjs Node'da DOMMatrix gibi tarayici siniflarini arar; import'tan ONCE saglanmali.
  installPdfNodePolyfills();

  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  // Worker modulu acikca import ediliyor: pdfjs onu calisma aninda dinamik
  // olarak yuklemeye calisiyor, ancak dinamik yol paketleyici tarafindan
  // gorulmedigi icin dosya Vercel dagitimina dahil edilmiyordu.
  await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
  const doc = (await pdfjs.getDocument({
    data,
    useSystemFonts: true,
  }).promise) as unknown as PdfDoc;

  const byKey = new Map<string, ParsedClass>();

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const parsed = await parsePage(page);
    if (!parsed) continue;

    const existing = byKey.get(parsed.classKey);
    if (existing) existing.students.push(...parsed.students);
    else byKey.set(parsed.classKey, parsed);
  }

  return [...byKey.values()];
}
