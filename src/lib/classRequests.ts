export type ClassRequestCategorySource = {
  admin_category?: string | null;
  topic?: string | null;
};

export type ClassRequestTeacherNoteSource = {
  teacher_description?: string | null;
  description?: string | null;
};

export function normalizeClassRequestCategory(value?: string | null): string {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("tr-TR");
}

export function cleanClassRequestText(value?: string | null): string {
  return String(value || "").trim();
}

export function getClassRequestDisplayCategory(request: ClassRequestCategorySource): string {
  return cleanClassRequestText(request.admin_category) || cleanClassRequestText(request.topic);
}

export function getClassRequestTeacherNote(request: ClassRequestTeacherNoteSource): string {
  return cleanClassRequestText(request.teacher_description) || cleanClassRequestText(request.description);
}
