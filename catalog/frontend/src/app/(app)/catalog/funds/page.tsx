"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchFunds, fetchFundsSeries, fetchMe, type CatalogRange, type FundSeriesPoint } from "@/lib/api";
import { Sparkline } from "@/components/catalog/Sparkline";
import { PeriodSwitcher, RANGE_RETURN_LABEL_SHORT } from "@/components/catalog/PeriodSwitcher";
import { CATEGORY_META, CATEGORY_ORDER, FALLBACK_CATEGORY, hasChart } from "@/lib/catalog-meta";
import { fmtPct, fmtPctSimple } from "@/lib/format";
import type { Fund } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Plain ratio (Sharpe/Beta) — 2 decimals, no percent. */
function fmtNum(v: number | null | undefined, digits = 2): string {
  return v == null ? "—" : v.toFixed(digits);
}

/** One compact metric cell in the card's left column. */
function Metric({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[8.5px] font-medium uppercase tracking-[0.08em] text-muted-foreground leading-none truncate">
        {label}
      </div>
      <div className={cn("mt-0.5 text-[12px] font-semibold tabular-nums leading-none", valueClass)}>
        {value}
      </div>
    </div>
  );
}

function RiskDots({ score }: { score: number | null }) {
  if (!score) return null;
  return (
    <div className="flex gap-[3px]" title={`${score} из 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={cn("h-1.5 w-1.5 rounded-full", i <= score ? "bg-foreground" : "bg-border")}
        />
      ))}
    </div>
  );
}

function CcyBadge({ ccy }: { ccy: string }) {
  const tone = ccy === "RUB"
    ? "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:ring-blue-900"
    : "bg-indigo-50 text-indigo-800 ring-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:ring-indigo-900";
  return (
    <span className={cn("text-[10px] font-semibold tracking-wider px-2 py-0.5 rounded ring-1", tone)}>
      {ccy}
    </span>
  );
}

function FundHeroCard({ fund, series, retLabel }: { fund: Fund; series: FundSeriesPoint | undefined; retLabel: string }) {
  const ret = series?.ret ?? null;
  const benchRet = series?.bench_ret ?? null;
  const delta = ret !== null && benchRet !== null ? ret - benchRet : null;
  const tone = ret === null ? "neutral" : ret >= 0 ? "up" : "down";
  const { Icon } = CATEGORY_META[fund.category ?? ""] ?? FALLBACK_CATEGORY;
  const showChart = hasChart(fund);

  return (
    <Link
      href={`/catalog/funds/${fund.key}`}
      className={cn(
        "group flex flex-col min-h-[212px] rounded-xl border border-border bg-card p-4 transition-all",
        "hover:border-blue-400/50 hover:shadow-md hover:shadow-blue-500/5",
      )}
    >
      {/* Header: meta + risk dots */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.1em] text-muted-foreground min-w-0">
          <Icon className="h-3 w-3 shrink-0" strokeWidth={2} />
          <span className="truncate">{fund.contract_type ?? "—"}</span>
          <CcyBadge ccy={fund.native_currency} />
        </div>
        <RiskDots score={fund.risk_score} />
      </div>

      {/* Name */}
      <h3 className="mt-2 text-base font-semibold tracking-tight leading-snug line-clamp-2">
        {fund.short_name ?? fund.name}
      </h3>

      {showChart ? (
        /* Body: metrics column (left) + large chart (right) */
        <div className="mt-2.5 flex-1 min-h-0 flex gap-3">
          <div className="w-[136px] shrink-0 flex flex-col">
            <div className="text-[9px] uppercase tracking-[0.1em] text-muted-foreground">{retLabel}</div>
            <div
              className={cn(
                "mt-0.5 text-[1.7rem] font-bold tabular-nums tracking-tight leading-none",
                ret === null && "text-muted-foreground/50",
                ret !== null && ret >= 0 && "text-emerald-700 dark:text-emerald-400",
                ret !== null && ret < 0 && "text-rose-600 dark:text-rose-400",
              )}
            >
              {fmtPct(ret)}
            </div>
            {delta !== null && (
              <div className="mt-1 text-[10px] tabular-nums truncate">
                <span className={delta >= 0 ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-rose-600 dark:text-rose-400 font-medium"}>
                  {fmtPct(delta, 1)}
                </span>
                <span className="text-muted-foreground"> vs {series?.bench_label ?? "—"}</span>
              </div>
            )}

            <div className="mt-auto grid grid-cols-2 gap-x-3 gap-y-2 pt-3">
              <Metric label="CAGR" value={fmtPct(series?.cagr ?? null, 1)} />
              <Metric label="Волат." value={fmtPctSimple(series?.vol ?? null, 1)} />
              <Metric label="Sharpe" value={fmtNum(series?.sharpe)} />
              <Metric label="Beta" value={fmtNum(series?.beta)} />
              <Metric
                label="Просадка"
                value={fmtPct(series?.max_dd ?? null, 1)}
                valueClass={series?.max_dd != null && series.max_dd < 0 ? "text-rose-600 dark:text-rose-400" : undefined}
              />
              <Metric label="Бенчмарк" value={fmtPct(benchRet, 1)} />
            </div>
          </div>

          <div className="flex-1 min-w-0 flex items-stretch">
            <Sparkline points={series?.points ?? []} benchPoints={series?.bench_points ?? null} ytdStartIdx={series?.ytd_start_idx ?? null} width={200} height={120} tone={tone} className="w-full h-full" />
          </div>
        </div>
      ) : (
        <>
          {/* No-chart variant — meta grid instead of sparkline + KPI */}
          {fund.description && (
            <p className="mt-3 flex-1 text-[11px] leading-snug text-muted-foreground line-clamp-4">
              {fund.description}
            </p>
          )}
          <div className="mt-3 pt-3 border-t border-border grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
            {fund.target_yield && (
              <div className="col-span-2 text-muted-foreground">
                Цель: <span className="text-foreground font-medium tabular-nums">{fund.target_yield}</span>
              </div>
            )}
            {fund.horizon && (
              <div className="text-muted-foreground">
                Горизонт: <span className="text-foreground">{fund.horizon}</span>
              </div>
            )}
            {fund.min_check && (
              <div className="text-muted-foreground">
                От: <span className="text-foreground tabular-nums">{fund.min_check}</span>
              </div>
            )}
          </div>
        </>
      )}
    </Link>
  );
}

export default function FundsListPage() {
  const [range, setRange] = useState<CatalogRange>("max");
  const { data: funds, isLoading, isError } = useQuery({
    queryKey: ["funds"],
    queryFn: () => fetchFunds(),
  });
  const { data: series } = useQuery({
    queryKey: ["funds-series", range],
    queryFn: () => fetchFundsSeries(range),
  });
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: fetchMe });

  const retLabel = RANGE_RETURN_LABEL_SHORT[range];

  if (isLoading) return <div className="text-muted-foreground text-sm">Загрузка…</div>;
  if (isError || !funds) return <div className="text-destructive text-sm">Не удалось загрузить фонды</div>;

  const groups = new Map<string, Fund[]>();
  for (const f of funds) {
    const cat = f.category ?? "other";
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push(f);
  }
  const ordered = CATEGORY_ORDER.filter((c) => groups.has(c));

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between gap-3">
        <PeriodSwitcher value={range} onChange={setRange} />
        {me?.is_superuser && (
          <Link
            href="/catalog/funds/new"
            className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-accent transition-colors"
          >
            + Добавить фонд
          </Link>
        )}
      </div>

      {ordered.map((cat) => {
        const meta = CATEGORY_META[cat] ?? FALLBACK_CATEGORY;
        const Icon = meta.Icon;
        const count = groups.get(cat)!.length;
        return (
          <section key={cat} className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />
              {meta.label}
              <span className="text-border">·</span>
              <span className="text-muted-foreground/60 normal-case tracking-normal">
                {count} фонд{count === 1 ? "" : "ов"}
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3">
              {groups.get(cat)!.map((f) => (
                <FundHeroCard key={f.key} fund={f} series={series?.[f.key]} retLabel={retLabel} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
