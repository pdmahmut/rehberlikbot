import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/apiAuth";
import { getResetSummary, performReset } from "@/lib/newTerm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Yeni doneme baslarken sistemi bosaltma islemi.
// GET  -> silinecek kayitlarin ozeti (hicbir sey silmez)
// POST -> onay metni dogruysa siler

const CONFIRM_PHRASE = "YENİ DÖNEME BAŞLA";

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const groups = await getResetSummary();
    return NextResponse.json({
      groups,
      total: groups.reduce((n, g) => n + g.count, 0),
      confirmPhrase: CONFIRM_PHRASE,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Özet alınamadı";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  let body: { confirm?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });
  }

  // Onay metni birebir yazilmadan silme yapilmaz
  const typed = String(body.confirm || "").trim().toLocaleUpperCase("tr-TR");
  if (typed !== CONFIRM_PHRASE) {
    return NextResponse.json(
      { error: `Onaylamak için "${CONFIRM_PHRASE}" yazmalısınız` },
      { status: 400 }
    );
  }

  try {
    const result = await performReset();
    return NextResponse.json({
      success: true,
      totalDeleted: result.totalDeleted,
      deleted: result.deleted.filter((d) => d.count > 0),
      failed: result.failed,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sıfırlama başarısız";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
