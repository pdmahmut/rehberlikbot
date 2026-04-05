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
  onClick
}: StudentCardProps) {
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
      {/* Full Width Card - Horizontal Layout */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-4">
        {/* SOL: Öğrenci Bilgileri */}
        <div className="flex-1 min-w-0">
          {/* Öğrenci Adı - Bold, Büyük */}
          <h3 className="text-base font-bold text-slate-900 leading-tight">
            {studentName}
          </h3>

          {/* Sınıf / Numara - Küçük, Gri */}
          <p className="mt-1 text-xs text-slate-500">
            {classDisplay || classNumber || "Sınıf bilinmiyor"}
          </p>

          {/* Not / Açıklama - 2 satır max */}
          {note && (
            <p className="mt-2 text-sm text-slate-700 line-clamp-2 leading-5">
              {truncateText(note, 2)}
            </p>
          )}
        </div>

        {/* SAĞ: Tarih ve Butonlar */}
        <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3 md:ml-auto">
          {/* Tarih */}
          <div className="text-xs text-slate-500 whitespace-nowrap">
            {formatDate(date)}
          </div>

          {/* Butonlar */}
          <div className="flex gap-2 items-center">
            {isScheduled ? (
              <Badge className="bg-amber-100 text-amber-700 border-0 text-xs whitespace-nowrap">
                <Calendar className="h-3 w-3 mr-1" />
                Randevu Verildi
              </Badge>
            ) : (
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
          </div>
        </div>
      </div>
    </div>
  );
}
