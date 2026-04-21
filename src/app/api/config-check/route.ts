import { NextResponse } from 'next/server';
export const runtime = 'nodejs';
export async function GET() {
  const sheets = Boolean(
    process.env.SHEETS_SPREADSHEET_ID &&
    process.env.GOOGLE_SHEETS_CLIENT_EMAIL &&
    process.env.GOOGLE_SHEETS_PRIVATE_KEY
  );
  return NextResponse.json({ sheets, configured: sheets });
}import { NextResponse } from 'next/server';
export const runtime = 'nodejs';
export async function GET() {
  const sheets = Boolean(
    process.env.SHEETS_SPREADSHEET_ID &&
    process.env.GOOGLE_SHEETS_CLIENT_EMAIL &&
    process.env.GOOGLE_SHEETS_PRIVATE_KEY
  );
  return NextResponse.json({ sheets, configured: sheets });
}