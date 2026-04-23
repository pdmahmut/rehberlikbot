import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

type ObservationStatus = "pending" | "scheduled" | "converted" | "active_follow" | "completed";

const VALID_STATUSES: ObservationStatus[] = [
  "pending",
  "scheduled",
  "converted",
  "active_follow",
  "completed"
];

const isValidStatus = (value: unknown): value is ObservationStatus =>
  typeof value === "string" && VALID_STATUSES.includes(value as ObservationStatus);

const normalizeIncomingStatus = (value: unknown): ObservationStatus => {
  if (value === "active") return "active_follow";
  if (value === "regular" || value === "regular_meeting") return "active_follow";
  if (value === "randevu_verildi") return "converted";
  if (value === "scheduled") return "converted";
  if (isValidStatus(value)) return value;
  return "converted";
};

const collectTargetIds = (body: Record<string, unknown>) => {
  const ids = Array.isArray(body.ids) ? body.ids.filter((id): id is string => typeof id === "string" && id.trim().length > 0) : [];
  const studentId = typeof body.studentId === "string" && body.studentId.trim().length > 0 ? body.studentId.trim() : null;

  if (studentId) {
    ids.unshift(studentId);
  }

  return Array.from(new Set(ids));
};

const isMissingColumnError = (error: { message?: string } | null | undefined, columnName: string) => {
  const message = error?.message || "";
  return message.toLowerCase().includes("column") && message.toLowerCase().includes(columnName.toLowerCase());
};

export async function POST(request: NextRequest) {
  if (!supabase) {
    return NextResponse.json({ error: "Supabase yapılandırması eksik" }, { status: 500 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const targetIds = collectTargetIds(body);

    if (targetIds.length === 0) {
      return NextResponse.json({ error: "Güncellenecek gözlem kaydı bulunamadı" }, { status: 400 });
    }

    const status = normalizeIncomingStatus(body.status);
    const updatePayload: Record<string, unknown> = {
      status
    };

    if (status === "converted") {
      updatePayload.converted_at = new Date().toISOString();
      updatePayload.appointment_id = typeof body.appointment_id === "string" ? body.appointment_id : body.appointment_id || null;
    }

    if (status === "completed") {
      updatePayload.completed_at = new Date().toISOString();
    }

    const applyUpdate = async (payload: Record<string, unknown>) =>
      supabase
        .from("observation_pool")
        .update(payload)
        .in("id", targetIds)
        .select("*");

    let { data, error } = await applyUpdate(updatePayload);

    if (
      error &&
      (isMissingColumnError(error, "appointment_id") ||
        isMissingColumnError(error, "converted_at") ||
        isMissingColumnError(error, "completed_at"))
    ) {
      const {
        appointment_id: _ignoredAppointmentId,
        converted_at: _ignoredConvertedAt,
        completed_at: _ignoredCompletedAt,
        ...fallbackPayload
      } = updatePayload;

      const fallbackResult = await applyUpdate(fallbackPayload);
      data = fallbackResult.data;
      error = fallbackResult.error;
    }

    if (error) {
      console.error("Observation convert error:", error);
      return NextResponse.json(
        { error: "Gözlem kaydı güncellenemedi", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ observations: data || [], message: "Gözlem kaydı güncellendi" });
  } catch (error) {
    console.error("Observation convert unexpected error:", error);
    return NextResponse.json({ error: "Beklenmeyen hata oluştu" }, { status: 500 });
  }
}
