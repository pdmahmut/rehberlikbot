"use client";

import { useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { normalizeClassRequestCategory } from "@/lib/classRequests";

type ClassRequestCategoryInputProps = {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  disabled?: boolean;
  label?: string;
  placeholder?: string;
  hint?: string;
  emptyText?: string;
};

export function ClassRequestCategoryInput({
  value,
  onChange,
  suggestions,
  disabled = false,
  label = "Teknik Kategori",
  placeholder = "Kategori yazın veya seçin",
  hint,
  emptyText = "Eşleşen kategori yok. Yazdığınız değer yeni kategori olarak kaydedilecek.",
}: ClassRequestCategoryInputProps) {
  const [open, setOpen] = useState(false);

  const normalizedValue = normalizeClassRequestCategory(value);

  const filteredSuggestions = useMemo(() => {
    const deduped = Array.from(
      new Map(
        suggestions.map((item) => [normalizeClassRequestCategory(item), item.trim()])
      ).values()
    );

    if (!normalizedValue) return deduped.slice(0, 8);

    return deduped
      .filter((item) => normalizeClassRequestCategory(item).includes(normalizedValue))
      .slice(0, 8);
  }, [normalizedValue, suggestions]);

  const exactMatch = filteredSuggestions.some(
    (item) => normalizeClassRequestCategory(item) === normalizedValue
  );

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-semibold text-slate-700">{label}</label>
      <div className="relative">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={value}
            disabled={disabled}
            placeholder={placeholder}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 120)}
            onChange={(event) => {
              onChange(event.target.value);
              if (!open) setOpen(true);
            }}
            className="rounded-xl border-slate-200 pl-9"
          />
        </div>

        {open && !disabled && (
          <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
            {filteredSuggestions.length > 0 ? (
              <div className="max-h-56 overflow-y-auto py-1.5">
                {filteredSuggestions.map((suggestion) => {
                  const selected =
                    normalizeClassRequestCategory(suggestion) === normalizedValue;

                  return (
                    <button
                      key={`${normalizeClassRequestCategory(suggestion)}-${suggestion}`}
                      type="button"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        onChange(suggestion);
                        setOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors",
                        selected
                          ? "bg-violet-50 text-violet-700"
                          : "text-slate-700 hover:bg-slate-50"
                      )}
                    >
                      <span className="truncate">{suggestion}</span>
                      {selected && <Check className="ml-2 h-4 w-4 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="px-3 py-3 text-sm text-slate-500">{emptyText}</div>
            )}
          </div>
        )}
      </div>
      <p className="text-xs text-slate-500">
        {hint || (exactMatch ? "Var olan kategori seçildi." : "Yeni bir kategori yazabilirsiniz.")}
      </p>
    </div>
  );
}
