/** Расчёт метрик доходности по треку стратегии (клиентская сторона).
 * Ряд месячный; на дате трансформации ДУ→ИПИФ используется значение фонда.
 */

import type { TrackPoint } from "./track-data";

export interface TrackValue {
  d: string;
  v: number;
}

/** Единый ряд: ДУ до трансформации, фонд — начиная с даты трансформации. */
export function combinedSeries(points: TrackPoint[]): TrackValue[] {
  const out: TrackValue[] = [];
  for (const p of points) {
    const v = p.fund ?? p.du;
    if (v != null) out.push({ d: p.d, v });
  }
  return out;
}

export interface DrawdownInfo {
  depth: number; // отрицательная доля, напр. -0.35
  peakDate: string;
  troughDate: string;
  recoveryDate: string | null; // первая дата, когда ряд вернулся к пику
  recoveryDays: number | null; // дни от дна до восстановления
}

export interface WindowMetrics {
  startDate: string;
  endDate: string;
  months: number; // число месячных интервалов
  years: number; // календарная длина периода в годах
  totalReturn: number; // end/start − 1
  cagr: number | null; // null, если период короче ~года
  maxDrawdown: DrawdownInfo | null;
  volatility: number | null; // аннуализированная σ месячных доходностей
  bestMonth: { d: string; r: number } | null;
  worstMonth: { d: string; r: number } | null;
  positiveShare: number | null; // доля прибыльных месяцев
}

const DAY_MS = 86_400_000;

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / DAY_MS);
}

/** Максимальная просадка с датами пика/дна и временем восстановления. */
export function maxDrawdownInfo(series: TrackValue[]): DrawdownInfo | null {
  if (series.length < 2) return null;
  let peakVal = series[0].v;
  let peakIdx = 0;
  let depth = 0;
  let ddPeakIdx = 0;
  let ddTroughIdx = 0;
  for (let i = 1; i < series.length; i++) {
    if (series[i].v > peakVal) {
      peakVal = series[i].v;
      peakIdx = i;
    }
    const d = peakVal > 0 ? series[i].v / peakVal - 1 : 0;
    if (d < depth) {
      depth = d;
      ddPeakIdx = peakIdx;
      ddTroughIdx = i;
    }
  }
  if (depth >= 0) return null;

  const ddPeakVal = series[ddPeakIdx].v;
  let recoveryDate: string | null = null;
  for (let j = ddTroughIdx + 1; j < series.length; j++) {
    if (series[j].v >= ddPeakVal) {
      recoveryDate = series[j].d;
      break;
    }
  }
  return {
    depth,
    peakDate: series[ddPeakIdx].d,
    troughDate: series[ddTroughIdx].d,
    recoveryDate,
    recoveryDays: recoveryDate ? daysBetween(series[ddTroughIdx].d, recoveryDate) : null,
  };
}

/** Метрики за окно [первая точка .. последняя точка]. Первая точка — база (=100). */
export function computeMetrics(series: TrackValue[]): WindowMetrics | null {
  if (series.length < 2) return null;
  const start = series[0];
  const end = series[series.length - 1];
  const days = daysBetween(start.d, end.d);
  const years = days / 365.25;
  const totalReturn = end.v / start.v - 1;

  const returns: { d: string; r: number }[] = [];
  for (let i = 1; i < series.length; i++) {
    if (series[i - 1].v > 0) returns.push({ d: series[i].d, r: series[i].v / series[i - 1].v - 1 });
  }

  let volatility: number | null = null;
  if (returns.length >= 3) {
    const mean = returns.reduce((s, x) => s + x.r, 0) / returns.length;
    const varSum = returns.reduce((s, x) => s + (x.r - mean) ** 2, 0) / (returns.length - 1);
    volatility = Math.sqrt(varSum) * Math.sqrt(12);
  }

  let best: { d: string; r: number } | null = null;
  let worst: { d: string; r: number } | null = null;
  let positive = 0;
  for (const x of returns) {
    if (!best || x.r > best.r) best = x;
    if (!worst || x.r < worst.r) worst = x;
    if (x.r > 0) positive++;
  }

  return {
    startDate: start.d,
    endDate: end.d,
    months: returns.length,
    years,
    totalReturn,
    cagr: years >= 0.9 ? Math.pow(end.v / start.v, 1 / years) - 1 : null,
    maxDrawdown: maxDrawdownInfo(series),
    volatility,
    bestMonth: best,
    worstMonth: worst,
    positiveShare: returns.length ? positive / returns.length : null,
  };
}

