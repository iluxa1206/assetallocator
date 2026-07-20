"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

const MONTHS = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];

interface Props {
  value: string;            // "YYYY-MM-DD" or "YYYY-MM" — whatever store holds
  onChange: (v: string) => void;
  availableDates: string[]; // "YYYY-MM-DD" or "YYYY-MM" from API
  /** Какая дата месяца выбирается кликом: "last" (по умолчанию, конец месяца)
   * или "first" — первая точка месяца (для полей «от»: даёт выбрать дату формирования). */
  monthAnchor?: "first" | "last";
}

export function MonthYearPicker({ value, onChange, availableDates, monthAnchor = "last" }: Props) {
  const toYM = (d: string) => d.slice(0, 7);

  const ymToFull = new Map<string, string>();
  for (const d of availableDates) {
    const ym = toYM(d);
    if (monthAnchor === "last" || !ymToFull.has(ym)) ymToFull.set(ym, d);
  }
  const availableYM = new Set(availableDates.map(toYM));
  const years = [...new Set(availableDates.map((d) => parseInt(d.slice(0, 4))))].sort((a,b) => a-b);

  const currentYM = toYM(value || availableDates[0] || "");
  const [y, m] = currentYM.split("-");
  const year  = parseInt(y) || new Date().getFullYear();
  const month = parseInt(m) || 1;

  const [open,    setOpen]    = useState(false);
  const [closing, setClosing] = useState(false);
  const [viewYear, setViewYear] = useState(year);
  const [origin,  setOrigin]  = useState<"top-left" | "top-right">("top-left");

  const ref        = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const closeDropdown = () => {
    setClosing(true);
    closeTimerRef.current = setTimeout(() => {
      setClosing(false);
      setOpen(false);
    }, 150);
  };

  useEffect(() => {
    return () => { if (closeTimerRef.current) clearTimeout(closeTimerRef.current); };
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) closeDropdown();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const label = currentYM ? `${MONTHS[month - 1]} ${year}` : "—";

  const handleOpen = () => {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setOrigin(rect.left + 224 > window.innerWidth ? "top-right" : "top-left");
    }
    setOpen((o) => !o);
    setViewYear(year);
  };

  const prevYear = () => {
    const idx = years.indexOf(viewYear);
    if (idx > 0) setViewYear(years[idx - 1]);
  };
  const nextYear = () => {
    const idx = years.indexOf(viewYear);
    if (idx < years.length - 1) setViewYear(years[idx + 1]);
  };

  const selectMonth = (m: number) => {
    const ym = `${viewYear}-${String(m).padStart(2, "0")}`;
    if (!availableYM.has(ym)) return;
    onChange(ymToFull.get(ym) ?? ym);
    closeDropdown();
  };

  const isFirst = years.indexOf(viewYear) === 0;
  const isLast  = years.indexOf(viewYear) === years.length - 1;

  return (
    <div className="relative" ref={ref}>
      {/* Trigger */}
      <button type="button"
        ref={triggerRef}
        onClick={handleOpen}
        className={cn(
          "px-3 py-1.5 text-sm font-medium border border-input rounded-lg bg-background",
          "hover:bg-muted transition-colors focus:outline-none focus:ring-1 focus:ring-primary",
          "min-w-[96px] text-left",
          open && "ring-1 ring-primary border-primary"
        )}
      >
        {label}
      </button>

      {/* Popover */}
      {(open || closing) && (
        <div className={cn(
          "t-dropdown absolute top-full mt-2 z-50 w-56",
          "bg-popover border border-border rounded-xl shadow-xl overflow-hidden",
          origin === "top-right" && "right-0",
          open && !closing && "is-open",
          closing && "is-closing",
        )} data-origin={origin}>
          {/* Year selector */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
            <button type="button"
              onClick={prevYear}
              disabled={isFirst}
              className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-muted-foreground hover:text-foreground"
            >
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <span className="text-sm font-semibold tabular-nums">{viewYear}</span>
            <button type="button"
              onClick={nextYear}
              disabled={isLast}
              className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-muted-foreground hover:text-foreground"
            >
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>

          {/* Month grid — 3×4 */}
          <div className="grid grid-cols-3 gap-1 p-2">
            {MONTHS.map((name, i) => {
              const m = i + 1;
              const ym = `${viewYear}-${String(m).padStart(2, "0")}`;
              const available = availableYM.has(ym);
              const selected = ym === currentYM;
              return (
                <button type="button"
                  key={m}
                  onClick={() => selectMonth(m)}
                  disabled={!available}
                  className={cn(
                    "py-1.5 text-sm rounded-lg transition-colors font-medium",
                    selected
                      ? "bg-primary text-primary-foreground"
                      : available
                        ? "hover:bg-muted text-foreground"
                        : "opacity-25 cursor-not-allowed text-muted-foreground"
                  )}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
