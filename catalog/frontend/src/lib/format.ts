/** Shared number / money formatters for ru-RU locale with space-separated thousands */

export const CCY_SYM: Record<string, string> = { RUB: "₽", USD: "$", CNY: "¥", GLD: "Au" };
export const CCY_LABEL: Record<string, string> = { RUB: "₽ RUB", USD: "$ USD", CNY: "¥ CNY", GLD: "Au GLD" };

/** "1 843 759" — integer with non-breaking-space thousands separator */
export function numSpaces(n: number): string {
  return String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** "1 843 759 ₽" — full absolute */
export function fmtFull(v: number | null, ccy: string): string {
  if (v == null) return "—";
  const sym = CCY_SYM[ccy] ?? ccy;
  return (v < 0 ? "−" : "") + numSpaces(v) + " " + sym;
}

/** "+843 759 ₽" / "−843 759 ₽" — signed profit */
export function fmtProfit(v: number | null, ccy: string): string {
  if (v == null) return "—";
  const sym = CCY_SYM[ccy] ?? ccy;
  return (v >= 0 ? "+" : "−") + numSpaces(v) + " " + sym;
}

/** "10,2 млн ₽" / "500 тыс ₽" / "999 ₽" — compact */
export function fmtCompact(v: number, ccy: string): string {
  const sym = CCY_SYM[ccy] ?? ccy;
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(".", ",") + " млн " + sym;
  if (abs >= 1_000)     return (v / 1_000).toFixed(0) + " тыс " + sym;
  return numSpaces(v) + " " + sym;
}

/** "12,5 млрд ₽" / "850 млн ₽" / "1 млн ₽" — AUM-scale compact (billions/millions) */
export function fmtAum(v: number | null, ccy: string): string {
  if (v == null) return "—";
  const sym = CCY_SYM[ccy] ?? ccy;
  const abs = Math.abs(v);
  if (abs >= 1_000_000_000) return (v / 1_000_000_000).toFixed(1).replace(".", ",") + " млрд " + sym;
  if (abs >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(".", ",") + " млн " + sym;
  if (abs >= 1_000) return (v / 1_000).toFixed(0) + " тыс " + sym;
  return numSpaces(v) + " " + sym;
}

/** "+17.58%" — with sign */
export function fmtPct(v: number | null, digits = 2): string {
  if (v == null) return "—";
  return (v >= 0 ? "+" : "") + (v * 100).toFixed(digits) + "%";
}

/** "13.47%" — no sign */
export function fmtPctSimple(v: number | null, digits = 2): string {
  if (v == null) return "—";
  return (v * 100).toFixed(digits) + "%";
}
