"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { usePortfolioStore } from "@/stores/portfolioStore";
import { ExportDialog } from "@/components/dashboard/report/ExportDialog";
import { computePortfolio } from "@/lib/api";
import { SetupGrid } from "@/components/dashboard/SetupGrid";
import { KpiStrip } from "@/components/dashboard/KpiStrip";
import { AllocationChart } from "@/components/dashboard/AllocationChart";
import { MainChart } from "@/components/dashboard/MainChart";
import { BacktestReturns } from "@/components/dashboard/BacktestReturns";
import { ComponentTable } from "@/components/dashboard/ComponentTable";
import { CompareTable } from "@/components/dashboard/CompareTable";
import { FxTable } from "@/components/dashboard/FxTable";
import { MonthYearPicker } from "@/components/dashboard/MonthYearPicker";
import { ManualPanel } from "@/components/dashboard/ManualPanel";
import { ExternalAssetsPanel } from "@/components/dashboard/ExternalAssetsPanel";
import { ClientPortfolioView } from "@/components/dashboard/ClientPortfolioView";
import { RISK_PROFILES, CCY_STRATEGIES, FUND_KEYS } from "@/lib/types";
import { CCY_LABEL, fmtYears } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Pencil, RotateCcw } from "lucide-react";
import { useTabsPill } from "@/hooks/useTabsPill";

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
    external_assets: s.external_assets.filter((a) => a.amount > 0),
  };

  const { data, isLoading, isError } = useQuery({
    queryKey: ["portfolio", req],
    queryFn: () => computePortfolio(req),
    staleTime: 30_000,
    placeholderData: keepPreviousData,   // keep prior result mounted while refetching → no layout collapse / scroll jump
  });

  const riskProfile = RISK_PROFILES[s.risk];
  const ccyStrategy = CCY_STRATEGIES[s.ccy];
  const { barRef: ccyBarRef, pillRef: ccyPillRef } = useTabsPill(s.base_currency, !!data);

  // Period summary string
  const periodSummary = data && data.dates.length >= 2
    ? `${data.dates[0]} → ${data.dates[data.dates.length - 1]} · ${fmtYears(data.metrics_portfolio?.years ?? 0)} · база ${s.base_currency}`
    : null;

  const fmtDateOption = (d: string) => {
    const months = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];
    const [y, m] = d.split("-");
    return months[parseInt(m) - 1] + " " + y;
  };

  // Data exists from 2020-12 (CPI base only); indices & funds start 2021-12 — clamp picker to that.
  const MIN_DATE = "2021-12-31";
  const availableDates = (data?.available_dates ?? []).filter((d) => d >= MIN_DATE);

  return (
    <div className="space-y-8">
      {/* ═══════════════════════════════════════
          СЕКЦИЯ 1: Подбор стратегии
      ═══════════════════════════════════════ */}
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] brand-text mb-1.5 w-fit">Модельный портфель</p>
            <h1 className="text-[1.7rem] font-extrabold tracking-tight">Подбор стратегии</h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-xl">
              Введите сумму, выберите риск-профиль и валютный микс — аллокация рассчитается автоматически.
            </p>
          </div>
        </div>

        <SetupGrid />

        {/* Subsection header */}
        <div className="flex flex-wrap items-start justify-between gap-3 pt-1">
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
            className="flex items-center px-4 py-2 text-sm font-semibold glossy rounded-xl hover:-translate-y-0.5 transition-transform"
          >
            <div className="t-icon-swap" data-state={s.manual ? "b" : "a"}>
              <span className="t-icon inline-flex items-center gap-1.5" data-icon="a">
                <Pencil className="w-4 h-4" />
                Настроить портфель
              </span>
              <span className="t-icon inline-flex items-center gap-1.5" data-icon="b">
                <RotateCcw className="w-4 h-4" />
                Вернуться к стратегии
              </span>
            </div>
          </button>
        </div>

        {s.manual && <ManualPanel />}

        {isLoading && (
          <div className="flex items-center gap-2 text-sm py-6">
            <svg className="animate-spin w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            <span className="t-shimmer" data-text="Расчёт портфеля…">Расчёт портфеля…</span>
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
            externalAdjusted={data.external_adjusted}
            externalItems={data.external_items}
            ourCurrencyBase={data.our_currency_base}
            externalCurrencyBase={data.external_currency_base}
          />
        )}

        <ExternalAssetsPanel />

        {data && data.external_total_base > 0 && (
          <ClientPortfolioView
            investedBase={data.invested_base ?? 0}
            externalTotalBase={data.external_total_base}
            ourCurrency={data.our_currency_base}
            ourClass={data.our_class_base}
            externalCurrency={data.external_currency_base}
            externalClass={data.external_class_base}
            baseCurrency={s.base_currency}
            adjusted={data.external_adjusted}
          />
        )}
      </div>

      {/* ═══════════════════════════════════════
          EXPORT BAR
      ═══════════════════════════════════════ */}
      {data && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 py-5 border-y border-border">
          <div>
            <p className="text-sm font-medium">Выгрузить рекомендацию для клиента</p>
            <p className="text-xs text-muted-foreground mt-0.5">Чистый отчёт: PNG для письма, печать в PDF или готовый текст</p>
          </div>
          <ExportDialog
            data={data}
            params={{
              amount: s.amount,
              amountCcy: s.amount_ccy,
              risk: s.risk,
              ccy: s.ccy,
              baseCurrency: s.base_currency,
              depositTermMonths: s.deposit_term_months,
            }}
            fileName={`Стратегия_${riskProfile?.name ?? "портфель"}`}
          />
        </div>
      )}

      {/* ═══════════════════════════════════════
          СЕКЦИЯ 2: Бэктест стратегии
      ═══════════════════════════════════════ */}
      {data && (
        <div className="space-y-5">
          <div className="flex items-center gap-4 pt-2">
            <div className="h-px flex-1 bg-border" />
            <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground whitespace-nowrap">Бэктест стратегии</h2>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* Period bar */}
          <div className="flex items-center gap-5 flex-wrap glossy rounded-2xl px-5 py-3">
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
              <div
                ref={ccyBarRef}
                className="relative flex gap-1 p-1 bg-muted rounded-lg"
                style={{ "--tabs-pill-pad": "4px" } as React.CSSProperties}
              >
                <span ref={ccyPillRef} className="t-tabs-pill t-tabs-pill-primary" aria-hidden="true" />
                {BASE_CURRENCIES.map((c) => (
                  <button type="button"
                    key={c}
                    onClick={() => s.set({ base_currency: c })}
                    data-selected={s.base_currency === c || undefined}
                    className={cn(
                      "relative z-10 px-3 py-1.5 text-sm rounded-md transition-colors",
                      s.base_currency === c
                        ? "text-primary-foreground font-medium"
                        : "text-muted-foreground hover:bg-muted/80"
                    )}
                  >
                    {CCY_LABEL[c]}
                  </button>
                ))}
              </div>
            </div>

            {periodSummary && (
              <div className="sm:ml-auto text-xs text-muted-foreground font-medium">
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

          {/* Monthly returns table (collapsible, per-line) */}
          <BacktestReturns
            dates={data.dates}
            portfolio={data.portfolio_series}
            benchmark={data.benchmark_series}
            cpi={data.cpi_series}
            deposit={data.deposit_series}
            portfolioName={riskProfile?.name}
            depositTerm={s.deposit_term_months}
            currencyLabel={CCY_LABEL[s.base_currency]}
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
          <FxTable rows={data.fx_decomp} invCcy={s.base_currency} />
        </div>
      )}
    </div>
  );
}
