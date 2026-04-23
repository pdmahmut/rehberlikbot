import { readFileSync } from 'node:fs';
import { google } from 'googleapis';
import { YonlendirilenOgrenci } from '@/types';
import { formatGuidanceReasons, normalizeGuidanceReasons } from '@/lib/guidance';

type SheetsConfig = {
  sheetsId: string;
  range: string;
  serviceAccountEmail: string;
  privateKey: string;
};

type SheetsConfigStatus = {
  configured: boolean;
  sheetsId: boolean;
  serviceAccountEmail: boolean;
  privateKey: boolean;
  credentialSource: 'env' | 'json-env' | 'file' | 'missing';
};

function normalizePrivateKey(value?: string | null) {
  return value?.replace(/\\n/g, '\n').trim() || '';
}

function resolveServiceAccountFromJson(raw?: string | null) {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      serviceAccountEmail: String(parsed.client_email || '').trim(),
      privateKey: normalizePrivateKey(parsed.private_key),
      credentialSource: 'json-env' as const,
    };
  } catch (error) {
    console.warn('Google Sheets service account JSON parse edilemedi:', error);
    return null;
  }
}

function resolveServiceAccountFromFile(filePath?: string | null) {
  if (!filePath) {
    return null;
  }

  try {
    const raw = readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      serviceAccountEmail: String(parsed.client_email || '').trim(),
      privateKey: normalizePrivateKey(parsed.private_key),
      credentialSource: 'file' as const,
    };
  } catch (error) {
    console.warn('Google Sheets credentials dosyasi okunamadi:', error);
    return null;
  }
}

function resolveGoogleSheetsConfig() {
  const sheetsId =
    process.env.SHEETS_SPREADSHEET_ID?.trim() ||
    process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim() ||
    '';

  const range = process.env.SHEETS_RANGE?.trim() || 'Sayfa1!A:G';

  const directEnvEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL?.trim() || '';
  const directEnvKey = normalizePrivateKey(process.env.GOOGLE_SHEETS_PRIVATE_KEY);

  const fromJsonEnv = resolveServiceAccountFromJson(
    process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON ||
      process.env.GOOGLE_SERVICE_ACCOUNT_JSON ||
      null
  );

  const fromFile = resolveServiceAccountFromFile(
    process.env.GOOGLE_APPLICATION_CREDENTIALS || null
  );

  const credentialSource =
    directEnvEmail && directEnvKey
      ? 'env'
      : fromJsonEnv?.serviceAccountEmail && fromJsonEnv.privateKey
        ? fromJsonEnv.credentialSource
        : fromFile?.serviceAccountEmail && fromFile.privateKey
          ? fromFile.credentialSource
          : 'missing';

  const serviceAccountEmail =
    directEnvEmail ||
    fromJsonEnv?.serviceAccountEmail ||
    fromFile?.serviceAccountEmail ||
    '';

  const privateKey =
    directEnvKey ||
    fromJsonEnv?.privateKey ||
    fromFile?.privateKey ||
    '';

  const status: SheetsConfigStatus = {
    configured: Boolean(sheetsId && serviceAccountEmail && privateKey),
    sheetsId: Boolean(sheetsId),
    serviceAccountEmail: Boolean(serviceAccountEmail),
    privateKey: Boolean(privateKey),
    credentialSource,
  };

  const config = status.configured
    ? {
        sheetsId,
        range,
        serviceAccountEmail,
        privateKey,
      }
    : null;

  return { config, status };
}

export function getGoogleSheetsConfigStatus() {
  return resolveGoogleSheetsConfig().status;
}

export async function writeToGoogleSheets(students: YonlendirilenOgrenci[]): Promise<boolean> {
  const { config, status } = resolveGoogleSheetsConfig();

  if (!config) {
    console.warn('Google Sheets configuration missing. Please check environment variables in .env.local');
    console.warn('Missing:', status);
    return false;
  }

  const { sheetsId, range, serviceAccountEmail, privateKey } = config;

  try {
    const auth = new google.auth.JWT({
      email: serviceAccountEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const now = new Date();
    const timestamp = now.toLocaleString('tr-TR');

    const rows = students.map((student) => {
      const sinifNormalized = student.sinifSube?.replace(' Şubesi', '') || student.sinifSube;
      const reasons = normalizeGuidanceReasons(student.yonlendirmeNedenleri ?? student.yonlendirmeNedeni);

      return [
        timestamp,
        student.ogretmenAdi,
        sinifNormalized,
        student.ogrenciAdi,
        formatGuidanceReasons(reasons),
        student.not || '',
        student.id,
      ];
    });

    const headerRow = [
      'TarihSaat',
      'Öğretmen',
      'Sınıf/Şube',
      'Öğrenci',
      'Neden',
      'Not',
      'ReferralID',
    ];

    const sheetTitle = process.env.SHEETS_RANGE?.split('!')[0] || 'Sayfa1';
    const headerRange = `${sheetTitle}!A1:G1`;

    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetsId,
        range: headerRange,
      });

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

      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetsId,
        range: headerRange,
        valueInputOption: 'RAW',
        requestBody: {
          values: [headerRow],
        },
      });
    }

    const appendResponse = await sheets.spreadsheets.values.append({
      spreadsheetId: sheetsId,
      range,
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

export async function createGoogleSheetsIfNotExists(explicitSheetsId?: string): Promise<boolean> {
  const { config } = resolveGoogleSheetsConfig();
  const sheetsId = explicitSheetsId?.trim() || config?.sheetsId || '';
  const serviceAccountEmail = config?.serviceAccountEmail || '';
  const privateKey = config?.privateKey || '';

  if (!sheetsId || !serviceAccountEmail || !privateKey) {
    return false;
  }

  try {
    const auth = new google.auth.JWT({
      email: serviceAccountEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    await sheets.spreadsheets.get({
      spreadsheetId: sheetsId,
    });

    return true;
  } catch (error) {
    console.error('Google Sheets kontrol hatası:', error);
    return false;
  }
}
