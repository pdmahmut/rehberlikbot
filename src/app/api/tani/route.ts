import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/apiAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GECICI TANI UCU
//
// Amac tek bir soruyu cevaplamak: sunucudan (Vercel) veritabanina (Supabase)
// bir sorgu ne kadar suruyor? Bu sure, sayfalarin ne kadar hizli acilabilecegini
// belirliyor ve disaridan olculemiyor.
//
// Olcum alindiktan sonra bu dosya silinecek.

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const supabase = getSupabaseAdmin();

  // Ayni sorgu birkac kez: ilki baglanti kurmayi da icerir, sonrakiler
  // baglanti hazirken gecen sureyi gosterir.
  const sureler: number[] = [];
  for (let i = 0; i < 5; i++) {
    const t = Date.now();
    await supabase.from("classes").select("class_key").limit(1);
    sureler.push(Date.now() - t);
  }

  // Bes sorgu ayni anda: paralel calisma gercekten bedava mi?
  const paralelBas = Date.now();
  await Promise.all(
    Array.from({ length: 5 }, () => supabase.from("classes").select("class_key").limit(1))
  );
  const paralelSure = Date.now() - paralelBas;

  const enHizli = Math.min(...sureler);

  return NextResponse.json(
    {
      aciklama: "Sunucudan veritabanina gidis-donus suresi (ms)",
      sunucu_bolgesi: process.env.VERCEL_REGION || "yerel",
      ardisik_5_sorgu: sureler,
      en_hizli_tek_sorgu: enHizli,
      bes_sorgu_paralel: paralelSure,
      yorum:
        enHizli < 60
          ? "HIZLI — veritabani yakinda. Yavasligin sebebi baska yerde."
          : enHizli < 150
            ? "ORTA — kabul edilebilir ama iyilestirilebilir."
            : "YAVAS — veritabani uzak bir bolgede. Asil darbogaz bu.",
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
