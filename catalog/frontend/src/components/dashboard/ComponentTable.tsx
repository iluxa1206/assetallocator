import type { FundComponent } from "@/lib/types";
import { cn } from "@/lib/utils";
import { fmtFull, fmtProfit, fmtCompact, fmtCompactSigned, fmtPct, fmtPctSimple } from "@/lib/format";

function cls(v: number | null | undefined) {
  if (v == null) return "";
  return v > 0 ? "text-[var(--pos)]" : v < 0 ? "text-[var(--neg)]" : "";
}

/** Drawdown is ≤ 0: show "−X%" for losses, plain "0,00%" for none (no "+", no colour). */
function fmtDD(v: number | null | undefined): string {
  if (v == null) return "—";
  if (v === 0) return "0,00%";
  return fmtPct(v);
}

interface Props {
  components: FundComponent[];
  dates: string[];
  baseCurrency: string;
  investedBase?: number | null;
  endedBase?: number | null;
}

export function ComponentTable({ components, dates, baseCurrency, investedBase, endedBase }: Props) {
  const period = dates.length >= 2
    ? `${dates[0].slice(0, 7)} — ${dates[dates.length - 1].slice(0, 7)}`
    : "";

  const active = components.filter((c) => c.weight > 0);
  const totalInvested = active.reduce((s, c) => s + c.invested_base, 0);
  const totalEnded = active.reduce((s, c) => s + (c.ended_base ?? 0), 0);
  const totalProfit = totalEnded - totalInvested;

  return (
    <div className="glossy rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <p className="text-sm font-semibold">Финансовый результат по фондам</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Вклад каждого фонда в общий результат портфеля
          {period && <span className="ml-2">· {period}</span>}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="text-xs text-muted-foreground border-b border-border bg-muted/20">
              <th className="text-left py-3 px-4 font-medium">ФОНД</th>
              <th className="text-right py-3 px-3 font-medium">ДОЛЯ</th>
              <th className="text-right py-3 px-3 font-medium">СУММА НА СТАРТЕ</th>
              <th className="text-right py-3 px-3 font-medium">СУММА НА КОНЕЦ</th>
              <th className="text-right py-3 px-3 font-medium">РЕЗУЛЬТАТ</th>
              <th className="text-right py-3 px-3 font-medium">ДОХОДНОСТЬ</th>
              <th className="text-right py-3 px-3 font-medium">CAGR</th>
              <th className="text-right py-3 px-3 font-medium">ВОЛАТИЛЬНОСТЬ</th>
              <th className="text-right py-3 px-3 font-medium">МАКС. ПРОСАДКА</th>
              <th className="text-right py-3 px-4 font-medium">ВКЛАД</th>
            </tr>
          </thead>
          <tbody>
            {active.map((c) => {
              const profit = c.ended_base != null ? c.ended_base - c.invested_base : null;
              const contrib = profit != null && totalProfit !== 0 ? (profit / totalProfit) * 100 : null;
              return (
                <tr key={c.fund_key} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="py-3 px-4">
                    <span className="font-medium">{c.fund_name}</span>
                    <span className="text-xs text-muted-foreground ml-2">{c.fund_key}</span>
                  </td>
                  <td className="text-right tabular-nums py-3 px-3">{c.weight.toFixed(1).replace(".", ",")}%</td>
                  <td className="text-right tabular-nums py-3 px-3 text-muted-foreground" title={fmtFull(c.invested_base, baseCurrency)}>
                    {fmtCompact(c.invested_base, baseCurrency)}
                  </td>
                  <td className="text-right tabular-nums py-3 px-3 font-medium" title={c.ended_base != null ? fmtFull(c.ended_base, baseCurrency) : undefined}>
                    {c.ended_base != null ? fmtCompact(c.ended_base, baseCurrency) : "—"}
                  </td>
                  <td className={cn("text-right tabular-nums py-3 px-3 font-medium", cls(profit))} title={profit != null ? fmtProfit(profit, baseCurrency) : undefined}>
                    {fmtCompactSigned(profit, baseCurrency)}
                  </td>
                  <td className={cn("text-right tabular-nums py-3 px-3", cls(c.metrics?.total_ret))}>
                    {fmtPct(c.metrics?.total_ret ?? null)}
                  </td>
                  <td className={cn("text-right tabular-nums py-3 px-3", cls(c.metrics?.cagr))}>
                    {fmtPct(c.metrics?.cagr ?? null)}
                  </td>
                  <td className="text-right tabular-nums py-3 px-3 text-muted-foreground">
                    {fmtPctSimple(c.metrics?.vol ?? null)}
                  </td>
                  <td className={cn("text-right tabular-nums py-3 px-3", cls(c.metrics?.max_dd))}>
                    {fmtDD(c.metrics?.max_dd)}
                  </td>
                  <td className={cn("text-right tabular-nums py-3 px-4", cls(contrib))}>
                    {contrib != null ? (contrib >= 0 ? "+" : "−") + Math.abs(contrib).toFixed(1).replace(".", ",") + "%" : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {/* Summary row */}
          <tfoot>
            <tr className="border-t-2 border-border bg-muted/20 font-semibold text-sm">
              <td className="py-3 px-4">Итого по портфелю</td>
              <td className="text-right tabular-nums py-3 px-3">100,0%</td>
              <td className="text-right tabular-nums py-3 px-3 text-muted-foreground" title={fmtFull(totalInvested, baseCurrency)}>{fmtCompact(totalInvested, baseCurrency)}</td>
              <td className="text-right tabular-nums py-3 px-3" title={fmtFull(totalEnded, baseCurrency)}>{fmtCompact(totalEnded, baseCurrency)}</td>
              <td className={cn("text-right tabular-nums py-3 px-3", cls(totalProfit))} title={fmtProfit(totalProfit, baseCurrency)}>{fmtCompactSigned(totalProfit, baseCurrency)}</td>
              <td className={cn("text-right tabular-nums py-3 px-3", cls(totalProfit))}>
                {totalInvested > 0 ? fmtPct(totalProfit / totalInvested) : "—"}
              </td>
              <td colSpan={4} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
