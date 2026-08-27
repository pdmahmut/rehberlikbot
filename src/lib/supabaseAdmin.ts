import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Service role key ile calisan sunucu-ici Supabase client'i.
// RLS'i bypass eder; SADECE oturum dogrulamasi yapilmis API route'larindan kullanilmali.
// Bu dosya asla client component'ten import edilmemeli.

let _adminClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (typeof window !== "undefined") {
    throw new Error("getSupabaseAdmin yalnizca sunucu tarafinda kullanilabilir.");
  }

  if (_adminClient) return _adminClient;

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY tanimli degil. Bu anahtar olmadan kilitlenmis tablolara erisilemez."
    );
  }

  _adminClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return _adminClient;
}

export function hasSupabaseAdmin(): boolean {
  return Boolean(
    (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}
