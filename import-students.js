const XLSX = require('xlsx');
const fs = require('fs');

// Excel dosyasını oku
const workbook = XLSX.readFile('students.xlsx');
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(worksheet);

console.log('📊 Excel Bilgileri:');
console.log(`Toplam öğrenci: ${data.length}`);
console.log(`Sütunlar: ${Object.keys(data[0]).join(', ')}`);
console.log('\n📋 İlk 5 öğrenci:');
data.slice(0, 5).forEach((row, i) => {
  console.log(`${i+1}. ${JSON.stringify(row)}`);
});

// data.json'u oku
const dataJson = JSON.parse(fs.readFileSync('data.json', 'utf8'));

// Öğrencileri sınıflara göre grupla
const studentsByClass = {};
const classKeys = ['5A', '5B', '5C', '6A', '6B', '6C', '7A', '7B', '7C', '8A', '8B', '8C'];

classKeys.forEach(key => {
  studentsByClass[key] = [];
});

// Excel'den öğrencileri al
data.forEach((row, index) => {
  const tcKimlikNo = row['T.C. Kimlik No'] || row['TC Kimlik No'] || row['TCKN'] || row['TC'];
  const adi = row['Adı'] || row['Ad'] || row['ADI'];
  const soyadi = row['Soyadı'] || row['Soyad'] || row['SOYADI'];
  const okulNo = row['Okul No'] || row['OkulNo'] || row['Numara'] || row['No'];
  let sinifi = row['Sınıfı'] || row['Sınıf'] || row['SINIF'];

  // "5. Sınıf / A Şubesi" formatını "5A" formatına çevir
  if (sinifi && typeof sinifi === 'string') {
    const match = sinifi.match(/(\d+)\.\s*Sınıf\s*\/\s*([ABC])\s*Şubesi/i);
    if (match) {
      sinifi = match[1] + match[2].toUpperCase();
    }
  }

  if (!sinifi || !classKeys.includes(sinifi)) {
    console.warn(`⚠️ Satır ${index + 2}: Geçersiz sınıf '${sinifi}' - atlandı`);
    return;
  }

  const student = {
    "Tc Kimlik": String(tcKimlikNo || ''),
    "Ad": String(adi || ''),
    "Soyad": String(soyadi || ''),
    "Okul No": String(okulNo || ''),
    "Sinif Sube": sinifi
  };

  studentsByClass[sinifi].push(student);
});

// data.json'a yaz
classKeys.forEach(classKey => {
  const jsonKey = `Ogrenci_${classKey[0]}. Sınıf _ ${classKey[1]} Şubesi`;
  dataJson[jsonKey] = studentsByClass[classKey];
});

fs.writeFileSync('data.json', JSON.stringify(dataJson, null, 2), 'utf8');

console.log('\n✅ İçe aktarma tamamlandı!');
console.log('\n📊 Sınıf bazında öğrenci sayıları:');
classKeys.forEach(classKey => {
  const count = studentsByClass[classKey].length;
  if (count > 0) {
    console.log(`${classKey}: ${count} öğrenci`);
  }
});

const totalStudents = Object.values(studentsByClass).reduce((sum, arr) => sum + arr.length, 0);
console.log(`\n📚 TOPLAM: ${totalStudents} öğrenci`);
