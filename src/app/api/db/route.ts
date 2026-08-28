import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/apiAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  getTablePolicy,
  isOperationAllowed,
  validateQuery,
  type DbQuery,
  type QueryFilter,
} from "@/lib/dbGateway";
import type { SessionUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Tarayicidan gelen veritabani sorgulari icin tek giris noktasi.
//
// Sayfalar artik Supabase'e dogrudan baglanmaz; sorgu tanimini buraya
// gonderir. Burada oturum dogrulanir, tablo/islem izni kontrol edilir,
// ogretmen sorgularina sinif filtresi ZORLA eklenir ve sorgu service_role
// ile calistirilir. Boylece anon anahtarin tarayicida bulunmasi gerekmez.

type QueryBuilder = ReturnType<ReturnType<typeof getSupabaseAdmin>["from"]>;

/** Ogretmen icin sunucu tarafinda zorunlu sinif filtresi uretir. */
function teacherScopeFilter(query: DbQuery, session: SessionUser): QueryFilter | null {
  if (session.role !== "teacher") return null;

  const policy = getTablePolicy(query.table);
  if (!policy?.teacherScopeColumn) return null;

  return {
    type: "eq",
    column: policy.teacherScopeColumn,
    // Sinifi olmayan ogretmen hicbir kayit goremesin
    value: session.classKey || "__no_class__",
  };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function applyFilters(builder: any, filters: QueryFilter[]) {
  let result = builder;
  for (const f of filters) {
    switch (f.type) {
      case "eq": result = result.eq(f.column, f.value); break;
      case "neq": result = result.neq(f.column, f.value); break;
      case "in": result = result.in(f.column, Array.isArray(f.value) ? f.value : []); break;
      case "ilike": result = result.ilike(f.column, String(f.value)); break;
      case "like": result = result.like(f.column, String(f.value)); break;
      case "gte": result = result.gte(f.column, f.value); break;
      case "lte": result = result.lte(f.column, f.value); break;
      case "gt": result = result.gt(f.column, f.value); break;
      case "lt": result = result.lt(f.column, f.value); break;
      case "is": result = result.is(f.column, f.value); break;
      case "contains": result = result.contains(f.column, f.value as never); break;
    }
  }
  return result;
}

export async function POST(request: NextRequest) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;

  const session = guard.session;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi" }, { status: 400 });
  }

  const validated = validateQuery(body);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const query = validated.query;

  if (!isOperationAllowed(query.table, query.operation, session.role)) {
    return NextResponse.json(
      { error: `Bu işlem için yetkiniz yok: ${query.operation} ${query.table}` },
      { status: 403 }
    );
  }

  // Ogretmen filtresi istemciden GELMEZ, burada eklenir. Istemcinin
  // gonderdigi filtrelerle birlikte uygulanir; kaldirilamaz.
  const filters = [...(query.filters || [])];
  const scope = teacherScopeFilter(query, session);
  if (scope) filters.push(scope);

  try {
    const supabase = getSupabaseAdmin();
    let builder: QueryBuilder | any;

    switch (query.operation) {
      case "select":
        builder = applyFilters(supabase.from(query.table).select(query.columns || "*"), filters);
        for (const o of query.order || []) {
          builder = builder.order(o.column, { ascending: o.ascending });
        }
        if (query.limit !== undefined) builder = builder.limit(query.limit);
        break;

      case "insert":
        builder = supabase.from(query.table).insert(query.values as never);
        if (query.returning) builder = builder.select(query.columns || "*");
        break;

      case "update":
        builder = applyFilters(
          supabase.from(query.table).update(query.values as never),
          filters
        );
        if (query.returning) builder = builder.select(query.columns || "*");
        break;

      case "delete":
        builder = applyFilters(supabase.from(query.table).delete(), filters);
        if (query.returning) builder = builder.select(query.columns || "*");
        break;
    }

    if (query.rowMode === "one") builder = builder.single();
    else if (query.rowMode === "maybe") builder = builder.maybeSingle();

    const { data, error } = await builder;

    if (error) {
      return NextResponse.json({ data: null, error: { message: error.message, code: error.code } });
    }
    return NextResponse.json({ data, error: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Veritabanı hatası";
    return NextResponse.json({ data: null, error: { message } }, { status: 500 });
  }
}
