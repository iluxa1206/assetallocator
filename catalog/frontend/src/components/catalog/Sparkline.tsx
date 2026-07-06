"use client";

import { useId } from "react";
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
  const uid = useId();
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

  const showYtdOverlay =
    typeof ytdStartIdx === "number" && ytdStartIdx > 0 && ytdStartIdx < coords.length;

  // Institutional tokens — single tone colour, soft gradient fill, no flat blocks.
  const lineColor = tone === "up" ? "var(--pos)" : tone === "down" ? "var(--neg)" : "var(--muted-foreground)";
  // When a YTD tail is highlighted, the historical part is muted and the tail carries full tone.
  const baseStroke = showYtdOverlay ? "var(--muted-foreground)" : lineColor;

  const gradId = `spark-grad-${uid}`;
  const ytdClipId = `ytd-clip-${uid}`;
  const ytdStartX = showYtdOverlay ? coords[ytdStartIdx!][0] : null;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={cn("overflow-visible", className)}
      aria-hidden
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={lineColor} stopOpacity={0.16} />
          <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
        </linearGradient>
        {showYtdOverlay && ytdStartX !== null && (
          <clipPath id={ytdClipId}>
            <rect x={ytdStartX} y={-2} width={width - ytdStartX + 2} height={height + 4} />
          </clipPath>
        )}
      </defs>

      {/* Soft gradient area under the whole line */}
      <path d={areaPath} fill={`url(#${gradId})`} />

      {/* Benchmark — thin muted dashed */}
      {benchPath && (
        <path
          d={benchPath}
          fill="none"
          stroke="var(--muted-foreground)"
          strokeOpacity={0.45}
          strokeWidth={1}
          strokeDasharray="3 2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      )}

      {/* Base fund line */}
      <path d={path} fill="none" stroke={baseStroke} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />

      {/* YTD tail — same curve, brighter tone, thin divider at the start (no filled block) */}
      {showYtdOverlay && ytdStartX !== null && (
        <>
          <line x1={ytdStartX} y1={0} x2={ytdStartX} y2={height} stroke="var(--border)" strokeWidth={1} strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
          <path d={path} fill="none" stroke={lineColor} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" clipPath={`url(#${ytdClipId})`} />
        </>
      )}
    </svg>
  );
}
