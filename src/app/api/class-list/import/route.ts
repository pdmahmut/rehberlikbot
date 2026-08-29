import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/apiAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { upsertClasses } from "@/lib/classes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Onizlemesi onaylanan sinif/ogrenci listesini veritabanina yazar.
//
// mode = "classes" : YALNIZCA PDF'te bulunan siniflar yenilenir. Diger siniflara
//                    dokunulmaz. Kismi liste yuklendiginde kaza olmaz.
// mode = "merge"   : hicbir sey silinmez, yalnizca eksik ogrenciler eklenir
//
// Tum sistemi bosaltma islemi burada DEGIL, /panel/yeni-donem ekranindadir.
//
// Her iki modda da yonlendirme/randevu/gorusme gecmisine DOKUNULMAZ.

interface IncomingStudent {
  ogrenciNo?: string;
  ad?: string;
  soyad?: string;
}

interface IncomingClass {
  classKey?: string;
  classDisplay?: string;
  students?: IncomingStudent[];
}

const upper = (v: string) => String(v || "").trim().toLocaleUpperCase("tr-TR");

export async function POST(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  let body: { mode?: string; fileName?: string; classes?: IncomingClass[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });
  }

  const mode = body.mode === "classes" ? "classes" : "merge";
  const incoming = Array.isArray(body.classes) ? body.classes : [];

  if (incoming.length === 0) {
    return NextResponse.json({ error: "Yüklenecek sınıf bulunamadı" }, { status: 400 });
  }

  // Gelen veriyi temizle ve dogrula
  const classes = incoming
    .map((c) => ({
      classKey: String(c.classKey || "").trim(),
      classDisplay: String(c.classDisplay || "").trim(),
      students: (c.students || [])
        .map((s) => ({
          student_number: String(s.ogrenciNo || "").trim() || null,
          student_name: `${upper(s.ad || "")} ${upper(s.soyad || "")}`.trim(),
        }))
        .filter((s) => s.student_name),
    }))
    .filter((c) => c.classKey && c.classDisplay);

  if (classes.length === 0) {
    return NextResponse.json({ error: "Geçerli sınıf bilgisi bulunamadı" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const classKeys = classes.map((c) => c.classKey);

  try {
    let removedCount = 0;

    if (mode === "classes") {
      // Yalnizca bu PDF'te bulunan siniflarin ogrencileri silinir.
      // Listede olmayan siniflar (ornegin sadece 8. sinif yuklendiyse 5/6/7)
      // oldugu gibi kalir.
      const { data: deleted, error: delError } = await supabase
        .from("class_students")
        .delete()
        .in("class_key", classKeys)
        .select("id");
      if (delError) throw delError;
      removedCount = (deleted || []).length;
    }

    await upsertClasses(classes.map((c) => ({ classKey: c.classKey, classDisplay: c.classDisplay })));

    // Mevcut ogrenciler (merge modunda kopya olusmasin diye)
    const existing = new Set<string>();
    if (mode === "merge") {
      const { data: rows, error } = await supabase
        .from("class_students")
        .select("class_key, student_name");
      if (error) throw error;
      for (const r of rows || []) existing.add(`${r.class_key}|${upper(r.student_name)}`);
    }

    const toInsert: Array<{
      class_key: string;
      class_display: string;
      student_name: string;
      student_number: string | null;
      status: string;
    }> = [];

    for (const c of classes) {
      for (const s of c.students) {
        if (existing.has(`${c.classKey}|${upper(s.student_name)}`)) continue;
        existing.add(`${c.classKey}|${upper(s.student_name)}`);
        toInsert.push({
          class_key: c.classKey,
          class_display: c.classDisplay,
          student_name: s.student_name,
          student_number: s.student_number,
          status: "tumu",
        });
      }
    }

    // Buyuk listeleri parcalar halinde yaz
    let inserted = 0;
    const CHUNK = 200;
    for (let i = 0; i < toInsert.length; i += CHUNK) {
      const chunk = toInsert.slice(i, i + CHUNK);
      const { error } = await supabase.from("class_students").insert(chunk);
      if (error) throw error;
      inserted += chunk.length;
    }

    await supabase.from("student_imports").insert({
      file_name: body.fileName || null,
      mode,
      class_count: classes.length,
      student_count: inserted,
      removed_count: removedCount,
    });

    return NextResponse.json({
      success: true,
      mode,
      classCount: classes.length,
      insertedCount: inserted,
      removedCount,
      skippedCount: toInsert.length === 0 && mode === "merge"
        ? classes.reduce((n, c) => n + c.students.length, 0)
        : classes.reduce((n, c) => n + c.students.length, 0) - inserted,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Kayıt sırasında hata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