export interface RollingWindow {
  entry: string; // дата входа
  exit: string; // дата выхода (≈ entry + horizon)
  years: number; // фактическая длина окна в годах
  abs: number; // абсолютная доходность за окно
  cagr: number; // среднегодовая за окно
}

export interface RollingStats {
  windows: RollingWindow[];
  best: RollingWindow;
  worst: RollingWindow;
  medianCagr: number;
  medianAbs: number;
  positiveShare: number; // доля окон с прибылью
}

/** Месяцы от нулевого года: для календарного сдвига окна. */
function ymIndex(iso: string): number {
  return parseInt(iso.slice(0, 4)) * 12 + parseInt(iso.slice(5, 7)) - 1;
}

/** Скользящие окна фиксированного горизонта: вход в каждую точку ряда,
 * выход — первая точка в календарном месяце `entry + years*12` (допуск +1 месяц на дыры). */
export function rollingWindows(series: TrackValue[], years: number): RollingStats | null {
  const windows: RollingWindow[] = [];
  let j = 0;
  for (let i = 0; i < series.length; i++) {
    const start = series[i];
    const targetYM = ymIndex(start.d) + years * 12;
    if (j < i + 1) j = i + 1;
    while (j < series.length && ymIndex(series[j].d) < targetYM) j++;
    if (j >= series.length) break;
    const end = series[j];
    if (ymIndex(end.d) > targetYM + 1) continue; // дыра в ряде — окно нечестное
    const actualYears = daysBetween(start.d, end.d) / 365.25;
    const abs = end.v / start.v - 1;
    windows.push({
      entry: start.d,
      exit: end.d,
      years: actualYears,
      abs,
      cagr: Math.pow(end.v / start.v, 1 / actualYears) - 1,
    });
  }
  if (!windows.length) return null;

  const byCagr = [...windows].sort((a, b) => a.cagr - b.cagr);
  const byAbs = [...windows].sort((a, b) => a.abs - b.abs);
  const mid = (arr: RollingWindow[], f: (w: RollingWindow) => number) =>
    arr.length % 2
      ? f(arr[(arr.length - 1) / 2])
      : (f(arr[arr.length / 2 - 1]) + f(arr[arr.length / 2])) / 2;

  return {
    windows,
    best: byCagr[byCagr.length - 1],
    worst: byCagr[0],
    medianCagr: mid(byCagr, (w) => w.cagr),
    medianAbs: mid(byAbs, (w) => w.abs),
    positiveShare: windows.filter((w) => w.abs > 0).length / windows.length,
  };
}

const MONTHS_SHORT = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

/** "31 мар 2015" */
export function fmtDateRu(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${parseInt(d)} ${MONTHS_SHORT[parseInt(m) - 1]} ${y}`;
}

/** "мар 2015" */
export function fmtMonthRu(iso: string): string {
  const [y, m] = iso.split("-");
  return `${MONTHS_SHORT[parseInt(m) - 1]} ${y}`;
}

function yearWord(n: number): string {
  const r = Math.round(n * 10) / 10;
  if (!Number.isInteger(r)) return "года";
  const a = Math.abs(r) % 100;
  if (a >= 11 && a <= 14) return "лет";
  const b = a % 10;
  if (b === 1) return "год";
  if (b >= 2 && b <= 4) return "года";
  return "лет";
}

/** Длительность по дням: "3 мес", "14 мес", "2,5 года" */
export function fmtDuration(days: number): string {
  const months = Math.round(days / 30.44);
  if (months < 1) return `${days} дн`;
  if (months < 24) return `${months} мес`;
  const years = Math.round((days / 365.25) * 10) / 10;
  return `${String(years).replace(".", ",")} ${yearWord(years)}`;
}
