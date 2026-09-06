"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtPct, fmtPctSimple, fmtYears } from "@/lib/format";
import type { WindowMetrics } from "@/lib/track-metrics";
import { fmtDateRu, fmtDuration, fmtMonthRu } from "@/lib/track-metrics";

function StatCard({
  label, value, sub, positive,
}: { label: string; value: string; sub?: string; positive?: boolean }) {
  return (
    <div className="glossy rounded-lg p-4 backdrop-blur-sm">
      <p className="text-[12px] text-muted-foreground font-semibold uppercase tracking-[0.06em] mb-1.5 truncate">{label}</p>
      <span className={cn(
        "block text-[1.5rem] font-bold leading-tight tracking-tight tabular-nums",
        positive === true ? "text-[var(--pos)]" : positive === false ? "text-[var(--neg)]" : "",
      )}>
        {value}
      </span>
      {sub && <p className="text-[12px] text-muted-foreground-2 mt-1 truncate">{sub}</p>}
    </div>
  );
}

/** Сетка ключевых метрик за выбранный период. */
export function TrackMetricsGrid({ m }: { m: WindowMetrics }) {
  const dd = m.maxDrawdown;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard
        label="Доходность за период"
        value={fmtPct(m.totalReturn)}
        sub={`${fmtDateRu(m.startDate)} → ${fmtDateRu(m.endDate)}`}
        positive={m.totalReturn >= 0}
      />
      <StatCard
        label="Среднегодовая (CAGR)"
        value={m.cagr != null ? fmtPct(m.cagr) : "—"}
        sub={m.cagr != null ? `за ${fmtYears(m.years)}` : "период короче года"}
        positive={m.cagr != null ? m.cagr >= 0 : undefined}
      />
      <StatCard
        label="Макс. просадка"
        value={dd ? fmtPct(dd.depth) : "—"}
        sub={dd ? `пик ${fmtMonthRu(dd.peakDate)} · дно ${fmtMonthRu(dd.troughDate)}` : "без просадок"}
        positive={dd ? false : undefined}
      />
      <StatCard
        label="Восстановление"
        value={dd ? (dd.recoveryDays != null ? fmtDuration(dd.recoveryDays) : "не завершено") : "—"}
        sub={dd?.recoveryDate ? `к ${fmtMonthRu(dd.recoveryDate)}` : dd ? "пик пока не достигнут" : undefined}
      />
      <StatCard
        label="Волатильность"
        value={m.volatility != null ? fmtPctSimple(m.volatility, 1) : "—"}
        sub="аннуализированная"
      />
      <StatCard
        label="Лучший месяц"
        value={m.bestMonth ? fmtPct(m.bestMonth.r) : "—"}
        sub={m.bestMonth ? fmtMonthRu(m.bestMonth.d) : undefined}
        positive={m.bestMonth ? true : undefined}
      />
      <StatCard
        label="Худший месяц"
        value={m.worstMonth ? fmtPct(m.worstMonth.r) : "—"}
        sub={m.worstMonth ? fmtMonthRu(m.worstMonth.d) : undefined}
        positive={m.worstMonth ? false : undefined}
      />
      <StatCard
        label="Прибыльных месяцев"
        value={m.positiveShare != null ? fmtPctSimple(m.positiveShare, 0) : "—"}
        sub={`${m.months} мес в периоде`}
      />
    </div>
  );
}

/** Панель метрик от выбранной на графике точки до конца периода. */
export function AnchorPanel({ m, onClear }: { m: WindowMetrics; onClear: () => void }) {
  const dd = m.maxDrawdown;
  const rows: { label: string; value: string; tone?: "pos" | "neg" }[] = [
    { label: "Доходность", value: fmtPct(m.totalReturn), tone: m.totalReturn >= 0 ? "pos" : "neg" },
    { label: "Среднегодовая", value: m.cagr != null ? fmtPct(m.cagr) : "—", tone: m.cagr != null ? (m.cagr >= 0 ? "pos" : "neg") : undefined },
    { label: "Макс. просадка", value: dd ? fmtPct(dd.depth) : "—", tone: dd ? "neg" : undefined },
    {
      label: "Восстановление",
      value: dd ? (dd.recoveryDays != null ? fmtDuration(dd.recoveryDays) : "не завершено") : "—",
    },
    { label: "Волатильность", value: m.volatility != null ? fmtPctSimple(m.volatility, 1) : "—" },
    { label: "Горизонт", value: fmtYears(m.years) },
  ];
  return (
    <div className="glossy rounded-2xl p-5 relative">
      <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-primary/70 rounded-l-2xl" />
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-sm font-semibold">Результат от выбранной точки</p>
          <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
            {fmtDateRu(m.startDate)} → {fmtDateRu(m.endDate)}
          </p>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          <X className="w-3.5 h-3.5" /> Сбросить
        </button>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3 lg:grid-cols-6">
        {rows.map((r) => (
          <div key={r.label}>
            <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-[0.06em]">{r.label}</p>
            <p className={cn(
              "text-base font-bold tabular-nums mt-0.5",
              r.tone === "pos" && "text-[var(--pos)]",
              r.tone === "neg" && "text-[var(--neg)]",
            )}>
              {r.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
