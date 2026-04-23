import { NextRequest, NextResponse } from "next/server";
import { updateAdminPassword } from "@/lib/adminPassword";
import { getSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Yetki yok" }, { status: 403 });
  }

  const { oldPassword, newPassword } = await request.json().catch(() => ({}));
  const result = updateAdminPassword(oldPassword, newPassword);
  if (!result.success) {
    return NextResponse.json({ error: result.error || "Güncellenemedi" }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
