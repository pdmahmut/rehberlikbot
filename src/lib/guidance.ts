import { YonlendirilenOgrenci } from "@/types";

export type GuidanceStudentInput = Omit<
  Partial<YonlendirilenOgrenci>,
  "yonlendirmeNedenleri" | "yonlendirmeNedeni"
> & {
  ogretmenAdi: string;
  sinifSube: string;
  ogrenciAdi: string;
  yonlendirmeNedenleri?: string[] | string;
  yonlendirmeNedeni?: string;
};

export type NormalizedGuidanceStudent = Omit<
  YonlendirilenOgrenci,
  "yonlendirmeNedenleri" | "yonlendirmeNedeni"
> & {
  yonlendirmeNedenleri: string[];
  yonlendirmeNedeni: string;
};

export const GUIDANCE_REFERRALS_CHANGED_EVENT = "referrals:changed";

export type GuidanceChangeDetail = {
  action: "create" | "delete" | "update";
  id?: string;
  studentName?: string;
  teacherName?: string;
};

function normalizeText(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/\s+/g, " ");
}

function uniqueValues(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function normalizeGuidanceReasons(input: string[] | string | undefined): string[] {
  if (!input) return [];
  if (Array.isArray(input)) return uniqueValues(input);

  return uniqueValues(
    input
      .split(/\r?\n|\||\u2022/g)
      .map((value) => value.replace(/^[-*]\s*/, "").trim())
  );
}

export function formatGuidanceReasons(reasons: string[], separator = " | ") {
  return uniqueValues(reasons).join(separator);
}

export function formatGuidanceReasonsAsBullets(reasons: string[]) {
  return uniqueValues(reasons).map((reason) => `\u2022 ${reason}`).join("\n");
}

export function buildGuidanceKey(
  student: Pick<YonlendirilenOgrenci, "ogretmenAdi" | "sinifSube" | "ogrenciAdi">
) {
  return [student.ogretmenAdi, student.sinifSube, student.ogrenciAdi]
    .map(normalizeText)
    .join("||");
}

export function normalizeGuidanceStudent(student: GuidanceStudentInput): NormalizedGuidanceStudent {
  const reasons = normalizeGuidanceReasons(student.yonlendirmeNedenleri ?? student.yonlendirmeNedeni);
  const timestamp = student.tarih || new Date().toLocaleString("tr-TR");
  const note = student.not?.trim() || undefined;

  return {
    ...(student as Omit<YonlendirilenOgrenci, "yonlendirmeNedenleri" | "yonlendirmeNedeni">),
    id: student.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tarih: timestamp,
    not: note,
    yonlendirmeNedenleri: reasons,
    yonlendirmeNedeni: formatGuidanceReasons(reasons),
  };
}

export function groupGuidanceStudents(students: GuidanceStudentInput[]) {
  const grouped = new Map<string, NormalizedGuidanceStudent>();

  for (const student of students) {
    const normalized = normalizeGuidanceStudent(student);
    const key = buildGuidanceKey(normalized);
    const existing = grouped.get(key);

    if (!existing) {
      grouped.set(key, normalized);
      continue;
    }

    const mergedReasons = uniqueValues([
      ...existing.yonlendirmeNedenleri,
      ...normalized.yonlendirmeNedenleri,
    ]);

    grouped.set(key, {
      ...existing,
      id: existing.id || normalized.id,
      tarih: normalized.tarih || existing.tarih,
      not: normalized.not || existing.not,
      yonlendirmeNedenleri: mergedReasons,
      yonlendirmeNedeni: formatGuidanceReasons(mergedReasons),
    });
  }

  return [...grouped.values()];
}

export function notifyGuidanceReferralsChanged(detail: GuidanceChangeDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(GUIDANCE_REFERRALS_CHANGED_EVENT, { detail }));
}
