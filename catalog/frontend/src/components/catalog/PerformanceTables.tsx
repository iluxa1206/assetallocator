"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchPerformance } from "@/lib/api";
import { fmtPct } from "@/lib/format";
import { cn } from "@/lib/utils";

const PERIOD_LABELS: Record<string, string> = {
  "1m": "1 мес",
  "3m": "3 мес",
  "6m": "6 мес",
  "1y": "1 год",
  "3y": "3 года",
  ytd: "С нач. года",
  inception: "С нач. жизни",
};

const PERIOD_ORDER = ["1m", "3m", "6m", "1y", "3y", "ytd", "inception"];

const MONTH_LABELS = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];

function PctCell({ v }: { v: number | null | undefined }) {
  if (v == null) return <span className="text-muted-foreground/40">—</span>;
  return (
    <span
      className={cn(
        "tabular-nums",
        v > 0 && "text-emerald-700 dark:text-emerald-400",
        v < 0 && "text-rose-600 dark:text-rose-400",
      )}
    >
      {fmtPct(v, 2)}
    </span>
  );
}

export function PerformanceTables({ fundKey }: { fundKey: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["performance", fundKey],
    queryFn: () => fetchPerformance(fundKey),
  });

  if (isLoading) return <div className="text-sm text-muted-foreground">Загрузка…</div>;
  if (!data || (!Object.keys(data.periods).length && !data.monthly.length)) {
    return <div className="text-sm text-muted-foreground">Нет данных для расчёта доходности.</div>;
  }

  const availablePeriods = PERIOD_ORDER.filter((p) => p in data.periods);

  // Pivot monthly → year × month matrix + annual cumulative product
  const byYear = new Map<number, Map<number, number | null>>();
  for (const m of data.monthly) {
    const [yStr, monthStr] = m.date.split("-");
    const y = parseInt(yStr);
    const mo = parseInt(monthStr);
    if (!byYear.has(y)) byYear.set(y, new Map());
    byYear.get(y)!.set(mo, m.ret);
  }
  const years = [...byYear.keys()].sort();
  const annualByYear = new Map<number, number | null>();
  for (const y of years) {
    const months = byYear.get(y)!;
    let acc = 1;
    let hasAny = false;
    for (let m = 1; m <= 12; m++) {
      const r = months.get(m);
      if (r != null) {
        acc *= 1 + r;
        hasAny = true;
      }
    }
    annualByYear.set(y, hasAny ? acc - 1 : null);
  }

  return (
    <div className="space-y-6">
      {/* Period returns: abs + annual */}
      {availablePeriods.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Результаты инвестирования{data.currency ? ` (в ${data.currency})` : ""} · на {data.as_of}
          </h3>
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-[10px] uppercase tracking-[0.1em]">
                <tr>
                  <th className="px-3 py-2 text-left">Доходность</th>
                  {availablePeriods.map((p) => (
                    <th key={p} className="px-3 py-2 text-right">{PERIOD_LABELS[p]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-border">
                  <td className="px-3 py-2 text-muted-foreground">В абсолюте</td>
                  {availablePeriods.map((p) => (
                    <td key={p} className="px-3 py-2 text-right">
                      <PctCell v={data.periods[p].abs} />
                    </td>
                  ))}
                </tr>
                <tr className="border-t border-border">
                  <td className="px-3 py-2 text-muted-foreground">В годовых</td>
                  {availablePeriods.map((p) => (
                    <td key={p} className="px-3 py-2 text-right">
                      <PctCell v={data.periods[p].annual} />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Monthly grid */}
      {years.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Изменение стоимости пая по месяцам{data.currency ? ` (в ${data.currency})` : ""}
          </h3>
          <div className="rounded-xl border border-border overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 text-[10px] uppercase tracking-[0.1em]">
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
                    {MONTH_LABELS.map((_, i) => {
                      const r = byYear.get(y)?.get(i + 1);
                      return (
                        <td key={i} className="px-2 py-1.5 text-right">
                          <PctCell v={r ?? null} />
                        </td>
                      );
                    })}
                    <td className="px-2 py-1.5 text-right font-bold border-l border-border">
                      <PctCell v={annualByYear.get(y) ?? null} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
