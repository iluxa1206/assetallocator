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
  const a = Math.abs(v);
  const sign = v < 0 ? "−" : "";
  if (a >= 1_000_000_000) return sign + (a / 1_000_000_000).toFixed(1).replace(".", ",") + " млрд " + sym;
  if (a >= 1_000_000) return sign + (a / 1_000_000).toFixed(1).replace(".", ",") + " млн " + sym;
  if (a >= 1_000) return sign + (a / 1_000).toFixed(0) + " тыс " + sym;
  return sign + numSpaces(a) + " " + sym;
}

/** Signed compact money for P&L, e.g. "+8,4 млн ₽". */
export function fmtCompactSigned(v: number | null, ccy: string): string {
  if (v == null) return "—";
  return (v >= 0 ? "+" : "−") + fmtCompact(Math.abs(v), ccy);
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

/** "+17,58%" — with sign, ru-locale comma decimal */
export function fmtPct(v: number | null, digits = 2): string {
  if (v == null) return "—";
  return (v >= 0 ? "+" : "−") + Math.abs(v * 100).toFixed(digits).replace(".", ",") + "%";
}

/** "13,47%" — no sign, ru-locale comma decimal */
export function fmtPctSimple(v: number | null, digits = 2): string {
  if (v == null) return "—";
  return (v * 100).toFixed(digits).replace(".", ",") + "%";
}

function yearWord(n: number): string {
  if (!Number.isInteger(n)) return "года";
  const a = Math.abs(n) % 100;
  if (a >= 11 && a <= 14) return "лет";
  const b = a % 10;
  if (b === 1) return "год";
  if (b >= 2 && b <= 4) return "года";
  return "лет";
}

/** "4,3 года" / "5 лет" — ru-locale years with correct pluralization */
export function fmtYears(n: number, digits = 1): string {
  const r = +n.toFixed(digits);
  return r.toFixed(digits).replace(".", ",") + " " + yearWord(r);
}

/** "12.03.2025" — ISO date (YYYY-MM-DD) → ru dd.mm.yyyy; passthrough if not ISO */
export function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : s;
}
