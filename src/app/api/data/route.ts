import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/apiAuth';
import { getClassOptions } from '@/lib/classes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Sinif listesi. Onceden data.json dosyasindaki sabit diziden geliyordu;
// artik classes tablosundan (PDF yuklemesiyle olusan liste).

export async function GET() {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;

  try {
    const sinifSubeList = await getClassOptions();
    return NextResponse.json({ sinifSubeList });
  } catch (error) {
    console.error('Data API Error:', error);
    return NextResponse.json({ error: 'Sınıf listesi yüklenemedi' }, { status: 500 });
  }
}
