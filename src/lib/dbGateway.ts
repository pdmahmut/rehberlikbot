import type { UserRole } from "@/lib/auth";

// Tarayici -> veritabani gecidi icin yetki kurallari.
//
// Onceden panel sayfalari Supabase'e anon anahtarla DOGRUDAN baglaniyordu.
// Anon anahtar tarayicida gorunur oldugu icin, uygulamayi hic kullanmadan
// ogrenci isimleri ve hassas kayitlar (akran zorbaligi, multeci, maddi durum)
// okunabiliyordu. Artik tum sorgular /api/db uzerinden gecer ve burada
// tanimli kurallara gore dogrulanir.
//
// Kural: burada YAZMAYAN hicbir tablo/islem gecide kabul edilmez.

export type DbOperation = "select" | "insert" | "update" | "delete";

export interface TablePolicy {
  /** Yoneticinin yapabilecegi islemler. */
  admin: DbOperation[];
  /** Ogretmenin yapabilecegi islemler. */
  teacher: DbOperation[];
  /**
   * Ogretmen sorgularina sunucu tarafinda zorla eklenen sinif filtresi.
   * Ogretmen kendi sinifi disindaki kayitlari goremez.
   * Tanimli degilse ogretmen bu tabloda sinif kisiti olmadan calisir.
   */
  teacherScopeColumn?: string;
}

const R: DbOperation[] = ["select"];
const NONE: DbOperation[] = [];

export const TABLE_POLICIES: Record<string, TablePolicy> = {
  referrals: { admin: R, teacher: R, teacherScopeColumn: "class_key" },
  individual_requests: { admin: R, teacher: R, teacherScopeColumn: "class_key" },
  parent_meeting_requests: { admin: R, teacher: R, teacherScopeColumn: "class_key" },
  student_incidents: { admin: R, teacher: R, teacherScopeColumn: "target_class_key" },

  observation_pool: {
    admin: ["select", "delete"],
    teacher: R,
    teacherScopeColumn: "class_key",
  },

  // appointments tablosunda sinif kolonu yok; ogretmen kapsamı su an
  // daraltilamiyor. Mevcut davranis korunuyor (bkz. README notu / takip isi).
  appointments: { admin: ["select", "update", "delete"], teacher: R },

  guidance_plans: { admin: ["select", "insert", "update", "delete"], teacher: NONE },
  guidance_topics: { admin: ["select", "insert", "delete"], teacher: NONE },
  tasks: { admin: ["select", "insert", "delete"], teacher: NONE },
  follow_ups: { admin: R, teacher: NONE },
  class_activities: { admin: R, teacher: NONE },
};

export function getTablePolicy(table: string): TablePolicy | null {
  return Object.prototype.hasOwnProperty.call(TABLE_POLICIES, table)
    ? TABLE_POLICIES[table]
    : null;
}

export function isOperationAllowed(
  table: string,
  operation: DbOperation,
  role: UserRole
): boolean {
  const policy = getTablePolicy(table);
  if (!policy) return false;
  return (role === "admin" ? policy.admin : policy.teacher).includes(operation);
}

// --- Sorgu tanimlari ---

export type FilterType =
  | "eq" | "neq" | "in" | "ilike" | "like"
  | "gte" | "lte" | "gt" | "lt" | "is" | "contains";

export interface QueryFilter {
  type: FilterType;
  column: string;
  value: unknown;
}

export interface QueryOrder {
  column: string;
  ascending: boolean;
}

export interface DbQuery {
  table: string;
  operation: DbOperation;
  columns?: string;
  filters?: QueryFilter[];
  order?: QueryOrder[];
  limit?: number;
  /** "one" -> .single(), "maybe" -> .maybeSingle() */
  rowMode?: "one" | "maybe" | null;
  /** insert / update icin gonderilen veri */
  values?: unknown;
  /** insert/update sonrasi kayit geri istensin mi */
  returning?: boolean;
}

const ALLOWED_FILTERS: FilterType[] = [
  "eq", "neq", "in", "ilike", "like", "gte", "lte", "gt", "lt", "is", "contains",
];

/** Kolon adlarinda yalnizca guvenli karakterlere izin ver. */
const COLUMN_PATTERN = /^[a-z_][a-z0-9_]*$/;

export function validateQuery(query: unknown): { ok: true; query: DbQuery } | { ok: false; error: string } {
  if (!query || typeof query !== "object") return { ok: false, error: "Geçersiz sorgu" };

  const q = query as Record<string, unknown>;
  const table = String(q.table || "");
  const operation = String(q.operation || "") as DbOperation;

  if (!getTablePolicy(table)) return { ok: false, error: `Bu tabloya erişim tanımlı değil: ${table}` };
  if (!["select", "insert", "update", "delete"].includes(operation)) {
    return { ok: false, error: "Geçersiz işlem" };
  }

  const filters: QueryFilter[] = [];
  if (q.filters !== undefined) {
    if (!Array.isArray(q.filters)) return { ok: false, error: "filters bir dizi olmalı" };
    for (const raw of q.filters) {
      const f = raw as Record<string, unknown>;
      const type = String(f.type || "") as FilterType;
      const column = String(f.column || "");
      if (!ALLOWED_FILTERS.includes(type)) return { ok: false, error: `Geçersiz filtre: ${type}` };
      if (!COLUMN_PATTERN.test(column)) return { ok: false, error: `Geçersiz kolon: ${column}` };
      filters.push({ type, column, value: f.value });
    }
  }

  const order: QueryOrder[] = [];
  if (q.order !== undefined) {
    if (!Array.isArray(q.order)) return { ok: false, error: "order bir dizi olmalı" };
    for (const raw of q.order) {
      const o = raw as Record<string, unknown>;
      const column = String(o.column || "");
      if (!COLUMN_PATTERN.test(column)) return { ok: false, error: `Geçersiz sıralama kolonu: ${column}` };
      order.push({ column, ascending: o.ascending !== false });
    }
  }

  const columns = q.columns === undefined ? "*" : String(q.columns);
  // select ifadesinde yalnizca kolon adlari, virgul, bosluk ve * kabul edilir
  if (!/^[a-z0-9_,*\s()]+$/i.test(columns)) {
    return { ok: false, error: "Geçersiz kolon listesi" };
  }

  const limit = q.limit === undefined ? undefined : Number(q.limit);
  if (limit !== undefined && (!Number.isFinite(limit) || limit < 0 || limit > 5000)) {
    return { ok: false, error: "Geçersiz limit" };
  }

  const rowMode = q.rowMode === "one" || q.rowMode === "maybe" ? q.rowMode : null;

  return {
    ok: true,
    query: {
      table,
      operation,
      columns,
      filters,
      order,
      limit,
      rowMode,
      values: q.values,
      returning: q.returning !== false,
    },
  };
}
