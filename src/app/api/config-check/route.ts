import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/apiAuth';
import { getGoogleSheetsConfigStatus } from '@/lib/sheets';

export const runtime = 'nodejs';

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const sheetsStatus = getGoogleSheetsConfigStatus();

  return NextResponse.json({
    sheets: sheetsStatus.configured,
    configured: sheetsStatus.configured,
    details: sheetsStatus,
  });
}
