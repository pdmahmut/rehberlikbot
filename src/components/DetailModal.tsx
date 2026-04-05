"use client";

import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export type DetailModalRecord = {
  id: string;
  type: "incident" | "referral" | "observation" | "request" | "individual";
  studentName: string;
  classDisplay?: string | null;
  classNumber?: string | null;
  date?: string | null;
  note?: string | null;
  sourceLabel: string;
  detailEntries: Array<{ label: string; value?: string | null }>;
};

type DetailModalProps = {
  open: boolean;
  item: DetailModalRecord | null;
  onOpenChange: (open: boolean) => void;
};

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  return date.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
};

export function DetailModal({ open, item, onOpenChange }: DetailModalProps) {
  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-xl p-6">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle>{item.sourceLabel || "Detaylar"}</DialogTitle>
              <DialogDescription>{item.studentName}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="flex flex-col gap-2">
              <div className="text-sm text-slate-500">Öğrenci</div>
              <div className="text-lg font-semibold text-slate-900">{item.studentName}</div>
              <div className="text-sm text-slate-500">
                {item.classDisplay || item.classNumber || "Sınıf/Numara bilinmiyor"}
              </div>
              <div className="text-sm text-slate-500">Tarih: {formatDate(item.date)}</div>
            </div>
          </div>

          <div className="grid gap-3">
            {item.detailEntries.map((entry) => (
              <div key={entry.label} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-400">{entry.label}</div>
                <div className="mt-2 text-sm text-slate-700">
                  {entry.value || "Bilgi yok"}
                </div>
              </div>
            ))}
          </div>

          {item.note && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Genel Not</div>
              <div className="mt-2 text-sm text-slate-700 whitespace-pre-line">{item.note}</div>
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <Badge variant="secondary" className="px-3 py-2 text-xs">
            {item.type === "referral" && "Öğretmen Yönlendirmesi"}
            {item.type === "incident" && "Öğrenci Bildirimi"}
            {item.type === "observation" && "Gözlem"}
            {item.type === "request" && "Veli Talebi"}
            {item.type === "individual" && "Bireysel Başvuru"}
          </Badge>
        </div>
      </DialogContent>
    </Dialog>
  );
}
