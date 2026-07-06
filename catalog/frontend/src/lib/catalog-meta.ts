/**
 * Shared catalog presentation: category icons + labels + ordering.
 * Used by both list and detail pages so they don't drift apart.
 */

import { TrendingUp, Landmark, Sparkles, Droplets, Briefcase, type LucideIcon } from "lucide-react";

export const CATEGORY_META: Record<string, { label: string; Icon: LucideIcon }> = {
  alternative: { label: "Хедж-фонды", Icon: Sparkles },
  equities: { label: "Акции", Icon: TrendingUp },
  bonds: { label: "Облигации", Icon: Landmark },
  liquidity: { label: "Ликвидность", Icon: Droplets },
};

export const CATEGORY_ORDER = [
  "alternative",
  "equities",
  "bonds",
  "liquidity",
  "other",
];

export const FALLBACK_CATEGORY = { label: "Другое", Icon: Briefcase };

/**
 * Only ИПИФы (with paid units → NAV series in `fund_quotes`) get the chart treatment.
 * ДУ + Advisory don't have a NAV — they're rendered without sparkline / KPI / perf tables.
 * Exception: «Мгновенная ликвидность» (ДУ, but has a synthetic RUSFAR-based series).
 */
export function hasChart(fund: { contract_type: string | null; key: string }): boolean {
  return fund.contract_type === "ИПИФ";
}
