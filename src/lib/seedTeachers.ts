import { saveTeachersToStore } from './teachersStore';
import { TeacherRecord } from './teachers';

// Real teacher-class mappings from user data
const SEED_TEACHERS: TeacherRecord[] = [
  {
    teacherId: "t1",
    teacherName: "AHMET ÖZÜPERK",
    teacherNameNormalized: "ahmet ozuperk",
    sinifSubeKey: "22154388#1",
    sinifSubeDisplay: "1. Sınıf / A Şubesi"
  },
  {
    teacherId: "t2",
    teacherName: "AHMET KARAV",
    teacherNameNormalized: "ahmet karav",
    sinifSubeKey: "22154324#1",
    sinifSubeDisplay: "1. Sınıf / B Şubesi"
  },
  {
    teacherId: "t3",
    teacherName: "MUSTAFA ULUTAŞ",
    teacherNameNormalized: "mustafa ulutas",
    sinifSubeKey: "22154483#1",
    sinifSubeDisplay: "1. Sınıf / C Şubesi"
  },
  {
    teacherId: "t4",
    teacherName: "SEDA EFİL",
    teacherNameNormalized: "seda efil",
    sinifSubeKey: "22154405#1",
    sinifSubeDisplay: "1. Sınıf / D Şubesi"
  },
  {
    teacherId: "t5",
    teacherName: "SEÇİL YOLCU",
    teacherNameNormalized: "secil yolcu",
    sinifSubeKey: "22150668#2",
    sinifSubeDisplay: "2. Sınıf / A Şubesi"
  },
  {
    teacherId: "t6",
    teacherName: "SERAP SİTİL BALANAN",
    teacherNameNormalized: "serap sitil balanan",
    sinifSubeKey: "22150721#2",
    sinifSubeDisplay: "2. Sınıf / B Şubesi"
  },
  {
    teacherId: "t7",
    teacherName: "SEHER DÜZYOL",
    teacherNameNormalized: "seher duzyol",
    sinifSubeKey: "22150640#2",
    sinifSubeDisplay: "2. Sınıf / C Şubesi"
  },
  {
    teacherId: "t8",
    teacherName: "MUSTAFA İNCEDAL",
    teacherNameNormalized: "mustafa incedal",
    sinifSubeKey: "22151847#3",
    sinifSubeDisplay: "3. Sınıf / A Şubesi"
  },
  {
    teacherId: "t9",
    teacherName: "SERAP GELENER",
    teacherNameNormalized: "serap gelener",
    sinifSubeKey: "22151690#3",
    sinifSubeDisplay: "3. Sınıf / B Şubesi"
  },
  {
    teacherId: "t10",
    teacherName: "MERİÇ SARI",
    teacherNameNormalized: "meric sari",
    sinifSubeKey: "22152892#3",
    sinifSubeDisplay: "3. Sınıf / C Şubesi"
  },
  {
    teacherId: "t11",
    teacherName: "FATMA ARSLAN",
    teacherNameNormalized: "fatma arslan",
    sinifSubeKey: "22150551#3",
    sinifSubeDisplay: "3. Sınıf / D Şubesi"
  },
  {
    teacherId: "t12",
    teacherName: "HİLAL AVLAR",
    teacherNameNormalized: "hilal avlar",
    sinifSubeKey: "22151450#4",
    sinifSubeDisplay: "4. Sınıf / A Şubesi"
  },
  {
    teacherId: "t13",
    teacherName: "EKREM YÜCEL",
    teacherNameNormalized: "ekrem yucel",
    sinifSubeKey: "22151485#4",
    sinifSubeDisplay: "4. Sınıf / B Şubesi"
  },
  {
    teacherId: "t14",
    teacherName: "ABDÜLKADİR SÜRÜCÜ",
    teacherNameNormalized: "abdulkadir surucu",
    sinifSubeKey: "22151476#4",
    sinifSubeDisplay: "4. Sınıf / C Şubesi"
  },
  {
    teacherId: "t15",
    teacherName: "YEŞİM KUŞAKSIZ",
    teacherNameNormalized: "yesim kusaksiz",
    sinifSubeKey: "22702337#0",
    sinifSubeDisplay: "Ana Sınıfı / D Şubesi"
  },
  {
    teacherId: "t16",
    teacherName: "MÜNİRE ALTUNBAŞAK",
    teacherNameNormalized: "munire altunbasak",
    sinifSubeKey: "22643016#0",
    sinifSubeDisplay: "Ana Sınıfı / C Şubesi"
  },
  {
    teacherId: "t17",
    teacherName: "GÜLSÜM YURUL",
    teacherNameNormalized: "gulsum yurul",
    sinifSubeKey: "22602658#0",
    sinifSubeDisplay: "Ana Sınıfı / A Şubesi"
  },
  {
    teacherId: "t18",
    teacherName: "DERYA ARSLAN",
    teacherNameNormalized: "derya arslan",
    sinifSubeKey: "22602663#0",
    sinifSubeDisplay: "Ana Sınıfı / B Şubesi"
  }
];

export async function seedTeachers(): Promise<number> {
  await saveTeachersToStore(SEED_TEACHERS);
  return SEED_TEACHERS.length;
}

export function getSeedData(): TeacherRecord[] {
  return SEED_TEACHERS;
}