import type { Metrics } from "@/lib/types";
import { cn } from "@/lib/utils";
import { fmtCompact, fmtPct, fmtPctSimple } from "@/lib/format";

function Cell({ value, positive, muted, highlight }: { value: string; positive?: boolean; muted?: boolean; highlight?: boolean }) {
  return (
    <td className={cn(
      "text-right tabular-nums py-3 px-4",
      highlight && "bg-primary/[0.04]",
      muted ? "text-muted-foreground" : "",
      !muted && positive === true ? "text-[var(--pos)] font-semibold" :
      !muted && positive === false ? "text-[var(--neg)] font-semibold" : "font-medium",
    )}>
      {value}
    </td>
  );
}

interface ColHeader {
  label: string;
  color: string;
  name: string;
}

interface Props {
  portfolio: Metrics | null;
  benchmark: Metrics | null;
  cpi: Metrics | null;
  deposit: Metrics | null;
  depositTerm?: number;
  investedBase: number | null;
  endedBase: number | null;
  baseCurrency: string;
  portfolioName?: string;
}

export function CompareTable({ portfolio, benchmark, cpi, deposit, depositTerm = 6, investedBase, endedBase, baseCurrency, portfolioName = "Консервативный" }: Props) {
  if (!portfolio) return null;

  const benchEndedBase = investedBase != null && benchmark ? investedBase * (1 + benchmark.total_ret) : null;
  const cpiEndedBase = investedBase != null && cpi ? investedBase * (1 + cpi.total_ret) : null;
  const depEndedBase = investedBase != null && deposit ? investedBase * (1 + deposit.total_ret) : null;

  const profit = investedBase != null && endedBase != null ? endedBase - investedBase : null;
  const benchProfit = investedBase != null && benchEndedBase != null ? benchEndedBase - investedBase : null;
  const cpiProfit = investedBase != null && cpiEndedBase != null ? cpiEndedBase - investedBase : null;
  const depProfit = investedBase != null && depEndedBase != null ? depEndedBase - investedBase : null;

  // Colours synced 1:1 with MainChart line palette.
  const cols: ColHeader[] = [
    { label: `Портфель «${portfolioName}»`, color: "var(--primary)", name: "port" },
    { label: "Композитный индекс", color: "var(--chart-5)", name: "bench" },
    { label: `Депозит ${depositTerm} мес`, color: "var(--pos)", name: "dep" },
    { label: `Инфляция (${baseCurrency})`, color: "var(--muted-foreground)", name: "cpi" },
  ];

  type Row = {
    label: string;
    port: string; bench: string; dep: string; cpi_: string;
    posPort?: boolean; posBench?: boolean; posDep?: boolean; posCpi?: boolean;
    mutePort?: boolean; muteBench?: boolean; muteDep?: boolean; muteCpi?: boolean;
  };

  const rows: Row[] = [
    {
      label: "Сумма на старте",
      port: investedBase != null ? fmtCompact(investedBase, baseCurrency) : "—",
      bench: investedBase != null ? fmtCompact(investedBase, baseCurrency) : "—",
      dep: investedBase != null ? fmtCompact(investedBase, baseCurrency) : "—",
      cpi_: investedBase != null ? fmtCompact(investedBase, baseCurrency) : "—",
    },
    {
      label: "Сумма на конец",
      port: endedBase != null ? fmtCompact(endedBase, baseCurrency) : "—",
      bench: benchEndedBase != null ? fmtCompact(benchEndedBase, baseCurrency) : "—",
      dep: depEndedBase != null ? fmtCompact(depEndedBase, baseCurrency) : "—",
      cpi_: cpiEndedBase != null ? fmtCompact(cpiEndedBase, baseCurrency) : "—",
    },
    {
      label: "Финансовый результат",
      port: profit != null ? (profit >= 0 ? "+" : "−") + fmtCompact(Math.abs(profit), baseCurrency) : "—",
      bench: benchProfit != null ? (benchProfit >= 0 ? "+" : "−") + fmtCompact(Math.abs(benchProfit), baseCurrency) : "—",
      dep: depProfit != null ? (depProfit >= 0 ? "+" : "−") + fmtCompact(Math.abs(depProfit), baseCurrency) : "—",
      cpi_: cpiProfit != null ? (cpiProfit >= 0 ? "+" : "−") + fmtCompact(Math.abs(cpiProfit), baseCurrency) : "—",
      posPort: profit != null ? profit >= 0 : undefined,
      posBench: benchProfit != null ? benchProfit >= 0 : undefined,
      posDep: depProfit != null ? depProfit >= 0 : undefined,
      posCpi: cpiProfit != null ? cpiProfit >= 0 : undefined,
    },
    {
      label: "Доходность за период",
      port: fmtPct(portfolio.total_ret),
      bench: fmtPct(benchmark?.total_ret ?? null),
      dep: fmtPct(deposit?.total_ret ?? null),
      cpi_: fmtPct(cpi?.total_ret ?? null),
      posPort: portfolio.total_ret >= 0,
      posBench: benchmark ? benchmark.total_ret >= 0 : undefined,
      posDep: deposit ? deposit.total_ret >= 0 : undefined,
      posCpi: cpi ? cpi.total_ret >= 0 : undefined,
    },
    {
      label: "Среднегодовая доходность",
      port: fmtPct(portfolio.cagr),
      bench: fmtPct(benchmark?.cagr ?? null),
      dep: fmtPct(deposit?.cagr ?? null),
      cpi_: fmtPct(cpi?.cagr ?? null),
      posPort: portfolio.cagr >= 0,
      posBench: benchmark ? benchmark.cagr >= 0 : undefined,
      posDep: deposit ? deposit.cagr >= 0 : undefined,
      posCpi: cpi ? cpi.cagr >= 0 : undefined,
    },
    {
      label: "Волатильность годовая",
      port: fmtPctSimple(portfolio.vol),
      bench: fmtPctSimple(benchmark?.vol ?? null),
      dep: fmtPctSimple(deposit?.vol ?? null),
      cpi_: fmtPctSimple(cpi?.vol ?? null),
      mutePort: true,
      muteBench: true,
      muteDep: true,
      muteCpi: true,
    },
    {
      label: "Максимальная просадка",
      port: fmtPct(portfolio.max_dd),
      bench: fmtPct(benchmark?.max_dd ?? null),
      dep: fmtPct(deposit?.max_dd ?? null),
      cpi_: fmtPct(cpi?.max_dd ?? null),
      posPort: false,
      posBench: benchmark ? false : undefined,
      posDep: deposit ? false : undefined,
      posCpi: cpi ? false : undefined,
    },
  ];

  const vals = (r: Row) => [
    { v: r.port, pos: r.posPort, mute: r.mutePort },
    { v: r.bench, pos: r.posBench, mute: r.muteBench },
    { v: r.dep, pos: r.posDep, mute: r.muteDep },
    { v: r.cpi_, pos: r.posCpi, mute: r.muteCpi },
  ];

  return (
    <div className="glossy rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[640px]">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="text-left py-3 px-4 font-medium text-sm">Параметр</th>
            {cols.map((c, ci) => (
              <th key={c.name} className={cn("text-right py-3 px-4 font-medium", ci === 0 && "bg-primary/[0.04]")}>
                <div className="flex items-center justify-end gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ background: c.color }} />
                  <span className="text-xs uppercase tracking-wide" style={{ color: c.color }}>{c.label}</span>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
              <td className="py-3 px-4 text-sm text-muted-foreground">{r.label}</td>
              {vals(r).map((cell, i) => (
                <Cell key={i} value={cell.v} positive={cell.pos} muted={cell.mute} highlight={i === 0} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      <div className="px-4 py-3 border-t border-border/50 text-[11px] text-muted-foreground-2">
        Все ряды нормированы к 100 на стартовую дату. Композитный индекс собран из бенчмарков фондов пропорционально их долям. Депозит — реинвестирование с капитализацией каждые {depositTerm} мес по максимальной ставке топ-10 банков (ЦБ РФ). Инфляция — накопленный индекс CPI выбранной базовой валюты.
      </div>
    </div>
  );
}
