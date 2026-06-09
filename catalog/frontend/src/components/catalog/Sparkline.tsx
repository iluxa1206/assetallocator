"use client";

import { cn } from "@/lib/utils";

interface Props {
  points: number[];
  width?: number;
  height?: number;
  className?: string;
  /** Direction tint: "up" → green stroke + fill, "down" → red, default → muted. */
  tone?: "up" | "down" | "neutral";
  /**
   * Index in `points` where the YTD (year-to-date) segment starts. Renders an additional
   * accent-colored stroke + fill on top of the muted base line, so the user can spot
   * current-year performance at a glance against full-history.
   */
  ytdStartIdx?: number | null;
  /**
   * Benchmark line, aligned 1:1 with `points` (same length, normalized to the same base).
   * Drawn as a thin dashed muted line under the fund line for an at-a-glance vs-bench read.
   */
  benchPoints?: number[] | null;
}

/**
 * Minimal inline-SVG sparkline.
 * Normalizes the input values to the [0..1] range across `height`, draws a single
 * polyline path. No axes, no labels — meant for in-card glimpse.
 */
export function Sparkline({
  points,
  width = 120,
  height = 36,
  className,
  tone = "neutral",
  ytdStartIdx,
  benchPoints,
}: Props) {
  if (!points || points.length < 2) {
    return (
      <div
        style={{ width, height }}
        className={cn("text-muted-foreground/40 text-[10px] leading-none", className)}
      >
        нет данных
      </div>
    );
  }

  const hasBench =
    Array.isArray(benchPoints) && benchPoints.length === points.length && benchPoints.length >= 2;

  // Scale over fund + benchmark together so both lines fit the same box.
  const scaleVals = hasBench ? [...points, ...benchPoints!] : points;
  const min = Math.min(...scaleVals);
  const max = Math.max(...scaleVals);
  const span = max - min || 1;
  const stepX = width / (points.length - 1);

  const coordsOf = (arr: number[]) =>
    arr.map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / span) * height;
      return [x, y] as const;
    });

  const coords = coordsOf(points);

  // Smooth line via Catmull-Rom → cubic Bézier (tension 1/6). Straight segments become
  // gentle curves; endpoints are duplicated so the spline starts/ends cleanly.
  const pathOf = (segment: ReadonlyArray<readonly [number, number]>) => {
    const n = segment.length;
    if (n === 0) return "";
    if (n < 3) return segment.map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`)).join(" ");
    let d = `M${segment[0][0]},${segment[0][1]}`;
    for (let i = 0; i < n - 1; i++) {
      const [x0, y0] = segment[i === 0 ? 0 : i - 1];
      const [x1, y1] = segment[i];
      const [x2, y2] = segment[i + 1];
      const [x3, y3] = segment[i + 2 < n ? i + 2 : n - 1];
      const c1x = x1 + (x2 - x0) / 6;
      const c1y = y1 + (y2 - y0) / 6;
      const c2x = x2 - (x3 - x1) / 6;
      const c2y = y2 - (y3 - y1) / 6;
      d += ` C${c1x},${c1y} ${c2x},${c2y} ${x2},${y2}`;
    }
    return d;
  };

  const path = pathOf(coords);
  const areaPath = `${path} L${width},${height} L0,${height} Z`;
  const benchPath = hasBench ? pathOf(coordsOf(benchPoints!)) : null;

  // Base (historical) tone — muted by default when YTD overlay is shown, otherwise full tone.
  const showYtdOverlay =
    typeof ytdStartIdx === "number" && ytdStartIdx > 0 && ytdStartIdx < coords.length;

  const baseStroke = showYtdOverlay
    ? "rgba(100, 116, 139, 0.7)"
    : tone === "up"
      ? "var(--catalog-pos, #058753)"
      : tone === "down"
        ? "var(--catalog-neg, #c53030)"
        : "currentColor";
  const baseFill = showYtdOverlay
    ? "rgba(100, 116, 139, 0.08)"
    : tone === "up"
      ? "rgba(5, 135, 83, 0.10)"
      : tone === "down"
        ? "rgba(197, 48, 48, 0.10)"
        : "rgba(100, 116, 139, 0.10)";

  // YTD overlay tone always tracks `tone` (or accent gold if neutral).
  const ytdStroke =
    tone === "up" ? "var(--catalog-pos, #058753)" :
    tone === "down" ? "var(--catalog-neg, #c53030)" :
    "var(--catalog-accent, #2563eb)";
  const ytdFill =
    tone === "up" ? "rgba(5, 135, 83, 0.18)" :
    tone === "down" ? "rgba(197, 48, 48, 0.18)" :
    "rgba(37, 99, 235, 0.18)";

  let ytdPath: string | null = null;
  let ytdAreaPath: string | null = null;
  if (showYtdOverlay) {
    const ytdSeg = coords.slice(ytdStartIdx!);
    ytdPath = pathOf(ytdSeg);
    const [, startY] = ytdSeg[0];
    const [endX] = ytdSeg[ytdSeg.length - 1];
    const startX = ytdSeg[0][0];
    ytdAreaPath = `${ytdPath} L${endX},${height} L${startX},${height} Z`;
    void startY;
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      // `none` lets CSS width:100% stretch the path across the container without
      // the default `xMidYMid meet` letterboxing.
      preserveAspectRatio="none"
      className={cn("overflow-visible", className)}
      aria-hidden
    >
      <path d={areaPath} fill={baseFill} />
      {benchPath && (
        <path
          d={benchPath}
          fill="none"
          stroke="rgba(100, 116, 139, 0.55)"
          strokeWidth={1}
          strokeDasharray="3 2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      )}
      <path d={path} fill="none" stroke={baseStroke} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      {ytdPath && ytdAreaPath && (
        <>
          <path d={ytdAreaPath} fill={ytdFill} />
          <path d={ytdPath} fill="none" stroke={ytdStroke} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </>
      )}
    </svg>
  );
}
