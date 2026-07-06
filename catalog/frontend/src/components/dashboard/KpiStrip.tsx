import type { Metrics } from "@/lib/types";
import { cn } from "@/lib/utils";
import { fmtCompact, fmtPct as fmtP, fmtYears } from "@/lib/format";

function AnimatedValue({ value, className }: { value: string; className?: string }) {
  const chars = value.split("");
  return (
    <span key={value} className={cn("t-digit-group is-animating tabular-nums", className)}>
      {chars.map((ch, i) => (
        <span
          key={i}
          className="t-digit"
          data-stagger={i === chars.length - 2 ? "1" : i === chars.length - 1 ? "2" : undefined}
        >
          {ch}
        </span>
      ))}
    </span>
  );
}

/** Compact uniform stat tile. */
function StatCard({
  label, value, sub, positive,
}: { label: string; value: string; sub?: string; positive?: boolean }) {
  return (
    <div className="glossy rounded-lg p-4 backdrop-blur-sm">
      <p className="text-[12px] text-muted-foreground font-semibold uppercase tracking-[0.06em] mb-1.5 truncate">{label}</p>
      <AnimatedValue
        value={value}
        className={cn(
          "block text-[1.5rem] font-bold leading-tight tracking-tight",
          positive === true ? "text-[var(--pos)]" : positive === false ? "text-[var(--neg)]" : "",
        )}
      />
      {sub && <p className="text-[12px] text-muted-foreground/70 mt-1 truncate">{sub}</p>}
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
  const profitPositive = profit != null ? profit >= 0 : undefined;

  const cagrSubs: string[] = [];
  if (benchmark) cagrSubs.push("бенч " + fmtP(benchmark.cagr));
  if (cpi) cagrSubs.push("инфл " + fmtP(cpi.cagr));

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
      {/* Hero — financial result */}
      <div className="relative col-span-2 lg:col-span-2 rounded-lg p-5 overflow-hidden glossy backdrop-blur-sm">
        <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-primary/70" />
        <div className="relative">
          <p className="text-[12px] text-muted-foreground font-semibold uppercase tracking-[0.08em] mb-2">
            Финансовый результат
          </p>
          <AnimatedValue
            value={profit != null ? (profit >= 0 ? "+" : "") + fmtCompact(Math.abs(profit), baseCurrency) : "—"}
            className={cn(
              "block text-[2.25rem] font-extrabold leading-none tracking-tight",
              profitPositive === true ? "text-[var(--pos)]" : profitPositive === false ? "text-[var(--neg)]" : "",
            )}
          />
          <div className="flex items-center gap-2 mt-3">
            <span className={cn(
              "inline-flex items-center text-xs font-bold tabular-nums px-2 py-1 rounded-lg",
              profitPositive
                ? "bg-[var(--pos)]/12 text-[var(--pos)]"
                : "bg-[var(--neg)]/12 text-[var(--neg)]",
            )}>
              {fmtP(portfolio.total_ret)}
            </span>
            <span className="text-[12px] text-muted-foreground">за {fmtYears(portfolio.years)}</span>
          </div>
        </div>
      </div>

      {/* Stat tiles */}
      <StatCard
        label="Сумма на старте"
        value={investedBase != null ? fmtCompact(investedBase, baseCurrency) : "—"}
      />
      <StatCard
        label="Сумма на конец"
        value={endedBase != null ? fmtCompact(endedBase, baseCurrency) : "—"}
        positive={endedBase != null && investedBase != null ? endedBase >= investedBase : undefined}
      />
      <StatCard
        label="Среднегодовая"
        value={fmtP(portfolio.cagr)}
        sub={cagrSubs.length ? cagrSubs.join(" · ") : undefined}
        positive={portfolio.cagr >= 0}
      />
      <StatCard
        label="Макс. просадка"
        value={fmtP(portfolio.max_dd)}
        sub={"волат. " + fmtP(portfolio.vol)}
        positive={false}
      />
    </div>
  );
}
