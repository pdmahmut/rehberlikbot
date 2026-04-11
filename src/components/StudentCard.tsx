"use client";

import { Button } from "@/components/ui/button";
import { Edit2, Trash2, Calendar } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export interface StudentCardProps {
  studentName: string;
  classDisplay?: string | null;
  classNumber?: string | null;
  note?: string | null;
  date?: string | null;
  onEdit: () => void;
  onDelete: () => void;
  appointmentUrl: string;
  isScheduled?: boolean;
  scheduledDate?: string | null; // randevu tarihi
  requestStatus?: "pending" | "scheduled" | "active_follow" | "regular_meeting" | "completed" | "cancelled";
  hideDelete?: boolean;
  onClick?: () => void;
}

const formatDate = (dateString?: string | null) => {
  if (!dateString) return "-";
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  } catch {
    return "-";
  }
};

const truncateText = (text: string | null | undefined, lines: number = 2) => {
  if (!text) return "";
  const lineArray = text.split("\n").slice(0, lines);
  const truncated = lineArray.join("\n");
  if (truncated.length > 150) {
    return truncated.substring(0, 150) + "...";
  }
  return truncated;
};

export function StudentCard({
  studentName,
  classDisplay,
  classNumber,
  note,
  date,
  onEdit,
  onDelete,
  appointmentUrl,
  isScheduled = false,
  scheduledDate,
  requestStatus,
  hideDelete = false,
  onClick
}: StudentCardProps) {
  const effectiveStatus = requestStatus || (isScheduled ? "scheduled" : "pending");

  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(event) => {
        if (!onClick) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
      className={`group rounded-xl border border-slate-200 bg-white shadow-sm transition-all duration-200 ${
        onClick ? "cursor-pointer hover:shadow-md hover:bg-slate-50 hover:-translate-y-0.5" : ""
      }`}
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-4">
        {/* SOL: Öğrenci Bilgileri */}
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-slate-900 leading-tight">
            {studentName}
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            {classDisplay || classNumber || "Sınıf bilinmiyor"}
          </p>
          {note && (
            <p className="mt-2 text-sm text-slate-700 line-clamp-2 leading-5">
              {truncateText(note, 2)}
            </p>
          )}
        </div>

        {/* SAĞ: Tarih ve Butonlar */}
        <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3 md:ml-auto">
          <div className="text-xs text-slate-500 whitespace-nowrap">
            {formatDate(date)}
          </div>

          <div className="flex gap-2 items-center">
            {effectiveStatus === "pending" ? (
              <Button
                asChild
                size="sm"
                className="bg-gradient-to-r from-indigo-600 via-sky-600 to-cyan-600 text-white hover:from-indigo-500 hover:via-sky-500 hover:to-cyan-500 text-xs h-8 px-2 rounded-lg flex-shrink-0 whitespace-nowrap"
              >
                <Link
                  href={appointmentUrl}
                  className="flex items-center gap-1"
                  onClick={(event) => event.stopPropagation()}
                >
                  <Calendar className="h-3.5 w-3.5" />
                  Randevuya Dönüştür
                </Link>
              </Button>
            ) : effectiveStatus === "scheduled" ? (
              <div className="flex flex-col items-end gap-0.5">
                <Badge className="bg-amber-100 text-amber-700 border-0 text-xs whitespace-nowrap">
                  <Calendar className="h-3 w-3 mr-1" />
                  Randevu Verildi
                </Badge>
                {scheduledDate && (
                  <span className="text-[11px] text-amber-600 font-medium">
                    {formatDate(scheduledDate)}
                  </span>
                )}
              </div>
            ) : effectiveStatus === "active_follow" ? (
              <Badge className="bg-cyan-100 text-cyan-700 border-0 text-xs whitespace-nowrap">
                <Calendar className="h-3 w-3 mr-1" />
                Aktif Takip
              </Badge>
            ) : effectiveStatus === "regular_meeting" ? (
              <Badge className="bg-violet-100 text-violet-700 border-0 text-xs whitespace-nowrap">
                <Calendar className="h-3 w-3 mr-1" />
                Düzenli Görüşme
              </Badge>
            ) : effectiveStatus === "completed" ? (
              <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs whitespace-nowrap">
                <Calendar className="h-3 w-3 mr-1" />
                Görüşme Yapıldı
              </Badge>
            ) : (
              <Badge className="bg-slate-100 text-slate-700 border-0 text-xs whitespace-nowrap">
                <Calendar className="h-3 w-3 mr-1" />
                İptal Edildi
              </Badge>
            )}

            <Button
              size="sm"
              variant="ghost"
              onClick={(event) => {
                event.stopPropagation();
                onEdit();
              }}
              className="h-8 w-8 p-0 text-slate-500 hover:text-slate-700 hover:bg-slate-200 flex-shrink-0"
              title="Düzenle"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </Button>

            {!hideDelete && (
              <Button
                size="sm"
                variant="ghost"
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete();
                }}
                className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-100 flex-shrink-0"
                title="Sil"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}