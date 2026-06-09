/**
 * Shared catalog presentation: category icons + labels + ordering.
 * Used by both list and detail pages so they don't drift apart.
 */

import { TrendingUp, Landmark, Sparkles, Droplets, Briefcase, type LucideIcon } from "lucide-react";

export const CATEGORY_META: Record<string, { label: string; Icon: LucideIcon }> = {
  equities: { label: "Акции", Icon: TrendingUp },
  bonds: { label: "Облигации", Icon: Landmark },
  alternative: { label: "Альтернативные инвестиции", Icon: Sparkles },
  liquidity: { label: "Ликвидность", Icon: Droplets },
  advisory: { label: "Advisory", Icon: Briefcase },
};

export const CATEGORY_ORDER = [
  "equities",
  "bonds",
  "alternative",
  "liquidity",
  "advisory",
  "other",
];

export const FALLBACK_CATEGORY = { label: "Другое", Icon: Briefcase };

/**
 * Only ИПИФы (with paid units → NAV series in `fund_quotes`) get the chart treatment.
 * ДУ + Advisory don't have a NAV — they're rendered without sparkline / KPI / perf tables.
 * Exception: «Мгновенная ликвидность» (ДУ, but has a synthetic RUSFAR-based series).
 */
export function hasChart(fund: { contract_type: string | null; key: string }): boolean {
  if (fund.key === "Liq") return true;
  return fund.contract_type === "ИПИФ";
}
