import { google } from 'googleapis';
import { YonlendirilenOgrenci } from '@/types';
import { formatGuidanceReasons, normalizeGuidanceReasons } from '@/lib/guidance';

export async function writeToGoogleSheets(students: YonlendirilenOgrenci[]): Promise<boolean> {
  const sheetsId = process.env.SHEETS_SPREADSHEET_ID;
  const serviceAccountEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const range = process.env.SHEETS_RANGE || 'Sayfa1!A:G';

  if (!sheetsId || !serviceAccountEmail || !privateKey) {
    console.warn('Google Sheets configuration missing. Please check environment variables in .env.local');
    console.warn('Missing:', { sheetsId: !!sheetsId, serviceAccountEmail: !!serviceAccountEmail, privateKey: !!privateKey });
    return false;
  }

  try {
    // JWT authentication
    const auth = new google.auth.JWT({
      email: serviceAccountEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Prepare data for sheets
    const now = new Date();
    const timestamp = now.toLocaleString('tr-TR');
    
    const rows = students.map(student => {
      const sinifNormalized = student.sinifSube?.replace(' Şubesi', '') || student.sinifSube;
      const reasons = normalizeGuidanceReasons(student.yonlendirmeNedenleri ?? student.yonlendirmeNedeni);
      return [
        // TarihSaat
        timestamp,
        // Öğretmen
        student.ogretmenAdi,
        // Sınıf/Şube (normalized)
        sinifNormalized,
        // Öğrenci
        student.ogrenciAdi,
  // Neden
  formatGuidanceReasons(reasons),
  // Not
  student.not || '',
        // ReferralID (uygulamadaki id)
        student.id,
      ];
    });

    // Check if headers exist, if not create them
    const headerRow = [
      'TarihSaat',
      'Öğretmen',
      'Sınıf/Şube',
      'Öğrenci',
      'Neden',
      'Not',
      'ReferralID'
    ];

    // Try to get existing data to check if headers exist
    const sheetTitle = (process.env.SHEETS_RANGE?.split('!')[0]) || 'Sayfa1';
    const headerRange = `${sheetTitle}!A1:G1`;
    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetsId,
        range: headerRange,
      });

      // If no data or headers don't match, add headers
      if (!response.data.values || response.data.values.length === 0) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: sheetsId,
          range: headerRange,
          valueInputOption: 'RAW',
          requestBody: {
            values: [headerRow],
          },
        });
      }
    } catch {
      // Sheet doesn't exist, create it
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: sheetsId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: sheetTitle,
                },
              },
            },
          ],
        },
      });

      // Add headers
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetsId,
        range: headerRange,
        valueInputOption: 'RAW',
        requestBody: {
          values: [headerRow],
        },
      });
    }

    // Append new data
    const appendResponse = await sheets.spreadsheets.values.append({
      spreadsheetId: sheetsId,
      range: range,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: rows,
      },
    });

    console.log(`✅ ${students.length} öğrenci Google Sheets'e başarıyla kaydedildi`);
    console.log('Sheets Response:', appendResponse.data.updates);
    return true;

  } catch (error) {
    console.error('Google Sheets yazma hatası:', error);
    return false;
  }
}

export async function createGoogleSheetsIfNotExists(sheetsId: string): Promise<boolean> {
  const serviceAccountEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!serviceAccountEmail || !privateKey) {
    return false;
  }

  try {
    const auth = new google.auth.JWT({
      email: serviceAccountEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Check if spreadsheet exists
    await sheets.spreadsheets.get({
      spreadsheetId: sheetsId,
    });

    return true;
  } catch (error) {
    console.error('Google Sheets kontrol hatası:', error);
    return false;
  }
}
