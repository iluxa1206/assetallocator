import type { FxRow } from "@/lib/types";
import { cn } from "@/lib/utils";
import { fmtFull, fmtProfit, fmtCompact, fmtCompactSigned, fmtPct } from "@/lib/format";

function cls(v: number) {
  return v > 0 ? "text-[var(--pos)]" : v < 0 ? "text-[var(--neg)]" : "";
}

interface Props {
  rows: FxRow[];
  invCcy: string;
}

export function FxTable({ rows, invCcy }: Props) {
  const okRows = rows.filter((r) => r.ok);
  const sumI = okRows.reduce((a, r) => a + r.invested, 0);
  const sumPN = okRows.reduce((a, r) => a + r.fund_pnl, 0);
  const sumPF = okRows.reduce((a, r) => a + r.fx_effect, 0);
  const sumE = okRows.reduce((a, r) => a + r.ended, 0);
  const totalRet = sumI > 0 ? (sumE - sumI) / sumI : 0;

  return (
    <div className="glossy rounded-2xl p-4 overflow-x-auto">
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-3">
        Валютная декомпозиция ({invCcy})
      </p>
      <table className="w-full text-sm min-w-[700px]">
        <thead>
          <tr className="text-xs text-muted-foreground border-b border-border">
            <th className="text-left pb-2 font-medium">Фонд</th>
            <th className="text-right pb-2 font-medium">Валюта</th>
            <th className="text-right pb-2 font-medium">Вложено</th>
            <th className="text-right pb-2 font-medium">Паи</th>
            <th className="text-right pb-2 font-medium">Доход фонда %</th>
            <th className="text-right pb-2 font-medium">Доход фонда {invCcy}</th>
            <th className="text-right pb-2 font-medium">Δ курс</th>
            <th className="text-right pb-2 font-medium">Эффект курса</th>
            <th className="text-right pb-2 font-medium">Итого %</th>
            <th className="text-right pb-2 font-medium">Итого {invCcy}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.fund_key} className="border-b border-border/50 last:border-0 hover:bg-muted/30">
              <td className="py-2.5">
                <span className="font-medium">{r.fund_key}</span>
              </td>
              <td className="text-right py-2.5 text-muted-foreground">{r.native_currency}</td>
              <td className="text-right tabular-nums py-2.5" title={fmtFull(r.invested, invCcy)}>
                {fmtCompact(r.invested, invCcy)}
              </td>
              <td className="text-right tabular-nums py-2.5 text-muted-foreground">
                {r.ok ? r.units.toFixed(2) : "—"}
              </td>
              <td className={cn("text-right tabular-nums py-2.5", r.ok ? cls(r.fund_return_pct) : "text-muted-foreground")}>
                {r.ok ? fmtPct(r.fund_return_pct) : "—"}
              </td>
              <td className={cn("text-right tabular-nums py-2.5", r.ok ? cls(r.fund_pnl) : "text-muted-foreground")}>
                {r.ok ? fmtCompactSigned(r.fund_pnl, invCcy) : "—"}
              </td>
              <td className={cn("text-right tabular-nums py-2.5",
                r.ok && r.native_currency !== invCcy ? cls(r.fx_delta_pct) : "text-muted-foreground")}>
                {r.ok && r.native_currency !== invCcy ? fmtPct(r.fx_delta_pct) : "—"}
              </td>
              <td className={cn("text-right tabular-nums py-2.5", r.ok ? cls(r.fx_effect) : "text-muted-foreground")}>
                {r.ok && r.native_currency !== invCcy ? fmtCompactSigned(r.fx_effect, invCcy) : "—"}
              </td>
              <td className={cn("text-right tabular-nums py-2.5", r.ok ? cls(r.total_return_pct) : "text-muted-foreground")}>
                {r.ok ? fmtPct(r.total_return_pct) : "—"}
              </td>
              <td className="text-right tabular-nums py-2.5" title={r.ok ? fmtFull(r.ended, invCcy) : undefined}>
                {r.ok ? fmtCompact(r.ended, invCcy) : "—"}
              </td>
            </tr>
          ))}
          {okRows.length > 0 && (
            <tr className="border-t-2 border-border font-medium bg-muted/20">
              <td className="py-2.5 pl-1" colSpan={2}>Итого</td>
              <td className="text-right tabular-nums py-2.5" title={fmtFull(sumI, invCcy)}>{fmtCompact(sumI, invCcy)}</td>
              <td />
              <td />
              <td className={cn("text-right tabular-nums py-2.5", cls(sumPN))} title={fmtProfit(sumPN, invCcy)}>
                {fmtCompactSigned(sumPN, invCcy)}
              </td>
              <td />
              <td className={cn("text-right tabular-nums py-2.5", cls(sumPF))} title={fmtProfit(sumPF, invCcy)}>
                {fmtCompactSigned(sumPF, invCcy)}
              </td>
              <td className={cn("text-right tabular-nums py-2.5", cls(totalRet))}>
                {fmtPct(totalRet)}
              </td>
              <td className="text-right tabular-nums py-2.5" title={fmtFull(sumE, invCcy)}>{fmtCompact(sumE, invCcy)}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
