import fs from 'fs';
import path from 'path';
import { StudentData, SinifSube, Ogrenci } from '@/types';

export function loadStudentData(): StudentData {
  const dataPath = path.join(process.cwd(), 'data.json');
  const jsonData = fs.readFileSync(dataPath, 'utf8');
  return JSON.parse(jsonData);
}

export function getSinifSubeList(): SinifSube[] {
  const data = loadStudentData();
  return data.Sinif_Sube;
}

export function getOgrenciListBySinif(sinifSube: string): Ogrenci[] {
  const data = loadStudentData();
  
  // Önce direkt eşleşme dene
  let sinifSubeText = data.Sinif_Sube.find(s => s.value === sinifSube)?.text;
  
  // Eğer bulunamadıysa, # karakteri eksik olabilir, pattern matching yap
  if (!sinifSubeText) {
    const matchedItem = data.Sinif_Sube.find(s => s.value.startsWith(sinifSube + '#'));
    if (matchedItem) {
      sinifSubeText = matchedItem.text;
    }
  }
  
  if (!sinifSubeText) {
    return [];
  }
  
  // "5. Sınıf / A Şubesi" formatını "Ogrenci_5. Sınıf _ A Şubesi" formatına çevir
  const key = `Ogrenci_${sinifSubeText.replace(" / ", " _ ")}`;
  
  const ogrenciList = data[key];
  if (Array.isArray(ogrenciList)) {
    // data.json'daki format: { "Tc Kimlik", "Ad", "Soyad", "Okul No", "Sinif Sube" }
    // Ogrenci tipine dönüştür: { value, text }
    return ogrenciList.map((student: any) => {
      const ad = student.Ad || student.ad || '';
      const soyad = student.Soyad || student.soyad || '';
      const okulNo = student['Okul No'] || student.okulNo || '';
      const fullName = `${ad} ${soyad}`.trim();
      
      return {
        value: fullName,
        text: okulNo ? `${okulNo} ${fullName}` : fullName
      };
    });
  }
  
  return [];
}

export function formatTelegramMessage(
  ogretmenAdi: string,
  ogrenciAdi: string, 
  sinifSube: string,
  yonlendirmeNedeni: string
): string {
  const now = new Date();
  const tarih = now.toLocaleDateString('tr-TR');
  const saat = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  
  return `${tarih} ${saat}\nÖğretmen: ${ogretmenAdi}\nYönlendirilen Öğrenci: ${sinifSube} / ${ogrenciAdi}\nYönlendirilme Nedeni: ${yonlendirmeNedeni}`;
}