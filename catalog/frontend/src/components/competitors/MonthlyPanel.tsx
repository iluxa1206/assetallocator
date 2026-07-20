"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchCompetitorMonthly } from "@/lib/api";
import { fmtPct } from "@/lib/format";
import { cn } from "@/lib/utils";

const MONTHS_RU = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];

function fmtMonth(m: string): string {
  const [y, mm] = m.split("-");
  return `${MONTHS_RU[parseInt(mm) - 1]} ${y}`;
}

function fmtPrice(v: number): string {
  return v.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

/** Lazy-loaded month-by-month detail for one fund: date, unit price, month result. */
export function MonthlyPanel({ fundKey }: { fundKey: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["competitor-monthly", fundKey],
    queryFn: () => fetchCompetitorMonthly(fundKey),
    staleTime: 5 * 60_000,
  });

  if (isLoading)
    return <div className="px-4 py-3 text-xs text-muted-foreground animate-pulse">Загрузка помесячных данных…</div>;
  if (isError || !data)
    return <div className="px-4 py-3 text-xs text-destructive">Не удалось загрузить помесячные данные</div>;
  if (data.rows.length === 0)
    return <div className="px-4 py-3 text-xs text-muted-foreground">Нет котировок</div>;

  // Newest first.
  const rows = [...data.rows].reverse();

  return (
    <div className="px-4 py-3 bg-muted/30">
      <div className="max-h-72 overflow-y-auto rounded-lg border border-border/60 bg-card">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-card">
            <tr className="border-b border-border text-muted-foreground">
              <th className="text-left px-3 py-2 font-medium">Месяц</th>
              <th className="text-left px-3 py-2 font-medium">Дата котировки</th>
              <th className="text-right px-3 py-2 font-medium">Цена пая, ₽</th>
              <th className="text-right px-3 py-2 font-medium">Результат за мес.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const tone = r.ret == null ? "" : r.ret >= 0 ? "text-[var(--pos)]" : "text-[var(--neg)]";
              return (
                <tr key={r.month} className="border-b border-border/40 last:border-0 hover:bg-muted/40">
                  <td className="px-3 py-1.5 whitespace-nowrap">{fmtMonth(r.month)}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap text-muted-foreground">
                    {r.date.split("-").reverse().join(".")}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums whitespace-nowrap">{fmtPrice(r.price)}</td>
                  <td className={cn("px-3 py-1.5 text-right tabular-nums whitespace-nowrap font-medium", tone)}>
                    {fmtPct(r.ret)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
