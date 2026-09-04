"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Sparkles, UserX, X } from "lucide-react";
import type { Appointment } from "@/types";

export type AppointmentOutcomeChoice = "completed" | "active_follow" | "not_attended" | "cancel";

type AppointmentOutcomeModalProps = {
  open: boolean;
  appointment: Appointment | null;
  loading?: boolean;
  onClose: () => void;
  onSelect: (choice: Exclude<AppointmentOutcomeChoice, "cancel">) => void | Promise<void>;
  /**
   * "Gelmedi" yalnizca yoklama alinirken anlamlidir. Gorusmesi yapilmis bir
   * kaydin sonucunu sonradan secerken gosterilmez.
   */
  allowNotAttended?: boolean;
};

const OPTIONS: Array<{
  value: Exclude<AppointmentOutcomeChoice, "cancel">;
  title: string;
  description: string;
  icon: typeof CheckCircle2;
  accent: string;
}> = [
  {
    value: "completed",
    title: "Tamamlandı",
    description: "Görüşme tamamlandı. Öğrenci görüşme listesinden çıkar, yalnızca başvurular ekranında kalır.",
    icon: CheckCircle2,
    accent: "from-emerald-500 to-green-600"
  },
  {
    value: "active_follow",
    title: "Aktif Takip",
    description: "Öğrenci Aktif Takip durumuna geçer ve ilgili sekmeye taşınır.",
    icon: Sparkles,
    accent: "from-cyan-500 to-blue-600"
  },
  {
    // Randevuyu ileri bir gune atmak o gunun programini bozar. Bunun yerine
    // basvuru tekrar bekleyen kuyruguna doner, uygun oldugunuzda yeni bir
    // randevu verirsiniz. Gelmedigi bilgisi kayitta kalir.
    value: "not_attended",
    title: "Gelmedi",
    description: "Öğrenci randevuya gelmedi. Başvuru tekrar \"Bekliyor\" durumuna döner, ders saati serbest kalır.",
    icon: UserX,
    accent: "from-slate-400 to-slate-500"
  }
];

export function AppointmentOutcomeModal({
  open,
  appointment,
  loading = false,
  onClose,
  onSelect,
  allowNotAttended = true
}: AppointmentOutcomeModalProps) {
  if (!open || !appointment) return null;

  const options = allowNotAttended
    ? OPTIONS
    : OPTIONS.filter((option) => option.value !== "not_attended");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b bg-slate-50 px-6 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Görüşme Sonucu</Badge>
              <span className="text-xs text-slate-500">{appointment.start_time}</span>
            </div>
            <h2 className="mt-2 truncate text-lg font-bold text-slate-800">{appointment.participant_name}</h2>
            {appointment.participant_class && (
              <p className="mt-1 text-sm text-slate-500">{appointment.participant_class}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
            aria-label="Kapat"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 px-6 py-5">
          {options.map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.value}
                type="button"
                disabled={loading}
                onClick={() => void onSelect(option.value)}
                className="group w-full rounded-2xl border border-slate-200 bg-white p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-70"
              >
                <div className="flex items-start gap-3">
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-r ${option.accent} text-white shadow-sm`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-base font-semibold text-slate-800">{option.title}</div>
                    <div className="mt-1 text-sm leading-6 text-slate-500">{option.description}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="border-t bg-slate-50 px-6 py-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading} className="w-full">
            İptal
          </Button>
        </div>
      </div>
    </div>
  );
}
