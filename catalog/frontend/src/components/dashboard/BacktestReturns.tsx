"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { fmtPct } from "@/lib/format";
import { cn } from "@/lib/utils";

const MONTH_LABELS = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];

interface Props {
  dates: string[];
  portfolio: number[];
  benchmark: number[] | null;
  cpi: number[] | null;
  deposit: number[] | null;
  portfolioName?: string;
  depositTerm?: number;
  currencyLabel?: string;
}

type LineKey = "portfolio" | "benchmark" | "cpi" | "deposit";

/** Heatmap cell: background tint scaled by magnitude relative to the grid's max move. */
function HeatCell({ v, maxAbs, bold }: { v: number | null; maxAbs: number; bold?: boolean }) {
  if (v == null) {
    return <td className="px-2 py-1.5 text-right text-muted-foreground-2">—</td>;
  }
  const intensity = maxAbs > 0 ? Math.min(1, Math.abs(v) / maxAbs) : 0;
  const pct = Math.round((0.06 + intensity * 0.4) * 100);
  const token = v >= 0 ? "var(--pos)" : "var(--neg)";
  return (
    <td
      className={cn("px-2 py-1.5 text-right tabular-nums", bold ? "font-bold border-l border-border" : "font-medium")}
      style={{ background: `color-mix(in oklab, ${token} ${pct}%, transparent)` }}
    >
      {fmtPct(v, 1)}
    </td>
  );
}

/** Month-over-month returns from an index series (start = 100). First point has no prior → null. */
function monthlyReturns(dates: string[], vals: number[]): { y: number; m: number; ret: number | null }[] {
  // Collapse to the last value seen per calendar month, preserving order.
  const byMonth = new Map<string, { y: number; m: number; val: number }>();
  dates.forEach((d, i) => {
    const v = vals[i];
    if (v == null) return;
    const [yStr, mStr] = d.split("-");
    const y = parseInt(yStr);
    const m = parseInt(mStr);
    if (Number.isNaN(y) || Number.isNaN(m)) return;
    byMonth.set(`${y}-${m}`, { y, m, val: v });
  });
  const pts = [...byMonth.values()];
  return pts.map((p, i) => ({
    y: p.y,
    m: p.m,
    ret: i === 0 ? null : pts[i - 1].val > 0 ? p.val / pts[i - 1].val - 1 : null,
  }));
}

export function BacktestReturns({
  dates,
  portfolio,
  benchmark,
  cpi,
  deposit,
  portfolioName = "Портфель",
  depositTerm,
  currencyLabel,
}: Props) {
  const [open, setOpen] = useState(false);

  const lines = useMemo(() => {
    const all: { key: LineKey; label: string; color: string; vals: number[] | null }[] = [
      { key: "portfolio", label: portfolioName, color: "var(--primary)", vals: portfolio },
      { key: "benchmark", label: "Индекс", color: "var(--chart-5)", vals: benchmark },
      { key: "cpi", label: "Инфляция", color: "var(--muted-foreground)", vals: cpi },
      { key: "deposit", label: depositTerm ? `Депозит ${depositTerm} мес` : "Депозит", color: "var(--pos)", vals: deposit },
    ];
    return all.filter((l): l is typeof l & { vals: number[] } => Array.isArray(l.vals));
  }, [portfolio, benchmark, cpi, deposit, portfolioName, depositTerm]);

  const [line, setLine] = useState<LineKey>("portfolio");
  const selected = lines.find((l) => l.key === line) ?? lines[0];

  const { years, byYear, annualByYear, maxAbs } = useMemo(() => {
    const empty = { years: [] as number[], byYear: new Map<number, Map<number, number | null>>(), annualByYear: new Map<number, number | null>(), maxAbs: 0 };
    if (!selected) return empty;
    const rows = monthlyReturns(dates, selected.vals);
    const byYear = new Map<number, Map<number, number | null>>();
    let maxAbs = 0;
    for (const r of rows) {
      if (!byYear.has(r.y)) byYear.set(r.y, new Map());
      byYear.get(r.y)!.set(r.m, r.ret);
      if (r.ret != null) maxAbs = Math.max(maxAbs, Math.abs(r.ret));
    }
    const years = [...byYear.keys()].sort((a, b) => a - b);
    const annualByYear = new Map<number, number | null>();
    for (const y of years) {
      const months = byYear.get(y)!;
      let acc = 1;
      let hasAny = false;
      for (let m = 1; m <= 12; m++) {
        const r = months.get(m);
        if (r != null) { acc *= 1 + r; hasAny = true; }
      }
      annualByYear.set(y, hasAny ? acc - 1 : null);
    }
    return { years, byYear, annualByYear, maxAbs };
  }, [dates, selected]);

  if (!selected || years.length === 0) return null;

  return (
    <div className="glossy rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-muted/30 transition-colors"
        aria-expanded={open}
      >
        <div>
          <p className="text-sm font-semibold">Доходность по месяцам</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Помесячная доходность выбранной линии{currencyLabel ? ` · в ${currencyLabel}` : ""}
          </p>
        </div>
        <ChevronDown className={cn("w-4 h-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} strokeWidth={2} />
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-3">
          {/* Line selector */}
          {lines.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {lines.map((l) => {
                const active = l.key === selected.key;
                return (
                  <button
                    key={l.key}
                    type="button"
                    onClick={() => setLine(l.key)}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors",
                      active
                        ? "border-border bg-muted/50 text-foreground"
                        : "border-transparent text-muted-foreground-2 hover:text-foreground hover:bg-muted/30",
                    )}
                  >
                    <span className="h-[3px] w-4 rounded-full shrink-0" style={{ background: l.color, opacity: active ? 1 : 0.4 }} />
                    {l.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Monthly heatmap grid */}
          <div className="rounded-xl border border-border overflow-x-auto">
            <table className="w-full min-w-[720px] text-xs">
              <thead className="bg-muted/50 text-[11px] uppercase tracking-[0.1em]">
                <tr>
                  <th className="px-2 py-2 text-left sticky left-0 bg-muted/50 z-10">Год</th>
                  {MONTH_LABELS.map((m) => (
                    <th key={m} className="px-2 py-2 text-right">{m}</th>
                  ))}
                  <th className="px-2 py-2 text-right font-bold">Год</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {years.map((y) => (
                  <tr key={y} className="border-t border-border">
                    <td className="px-2 py-1.5 font-semibold sticky left-0 bg-card">{y}</td>
                    {MONTH_LABELS.map((_, i) => (
                      <HeatCell key={i} v={byYear.get(y)?.get(i + 1) ?? null} maxAbs={maxAbs} />
                    ))}
                    <HeatCell v={annualByYear.get(y) ?? null} maxAbs={maxAbs} bold />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
