export interface Metrics {
  total_ret: number;
  cagr: number;
  vol: number;
  max_dd: number;
  years: number;
}

export interface FundComponent {
  fund_key: string;
  fund_name: string;
  native_currency: string;
  benchmark: string;
  benchmark_label: string;
  weight: number;
  invested_base: number;
  ended_base: number | null;
  series: number[] | null;
  metrics: Metrics | null;
  bench_series: number[] | null;
  bench_metrics: Metrics | null;
}

export interface FxRow {
  fund_key: string;
  fund_name: string;
  native_currency: string;
  invested: number;
  units: number;
  fund_return_pct: number;
  fund_pnl: number;
  fx_delta_pct: number;
  fx_effect: number;
  total_return_pct: number;
  ended: number;
  ok: boolean;
}

export interface PortfolioResponse {
  dates: string[];
  weights: Record<string, number>;
  portfolio_series: number[];
  benchmark_series: number[] | null;
  cpi_series: number[] | null;
  deposit_series: number[] | null;
  metrics_portfolio: Metrics | null;
  metrics_benchmark: Metrics | null;
  metrics_cpi: Metrics | null;
  metrics_deposit: Metrics | null;
  fund_components: FundComponent[];
  fx_decomp: FxRow[];
  currency_breakdown: Record<string, number>;
  available_dates: string[];
  invested_base: number | null;
  ended_base: number | null;
  external_total_base: number;
  our_currency_base: Record<string, number>;
  our_class_base: Record<string, number>;
  external_currency_base: Record<string, number>;
  external_class_base: Record<string, number>;
  external_items: ExternalItem[];
  external_adjusted: boolean;
}

export interface ExternalItem {
  name: string;
  currency: string;
  asset_class: string;
  base_value: number;
}

export interface ExternalAsset {
  name: string;
  amount: number;
  currency: string;     // RUB | USD | CNY | GLD
  asset_class: string;  // equity | bond | alternative | cash | realty | other
}

export const ASSET_CLASSES: { key: string; label: string }[] = [
  { key: "equity",      label: "Акции" },
  { key: "bond",        label: "Облигации" },
  { key: "alternative", label: "Альтернатива" },
  { key: "cash",        label: "Депозит / кэш" },
  { key: "realty",      label: "Недвижимость" },
  { key: "other",       label: "Прочее" },
];
export const ASSET_CLASS_LABEL: Record<string, string> = Object.fromEntries(
  ASSET_CLASSES.map((c) => [c.key, c.label]),
);

export interface PortfolioRequest {
  risk: string;
  ccy: string;
  base_currency: string;
  start_date?: string;
  end_date?: string;
  amount: number;
  amount_ccy: string;
  manual?: boolean;
  manual_funds?: Record<string, number>;
  manual_index_weights?: Record<string, number>;
  deposit_term_months?: number;
  external_assets?: ExternalAsset[];
}

export const RISK_PROFILES: Record<string, { name: string; desc: string; tag: string }> = {
  base: { name: "Базовый",        desc: "Все 10 фондов поровну, по 10%",              tag: "универсальный" },
  cons: { name: "Консервативный", desc: "Сохранение капитала, минимум волатильности", tag: "низкий риск" },
  agg:  { name: "Агрессивный",    desc: "Максимизация доходности на горизонте",       tag: "высокий риск" },
};

export const CCY_STRATEGIES: Record<string, { name: string; rub: number; val: number }> = {
  rub6040: { name: "Преимущественно в рублях", rub: 60, val: 40 },
  equal:   { name: "Поровну",                  rub: 50, val: 50 },
  val6040: { name: "Преимущественно в валюте",  rub: 40, val: 60 },
};

export const BASE_CURRENCIES = ["RUB", "USD", "CNY", "GLD"] as const;
export const AMOUNT_CURRENCIES = ["RUB", "USD", "CNY"] as const;

export interface FundMeta {
  name: string;
  native_currency: string;
  benchmark: string;
  benchmark_label: string;
}

