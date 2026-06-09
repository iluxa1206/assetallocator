import type { Metrics } from "@/lib/types";
import { cn } from "@/lib/utils";
import { fmtCompact, fmtPct as fmtP } from "@/lib/format";

function KpiCard({
  label, value, sub, positive,
}: { label: string; value: string; sub?: string; positive?: boolean }) {
  return (
    <div className="bg-card rounded-xl p-4 flex-1 min-w-[140px]">
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">{label}</p>
      <p className={cn(
        "text-xl font-semibold tabular-nums leading-tight",
        positive === true ? "text-emerald-500" : positive === false ? "text-red-400" : "",
      )}>
        {value}
      </p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

interface Props {
  portfolio: Metrics | null;
  benchmark: Metrics | null;
  cpi: Metrics | null;
  investedBase: number | null;
  endedBase: number | null;
  baseCurrency: string;
}

export function KpiStrip({ portfolio, benchmark, cpi, investedBase, endedBase, baseCurrency }: Props) {
  if (!portfolio) return null;

  const profit = investedBase != null && endedBase != null ? endedBase - investedBase : null;

  const cagrSubs: string[] = [];
  if (benchmark) cagrSubs.push("бенч " + fmtP(benchmark.cagr));
  if (cpi) cagrSubs.push("инфл " + fmtP(cpi.cagr));

  return (
    <div className="flex gap-3 flex-wrap">
      <KpiCard
        label="Сумма на старте"
        value={investedBase != null ? fmtCompact(investedBase, baseCurrency) : "—"}
      />
      <KpiCard
        label="Сумма на конец"
        value={endedBase != null ? fmtCompact(endedBase, baseCurrency) : "—"}
        positive={endedBase != null && investedBase != null ? endedBase >= investedBase : undefined}
      />
      <KpiCard
        label="Финансовый результат"
        value={profit != null ? (profit >= 0 ? "+" : "") + fmtCompact(Math.abs(profit), baseCurrency) : "—"}
        sub={fmtP(portfolio.total_ret) + " за " + portfolio.years.toFixed(1) + " лет"}
        positive={profit != null ? profit >= 0 : undefined}
      />
      <KpiCard
        label="Среднегодовая доходность"
        value={fmtP(portfolio.cagr)}
        sub={cagrSubs.length ? cagrSubs.join(" · ") : undefined}
        positive={portfolio.cagr >= 0}
      />
      <KpiCard
        label="Макс. просадка"
        value={fmtP(portfolio.max_dd)}
        sub={"волат. " + fmtP(portfolio.vol)}
        positive={false}
      />
    </div>
  );
}
