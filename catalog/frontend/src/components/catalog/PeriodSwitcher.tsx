"use client";

import type { CatalogRange } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useTabsPill } from "@/hooks/useTabsPill";

/** Order + short button labels for the period switcher. */
export const RANGE_OPTIONS: { key: CatalogRange; label: string }[] = [
  { key: "1m", label: "1М" },
  { key: "3m", label: "3М" },
  { key: "6m", label: "6М" },
  { key: "12m", label: "12М" },
  { key: "2y", label: "2Г" },
  { key: "3y", label: "3Г" },
  { key: "ytd", label: "YTD" },
  { key: "max", label: "Всё" },
];

/** Headline wording for "доходность за <период>" given the active range. */
export const RANGE_RETURN_LABEL: Record<CatalogRange, string> = {
  "1m": "Доходность за 1 мес",
  "3m": "Доходность за 3 мес",
  "6m": "Доходность за 6 мес",
  "12m": "Доходность за 12 мес",
  "2y": "Доходность за 2 года",
  "3y": "Доходность за 3 года",
  ytd: "Доходность с начала года",
  max: "Доходность с начала жизни",
};

/** Short variant for tight card KPI strips. */
export const RANGE_RETURN_LABEL_SHORT: Record<CatalogRange, string> = {
  "1m": "1 мес",
  "3m": "3 мес",
  "6m": "6 мес",
  "12m": "12 мес",
  "2y": "2 года",
  "3y": "3 года",
  ytd: "С нач. года",
  max: "С нач. жизни",
};

export function PeriodSwitcher({
  value,
  onChange,
  size = "md",
  className,
}: {
  value: CatalogRange;
  onChange: (r: CatalogRange) => void;
  size?: "sm" | "md";
  className?: string;
}) {
  const { barRef, pillRef } = useTabsPill(value);

  return (
    <div
      ref={barRef}
      className={cn(
        "relative inline-flex rounded-lg border border-border bg-muted/40 p-0.5",
        className,
      )}
      role="group"
      aria-label="Период"
    >
      <span ref={pillRef} className="t-tabs-pill" aria-hidden="true" />
      {RANGE_OPTIONS.map(({ key, label }) => {
        const active = value === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            data-selected={active || undefined}
            className={cn(
              "relative z-10 rounded-md font-medium tabular-nums transition-colors",
              size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
