"use client";

import Link from "next/link";
import { use, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Download, FileText } from "lucide-react";
import { fetchFund, fetchFundsSeries, fetchMe, type CatalogRange } from "@/lib/api";
import { PerfChart } from "@/components/catalog/PerfChart";
import { PresentationBlock } from "@/components/catalog/PresentationBlock";
import { PeriodSwitcher, RANGE_RETURN_LABEL } from "@/components/catalog/PeriodSwitcher";
import { PerformanceTables } from "@/components/catalog/PerformanceTables";
import { CATEGORY_META, FALLBACK_CATEGORY, hasChart } from "@/lib/catalog-meta";
import { CCY_SYM, fmtAum, fmtDate, fmtPct, fmtPctSimple } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MgmtFeeTier } from "@/lib/types";

const SEVERITY_TONE: Record<string, string> = {
  "Высокий": "bg-[var(--neg)]/12 text-[var(--neg)]",
  "Средний": "bg-muted text-muted-foreground",
  "Низкий": "bg-[var(--pos)]/12 text-[var(--pos)]",
  "Минимальный": "bg-[var(--pos)]/12 text-[var(--pos)]",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

function KV({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex justify-between gap-3 py-1.5 border-b border-border/40 last:border-0 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right tabular-nums">{value}</span>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  info,
  tone = "neutral",
}: {
  label: string;
  value: string;
  sub?: string;
  info?: string;
  tone?: "pos" | "neg" | "neutral";
}) {
  return (
    <div className="glossy rounded-xl px-4 py-3.5">
      <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        <span>{label}</span>
        {info && (
          <span
            title={info}
            aria-label={info}
            className="inline-flex h-3.5 w-3.5 cursor-help items-center justify-center rounded-full border border-current text-[9px] leading-none opacity-60 hover:opacity-100"
          >
            ?
          </span>
        )}
      </div>
      <div
        className={cn(
          "mt-1.5 text-2xl font-extrabold tabular-nums tracking-tight leading-none",
          tone === "pos" && "text-[var(--pos)]",
          tone === "neg" && "text-[var(--neg)]",
        )}
      >
        {value}
      </div>
      {sub && <div className="mt-1.5 text-[11px] text-muted-foreground tabular-nums">{sub}</div>}
    </div>
  );
}

/** "1,5%" / "—" — fee percent, ru decimal comma. */
const fmtFeePct = (v: number | null) => (v != null ? `${String(v).replace(".", ",")}%` : "—");

/** Fee schedule. Collapses to a one-line summary when all tiers charge the same;
 *  shows the tier table only when fees actually vary by AUM. Empty columns are hidden.
 *  `bare` drops the glossy card wrapper for embedding inside another card (e.g. the sidebar). */
function FeeStructure({ tiers, ccy, bare = false }: { tiers: MgmtFeeTier[]; ccy: string; bare?: boolean }) {
  const sym = CCY_SYM[ccy] ?? ccy;
  const first = tiers[0];
  const uniform = tiers.every(
    (t) => t.mf === first.mf && t.sf === first.sf && t.hurdle === first.hurdle,
  );
  const hasSf = tiers.some((t) => t.sf != null);
  const hasHurdle = tiers.some((t) => t.hurdle != null);

  if (uniform) {
    return (
      <div className={cn("flex flex-wrap gap-x-6 gap-y-2 text-sm", !bare && "glossy rounded-xl px-4 py-3.5")}>
        <div>
          <span className="text-muted-foreground">Management fee&nbsp;</span>
          <span className="font-semibold tabular-nums">{fmtFeePct(first.mf)}</span>
        </div>
        {hasSf && (
          <div>
            <span className="text-muted-foreground">Success fee&nbsp;</span>
            <span className="font-semibold tabular-nums">{fmtFeePct(first.sf)}</span>
          </div>
        )}
        {first.hurdle && (
          <div>
            <span className="text-muted-foreground">Над бенчмарком&nbsp;</span>
            <span className="font-semibold">{first.hurdle}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn("overflow-x-auto", bare ? "rounded-lg border border-border" : "glossy rounded-xl")}>
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-[10px] uppercase tracking-[0.1em]">
          <tr>
            <th className="px-2.5 py-2 text-left">Тир, {sym}</th>
            <th className="px-2.5 py-2 text-right">MF, %</th>
            {hasSf && <th className="px-2.5 py-2 text-right">SF, %</th>}
            {hasHurdle && <th className="px-2.5 py-2 text-left">Над бенчмарком</th>}
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {tiers.map((t, i) => (
            <tr key={i} className="border-t border-border">
              <td className="px-2.5 py-1.5">{t.tier}</td>
              <td className="px-2.5 py-1.5 text-right">{t.mf ?? "—"}</td>
              {hasSf && <td className="px-2.5 py-1.5 text-right">{t.sf ?? "—"}</td>}
              {hasHurdle && <td className="px-2.5 py-1.5 text-muted-foreground">{t.hurdle ?? "—"}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RiskBar({ score }: { score: number | null }) {
  if (!score) return null;
  return (
    <div className="flex items-center gap-2">
      <span className="shrink-0 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">низкий</span>
      <div className="flex flex-1 min-w-0 gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={cn(
              "h-7 flex-1 min-w-0 rounded-md border text-center text-xs leading-7 font-semibold tabular-nums transition-colors",
              i === score
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground",
            )}
          >
            {i}
          </div>
        ))}
      </div>
      <span className="shrink-0 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">высокий</span>
    </div>
  );
}

export default function FundDetailPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = use(params);
  const [range, setRange] = useState<CatalogRange>("max");
  const { data: fund, isLoading, isError } = useQuery({
    queryKey: ["fund", key],
    queryFn: () => fetchFund(key),
  });
  const { data: series } = useQuery({
    queryKey: ["funds-series", range],
    queryFn: () => fetchFundsSeries(range),
  });
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: fetchMe });

  if (isLoading) return (
    <div className="space-y-8 animate-pulse">
      <div className="flex items-start gap-4">
        <div className="rounded-xl bg-muted h-10 w-10 shrink-0" />
        <div className="space-y-2 flex-1">
          <div className="h-7 w-64 bg-muted rounded-lg" />
          <div className="h-4 w-40 bg-muted rounded" />
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-card h-52" />
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {[0,1,2,3].map((i) => (
          <div key={i} className="rounded-xl border border-border bg-card h-16" />
        ))}
      </div>
      <div className="rounded-xl border border-border bg-card h-64" />
    </div>
  );
  if (isError || !fund) return <div className="text-destructive text-sm">Не удалось загрузить фонд</div>;

  const s = series?.[key];
  const ret = s?.ret ?? null;
  const benchRet = s?.bench_ret ?? null;
  const delta = ret !== null && benchRet !== null ? ret - benchRet : null;
  const tone = ret === null ? "neutral" : ret >= 0 ? "up" : "down";

  const { Icon } = CATEGORY_META[fund.category ?? ""] ?? FALLBACK_CATEGORY;
  const showChart = hasChart(fund);

  return (
    <div className="space-y-8">
      {/* Hero header — sticks to top on desktop scroll (mobile keeps the fixed app bar) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between md:sticky md:-top-8 md:z-20 md:-mx-6 md:px-6 md:py-3 md:bg-background md:border-b md:border-border/60">
        <div className="min-w-0">
          <Link
            href="/catalog"
            className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Каталог
          </Link>
          <div className="mt-2 flex items-center gap-3">
            <div className="rounded-md p-2.5 bg-muted text-foreground/70 ring-1 ring-border">
              <Icon className="h-5 w-5" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <h2 className="text-2xl font-bold tracking-tight leading-tight">{fund.name}</h2>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {fund.contract_type} · {fund.native_currency}
                {fund.manager_name && <> · {fund.manager_name}</>}
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <PresentationBlock entityType="fund" entityId={fund.key} isAdmin={!!me?.is_superuser} />
          {me?.is_superuser && (
            <Link
              href={`/catalog/funds/${fund.key}/edit`}
              className="rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-accent transition-colors shrink-0"
            >
              Редактировать
            </Link>
          )}
        </div>
      </div>

      {/* Headline investment params — lead facts, mirrors the presentation deck */}
      {(fund.target_yield || fund.horizon) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {fund.target_yield && (
            <div className="glossy rounded-xl px-5 py-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Инвестиционная цель
              </div>
              <div className="mt-1.5 text-xl font-bold tracking-tight tabular-nums">{fund.target_yield}</div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                % годовых на рекомендуемом горизонте · ориентир, не гарантия
              </div>
            </div>
          )}
          {fund.horizon && (
            <div className="glossy rounded-xl px-5 py-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Инвестиционный горизонт
              </div>
              <div className="mt-1.5 text-xl font-bold tracking-tight">{fund.horizon}</div>
              <div className="mt-1 text-[11px] text-muted-foreground">рекомендуемый срок вложения</div>
            </div>
          )}
        </div>
      )}

      {/* Performance hero — only when fund has a NAV series (ИПИФ + ликвидность). */}
      {showChart && (
      <div className="glossy rounded-2xl p-5 md:p-6">
        {/* Top: big return + period switcher */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {RANGE_RETURN_LABEL[range]}
            </div>
            <div className="mt-2 flex items-end gap-3 flex-wrap">
              <div
                className={cn(
                  "text-[3.25rem] md:text-[4rem] font-extrabold tabular-nums tracking-tight leading-none",
                  ret === null && "text-muted-foreground/40",
                  ret !== null && ret >= 0 && "text-[var(--pos)]",
                  ret !== null && ret < 0 && "text-[var(--neg)]",
                )}
              >
                {fmtPct(ret)}
              </div>
              {delta !== null && s?.bench_label && (
                <div className="mb-1.5 flex items-center gap-2 text-xs tabular-nums">
                  <span className={cn(
                    "inline-flex items-center font-bold px-2 py-1 rounded-lg",
                    delta >= 0 ? "bg-[var(--pos)]/12 text-[var(--pos)]" : "bg-[var(--neg)]/12 text-[var(--neg)]",
                  )}>
                    {fmtPct(delta, 1)}
                  </span>
                  <span className="text-muted-foreground">
                    vs {s.bench_label} ({fmtPct(benchRet, 1)})
                  </span>
                </div>
              )}
            </div>
          </div>
          <PeriodSwitcher value={range} onChange={setRange} />
        </div>

        {/* Big interactive chart */}
        <div className="mt-5">
          <PerfChart
            dates={s?.dates ?? []}
            points={s?.points ?? []}
            benchPoints={s?.bench_points ?? null}
            benchLabel={s?.bench_label}
            tone={tone}
            height={300}
          />
        </div>
        {/* Legend */}
        <div className="mt-2 flex items-center gap-4 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-[3px] w-4 rounded-full" style={{ background: tone === "up" ? "var(--pos)" : tone === "down" ? "var(--neg)" : "var(--primary)" }} />
            Стратегия фонда
          </span>
          {s?.bench_label && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-[3px] w-4 rounded-full" style={{ backgroundImage: "repeating-linear-gradient(90deg, var(--chart-5) 0 5px, transparent 5px 8px)" }} />
              {s.bench_label}
            </span>
          )}
        </div>

        {/* KPI cards */}
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <KpiCard
            label="CAGR"
            value={fmtPct(s?.cagr ?? null)}
            info="Compound Annual Growth Rate — среднегодовой темп роста стоимости пая за выбранный период."
            tone={s?.cagr != null ? (s.cagr >= 0 ? "pos" : "neg") : "neutral"}
          />
          <KpiCard
            label="Волатильность (год.)"
            value={fmtPctSimple(s?.vol ?? null, 1)}
            info="Годовая волатильность — стандартное отклонение доходностей, приведённое к годовому масштабу. Мера разброса результата."
          />
          <KpiCard
            label="Макс. просадка"
            value={fmtPct(s?.max_dd ?? null, 1)}
            info="Максимальное снижение стоимости от локального пика до последующего минимума за период."
            tone={s?.max_dd != null && s.max_dd < 0 ? "neg" : "neutral"}
          />
        </div>
      </div>
      )}

      {/* Performance tables — returns + monthly, full width, right after the chart and above the narrative */}
      {showChart && <PerformanceTables fundKey={fund.key} />}

      {/* Body grid */}
      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <aside className="space-y-4">
          <div className="glossy rounded-xl p-4">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-2">
              Ключевые факты
            </div>
            <KV
              label="AUM"
              value={
                fund.aum != null ? (
                  <span>
                    {fmtAum(fund.aum, fund.aum_currency ?? fund.native_currency)}
                    {fund.aum_as_of && (
                      <span className="ml-1 text-[10px] font-normal text-muted-foreground">на {fmtDate(fund.aum_as_of)}</span>
                    )}
                  </span>
                ) : null
              }
            />
            <KV label="Дата запуска" value={fund.inception_date ? fmtDate(fund.inception_date) : null} />
            <KV label="Ликвидность" value={fund.liquidity_label} />
            <KV label="Интервал" value={fund.interval_label} />
            <KV
              label="Доступность"
              value={[fund.investor_type_fl, fund.investor_type_ul].filter(Boolean).join(" / ")}
            />
            <KV label="Мин. чек" value={fund.min_check} />
            <KV label="Логистика" value={fund.logistics} />
            <KV label="ISIN" value={fund.isin} />
            <KV label="Бенчмарк" value={fund.benchmark_label || fund.benchmark} />
            <KV label="№ правил" value={fund.fund_rules_no} />
          </div>

          {fund.risk_score !== null && (
            <div className="glossy rounded-xl p-4 space-y-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Риск продукта
              </div>
              <RiskBar score={fund.risk_score} />
            </div>
          )}

          {fund.mgmt_fee_tiers && fund.mgmt_fee_tiers.length > 0 && (
            <div className="glossy rounded-xl p-4 space-y-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Структура расходов
              </div>
              <FeeStructure tiers={fund.mgmt_fee_tiers} ccy={fund.native_currency} bare />
              {(fund.redemption_discount_y1 !== null ||
                fund.redemption_discount_y2 !== null ||
                fund.extra_expenses ||
                fund.hwm) && (
                <div className="text-[11px] text-muted-foreground space-y-0.5">
                  {(fund.redemption_discount_y1 !== null || fund.redemption_discount_y2 !== null) && (
                    <div>
                      Скидки при погашении: 1-й год {fund.redemption_discount_y1 ?? 0}%, 2-й год{" "}
                      {fund.redemption_discount_y2 ?? 0}%, далее 0%
                    </div>
                  )}
                  {fund.extra_expenses && <div>{fund.extra_expenses}</div>}
                  {fund.hwm && <div>High-Water Mark: применяется</div>}
                </div>
              )}
            </div>
          )}

          {fund.documents && fund.documents.length > 0 && (
            <div className="glossy rounded-xl p-4 space-y-2">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-1">
                Документы
              </div>
              {fund.documents.map((doc, i) => (
                <a
                  key={i}
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 -mx-2 text-sm hover:bg-accent transition-colors"
                >
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 truncate">{doc.name}</span>
                  <Download className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </a>
              ))}
            </div>
          )}
        </aside>

        <div className="space-y-8 min-w-0">
          {fund.strategy_goal && (
            <Section title="Цель стратегии">
              <p className="text-sm leading-relaxed">{fund.strategy_goal}</p>
            </Section>
          )}

          {fund.description && (
            <Section title="Описание стратегии">
              <p className="text-sm leading-relaxed whitespace-pre-line">{fund.description}</p>
            </Section>
          )}

          {fund.why_bullets && fund.why_bullets.length > 0 && (
            <Section title={`Почему ${fund.short_name ?? fund.name}?`}>
              <ul className="space-y-2 text-sm">
                {fund.why_bullets.map((b, i) => (
                  <li key={i} className="flex gap-2.5">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {fund.risks && fund.risks.length > 0 && (
            <Section title="Ключевые риски">
              <div className="space-y-2">
                {fund.risks.map((r, i) => (
                  <div key={i} className="glossy rounded-xl p-3.5 text-sm">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="font-semibold">{r.name}</span>
                      <span
                        className={cn(
                          "text-[10px] uppercase tracking-wider px-2 py-0.5 rounded font-semibold",
                          SEVERITY_TONE[r.severity] ?? "bg-muted text-muted-foreground",
                        )}
                      >
                        {r.severity}
                      </span>
                    </div>
                    <p className="text-muted-foreground leading-relaxed">{r.description}</p>
                  </div>
                ))}
              </div>
            </Section>
          )}

        </div>
      </div>

      {/* Key positions — full width so the holdings table isn't clipped inside the 1fr column */}
      {fund.top_positions && fund.top_positions.length > 0 && (
        <Section
          title={`Ключевые позиции${
            fund.top_positions_as_of ? ` (на ${fmtDate(fund.top_positions_as_of)})` : ""
          }`}
        >
          <div className="glossy rounded-xl overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-muted/50 text-[10px] uppercase tracking-[0.1em]">
                <tr>
                  <th className="px-3 py-2.5 text-left">Инструмент</th>
                  <th className="px-3 py-2.5 text-left">Эмитент / Выпуск</th>
                  <th className="px-3 py-2.5 text-right">Доля / Купон</th>
                  <th className="px-3 py-2.5 text-left">Погашение</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {fund.top_positions.map((p, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-3 py-2">{p.instrument ?? "—"}</td>
                    <td className="px-3 py-2 font-medium">{p.issuer ?? p.issue ?? "—"}</td>
                    <td className="px-3 py-2 text-right">{p.weight ?? p.coupon ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{p.maturity ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </div>
  );
}
