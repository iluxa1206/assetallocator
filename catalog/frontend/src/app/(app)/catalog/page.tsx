"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Search, LayoutGrid, Table2, ArrowUp, ArrowDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchFunds,
  fetchFundsSeries,
  fetchMe,
  type CatalogRange,
  type FundSeriesPoint,
} from "@/lib/api";
import { Sparkline } from "@/components/catalog/Sparkline";
import { PeriodSwitcher, RANGE_RETURN_LABEL_SHORT } from "@/components/catalog/PeriodSwitcher";
import { CompanyPresentations } from "@/components/catalog/CompanyPresentations";
import { CATEGORY_META, CATEGORY_ORDER, FALLBACK_CATEGORY, hasChart } from "@/lib/catalog-meta";
import { fmtPct, fmtPctSimple } from "@/lib/format";
import type { Fund } from "@/lib/types";
import { cn } from "@/lib/utils";

// ─── Category design tokens ──────────────────────────────────────────────────

// Institutional monochrome: neutral icon chips, muted labels — no rainbow category coding.
const CATEGORY_ICON = "bg-muted text-foreground/70";
const CATEGORY_LABEL = "text-muted-foreground";

const CATEGORY_STYLE: Record<
  string,
  { iconBg: string; iconText: string; label: string }
> = {
  equities:    { iconBg: CATEGORY_ICON, iconText: "text-foreground/70", label: CATEGORY_LABEL },
  bonds:       { iconBg: CATEGORY_ICON, iconText: "text-foreground/70", label: CATEGORY_LABEL },
  alternative: { iconBg: CATEGORY_ICON, iconText: "text-foreground/70", label: CATEGORY_LABEL },
  liquidity:   { iconBg: CATEGORY_ICON, iconText: "text-foreground/70", label: CATEGORY_LABEL },
  advisory:    { iconBg: CATEGORY_ICON, iconText: "text-foreground/70", label: CATEGORY_LABEL },
};

const FALLBACK_STYLE = CATEGORY_STYLE.advisory;

// ─── Tab filter ───────────────────────────────────────────────────────────────

const TABS = [
  { key: "all", label: "Все фонды" },
  { key: "alternative", label: "Хедж-фонды" },
  { key: "equities", label: "Акции" },
  { key: "bonds", label: "Облигации" },
  { key: "liquidity", label: "Ликвидность" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtNum(v: number | null | undefined, digits = 2): string {
  if (v == null) return "—";
  return (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(digits).replace(".", ",");
}

function fmtAsOf(iso?: string): string | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}.${m}.${y}` : null;
}

// Metric explanations — shown as native tooltips on hover.
const METRIC_HINTS: Record<string, string> = {
  CAGR: "Среднегодовая доходность (CAGR) за выбранный период",
  "Волат.": "Годовая волатильность доходности",
  Sharpe: "Коэффициент Шарпе: доходность на единицу риска (rf = 0)",
  Beta: "Бета к бенчмарку: чувствительность к рынку",
  "Просад.": "Максимальная просадка за период",
  "Бенч.": "Доходность бенчмарка за период",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function CcyBadge({ ccy }: { ccy: string }) {
  return (
    <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold tracking-wider border border-border text-muted-foreground">
      {ccy}
    </span>
  );
}

function RiskDots({ score }: { score: number | null }) {
  if (!score) return null;
  return (
    <div className="flex gap-[3px]" role="img" aria-label={`Уровень риска ${score} из 5`} title={`Риск: ${score} из 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={cn(
            "h-1.5 w-1.5 rounded-full transition-colors",
            i <= score ? "bg-foreground/70" : "bg-border",
          )}
        />
      ))}
    </div>
  );
}

function MetricCell({
  label,
  value,
  valueClass,
  divider,
}: {
  label: string;
  value: string;
  valueClass?: string;
  divider?: boolean;
}) {
  return (
    <div className={cn("min-w-0 text-center", divider && "border-l border-border/50 pl-1")}>
      <div
        title={METRIC_HINTS[label]}
        className={cn(
          "text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground-2 leading-none mb-0.5 truncate",
          METRIC_HINTS[label] && "cursor-help",
        )}
      >
        {label}
      </div>
      <div className={cn("text-[13px] font-semibold tabular-nums leading-none", valueClass)}>
        {value}
      </div>
    </div>
  );
}

