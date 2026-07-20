"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import type { PortfolioResponse } from "@/lib/types";
import { RISK_PROFILES, CCY_STRATEGIES } from "@/lib/types";
import { CCY_SYM, fmtFull, fmtPct, fmtPctSimple, fmtYears } from "@/lib/format";

/** Параметры портфеля из стора — снимок на момент экспорта. */
export interface ReportParams {
  amount: number;
  amountCcy: string;
  risk: string;
  ccy: string;
  baseCurrency: string;
  depositTermMonths: number;
}

// Отчёт намеренно не зависит от темы приложения: light-палитра захардкожена,
// чтобы PNG/печать/письмо выглядели одинаково у всех.
const C = {
  text: "#1a2233",
  muted: "#697386",
  border: "#e3e7ee",
  bgSoft: "#f6f8fb",
  brand: "#2a4ba0",
  brandDark: "#1d2c54",
  pos: "#1f8257",
  neg: "#bb3447",
  teal: "#3d748f",
};

const CHART = {
  portfolio: C.brand,
  benchmark: C.teal,
  cpi: "#8a93a6",
  deposit: C.pos,
};

function fmtMonth(d: string): string {
  const months = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
  const [y, m] = d.split("-");
  return `${months[parseInt(m, 10) - 1]} ${y.slice(2)}`;
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th
      style={{
        padding: "7px 10px",
        fontSize: 10,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        color: C.muted,
        borderBottom: `1px solid ${C.border}`,
        textAlign: right ? "right" : "left",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children, right, bold, color, mono,
}: {
  children: React.ReactNode; right?: boolean; bold?: boolean; color?: string; mono?: boolean;
}) {
  return (
    <td
      style={{
        padding: "7px 10px",
        fontSize: 12,
        color: color ?? C.text,
        fontWeight: bold ? 700 : 400,
        borderBottom: `1px solid ${C.border}`,
        textAlign: right ? "right" : "left",
        fontVariantNumeric: mono ? "tabular-nums" : undefined,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </td>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.12em",
        color: C.muted,
        margin: "22px 0 8px",
      }}
    >
      {children}
    </div>
  );
}

const retColor = (v: number | null | undefined) =>
  v == null ? C.muted : v >= 0 ? C.pos : C.neg;

/**
 * Чистый light-отчёт для экспорта (PNG / печать / предпросмотр).
 * Ширина фиксирована под A4; никаких контролов приложения.
 */
export function PortfolioReport({ data, params }: { data: PortfolioResponse; params: ReportParams }) {
  const profile = RISK_PROFILES[params.risk];
  const mix = CCY_STRATEGIES[params.ccy];
  const funds = data.fund_components
    .filter((c) => c.weight > 0.05)
    .sort((a, b) => b.weight - a.weight);

  const period =
    data.dates.length >= 2
      ? `${fmtMonth(data.dates[0])} — ${fmtMonth(data.dates[data.dates.length - 1])} (${fmtYears(data.metrics_portfolio?.years ?? 0)})`
      : "—";

  const chartData = data.dates.map((d, i) => ({
    d,
    p: data.portfolio_series[i] ?? null,
    b: data.benchmark_series?.[i] ?? null,
    c: data.cpi_series?.[i] ?? null,
    dep: data.deposit_series?.[i] ?? null,
  }));

  const compareRows = [
    { label: `Портфель «${profile?.name ?? "—"}»`, m: data.metrics_portfolio, color: CHART.portfolio, boldRow: true },
    { label: "Композитный бенчмарк", m: data.metrics_benchmark, color: CHART.benchmark },
    { label: "Инфляция (ИПЦ)", m: data.metrics_cpi, color: CHART.cpi },
    { label: `Депозит (${params.depositTermMonths} мес., пролонгация)`, m: data.metrics_deposit, color: CHART.deposit },
  ].filter((r) => r.m);

  const ccyBreakdown = Object.entries(data.currency_breakdown ?? {})
    .filter(([, v]) => v > 0.05)
    .sort((a, b) => b[1] - a[1]);

  const now = new Date();
  const generated = now.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div
      style={{
        width: 794,
        background: "#ffffff",
        color: C.text,
        // Системный стек: PNG-экспорт идёт с skipFonts (см. ExportDialog), поэтому
        // отчёт не должен зависеть от webfont — иначе PNG и предпросмотр разойдутся.
        fontFamily: "-apple-system, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
        padding: "36px 40px",
        boxSizing: "border-box",
      }}
    >
      {/* ── Шапка ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 34, height: 34, borderRadius: 8,
                background: `linear-gradient(135deg, ${C.brandDark}, ${C.brand})`,
                color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 800, fontSize: 13, letterSpacing: "0.02em",
              }}
            >
              SAA
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14, letterSpacing: "0.01em" }}>Strategy Asset Allocation</div>
              <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.14em" }}>
                Модельный портфель
              </div>
            </div>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: "18px 0 2px", letterSpacing: "-0.01em" }}>
            Стратегия «{profile?.name ?? "—"}»
          </h1>
          <div style={{ fontSize: 12, color: C.muted }}>{profile?.desc}</div>
        </div>
        <div style={{ textAlign: "right", fontSize: 11, color: C.muted, paddingTop: 4 }}>
          Подготовлено {generated}
        </div>
      </div>

      {/* ── Параметры ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 10,
          marginTop: 20,
        }}
      >
        {[
          { k: "Сумма инвестиций", v: fmtFull(params.amount, params.amountCcy) },
          { k: "Валютный микс", v: mix ? `${mix.name} · ${mix.rub}/${mix.val}` : "—" },
          { k: "Валюта расчёта", v: `${CCY_SYM[params.baseCurrency] ?? ""} ${params.baseCurrency}` },
          { k: "Период бэктеста", v: period },
        ].map(({ k, v }) => (
          <div key={k} style={{ background: C.bgSoft, borderRadius: 8, padding: "10px 12px" }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: C.muted }}>
              {k}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, marginTop: 3, fontVariantNumeric: "tabular-nums" }}>{v}</div>
          </div>
        ))}
      </div>

      {/* ── Аллокация ── */}
      <SectionTitle>Аллокация по фондам</SectionTitle>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <Th>Фонд</Th>
            <Th>Валюта</Th>
            <Th right>Доля</Th>
            <Th right>Сумма, {CCY_SYM[params.baseCurrency] ?? params.baseCurrency}</Th>
          </tr>
        </thead>
        <tbody>
          {funds.map((c) => (
            <tr key={c.fund_key}>
              <Td bold>{c.fund_name}</Td>
              <Td color={C.muted}>{c.native_currency}</Td>
              <Td right mono>{fmtPctSimple(c.weight / 100, 1)}</Td>
              <Td right mono>{fmtFull(c.invested_base, params.baseCurrency)}</Td>
            </tr>
          ))}
          <tr>
            <Td bold>Итого</Td>
            <Td>{""}</Td>
            <Td right bold mono>100%</Td>
            <Td right bold mono>{fmtFull(data.invested_base, params.baseCurrency)}</Td>
          </tr>
        </tbody>
      </table>

      {ccyBreakdown.length > 0 && (
        <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>
          Валютная структура:{" "}
          {ccyBreakdown
            .map(([ccy, w]) => `${CCY_SYM[ccy] ?? ccy} ${ccy} — ${fmtPctSimple(w / 100, 0)}`)
            .join(" · ")}
        </div>
      )}

      {/* ── Бэктест ── */}
      <SectionTitle>Результаты бэктеста · {period}</SectionTitle>

      {data.invested_base != null && data.ended_base != null && (
        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          {[
            { k: "Вложено", v: fmtFull(data.invested_base, params.baseCurrency), c: C.text },
            { k: "Стало бы", v: fmtFull(data.ended_base, params.baseCurrency), c: C.text },
            {
              k: "Результат",
              v: fmtPct(data.metrics_portfolio?.total_ret ?? null),
              c: retColor(data.metrics_portfolio?.total_ret),
            },
            {
              k: "Годовых (CAGR)",
              v: fmtPct(data.metrics_portfolio?.cagr ?? null),
              c: retColor(data.metrics_portfolio?.cagr),
            },
          ].map(({ k, v, c }) => (
            <div key={k} style={{ flex: 1, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: C.muted }}>
                {k}
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, marginTop: 3, color: c, fontVariantNumeric: "tabular-nums" }}>
                {v}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── График ── */}
      <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: "14px 10px 6px" }}>
        <div style={{ display: "flex", gap: 14, fontSize: 10.5, color: C.muted, padding: "0 8px 8px" }}>
          {[
            { label: `Портфель «${profile?.name ?? ""}»`, color: CHART.portfolio, show: true },
            { label: "Бенчмарк", color: CHART.benchmark, show: !!data.benchmark_series },
            { label: "Инфляция", color: CHART.cpi, show: !!data.cpi_series },
            { label: "Депозит", color: CHART.deposit, show: !!data.deposit_series },
          ]
            .filter((l) => l.show)
            .map((l) => (
              <span key={l.label} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 12, height: 3, borderRadius: 2, background: l.color, display: "inline-block" }} />
                {l.label}
              </span>
            ))}
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={chartData} margin={{ top: 4, right: 14, bottom: 0, left: -14 }}>
            <CartesianGrid stroke={C.border} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="d"
              tickFormatter={fmtMonth}
              tick={{ fontSize: 10, fill: C.muted }}
              tickLine={false}
              axisLine={{ stroke: C.border }}
              minTickGap={48}
            />
            <YAxis
              tick={{ fontSize: 10, fill: C.muted }}
              tickLine={false}
              axisLine={false}
              domain={["auto", "auto"]}
              tickFormatter={(v: number) => String(Math.round(v))}
            />
            <Line type="monotone" dataKey="p" stroke={CHART.portfolio} strokeWidth={2.2} dot={false} isAnimationActive={false} />
            {data.benchmark_series && (
              <Line type="monotone" dataKey="b" stroke={CHART.benchmark} strokeWidth={1.6} strokeDasharray="6 4" dot={false} isAnimationActive={false} />
            )}
            {data.cpi_series && (
              <Line type="monotone" dataKey="c" stroke={CHART.cpi} strokeWidth={1.4} strokeDasharray="2 4" dot={false} isAnimationActive={false} />
            )}
            {data.deposit_series && (
              <Line type="monotone" dataKey="dep" stroke={CHART.deposit} strokeWidth={1.4} strokeDasharray="6 4" dot={false} isAnimationActive={false} />
            )}
          </LineChart>
        </ResponsiveContainer>
        <div style={{ fontSize: 9.5, color: C.muted, padding: "4px 8px 6px" }}>
          Все ряды нормированы к 100 на стартовую дату периода, база {params.baseCurrency}.
        </div>
      </div>

      {/* ── Сравнение ── */}
      <SectionTitle>Сравнение с альтернативами</SectionTitle>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <Th>{""}</Th>
            <Th right>Доходность</Th>
            <Th right>CAGR</Th>
            <Th right>Волатильность</Th>
            <Th right>Макс. просадка</Th>
          </tr>
        </thead>
        <tbody>
          {compareRows.map((r) => (
            <tr key={r.label}>
              <Td bold={r.boldRow}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                  <span style={{ width: 10, height: 3, borderRadius: 2, background: r.color, display: "inline-block" }} />
                  {r.label}
                </span>
              </Td>
              <Td right bold={r.boldRow} mono color={retColor(r.m!.total_ret)}>{fmtPct(r.m!.total_ret)}</Td>
              <Td right bold={r.boldRow} mono color={retColor(r.m!.cagr)}>{fmtPct(r.m!.cagr)}</Td>
              <Td right mono>{fmtPctSimple(r.m!.vol)}</Td>
              <Td right mono color={C.neg}>{fmtPctSimple(r.m!.max_dd)}</Td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── Футер ── */}
      <div
        style={{
          marginTop: 26,
          paddingTop: 12,
          borderTop: `1px solid ${C.border}`,
          fontSize: 9.5,
          lineHeight: 1.55,
          color: C.muted,
        }}
      >
        Данные носят справочный характер и не являются индивидуальной инвестиционной рекомендацией.
        Доходность прошлых периодов не гарантирует доходность в будущем. Показатели рассчитаны по доступным
        котировкам и могут отличаться от официальной отчётности фондов.
      </div>
    </div>
  );
}
