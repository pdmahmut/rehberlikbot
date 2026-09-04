"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
// Sorgu sonuclari cagiran koda supabase-js ile ayni sekilde (tiplenmemis)
// donuyor; sayfalar sonucu kendi tipine cast ediyor.

// Tarayici tarafi veritabani istemcisi.
//
// Supabase'in zincirlenebilir sorgu arayuzunun kullandigimiz alt kumesini
// taklit eder, ama istegi dogrudan veritabanina degil /api/db gecidine
// gonderir. Boylece:
//   - anon anahtarin tarayicida bulunmasi gerekmez
//   - her sorgu sunucuda oturum ve yetki kontrolunden gecer
//   - ogretmen sorgularina sunucuda sinif filtresi eklenir
//
// Sayfa kodunda `supabase.from(...).select(...).eq(...)` yazimi ayni kalir.

type FilterType =
  | "eq" | "neq" | "in" | "ilike" | "like"
  | "gte" | "lte" | "gt" | "lt" | "is" | "contains";

interface QueryFilter {
  type: FilterType;
  column: string;
  value: unknown;
}

interface QueryOrder {
  column: string;
  ascending: boolean;
}

export interface DbResult<T = any> {
  data: T | null;
  error: { message: string; code?: string } | null;
}

interface QueryState {
  table: string;
  operation: "select" | "insert" | "update" | "delete";
  columns: string;
  filters: QueryFilter[];
  order: QueryOrder[];
  limit?: number;
  rowMode: "one" | "maybe" | null;
  values?: unknown;
  returning: boolean;
}

// --- Istek gruplama ---------------------------------------------------
//
// Tarayicidan sunucuya her gidis-donus ~300 ms suruyor ve bu sure sorgunun
// buyuklugunden bagimsiz. Bir sayfa acilirken sekiz sorgu gonderiliyorsa
// eskiden bu sekiz ayri HTTP istegi demekti.
//
// Ayni anda (ayni mikro-gorevde) gonderilen sorgular burada toplanip tek
// istekte yollanir. Promise.all([...]) icindeki sorgular dogal olarak ayni
// anda basladigi icin sayfa kodlarinda hicbir degisiklik gerekmez.

type PendingQuery = {
  payload: Record<string, unknown>;
  resolve: (value: DbResult<any>) => void;
};

let pending: PendingQuery[] = [];
let flushScheduled = false;

/** Tek istekte gonderilecek azami sorgu sayisi (sunucu tarafiyla ayni). */
const MAX_BATCH = 25;

function hataSonucu(message: string): DbResult<any> {
  return { data: null, error: { message } };
}

async function flush() {
  const batch = pending;
  pending = [];
  flushScheduled = false;

  // Tek sorgu varsa gruplamaya gerek yok; eski bicimde gonderilir.
  if (batch.length === 1) {
    const { payload, resolve } = batch[0];
    resolve(await gonder("/api/db", payload));
    return;
  }

  for (let i = 0; i < batch.length; i += MAX_BATCH) {
    const dilim = batch.slice(i, i + MAX_BATCH);
    try {
      const response = await fetch("/api/db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queries: dilim.map((q) => q.payload) }),
      });
      const body = await response.json().catch(() => null);

      if (!response.ok || !Array.isArray(body?.results)) {
        const mesaj = body?.error || `İstek başarısız (${response.status})`;
        dilim.forEach((q) => q.resolve(hataSonucu(mesaj)));
        continue;
      }

      dilim.forEach((q, idx) => {
        const r = body.results[idx];
        q.resolve({ data: r?.data ?? null, error: r?.error ?? null });
      });
    } catch (err) {
      const mesaj = err instanceof Error ? err.message : "Bağlantı hatası";
      dilim.forEach((q) => q.resolve(hataSonucu(mesaj)));
    }
  }
}

async function gonder(url: string, payload: unknown): Promise<DbResult<any>> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      return hataSonucu(body?.error || `İstek başarısız (${response.status})`);
    }
    return { data: body?.data ?? null, error: body?.error ?? null };
  } catch (err) {
    return hataSonucu(err instanceof Error ? err.message : "Bağlantı hatası");
  }
}

function execute(state: QueryState): Promise<DbResult<any>> {
  const payload = {
    table: state.table,
    operation: state.operation,
    columns: state.columns,
    filters: state.filters,
    order: state.order,
    limit: state.limit,
    rowMode: state.rowMode,
    values: state.values,
    returning: state.returning,
  };

  return new Promise<DbResult<any>>((resolve) => {
    pending.push({ payload, resolve });
    if (!flushScheduled) {
      flushScheduled = true;
      // Mikro-gorev: ayni anda baslatilan tum sorgular toplanir.
      queueMicrotask(flush);
    }
  });
}

/**
 * Zincirlenebilir sorgu kurucusu. `await` edildiginde istegi gonderir
 * (Promise gibi davranir, thenable).
 */
class QueryBuilder implements PromiseLike<DbResult<any>> {
  private state: QueryState;

  constructor(state: QueryState) {
    this.state = state;
  }

  private addFilter(type: FilterType, column: string, value: unknown): this {
    this.state.filters.push({ type, column, value });
    return this;
  }

  select(columns = "*"): this {
    this.state.columns = columns;
    if (this.state.operation !== "select") this.state.returning = true;
    return this;
  }

  insert(values: unknown): this {
    this.state.operation = "insert";
    this.state.values = values;
    this.state.returning = false;
    return this;
  }

  update(values: unknown): this {
    this.state.operation = "update";
    this.state.values = values;
    this.state.returning = false;
    return this;
  }

  delete(): this {
    this.state.operation = "delete";
    this.state.returning = false;
    return this;
  }

  eq(column: string, value: unknown) { return this.addFilter("eq", column, value); }
  neq(column: string, value: unknown) { return this.addFilter("neq", column, value); }
  in(column: string, value: unknown[]) { return this.addFilter("in", column, value); }
  ilike(column: string, value: string) { return this.addFilter("ilike", column, value); }
  like(column: string, value: string) { return this.addFilter("like", column, value); }
  gte(column: string, value: unknown) { return this.addFilter("gte", column, value); }
  lte(column: string, value: unknown) { return this.addFilter("lte", column, value); }
  gt(column: string, value: unknown) { return this.addFilter("gt", column, value); }
  lt(column: string, value: unknown) { return this.addFilter("lt", column, value); }
  is(column: string, value: unknown) { return this.addFilter("is", column, value); }
  contains(column: string, value: unknown) { return this.addFilter("contains", column, value); }

  order(column: string, options?: { ascending?: boolean }): this {
    this.state.order.push({ column, ascending: options?.ascending !== false });
    return this;
  }

  limit(count: number): this {
    this.state.limit = count;
    return this;
  }

  single(): this {
    this.state.rowMode = "one";
    this.state.returning = true;
    return this;
  }

  maybeSingle(): this {
    this.state.rowMode = "maybe";
    this.state.returning = true;
    return this;
  }

  then<TResult1 = DbResult<any>, TResult2 = never>(
    onfulfilled?: ((value: DbResult<any>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return execute(this.state).then(onfulfilled, onrejected);
  }
}

export const db = {
  from(table: string) {
    return new QueryBuilder({
      table,
      operation: "select",
      columns: "*",
      filters: [],
      order: [],
      rowMode: null,
      returning: true,
    });
  },
};

export default db;