// ─── FundCard ─────────────────────────────────────────────────────────────────

function FundCard({
  fund,
  series,
  retLabel,
  category,
}: {
  fund: Fund;
  series: FundSeriesPoint | undefined;
  retLabel: string;
  category: string;
}) {
  const ret = series?.ret ?? null;
  const benchRet = series?.bench_ret ?? null;
  const delta = ret !== null && benchRet !== null ? ret - benchRet : null;
  const tone: "up" | "down" | "neutral" =
    ret === null ? "neutral" : ret >= 0 ? "up" : "down";
  const { Icon } = CATEGORY_META[fund.category ?? ""] ?? FALLBACK_CATEGORY;
  const catStyle = CATEGORY_STYLE[category] ?? FALLBACK_STYLE;
  const showChart = hasChart(fund);
  const asOf = fmtAsOf(series?.as_of);

  return (
    <Link
      href={`/catalog/funds/${fund.key}`}
      className={cn(
        "group relative flex flex-col rounded-2xl glossy h-full",
        "cursor-pointer overflow-hidden transition-all duration-200 backdrop-blur-xl",
        "hover:-translate-y-0.5 hover:shadow-[0_18px_44px_-14px_rgba(40,50,110,0.30)]",
      )}
    >
      <div className="relative flex flex-col flex-1 p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className={cn("rounded-md p-1.5 shrink-0", catStyle.iconBg)}>
              <Icon className={cn("h-3 w-3", catStyle.iconText)} strokeWidth={2.2} />
            </div>
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[11px] text-muted-foreground truncate">
                {fund.contract_type ?? "—"}
              </span>
              <CcyBadge ccy={fund.native_currency} />
            </div>
          </div>
          <RiskDots score={fund.risk_score} />
        </div>

        {/* Fund name */}
        <h3 className="text-[15px] font-semibold tracking-tight leading-snug line-clamp-2 mb-3">
          {fund.short_name ?? fund.name}
        </h3>

        {showChart ? (
          <>
            {/* Return + sparkline row */}
            <div className="flex gap-3 flex-1 min-h-0 mb-3">
              {/* Return column */}
              <div className="w-[130px] shrink-0 flex flex-col">
                <div className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground-2 mb-1">
                  {retLabel}
                </div>
                <div
                  className={cn(
                    "text-[2rem] font-extrabold tabular-nums tracking-tight leading-none mb-1",
                    ret === null && "text-muted-foreground-2",
                    ret !== null && ret >= 0 && "text-[var(--pos)]",
                    ret !== null && ret < 0 && "text-[var(--neg)]",
                  )}
                >
                  {fmtPct(ret)}
                </div>
                {delta !== null && (
                  <div className="text-[11px] tabular-nums leading-none mt-0.5">
                    <span
                      className={cn(
                        "font-bold",
                        delta >= 0 ? "text-[var(--pos)]" : "text-[var(--neg)]",
                      )}
                    >
                      {fmtPct(delta, 2)}
                    </span>
                    <span className="text-muted-foreground-2 font-normal">
                      {" "}vs {series?.bench_label ?? "—"}
                    </span>
                  </div>
                )}
              </div>

              {/* Sparkline */}
              <div className="flex-1 min-w-0 flex items-stretch">
                <Sparkline
                  points={series?.points ?? []}
                  benchPoints={series?.bench_points ?? null}
                  ytdStartIdx={series?.ytd_start_idx ?? null}
                  height={90}
                  tone={tone}
                  className="w-full h-full"
                />
              </div>
            </div>

            {/* Metrics strip — grouped: доходность | риск | бенч */}
            <div className="border-t border-border/60 pt-3 grid grid-cols-3 gap-y-3 gap-x-1 sm:grid-cols-6 sm:gap-y-0">
              <MetricCell label="CAGR" value={fmtPct(series?.cagr ?? null, 2)} valueClass={series?.cagr != null && series.cagr >= 0 ? "text-[var(--pos)]" : series?.cagr != null ? "text-[var(--neg)]" : ""} />
              <MetricCell label="Волат." value={fmtPctSimple(series?.vol ?? null, 2)} />
              <MetricCell label="Sharpe" value={fmtNum(series?.sharpe)} />
              <MetricCell label="Beta" value={fmtNum(series?.beta)} divider />
              <MetricCell
                label="Просад."
                value={fmtPct(series?.max_dd ?? null, 2)}
                valueClass={series?.max_dd != null && series.max_dd < 0 ? "text-[var(--neg)]" : ""}
              />
              <MetricCell label="Бенч." value={fmtPct(benchRet, 2)} divider />
            </div>
            {asOf && (
              <div className="text-[11px] text-muted-foreground-2 text-right mt-2 tabular-nums">
                данные на {asOf}
              </div>
            )}
          </>
        ) : (
          <>
            {fund.description && (
              <p className="flex-1 text-[11px] leading-relaxed text-muted-foreground line-clamp-4 mb-3">
                {fund.description}
              </p>
            )}
            <div className="border-t border-border/60 pt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
              {fund.target_yield && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">Цель: </span>
                  <span className="font-semibold tabular-nums">{fund.target_yield}</span>
                </div>
              )}
              {fund.horizon && (
                <div>
                  <span className="text-muted-foreground">Горизонт: </span>
                  <span className="font-medium">{fund.horizon}</span>
                </div>
              )}
              {fund.min_check && (
                <div>
                  <span className="text-muted-foreground">От: </span>
                  <span className="font-medium tabular-nums">{fund.min_check}</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Link>
  );
}

// ─── FundGrid ────────────────────────────────────────────────────────────────

function FundGrid({
  funds,
  series,
  retLabel,
}: {
  funds: Fund[];
  series: Record<string, FundSeriesPoint> | undefined;
  retLabel: string;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {funds.map((f, i) => (
        <motion.div
          key={f.key}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
        >
          <FundCard
            fund={f}
            series={series?.[f.key]}
            retLabel={retLabel}
            category={f.category ?? "advisory"}
          />
        </motion.div>
      ))}
    </div>
  );
}

// ─── FundTable (compact screener view) ──────────────────────────────────────

function pctCls(v: number | null | undefined): string {
  if (v == null) return "";
  return v > 0 ? "text-[var(--pos)]" : v < 0 ? "text-[var(--neg)]" : "";
}

function FundTable({
  funds,
  series,
  retLabel,
}: {
  funds: Fund[];
  series: Record<string, FundSeriesPoint> | undefined;
  retLabel: string;
}) {
  const router = useRouter();
  const Th = ({ label, hint, align = "right" }: { label: string; hint?: string; align?: "left" | "right" }) => (
    <th
      title={hint}
      className={cn(
        "py-2.5 px-3 font-medium whitespace-nowrap",
        align === "left" ? "text-left" : "text-right",
        hint && "cursor-help",
      )}
    >
      {label}
    </th>
  );

  return (
    <div className="glossy rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[880px]">
          <thead>
            <tr className="text-xs text-muted-foreground border-b border-border bg-muted/20">
              <Th label="Фонд" align="left" />
              <Th label={retLabel} hint="Доходность за выбранный период" />
              <Th label="CAGR" hint={METRIC_HINTS.CAGR} />
              <Th label="Волат." hint={METRIC_HINTS["Волат."]} />
              <Th label="Sharpe" hint={METRIC_HINTS.Sharpe} />
              <Th label="Beta" hint={METRIC_HINTS.Beta} />
              <Th label="Просад." hint={METRIC_HINTS["Просад."]} />
              <Th label="Бенч." hint={METRIC_HINTS["Бенч."]} />
              <Th label="Риск" hint="Риск-профиль фонда (1–5)" />
            </tr>
          </thead>
          <tbody>
            {funds.map((f) => {
              const s = series?.[f.key];
              const ret = s?.ret ?? null;
              const benchRet = s?.bench_ret ?? null;
              return (
                <tr
                  key={f.key}
                  onClick={() => router.push(`/catalog/funds/${f.key}`)}
                  className="border-b border-border/50 last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                >
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium truncate">{f.short_name ?? f.name}</span>
                      <span className="text-[11px] text-muted-foreground shrink-0">{f.key}</span>
                      <CcyBadge ccy={f.native_currency} />
                    </div>
                  </td>
                  <td className={cn("text-right tabular-nums py-3 px-3 font-semibold", pctCls(ret))}>{fmtPct(ret)}</td>
                  <td className={cn("text-right tabular-nums py-3 px-3", pctCls(s?.cagr))}>{fmtPct(s?.cagr ?? null, 2)}</td>
                  <td className="text-right tabular-nums py-3 px-3 text-muted-foreground">{fmtPctSimple(s?.vol ?? null, 2)}</td>
                  <td className="text-right tabular-nums py-3 px-3">{fmtNum(s?.sharpe)}</td>
                  <td className="text-right tabular-nums py-3 px-3">{fmtNum(s?.beta)}</td>
                  <td className={cn("text-right tabular-nums py-3 px-3", s?.max_dd != null && s.max_dd < 0 ? "text-[var(--neg)]" : "")}>{fmtPct(s?.max_dd ?? null, 2)}</td>
                  <td className="text-right tabular-nums py-3 px-3 text-muted-foreground">{fmtPct(benchRet, 2)}</td>
                  <td className="py-3 px-3">
                    <div className="flex justify-end"><RiskDots score={f.risk_score} /></div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type SortKey = "ret" | "cagr" | "risk" | "name";
const SORT_LABELS: Record<SortKey, string> = {
  ret: "Доходности",
  cagr: "CAGR",
  risk: "Риску",
  name: "Названию",
};

export default function CatalogPage() {
  const [range, setRange] = useState<CatalogRange>("max");
  const [tab, setTab] = useState<TabKey>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("ret");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [view, setView] = useState<"cards" | "table">("cards");

  const onSort = (k: SortKey) => {
    if (sort === k) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else {
      setSort(k);
      setSortDir(k === "name" ? "asc" : "desc");
    }
  };

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

  if (isLoading) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="h-10 w-full max-w-xl rounded-xl bg-muted" />
        {[0, 1].map((g) => (
          <div key={g} className="space-y-4">
            <div className="h-5 w-36 rounded bg-muted" />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-[240px] rounded-xl border border-border bg-card" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (isError || !funds) {
    return <div role="alert" className="text-destructive text-sm">Не удалось загрузить фонды</div>;
  }

  const q = search.trim().toLowerCase();
  const matches = (f: Fund) =>
    !q || `${f.name} ${f.short_name ?? ""} ${f.key}`.toLowerCase().includes(q);

  // Base comparator is "desc" oriented (best/high first); sortDir flips it.
  const mul = sortDir === "desc" ? 1 : -1;
  const cmp = (a: Fund, b: Fund): number => {
    let base: number;
    if (sort === "name") base = (b.short_name ?? b.name).localeCompare(a.short_name ?? a.name, "ru");
    else if (sort === "risk") base = (b.risk_score ?? -1) - (a.risk_score ?? -1);
    else {
      const va = series?.[a.key]?.[sort] ?? -Infinity;
      const vb = series?.[b.key]?.[sort] ?? -Infinity;
      base = (vb ?? -Infinity) - (va ?? -Infinity);
    }
    return base * mul;
  };

  const activeFunds = funds.filter((f) => f.is_active && matches(f));
  const tabFunds = tab === "all" ? activeFunds : activeFunds.filter((f) => f.category === tab);
  const sortedTabFunds = [...tabFunds].sort(cmp);

  const groups = new Map<string, Fund[]>();
  for (const f of activeFunds) {
    const cat = f.category ?? "other";
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push(f);
  }
  for (const list of groups.values()) list.sort(cmp);

  const filteredFunds = tab === "all" ? [] : sortedTabFunds;

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-[0.98] duration-300">

      {/* ── Sticky toolbar ── */}
      <div className="sticky top-0 z-20 -mx-4 px-4 md:-mx-6 md:px-6 py-3 space-y-3 bg-background/80 backdrop-blur-md border-b border-border">
      {/* Search + sort + view row */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground-2" strokeWidth={2} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск фонда…"
            className="w-full glossy rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
          />
        </div>
        <div className="flex items-center gap-2 text-sm flex-wrap justify-end">
          <span className="text-muted-foreground hidden sm:inline">Сортировка по</span>
          <div className="flex glossy rounded-lg p-0.5 max-w-full overflow-x-auto no-scrollbar">
            {(["ret", "cagr", "risk", "name"] as SortKey[]).map((k) => {
              const on = sort === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => onSort(k)}
                  className={cn(
                    "inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors",
                    on ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {SORT_LABELS[k]}
                  {on && (sortDir === "desc"
                    ? <ArrowDown className="w-3 h-3" strokeWidth={2.5} />
                    : <ArrowUp className="w-3 h-3" strokeWidth={2.5} />)}
                </button>
              );
            })}
          </div>
          {/* View toggle */}
          <div className="flex glossy rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setView("cards")}
              title="Карточки"
              className={cn("p-1.5 rounded-md transition-colors", view === "cards" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              <LayoutGrid className="w-4 h-4" strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={() => setView("table")}
              title="Таблица"
              className={cn("p-1.5 rounded-md transition-colors", view === "table" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              <Table2 className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>

      {/* Tabs + period row */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        {/* Tab filter */}
        <div className="flex items-center gap-1 rounded-2xl glossy p-1 backdrop-blur-xl max-w-full overflow-x-auto no-scrollbar">
          {TABS.map((t) => {
            const count = t.key === "all" ? activeFunds.length : (groups.get(t.key)?.length ?? 0);
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={cn(
                  "relative flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-sm font-semibold transition-all duration-200 shrink-0 whitespace-nowrap",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                )}
              >
                {t.label}
                {count > 0 && (
                  <span
                    className={cn(
                      "text-[11px] tabular-nums leading-none",
                      active ? "text-primary-foreground/70" : "text-muted-foreground-2",
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Right: period + add */}
        <div className="flex items-center gap-3">
          <PeriodSwitcher value={range} onChange={setRange} />
          {me?.is_superuser && (
            <Link
              href="/catalog/funds/new"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-accent transition-colors cursor-pointer"
            >
              + Добавить фонд
            </Link>
          )}
        </div>
      </div>
      </div>

      {/* ── Company presentation decks ── */}
      <CompanyPresentations isAdmin={!!me?.is_superuser} />

      {/* ── Empty state ── */}
      {activeFunds.length === 0 && (
        <div className="glossy rounded-xl py-16 text-center">
          <Search className="w-7 h-7 mx-auto text-muted-foreground-2 mb-3" strokeWidth={1.5} />
          <p className="text-sm font-medium">Ничего не найдено</p>
          <p className="text-xs text-muted-foreground mt-1">
            По запросу «{search}» фондов нет. Измените запрос или сбросьте поиск.
          </p>
          <button
            type="button"
            onClick={() => setSearch("")}
            className="mt-4 text-xs font-semibold text-primary hover:underline"
          >
            Сбросить поиск
          </button>
        </div>
      )}

      {/* ── Content ── */}
      {activeFunds.length > 0 && view === "table" && (
        <FundTable funds={sortedTabFunds} series={series} retLabel={retLabel} />
      )}

      {activeFunds.length > 0 && view === "cards" && (tab === "all" ? (
        <div className="space-y-10">
          {CATEGORY_ORDER.filter((c) => groups.has(c)).map((cat) => {
            const meta = CATEGORY_META[cat] ?? FALLBACK_CATEGORY;
            const catStyle = CATEGORY_STYLE[cat] ?? FALLBACK_STYLE;
            const Icon = meta.Icon;
            const count = groups.get(cat)!.length;

            return (
              <section key={cat}>
                {/* Section header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className={cn("rounded-lg p-1.5 shrink-0", catStyle.iconBg)}>
                    <Icon className={cn("h-4 w-4", catStyle.iconText)} strokeWidth={2.2} />
                  </div>
                  <span className={cn("text-xs font-bold uppercase tracking-[0.16em]", catStyle.label)}>
                    {meta.label}
                  </span>
                  <div className="h-px flex-1 bg-border/60" />
                  <span className="text-xs text-muted-foreground-2 tabular-nums">
                    {count} фонд{count === 1 ? "" : count < 5 ? "а" : "ов"}
                  </span>
                </div>

                <FundGrid funds={groups.get(cat)!} series={series} retLabel={retLabel} />
              </section>
            );
          })}
        </div>
      ) : (
        <FundGrid funds={filteredFunds} series={series} retLabel={retLabel} />
      ))}
    </div>
  );
}
