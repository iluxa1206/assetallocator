import type { PortfolioResponse } from "@/lib/types";
import { RISK_PROFILES, CCY_STRATEGIES } from "@/lib/types";
import { CCY_SYM, fmtFull, fmtPct, fmtPctSimple, fmtYears } from "@/lib/format";
import type { ReportParams } from "./PortfolioReport";

// Текст/HTML для вставки в письмо. HTML — inline-стили, чтобы пережить Outlook/Gmail.

const MUTED = "#697386";
const TEXT = "#1a2233";
const BORDER = "#e3e7ee";

function fmtMonth(d: string): string {
  const months = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  const [y, m] = d.split("-");
  return `${months[parseInt(m, 10) - 1].slice(0, 3)} ${y}`;
}

interface Prepared {
  title: string;
  paramLines: [string, string][];
  funds: { name: string; ccy: string; weight: string; amount: string }[];
  totalAmount: string;
  compare: { label: string; ret: string; cagr: string; vol: string; dd: string }[];
  resultLine: string | null;
  disclaimer: string;
}

function prepare(data: PortfolioResponse, params: ReportParams): Prepared {
  const profile = RISK_PROFILES[params.risk];
  const mix = CCY_STRATEGIES[params.ccy];
  const period =
    data.dates.length >= 2
      ? `${fmtMonth(data.dates[0])} — ${fmtMonth(data.dates[data.dates.length - 1])} (${fmtYears(data.metrics_portfolio?.years ?? 0)})`
      : "—";

  const funds = data.fund_components
    .filter((c) => c.weight > 0.05)
    .sort((a, b) => b.weight - a.weight)
    .map((c) => ({
      name: c.fund_name,
      ccy: c.native_currency,
      weight: fmtPctSimple(c.weight / 100, 1),
      amount: fmtFull(c.invested_base, params.baseCurrency),
    }));

  const compare = [
    { label: `Портфель «${profile?.name ?? "—"}»`, m: data.metrics_portfolio },
    { label: "Композитный бенчмарк", m: data.metrics_benchmark },
    { label: "Инфляция (ИПЦ)", m: data.metrics_cpi },
    { label: `Депозит (${params.depositTermMonths} мес.)`, m: data.metrics_deposit },
  ]
    .filter((r) => r.m)
    .map((r) => ({
      label: r.label,
      ret: fmtPct(r.m!.total_ret),
      cagr: fmtPct(r.m!.cagr),
      vol: fmtPctSimple(r.m!.vol),
      dd: fmtPctSimple(r.m!.max_dd),
    }));

  const resultLine =
    data.invested_base != null && data.ended_base != null
      ? `За период ${period} вложенные ${fmtFull(data.invested_base, params.baseCurrency)} превратились бы в ${fmtFull(data.ended_base, params.baseCurrency)} (${fmtPct(data.metrics_portfolio?.total_ret ?? null)}, CAGR ${fmtPct(data.metrics_portfolio?.cagr ?? null)}).`
      : null;

  return {
    title: `Модельный портфель — стратегия «${profile?.name ?? "—"}»`,
    paramLines: [
      ["Сумма инвестиций", fmtFull(params.amount, params.amountCcy)],
      ["Валютный микс", mix ? `${mix.name} (${mix.rub}/${mix.val})` : "—"],
      ["Валюта расчёта", `${CCY_SYM[params.baseCurrency] ?? ""} ${params.baseCurrency}`],
      ["Период бэктеста", period],
    ],
    funds,
    totalAmount: fmtFull(data.invested_base, params.baseCurrency),
    compare,
    resultLine,
    disclaimer:
      "Данные носят справочный характер и не являются индивидуальной инвестиционной рекомендацией. Доходность прошлых периодов не гарантирует доходность в будущем.",
  };
}

export function buildEmailText(data: PortfolioResponse, params: ReportParams): string {
  const p = prepare(data, params);
  const lines: string[] = [p.title, ""];
  p.paramLines.forEach(([k, v]) => lines.push(`${k}: ${v}`));
  lines.push("", "Аллокация по фондам:");
  p.funds.forEach((f) => lines.push(`  • ${f.name} (${f.ccy}) — ${f.weight} · ${f.amount}`));
  lines.push(`  Итого: ${p.totalAmount}`);
  if (p.resultLine) lines.push("", p.resultLine);
  lines.push("", "Сравнение с альтернативами (доходность · CAGR · волатильность · макс. просадка):");
  p.compare.forEach((r) => lines.push(`  • ${r.label}: ${r.ret} · ${r.cagr} · ${r.vol} · ${r.dd}`));
  lines.push("", p.disclaimer);
  return lines.join("\n");
}

export function buildEmailHtml(data: PortfolioResponse, params: ReportParams): string {
  const p = prepare(data, params);
  const td = `padding:6px 10px;border-bottom:1px solid ${BORDER};font-size:13px;color:${TEXT};`;
  const th = `padding:6px 10px;border-bottom:2px solid ${BORDER};font-size:11px;color:${MUTED};text-transform:uppercase;letter-spacing:0.06em;text-align:left;`;

  const paramRows = p.paramLines
    .map(([k, v]) => `<tr><td style="${td}color:${MUTED};">${k}</td><td style="${td}font-weight:600;">${v}</td></tr>`)
    .join("");

  const fundRows = p.funds
    .map(
      (f) =>
        `<tr><td style="${td}font-weight:600;">${f.name}</td><td style="${td}color:${MUTED};">${f.ccy}</td><td style="${td}text-align:right;">${f.weight}</td><td style="${td}text-align:right;">${f.amount}</td></tr>`,
    )
    .join("");

  const compareRows = p.compare
    .map(
      (r, i) =>
        `<tr><td style="${td}${i === 0 ? "font-weight:700;" : ""}">${r.label}</td><td style="${td}text-align:right;">${r.ret}</td><td style="${td}text-align:right;">${r.cagr}</td><td style="${td}text-align:right;">${r.vol}</td><td style="${td}text-align:right;">${r.dd}</td></tr>`,
    )
    .join("");

  return `<div style="font-family:Arial,Helvetica,sans-serif;color:${TEXT};max-width:640px;">
<h2 style="font-size:18px;margin:0 0 12px;">${p.title}</h2>
<table style="border-collapse:collapse;margin-bottom:16px;">${paramRows}</table>
<h3 style="font-size:14px;margin:0 0 6px;">Аллокация по фондам</h3>
<table style="border-collapse:collapse;width:100%;margin-bottom:16px;">
<tr><th style="${th}">Фонд</th><th style="${th}">Валюта</th><th style="${th}text-align:right;">Доля</th><th style="${th}text-align:right;">Сумма</th></tr>
${fundRows}
<tr><td style="${td}font-weight:700;">Итого</td><td style="${td}"></td><td style="${td}text-align:right;font-weight:700;">100%</td><td style="${td}text-align:right;font-weight:700;">${p.totalAmount}</td></tr>
</table>
${p.resultLine ? `<p style="font-size:13px;margin:0 0 16px;">${p.resultLine}</p>` : ""}
<h3 style="font-size:14px;margin:0 0 6px;">Сравнение с альтернативами</h3>
<table style="border-collapse:collapse;width:100%;margin-bottom:16px;">
<tr><th style="${th}"></th><th style="${th}text-align:right;">Доходность</th><th style="${th}text-align:right;">CAGR</th><th style="${th}text-align:right;">Волатильность</th><th style="${th}text-align:right;">Макс. просадка</th></tr>
${compareRows}
</table>
<p style="font-size:11px;color:${MUTED};line-height:1.5;margin:0;">${p.disclaimer}</p>
</div>`;
}
