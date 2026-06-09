"use client";

import Link from "next/link";
import { use, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layers, Shield, Flame, ChevronLeft, type LucideIcon } from "lucide-react";
import { fetchStrategy, fetchStrategySeries, fetchFunds, fetchMe, type CatalogRange } from "@/lib/api";
import { Sparkline } from "@/components/catalog/Sparkline";
import { PeriodSwitcher, RANGE_RETURN_LABEL } from "@/components/catalog/PeriodSwitcher";
import { fmtPct, fmtPctSimple } from "@/lib/format";
import { cn } from "@/lib/utils";

const RISK_META: Record<string, { label: string; Icon: LucideIcon; iconTone: string }> = {
  base: { label: "Базовый", Icon: Layers, iconTone: "bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300" },
  cons: { label: "Консервативный", Icon: Shield, iconTone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300" },
  agg: { label: "Агрессивный", Icon: Flame, iconTone: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300" },
};

const CCY_LABEL: Record<string, string> = {
  rub6040: "Рубль 60 / Валюта 40",
  equal: "Поровну 50 / 50",
  val6040: "Валюта 60 / Рубль 40",
  none: "—",
};

function KV({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex justify-between gap-3 py-1.5 border-b border-border/40 last:border-0 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right tabular-nums">{value}</span>
    </div>
  );
}

function KpiCard({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "pos" | "neg" | "neutral" }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
      <div
        className={cn(
          "mt-1 text-2xl font-bold tabular-nums tracking-tight leading-none",
          tone === "pos" && "text-emerald-700 dark:text-emerald-400",
          tone === "neg" && "text-rose-600 dark:text-rose-400",
        )}
      >
        {value}
      </div>
    </div>
  );
}

export default function StrategyDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const [range, setRange] = useState<CatalogRange>("max");
  const { data: s, isLoading, isError } = useQuery({
    queryKey: ["strategy", code],
    queryFn: () => fetchStrategy(code),
  });
  const { data: perf } = useQuery({
    queryKey: ["strategy-series", code, range],
    queryFn: () => fetchStrategySeries(code, range),
  });
  const { data: funds } = useQuery({ queryKey: ["funds"], queryFn: () => fetchFunds() });
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: fetchMe });

  if (isLoading) return <div className="text-muted-foreground text-sm">Загрузка…</div>;
  if (isError || !s) return <div className="text-destructive text-sm">Не удалось загрузить стратегию</div>;

  const meta = RISK_META[s.risk_profile] ?? RISK_META.base;
  const Icon = meta.Icon;

  const fundName = (k: string): string => {
    const f = funds?.find((x) => x.key === k);
    return f ? f.short_name ?? f.name : k;
  };
  const fundCcy = (k: string): string => {
    return funds?.find((x) => x.key === k)?.native_currency ?? "";
  };

  const entries = Object.entries(s.composition)
    .filter(([, w]) => w > 0)
    .sort(([, a], [, b]) => b - a);
  const total = entries.reduce((acc, [, w]) => acc + w, 0);
  const maxW = Math.max(...entries.map(([, w]) => w), 1);

  // Currency split
  let rub = 0;
  for (const [k, w] of entries) {
    if (fundCcy(k) === "RUB") rub += w;
  }
  const rubPct = (rub / total) * 100;

  // Backtested performance (engine-computed since strategy inception)
  const pRet = perf?.ret ?? null;
  const pBenchRet = perf?.bench_ret ?? null;
  const pDelta = pRet !== null && pBenchRet !== null ? pRet - pBenchRet : null;
  const pTone = pRet === null ? "neutral" : pRet >= 0 ? "up" : "down";
  const hasPerf = (perf?.points?.length ?? 0) >= 2;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            href="/catalog/strategies"
            className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Каталог стратегий
          </Link>
          <div className="mt-2 flex items-center gap-3">
            <div className={cn("rounded-xl p-2.5", meta.iconTone)}>
              <Icon className="h-5 w-5" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <h2 className="text-2xl font-bold tracking-tight leading-tight">{s.name}</h2>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {meta.label}
                {s.ccy_strategy !== "none" && <> · {CCY_LABEL[s.ccy_strategy] ?? s.ccy_strategy}</>}
              </div>
            </div>
          </div>
        </div>
        {me?.is_superuser && (
          <Link
            href={`/catalog/strategies/${s.code}/edit`}
            className="rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-accent transition-colors shrink-0"
          >
            Редактировать
          </Link>
        )}
      </div>

      {/* Backtested performance hero — engine-computed from composition since inception */}
      {hasPerf && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-end justify-between gap-6 flex-wrap">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {RANGE_RETURN_LABEL[range]}
              </div>
              <div
                className={cn(
                  "mt-2 text-5xl font-bold tabular-nums tracking-tight leading-none",
                  pRet === null && "text-muted-foreground/40",
                  pRet !== null && pRet >= 0 && "text-emerald-700 dark:text-emerald-400",
                  pRet !== null && pRet < 0 && "text-rose-600 dark:text-rose-400",
                )}
              >
                {fmtPct(pRet)}
              </div>
              {pDelta !== null && perf?.bench_label && (
                <div className="mt-2 text-xs tabular-nums">
                  <span
                    className={
                      pDelta >= 0
                        ? "text-emerald-600 dark:text-emerald-400 font-medium"
                        : "text-rose-600 dark:text-rose-400 font-medium"
                    }
                  >
                    {fmtPct(pDelta, 1)}
                  </span>{" "}
                  <span className="text-muted-foreground">
                    vs {perf.bench_label} ({fmtPct(pBenchRet, 1)})
                  </span>
                </div>
              )}
            </div>
            <div className="shrink-0">
              <div className="mb-2 flex justify-end">
                <PeriodSwitcher value={range} onChange={setRange} size="sm" />
              </div>
              <Sparkline
                points={perf?.points ?? []}
                benchPoints={perf?.bench_points ?? null}
                ytdStartIdx={perf?.ytd_start_idx ?? null}
                width={260}
                height={68}
                tone={pTone}
              />
              <div className="mt-1 flex items-center justify-between gap-3 text-[10px] text-muted-foreground tabular-nums">
                <span>{perf?.since ?? ""}</span>
                {perf?.bench_label && (
                  <span className="flex items-center gap-1 normal-case">
                    <span className="inline-block w-3 border-t border-dashed border-slate-400" />
                    {perf.bench_label}
                  </span>
                )}
                <span>{perf?.as_of ?? ""}</span>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <KpiCard
              label="CAGR"
              value={fmtPct(perf?.cagr ?? null)}
              tone={perf?.cagr != null ? (perf.cagr >= 0 ? "pos" : "neg") : "neutral"}
            />
            <KpiCard label="Волатильность (год.)" value={fmtPctSimple(perf?.vol ?? null, 1)} />
            <KpiCard
              label="Макс. просадка"
              value={fmtPct(perf?.max_dd ?? null, 1)}
              tone={perf?.max_dd != null && perf.max_dd < 0 ? "neg" : "neutral"}
            />
          </div>
        </div>
      )}

      {/* Currency split hero strip */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Валютная аллокация
        </div>
        <div className="mt-3 flex items-end gap-4">
          <div className="flex-1">
            <div className="flex h-3 rounded-full overflow-hidden ring-1 ring-border/70">
              <div className="bg-blue-500/80 dark:bg-blue-400/80 transition-all" style={{ width: `${rubPct}%` }} />
              <div className="bg-indigo-500/80 dark:bg-indigo-400/80 transition-all" style={{ width: `${100 - rubPct}%` }} />
            </div>
            <div className="mt-2.5 flex items-center gap-5 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                <span className="font-semibold tabular-nums">{Math.round(rubPct)}%</span>
                <span className="text-muted-foreground">₽ RUB</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-indigo-500" />
                <span className="font-semibold tabular-nums">{Math.round(100 - rubPct)}%</span>
                <span className="text-muted-foreground">FX</span>
              </span>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Фондов</div>
            <div className="text-3xl font-bold tabular-nums leading-none mt-1">{entries.length}</div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <aside className="rounded-xl border border-border bg-card p-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-2">
            Параметры
          </div>
          <KV label="Риск-профиль" value={meta.label} />
          <KV
            label="Валютная стратегия"
            value={s.ccy_strategy === "none" ? "—" : CCY_LABEL[s.ccy_strategy] ?? s.ccy_strategy}
          />
          <KV label="Дата запуска" value={s.inception_date} />
          <KV label="Целевая доходность" value={s.target_yield} />
          <KV label="Горизонт" value={s.horizon} />
          <KV label="Мин. чек" value={s.min_check} />
          <KV label="Ребалансировка" value={s.rebalance_period} />
          <KV label="Сумма весов" value={`${total}%`} />
        </aside>

        <div className="space-y-8">
          {s.description && (
            <section className="space-y-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Описание
              </h3>
              <p className="text-sm leading-relaxed whitespace-pre-line">{s.description}</p>
            </section>
          )}

          <section className="space-y-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Состав портфеля
            </h3>
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-[10px] uppercase tracking-[0.1em]">
                  <tr>
                    <th className="px-3 py-2.5 text-left">Фонд</th>
                    <th className="px-3 py-2.5 text-left">Валюта</th>
                    <th className="px-3 py-2.5 text-right">Вес</th>
                    <th className="px-3 py-2.5 w-40"></th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {entries.map(([k, weight]) => {
                    const ccy = fundCcy(k);
                    const isRub = ccy === "RUB";
                    return (
                      <tr key={k} className="border-t border-border hover:bg-accent/30 transition-colors">
                        <td className="px-3 py-2.5">
                          <Link href={`/catalog/funds/${k}`} className="font-medium hover:underline">
                            {fundName(k)}
                          </Link>
                          <span className="text-muted-foreground ml-1.5 text-xs">({k})</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={cn(
                              "text-[10px] font-semibold tracking-wider px-2 py-0.5 rounded ring-1",
                              isRub
                                ? "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:ring-blue-900"
                                : "bg-indigo-50 text-indigo-800 ring-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:ring-indigo-900",
                            )}
                          >
                            {ccy}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold">{weight}%</td>
                        <td className="px-3 py-2.5">
                          <div className="h-2 rounded-full bg-muted/70 overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full",
                                isRub
                                  ? "bg-blue-500/80 dark:bg-blue-400/80"
                                  : "bg-indigo-500/80 dark:bg-indigo-400/80",
                              )}
                              style={{ width: `${(weight / maxW) * 100}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
