import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/apiAuth";
import { parseClassListPdf } from "@/lib/classListPdf";
import { classSortOrder } from "@/lib/classes";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 15 * 1024 * 1024;

// PDF'i okur ve ONIZLEME dondurur. Veritabanina HICBIR SEY YAZMAZ.
// Yonetici sonucu gordukten sonra /api/class-list/import ile onaylar.

export async function POST(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "PDF dosyası seçilmedi" }, { status: 400 });
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "Dosya boş" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Dosya çok büyük (en fazla 15 MB)" }, { status: 400 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (String.fromCharCode(...bytes.slice(0, 4)) !== "%PDF") {
      return NextResponse.json({ error: "Bu bir PDF dosyası değil" }, { status: 400 });
    }

    const parsed = await parseClassListPdf(bytes);
    if (parsed.length === 0) {
      return NextResponse.json(
        { error: "PDF içinde sınıf listesi bulunamadı. Beklenen başlık: '... Sınıf Listesi'" },
        { status: 422 }
      );
    }

    // Mevcut durumla karsilastirma (yoneticinin ne degisecegini gormesi icin)
    const supabase = getSupabaseAdmin();
    const [{ data: currentClasses }, { count: currentStudentCount }] = await Promise.all([
      supabase.from("classes").select("class_key"),
      supabase.from("class_students").select("id", { count: "exact", head: true }),
    ]);

    const existingKeys = new Set((currentClasses || []).map((c) => c.class_key));

    const classes = parsed
      .map((c) => ({
        classKey: c.classKey,
        classDisplay: c.classDisplay,
        studentCount: c.students.length,
        isNew: !existingKeys.has(c.classKey),
        students: c.students,
      }))
      .sort((a, b) => classSortOrder(a.classKey) - classSortOrder(b.classKey));

    // Ayni sinifta ayni isim iki kez geciyor mu?
    const duplicates: string[] = [];
    for (const c of classes) {
      const seen = new Set<string>();
      for (const s of c.students) {
        const key = `${s.ad} ${s.soyad}`.trim().toLocaleUpperCase("tr-TR");
        if (seen.has(key)) duplicates.push(`${c.classKey}: ${key}`);
        seen.add(key);
      }
    }

    // Adi veya soyadi bos kalan kayitlar
    const incomplete = classes.flatMap((c) =>
      c.students
        .filter((s) => !s.ad || !s.soyad)
        .map((s) => `${c.classKey}: ${s.sira}. sıra (${s.ogrenciNo})`)
    );

    return NextResponse.json({
      fileName: file.name,
      classes,
      totals: {
        classCount: classes.length,
        studentCount: classes.reduce((n, c) => n + c.studentCount, 0),
        newClassCount: classes.filter((c) => c.isNew).length,
        currentStudentCount: currentStudentCount ?? 0,
        currentClassCount: existingKeys.size,
      },
      warnings: { duplicates, incomplete },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "PDF okunamadı";
    return NextResponse.json({ error: `PDF okunamadı: ${message}` }, { status: 500 });
  }
}
