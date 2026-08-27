import { NextResponse } from "next/server";
import { getSession, type SessionUser } from "@/lib/auth";

// API route'lari icin ortak oturum guard'lari.
// Kullanim:
//   const guard = await requireAdmin();
//   if (!guard.ok) return guard.response;
//   const session = guard.session;

export type GuardResult =
  | { ok: true; session: SessionUser }
  | { ok: false; response: NextResponse };

const unauthorized = () =>
  NextResponse.json({ error: "Oturum bulunamadı" }, { status: 401 });

const forbidden = () =>
  NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });

/** Giris yapmis herhangi bir kullanici (admin veya ogretmen). */
export async function requireSession(): Promise<GuardResult> {
  const session = await getSession();
  if (!session) return { ok: false, response: unauthorized() };
  return { ok: true, session };
}

/** Yalnizca admin (rehber ogretmen). */
export async function requireAdmin(): Promise<GuardResult> {
  const session = await getSession();
  if (!session) return { ok: false, response: unauthorized() };
  if (session.role !== "admin") return { ok: false, response: forbidden() };
  return { ok: true, session };
}

/** Yalnizca ogretmen. */
export async function requireTeacher(): Promise<GuardResult> {
  const session = await getSession();
  if (!session) return { ok: false, response: unauthorized() };
  if (session.role !== "teacher") return { ok: false, response: forbidden() };
  return { ok: true, session };
}