export const FUND_META: Record<string, FundMeta> = {
  R5:     { name: "Хедж-фонд Р5",                          native_currency: "RUB", benchmark: "RGBITR",       benchmark_label: "RGBITR" },
  D5:     { name: "Хедж-фонд Д5",                          native_currency: "USD", benchmark: "CbondsZO_USD", benchmark_label: "Cbonds ЗО (USD)" },
  Yu5:    { name: "Хедж-фонд Ю5",                          native_currency: "CNY", benchmark: "RUCNYTR_RUB",  benchmark_label: "RUCNYTR (RUB)" },
  D1:     { name: "Хедж-фонд Д1",                          native_currency: "USD", benchmark: "CbondsZO_USD", benchmark_label: "Cbonds ЗО (USD)" },
  VO:     { name: "Валютные облигации с выплатой дохода",  native_currency: "USD", benchmark: "CbondsZO_USD", benchmark_label: "Cbonds ЗО (USD)" },
  Aplus:  { name: "Хедж-фонд А+",                          native_currency: "RUB", benchmark: "MCFTR",        benchmark_label: "MCFTR" },
  A12080: { name: "Российские акции 120/80",               native_currency: "RUB", benchmark: "MCFTR",        benchmark_label: "MCFTR" },
  R1:     { name: "Облигации Р1",                          native_currency: "RUB", benchmark: "RGBITR",       benchmark_label: "RGBITR" },
  M3:     { name: "Хедж-фонд М3",                          native_currency: "GLD", benchmark: "GLDRUB",       benchmark_label: "GLDRUB" },
  Liq:    { name: "Фонд денежной ликвидности",             native_currency: "RUB", benchmark: "RUSFAR",       benchmark_label: "RUSFAR" },
};

export const FUND_KEYS = Object.keys(FUND_META);

// ──────────────── Catalog (funds + strategies) ────────────────

export interface MgmtFeeTier {
  tier: string;
  mf: number | null;
  sf: number | null;
  hurdle: string | null;
}

export interface RiskItem {
  name: string;
  severity: string;
  description: string;
}

export interface TopPosition {
  instrument?: string;
  issuer?: string;
  issue?: string;
  weight?: string;
  coupon?: string;
  maturity?: string;
}

export interface DocLink {
  name: string;
  url: string;
}

export interface Fund {
  key: string;
  name: string;
  short_name: string | null;
  category: string | null;
  contract_type: string | null;
  native_currency: string;
  benchmark: string;
  benchmark_label: string;
  isin: string | null;
  ticker: string | null;
  inception_date: string | null;
  fund_rules_no: string | null;
  aum: number | null;
  aum_currency: string | null;
  aum_as_of: string | null;
  manager_name: string | null;
  manager_bio: string | null;
  target_yield: string | null;
  horizon: string | null;
  risk_score: number | null;
  liquidity_label: string | null;
  interval_label: string | null;
  investor_type_fl: string | null;
  investor_type_ul: string | null;
  min_check: string | null;
  logistics: string | null;
  strategy_goal: string | null;
  description: string | null;
  why_bullets: string[] | null;
  mgmt_fee_tiers: MgmtFeeTier[] | null;
  redemption_discount_y1: number | null;
  redemption_discount_y2: number | null;
  extra_expenses: string | null;
  hwm: boolean;
  risks: RiskItem[] | null;
  top_positions: TopPosition[] | null;
  top_positions_as_of: string | null;
  documents: DocLink[] | null;
  sort_order: number;
  is_active: boolean;
}

export interface Strategy {
  code: string;
  name: string;
  risk_profile: string;
  ccy_strategy: string;
  description: string | null;
  composition: Record<string, number>;
  inception_date: string | null;
  target_yield: string | null;
  horizon: string | null;
  min_check: string | null;
  rebalance_period: string | null;
  is_active: boolean;
  sort_order: number;
}

export const INDEX_LIST: { key: string; name: string; sub: string }[] = [
  { key: "RUSFAR",       name: "RUSFAR",          sub: "денежный рынок" },
  { key: "RGBITR",       name: "RGBITR",          sub: "ОФЗ" },
  { key: "MCFTR",        name: "MCFTR",           sub: "российские акции" },
  { key: "CbondsZO_USD", name: "Cbonds ЗО (USD)", sub: "валютные облигации" },
  { key: "RUCNYTR_RUB",  name: "RUCNYTR (RUB)",   sub: "юаневые облигации" },
  { key: "GLDRUB",       name: "GLDRUB",          sub: "золото" },
];
