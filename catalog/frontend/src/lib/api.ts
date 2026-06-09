import axios from "axios";
import type { Fund, PortfolioRequest, PortfolioResponse, Strategy } from "./types";

const client = axios.create({ withCredentials: true });

export async function computePortfolio(req: PortfolioRequest): Promise<PortfolioResponse> {
  const { data } = await client.post<PortfolioResponse>("/api/v1/portfolio/compute", req);
  return data;
}

// ──────────────── Funds ────────────────

export interface FundListQuery {
  category?: string;
  currency?: string;
  risk?: number;
  include_inactive?: boolean;
}

export async function fetchFunds(q: FundListQuery = {}): Promise<Fund[]> {
  const { data } = await client.get<Fund[]>("/api/v1/funds", { params: q });
  return data;
}

export async function fetchFund(key: string): Promise<Fund> {
  const { data } = await client.get<Fund>(`/api/v1/funds/${key}`);
  return data;
}

export async function createFund(
  payload: Partial<Fund> & { key: string; name: string; native_currency: string; benchmark: string },
): Promise<Fund> {
  const { data } = await client.post<Fund>("/api/v1/funds", payload);
  return data;
}

export async function updateFund(key: string, payload: Partial<Fund>): Promise<Fund> {
  const { data } = await client.patch<Fund>(`/api/v1/funds/${key}`, payload);
  return data;
}

export async function deleteFund(key: string): Promise<void> {
  await client.delete(`/api/v1/funds/${key}`);
}

/** Period switcher range keys, shared by funds + strategies series endpoints. */
export type CatalogRange = "1m" | "3m" | "6m" | "12m" | "2y" | "3y" | "ytd" | "max";

export interface FundSeriesPoint {
  points: number[];
  /** Benchmark line normalized to 100 at the first point, aligned 1:1 with `points`. */
  bench_points?: number[] | null;
  /** All return / metric fields are decimals (0.34 = 34%). Use `fmtPct` to render. */
  ret: number | null;
  bench_ret: number | null;
  bench_label?: string;
  /** Currency the series was computed in: matches fund.native_currency when price_native is complete, else "RUB". */
  currency?: string;
  /** Index in `points` where YTD (current calendar year) starts — frontend colors the tail differently. */
  ytd_start_idx?: number | null;
  since: string | null;
  as_of?: string;
  cagr?: number | null;
  vol?: number | null;
  max_dd?: number | null;
  /** Sharpe ratio (rf=0): CAGR / annualized volatility. */
  sharpe?: number | null;
  /** Beta vs the benchmark over step returns. */
  beta?: number | null;
}

export async function fetchFundsSeries(range: CatalogRange = "max"): Promise<Record<string, FundSeriesPoint>> {
  const { data } = await client.get<Record<string, FundSeriesPoint>>("/api/v1/funds/series", {
    params: { range },
  });
  return data;
}

/** Backtested strategy NAV (engine-computed from composition, since inception). Same shape as a fund series point. */
export async function fetchStrategySeries(code: string, range: CatalogRange = "max"): Promise<FundSeriesPoint> {
  const { data } = await client.get<FundSeriesPoint>(`/api/v1/strategies/${code}/series`, {
    params: { range },
  });
  return data;
}

// ──────────────── Fund NAV quotes (admin) ────────────────

export interface FundQuote {
  id: number;
  date: string;        // YYYY-MM-DD
  price_rub: number;
  price_native: number | null;
}

export interface BulkUploadResult {
  inserted: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export async function fetchQuotes(key: string, params?: { from?: string; to?: string }): Promise<FundQuote[]> {
  const { data } = await client.get<FundQuote[]>(`/api/v1/funds/${key}/quotes`, { params });
  return data;
}

export async function createQuote(key: string, payload: Omit<FundQuote, "id">): Promise<FundQuote> {
  const { data } = await client.post<FundQuote>(`/api/v1/funds/${key}/quotes`, payload);
  return data;
}

export async function updateQuote(key: string, quoteId: number, payload: Omit<FundQuote, "id">): Promise<FundQuote> {
  const { data } = await client.patch<FundQuote>(`/api/v1/funds/${key}/quotes/${quoteId}`, payload);
  return data;
}

export async function deleteQuote(key: string, quoteId: number): Promise<void> {
  await client.delete(`/api/v1/funds/${key}/quotes/${quoteId}`);
}

// ──────────────── Fund performance tables ────────────────

export interface PeriodReturn {
  abs: number;
  annual: number | null;
}

export interface MonthlyReturn {
  date: string;        // "YYYY-MM"
  ret: number | null;  // decimal
}

export interface FundPerformance {
  periods: Record<string, PeriodReturn>;
  monthly: MonthlyReturn[];
  currency?: string;
  as_of: string;
  since: string;
}

export async function fetchPerformance(key: string): Promise<FundPerformance> {
  const { data } = await client.get<FundPerformance>(`/api/v1/funds/${key}/performance`);
  return data;
}

export async function bulkUploadQuotes(key: string, file: File, replace = false): Promise<BulkUploadResult> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await client.post<BulkUploadResult>(
    `/api/v1/funds/${key}/quotes/bulk`,
    form,
    { params: { replace }, headers: { "Content-Type": "multipart/form-data" } },
  );
  return data;
}

// ──────────────── Strategies ────────────────

export interface StrategyListQuery {
  risk_profile?: string;
  ccy_strategy?: string;
  include_inactive?: boolean;
}

export async function fetchStrategies(q: StrategyListQuery = {}): Promise<Strategy[]> {
  const { data } = await client.get<Strategy[]>("/api/v1/strategies", { params: q });
  return data;
}

export async function fetchStrategy(code: string): Promise<Strategy> {
  const { data } = await client.get<Strategy>(`/api/v1/strategies/${code}`);
  return data;
}

export async function createStrategy(
  payload: Partial<Strategy> & {
    code: string;
    name: string;
    risk_profile: string;
    ccy_strategy: string;
    composition: Record<string, number>;
  },
): Promise<Strategy> {
  const { data } = await client.post<Strategy>("/api/v1/strategies", payload);
  return data;
}

export async function updateStrategy(code: string, payload: Partial<Strategy>): Promise<Strategy> {
  const { data } = await client.patch<Strategy>(`/api/v1/strategies/${code}`, payload);
  return data;
}

export async function deleteStrategy(code: string): Promise<void> {
  await client.delete(`/api/v1/strategies/${code}`);
}

// ──────────────── Current user ────────────────

export interface MeResponse {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  is_superuser: boolean;
  is_verified: boolean;
}

export async function fetchMe(): Promise<MeResponse> {
  const { data } = await client.get<MeResponse>("/api/v1/users/me");
  return data;
}
