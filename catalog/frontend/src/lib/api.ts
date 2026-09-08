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
  /** ISO dates aligned 1:1 with `points` — for chart x-axis + tooltip. */
  dates?: string[];
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

// ──────────────── Competitors ────────────────

/** One leaderboard row = fund metadata + normalized series + period metrics. */
export interface CompetitorRow extends FundSeriesPoint {
  key: string;
  name: string;
  short_name?: string | null;
  provider?: string | null;
  peer_group?: string | null;
  kind: "own" | "competitor" | "benchmark";
  contract_type?: string | null;
  source?: string | null;
  last_synced_at?: string | null;
}

export async function fetchCompetitorLeaderboard(params: {
  range?: CatalogRange;
  peer_group?: string;
  include_own?: boolean;
}): Promise<CompetitorRow[]> {
  const { data } = await client.get<CompetitorRow[]>("/api/v1/competitors/leaderboard", { params });
  return data;
}

export async function fetchPeerGroups(): Promise<string[]> {
  const { data } = await client.get<string[]>("/api/v1/competitors/peer-groups");
  return data;
}

export interface CompetitorMonthlyRow {
  month: string;   // "YYYY-MM"
  date: string;    // actual month-end quote date, "YYYY-MM-DD"
  price: number;   // unit price / exchange price (RUB)
  ret: number | null; // month-over-month return, decimal
}

export interface CompetitorMonthly {
  key: string;
  name: string;
  provider?: string | null;
  rows: CompetitorMonthlyRow[];
}

export async function fetchCompetitorMonthly(key: string): Promise<CompetitorMonthly> {
  const { data } = await client.get<CompetitorMonthly>(`/api/v1/competitors/${key}/monthly`);
  return data;
}

export async function syncCompetitors(full = false): Promise<Record<string, number>> {
  const { data } = await client.post<Record<string, number>>("/api/v1/competitors/sync", null, {
    params: { full },
  });
  return data;
}

export interface OwnFundSyncResult {
  inserted: number;
  failed: string[];
  per_fund: Record<string, number>;
}

/** Ручной синк своих фондов с investfunds (то же, что джоб по понедельникам). */
export async function syncOwnFunds(full = false): Promise<OwnFundSyncResult> {
  const { data } = await client.post<OwnFundSyncResult>("/api/v1/funds/sync", null, {
    params: { full },
  });
  return data;
}

export interface MarketSyncResult {
  written: Record<string, number>;
  total: number;
}

/** Ручной синк индексов и курсов с MOEX. */
export async function syncMarketData(): Promise<MarketSyncResult> {
  const { data } = await client.post<MarketSyncResult>("/api/v1/market/sync");
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

/** Manager-role employees only see: dashboard, catalog (own funds), track. */
export function isRestrictedUser(me?: MeResponse | null): boolean {
  return !!me && !me.is_superuser && me.role === "manager";
}

// ──────────────── Admin ────────────────

export interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  is_superuser: boolean;
  created_at: string;
}

export interface InvitationRow {
  id: string;
  email: string;
  role: string;
  token: string;
  expires_at: string;
  created_at: string;
  status: "pending" | "used" | "expired";
  is_reset: boolean;
}

export async function fetchAdminUsers(): Promise<AdminUser[]> {
  const { data } = await client.get<AdminUser[]>("/api/v1/admin/users");
  return data;
}

export async function updateUser(
  id: string,
  patch: { is_active?: boolean; role?: string; full_name?: string },
): Promise<AdminUser> {
  const { data } = await client.patch<AdminUser>(`/api/v1/users/${id}`, patch);
  return data;
}

export async function fetchInvitations(): Promise<InvitationRow[]> {
  const { data } = await client.get<InvitationRow[]>("/api/v1/admin/invitations");
  return data;
}

export async function createInvitation(email: string, role = "manager"): Promise<InvitationRow> {
  const { data } = await client.post<InvitationRow>("/api/v1/admin/invitations", { email, role });
  return data;
}

export async function revokeInvitation(id: string): Promise<void> {
  await client.delete(`/api/v1/admin/invitations/${id}`);
}

export interface AuditEventRow {
  id: string;
  user_id: string | null;
  user_email: string | null;
  user_name: string | null;
  action: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface AuditQuery {
  user_id?: string;
  action?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
}

export async function fetchAuditLog(q: AuditQuery = {}): Promise<{ total: number; events: AuditEventRow[] }> {
  const { data } = await client.get<{ total: number; events: AuditEventRow[] }>("/api/v1/admin/audit", { params: q });
  return data;
}

// ──────────────── Attachments (presentation PDFs) ────────────────

export type AttachmentEntity = "fund" | "strategy" | "general";

export interface AttachmentInfo {
  id: string;
  filename: string;
  size: number;
  created_at: string;
}

export async function fetchAttachment(entityType: AttachmentEntity, entityId: string): Promise<AttachmentInfo | null> {
  try {
    const { data } = await client.get<AttachmentInfo>(`/api/v1/attachments/${entityType}/${entityId}`);
    return data;
  } catch (e) {
    if (axios.isAxiosError(e) && e.response?.status === 404) return null;
    throw e;
  }
}

export function attachmentDownloadUrl(entityType: AttachmentEntity, entityId: string): string {
  return `/api/v1/attachments/${entityType}/${entityId}/download`;
}

export async function uploadAttachment(
  entityType: AttachmentEntity,
  entityId: string,
  file: File,
): Promise<AttachmentInfo> {
  const fd = new FormData();
  fd.append("file", file);
  const { data } = await client.put<AttachmentInfo>(`/api/v1/attachments/${entityType}/${entityId}`, fd);
  return data;
}

export async function deleteAttachment(entityType: AttachmentEntity, entityId: string): Promise<void> {
  await client.delete(`/api/v1/attachments/${entityType}/${entityId}`);
}
