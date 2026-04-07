export const POTENTIAL_MEETINGS_CHANGED_EVENT = "potential-meetings:changed";
export const POTENTIAL_MEETINGS_STORAGE_KEY = "potential-meetings:last-change";
export const POTENTIAL_MEETINGS_HIDDEN_CHANGED_EVENT = "potential-meetings:hidden-changed";
export const POTENTIAL_MEETINGS_HIDDEN_STORAGE_KEY = "potential-meetings:hidden-records";

export type PotentialMeetingsChangeDetail = {
  action: "create" | "update" | "delete";
  id?: string;
  source?: string;
  studentName?: string;
};

export type PotentialMeetingKind =
  | "incident"
  | "referral"
  | "observation"
  | "request"
  | "individual-request";

export const buildPotentialMeetingStorageKey = (kind: PotentialMeetingKind, id: string) => `${kind}:${id}`;

export const loadHiddenPotentialMeetingKeys = () => {
  if (typeof window === "undefined") return [] as string[];

  try {
    const raw = window.localStorage.getItem(POTENTIAL_MEETINGS_HIDDEN_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((value): value is string => typeof value === "string" && value.length > 0);
  } catch {
    return [];
  }
};

export const saveHiddenPotentialMeetingKeys = (keys: string[]) => {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(POTENTIAL_MEETINGS_HIDDEN_STORAGE_KEY, JSON.stringify(keys));
    window.dispatchEvent(new Event(POTENTIAL_MEETINGS_HIDDEN_CHANGED_EVENT));
  } catch {
    // Storage write failed; the UI can still update in-memory.
  }
};

export const hidePotentialMeetingKey = (kind: PotentialMeetingKind, id: string) => {
  if (typeof window === "undefined") return;

  const key = buildPotentialMeetingStorageKey(kind, id);
  const keys = loadHiddenPotentialMeetingKeys();

  if (!keys.includes(key)) {
    keys.push(key);
    saveHiddenPotentialMeetingKeys(keys);
  } else {
    window.dispatchEvent(new Event(POTENTIAL_MEETINGS_HIDDEN_CHANGED_EVENT));
  }
};

export function notifyPotentialMeetingsChanged(detail: PotentialMeetingsChangeDetail) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(new CustomEvent(POTENTIAL_MEETINGS_CHANGED_EVENT, { detail }));

  try {
    window.localStorage.setItem(
      POTENTIAL_MEETINGS_STORAGE_KEY,
      JSON.stringify({ ...detail, timestamp: Date.now() })
    );
  } catch {
    // Storage write failed; the in-tab event already fired.
  }
}
