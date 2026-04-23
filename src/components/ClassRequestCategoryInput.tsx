"use client";

import { useMemo, useState } from "react";
import { Check, List, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { normalizeClassRequestCategory } from "@/lib/classRequests";

type ClassRequestCategoryInputProps = {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  onDeleteSuggestion?: (suggestion: string) => Promise<void> | void;
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
  onDeleteSuggestion,
  disabled = false,
  label = "Teknik Kategori",
  placeholder = "Kategori yazın veya seçin",
  hint,
  emptyText = "Eşleşen kategori yok. Yazdığınız değer yeni kategori olarak kaydedilecek.",
}: ClassRequestCategoryInputProps) {
  const [open, setOpen] = useState(false);
  const [forceShowList, setForceShowList] = useState(false);
  const [deletingSuggestion, setDeletingSuggestion] = useState<string | null>(null);

  const normalizedValue = normalizeClassRequestCategory(value);

  const dedupedSuggestions = useMemo(
    () =>
      Array.from(
      new Map(
        suggestions.map((item) => [normalizeClassRequestCategory(item), item.trim()])
      ).values()
      ),
    [suggestions]
  );

  const filteredSuggestions = useMemo(() => {
    if (forceShowList) return dedupedSuggestions.slice(0, 50);
    if (!normalizedValue) return dedupedSuggestions.slice(0, 8);

    return dedupedSuggestions
      .filter((item) => normalizeClassRequestCategory(item).includes(normalizedValue))
      .slice(0, 8);
  }, [dedupedSuggestions, forceShowList, normalizedValue]);

  const exactMatch = filteredSuggestions.some(
    (item) => normalizeClassRequestCategory(item) === normalizedValue
  );

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label className="text-sm font-semibold text-slate-700">{label}</label>
        <button
          type="button"
          disabled={disabled}
          onMouseDown={(event) => {
            event.preventDefault();
            setForceShowList(true);
            setOpen((prev) => !prev);
          }}
          className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          title="Kayıtlı kategorileri göster"
        >
          <List className="h-3.5 w-3.5" />
          Liste
        </button>
      </div>
      <div className="relative">
        <div className="relative">
          <Input
            value={value}
            disabled={disabled}
            placeholder={placeholder}
            onFocus={() => {
              setOpen(true);
              setForceShowList(false);
            }}
            onBlur={() =>
              setTimeout(() => {
                setOpen(false);
                setForceShowList(false);
              }, 120)
            }
            onChange={(event) => {
              onChange(event.target.value);
              setForceShowList(false);
              if (!open) setOpen(true);
            }}
            className="rounded-xl border-slate-200"
          />
        </div>

        {open && !disabled && (
          <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
            {filteredSuggestions.length > 0 ? (
              <div className="max-h-56 overflow-y-auto py-1.5">
                {filteredSuggestions.map((suggestion) => {
                  const selected =
                    normalizeClassRequestCategory(suggestion) === normalizedValue;
                  const isDeleting = deletingSuggestion === suggestion;

                  return (
                    <div
                      key={`${normalizeClassRequestCategory(suggestion)}-${suggestion}`}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 text-sm transition-colors",
                        selected
                          ? "bg-violet-50 text-violet-700"
                          : "text-slate-700 hover:bg-slate-50"
                      )}
                    >
                      <button
                        type="button"
                        onMouseDown={(event) => {
                          event.preventDefault();
                          onChange(suggestion);
                          setOpen(false);
                        }}
                        className="flex min-w-0 flex-1 items-center justify-between text-left"
                      >
                        <span className="truncate">{suggestion}</span>
                        {selected && <Check className="ml-2 h-4 w-4 shrink-0" />}
                      </button>
                      {onDeleteSuggestion && (
                        <button
                          type="button"
                          disabled={isDeleting}
                          onMouseDown={async (event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            setDeletingSuggestion(suggestion);
                            try {
                              await onDeleteSuggestion(suggestion);
                            } finally {
                              setDeletingSuggestion(null);
                            }
                          }}
                          className="rounded-md p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                          title="Kategoriyi sil"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
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
