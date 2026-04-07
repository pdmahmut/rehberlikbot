export const LESSON_SLOT_VALUES = ["1", "2", "3", "4", "5", "6", "7"] as const;

export type LessonSlotValue = (typeof LESSON_SLOT_VALUES)[number];

const SLOT_PATTERN = /([1-7])/;

export function normalizeLessonSlot(value: string | number | null | undefined): LessonSlotValue | null {
  if (value === null || value === undefined) return null;

  const text = String(value).trim();
  if (!text) return null;

  if (LESSON_SLOT_VALUES.includes(text as LessonSlotValue)) {
    return text as LessonSlotValue;
  }

  const match = text.match(SLOT_PATTERN);
  if (!match) return null;

  const normalized = match[1] as LessonSlotValue;
  return LESSON_SLOT_VALUES.includes(normalized) ? normalized : null;
}

export function formatLessonSlotLabel(value: string | number | null | undefined): string {
  const normalized = normalizeLessonSlot(value);
  return normalized ? `${normalized}. Ders` : "";
}

export function createBusySlotSet(values: Array<string | number | null | undefined>) {
  const slots = new Set<string>();

  values.forEach((value) => {
    const normalized = normalizeLessonSlot(value);
    if (normalized) {
      slots.add(normalized);
    }
  });

  return slots;
}
