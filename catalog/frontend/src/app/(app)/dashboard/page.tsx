"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { usePortfolioStore } from "@/stores/portfolioStore";
import { computePortfolio } from "@/lib/api";
import { SetupGrid } from "@/components/dashboard/SetupGrid";
import { KpiStrip } from "@/components/dashboard/KpiStrip";
import { AllocationChart } from "@/components/dashboard/AllocationChart";
import { MainChart } from "@/components/dashboard/MainChart";
import { ComponentTable } from "@/components/dashboard/ComponentTable";
import { CompareTable } from "@/components/dashboard/CompareTable";
import { FxTable } from "@/components/dashboard/FxTable";
import { MonthYearPicker } from "@/components/dashboard/MonthYearPicker";
import { ManualPanel } from "@/components/dashboard/ManualPanel";
import { RISK_PROFILES, CCY_STRATEGIES, FUND_KEYS } from "@/lib/types";
import { CCY_LABEL } from "@/lib/format";
import { cn } from "@/lib/utils";

const BASE_CURRENCIES = ["RUB", "USD", "CNY"] as const;

export default function DashboardPage() {
  const s = usePortfolioStore();

  const req = {
    risk: s.risk,
    ccy: s.ccy,
    base_currency: s.base_currency,
    start_date: s.start_date || undefined,
    end_date: s.end_date || undefined,
    amount: s.amount,
    amount_ccy: s.amount_ccy,
    manual: s.manual,
    manual_funds: s.manual ? s.manual_funds : undefined,
    deposit_term_months: s.deposit_term_months,
  };

  const { data, isLoading, isError } = useQuery({
    queryKey: ["portfolio", req],
    queryFn: () => computePortfolio(req),
    staleTime: 30_000,
    placeholderData: keepPreviousData,   // keep prior result mounted while refetching → no layout collapse / scroll jump
  });

  const riskProfile = RISK_PROFILES[s.risk];
  const ccyStrategy = CCY_STRATEGIES[s.ccy];

  // Period summary string
  const periodSummary = data && data.dates.length >= 2
    ? `${data.dates[0]} → ${data.dates[data.dates.length - 1]} · ${data.metrics_portfolio?.years.toFixed(2)} лет · база ${s.base_currency}`
    : null;

  const fmtDateOption = (d: string) => {
    const months = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];
    const [y, m] = d.split("-");
    return months[parseInt(m) - 1] + " " + y;
  };

  const availableDates = data?.available_dates ?? [];

  return (
    <div>
      {/* ═══════════════════════════════════════
          СЕКЦИЯ 1: Подбор стратегии
      ═══════════════════════════════════════ */}
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Подбор инвестиционной стратегии</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Введите сумму инвестиций клиента, выберите риск-профиль и валютный микс.
            Аллокация по фондам и динамика стратегии рассчитываются автоматически.
          </p>
        </div>

        <SetupGrid />

        {/* Subsection header */}
        <div className="flex items-center justify-between pt-1">
          <div>
            <h2 className="text-base font-semibold">Индивидуальный портфель</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {s.manual
                ? "Ручной режим: доли заданы вручную, бенчмарки пересобираются автоматически"
                : "Доли фондов и бенчмарков рассчитываются автоматически по выбранной стратегии"}
            </p>
          </div>
          <button type="button"
            onClick={() => {
              if (s.manual) {
                s.set({ manual: false });
                return;
              }
              const seed: Record<string, number> = {};
              const autoWeights = data?.weights ?? {};
              FUND_KEYS.forEach((k) => (seed[k] = Math.round((autoWeights[k] ?? 10) * 10) / 10));
              s.set({ manual: true, manual_funds: seed });
            }}
            className="flex items-center gap-1.5 px-4 py-2 text-sm border border-border rounded-xl hover:bg-muted transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
            </svg>
            {s.manual ? "Вернуться к стратегии" : "Настроить портфель"}
          </button>
        </div>

        {s.manual && <ManualPanel />}

        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            Расчёт портфеля…
          </div>
        )}
        {isError && (
          <div className="text-sm text-destructive bg-destructive/10 rounded-xl px-4 py-3 border border-destructive/20">
            Ошибка загрузки данных. Проверьте подключение к серверу.
          </div>
        )}

        {data && (
          <AllocationChart
            components={data.fund_components}
            amount={s.amount}
            amountCcy={s.amount_ccy}
            currencyBreakdown={data.currency_breakdown}
            investedBase={data.invested_base}
            baseCurrency={s.base_currency}
          />
        )}
      </div>

      {/* ═══════════════════════════════════════
          EXPORT BAR
      ═══════════════════════════════════════ */}
      {data && (
        <div className="flex items-center justify-between py-5 mt-5 border-y border-border">
          <div>
            <p className="text-sm font-medium">Выгрузить рекомендацию для клиента</p>
            <p className="text-xs text-muted-foreground mt-0.5">Текущая аллокация с диаграммами по фондам и валютам</p>
          </div>
          <div className="flex gap-2">
            <button type="button" className="flex items-center gap-1.5 px-4 py-2 text-sm border border-border rounded-xl hover:bg-muted transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              PDF
            </button>
            <button type="button" className="flex items-center gap-1.5 px-4 py-2 text-sm border border-border rounded-xl hover:bg-muted transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h.008v.008h-.008V8.25zm0 0c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h17.25" />
              </svg>
              Excel
            </button>
            <button type="button" className="flex items-center gap-1.5 px-4 py-2 text-sm border border-border rounded-xl hover:bg-muted transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
              Шаблон письма
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════
          СЕКЦИЯ 2: Бэктест стратегии
      ═══════════════════════════════════════ */}
      {data && (
        <div className="space-y-5 mt-5">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Бэктест стратегии</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Выбор периода и валюты расчёта · ключевые метрики по портфелю и индексу-бенчмарку
            </p>
          </div>

          {/* Period bar */}
          <div className="flex items-center gap-5 flex-wrap bg-card border border-border rounded-2xl px-5 py-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Период</span>
              <MonthYearPicker
                value={s.start_date || (availableDates[0] ?? "")}
                onChange={(v) => s.set({ start_date: v })}
                availableDates={availableDates}
              />
              <span className="text-muted-foreground">—</span>
              <MonthYearPicker
                value={s.end_date || (availableDates[availableDates.length - 1] ?? "")}
                onChange={(v) => s.set({ end_date: v })}
                availableDates={availableDates}
              />
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Валюта расчёта</span>
              <div className="flex gap-1 p-1 bg-muted rounded-lg">
                {BASE_CURRENCIES.map((c) => (
                  <button type="button"
                    key={c}
                    onClick={() => s.set({ base_currency: c })}
                    className={cn(
                      "px-3 py-1.5 text-sm rounded-md transition-colors",
                      s.base_currency === c
                        ? "bg-primary text-primary-foreground font-medium"
                        : "text-muted-foreground hover:bg-muted/80"
                    )}
                  >
                    {CCY_LABEL[c]}
                  </button>
                ))}
              </div>
            </div>

            {periodSummary && (
              <div className="ml-auto text-xs text-muted-foreground font-medium">
                {periodSummary}
              </div>
            )}
          </div>

          {/* KPI strip */}
          <KpiStrip
            portfolio={data.metrics_portfolio}
            benchmark={data.metrics_benchmark}
            cpi={data.metrics_cpi}
            investedBase={data.invested_base}
            endedBase={data.ended_base}
            baseCurrency={s.base_currency}
          />

          {/* Chart */}
          <MainChart
            dates={data.dates}
            portfolio={data.portfolio_series}
            benchmark={data.benchmark_series}
            cpi={data.cpi_series}
            deposit={data.deposit_series}
            portfolioName={riskProfile?.name}
          />

          {/* Comparison table */}
          <CompareTable
            portfolio={data.metrics_portfolio}
            benchmark={data.metrics_benchmark}
            cpi={data.metrics_cpi}
            deposit={data.metrics_deposit}
            depositTerm={s.deposit_term_months}
            investedBase={data.invested_base}
            endedBase={data.ended_base}
            baseCurrency={s.base_currency}
            portfolioName={riskProfile?.name}
          />

          {/* Fund results table */}
          <ComponentTable
            components={data.fund_components}
            dates={data.dates}
            baseCurrency={s.base_currency}
            investedBase={data.invested_base}
            endedBase={data.ended_base}
          />

          {/* FX decomposition */}
          <FxTable rows={data.fx_decomp} invCcy={s.amount_ccy} />
        </div>
      )}
    </div>
  );
}
