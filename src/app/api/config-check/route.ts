import { NextResponse } from 'next/server';
import { getGoogleSheetsConfigStatus } from '@/lib/sheets';

export const runtime = 'nodejs';

export async function GET() {
  const sheetsStatus = getGoogleSheetsConfigStatus();

  return NextResponse.json({
    sheets: sheetsStatus.configured,
    configured: sheetsStatus.configured,
    details: sheetsStatus,
  });
}
