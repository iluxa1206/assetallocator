import { cn } from "@/lib/utils";

/**
 * Strategy — brand mark.
 * Geometric "SAA" glyph: three ascending bars inside a gradient-stroked rounded square,
 * evoking an allocation / strategy build-up. Pairs with an optional stacked wordmark.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative inline-flex items-center justify-center rounded-md shrink-0",
        "bg-[#141a2e] ring-1 ring-white/10",
        "shadow-[0_1px_3px_rgba(10,14,28,0.30)]",
        className,
      )}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" fill="none" className="h-[58%] w-[58%]">
        <rect x="4"    y="13" width="3.4" height="7"  rx="0.6" fill="white" fillOpacity="0.55" />
        <rect x="10.3" y="9"  width="3.4" height="11" rx="0.6" fill="white" fillOpacity="0.78" />
        <rect x="16.6" y="4"  width="3.4" height="16" rx="0.6" fill="#7e97d6" />
      </svg>
    </span>
  );
}

export function Logo({
  collapsed = false,
  className,
}: {
  collapsed?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark className="h-8 w-8" />
      {!collapsed && (
        <span className="flex flex-col leading-none">
          <span className="text-[15px] font-extrabold tracking-[0.04em] text-foreground">
            SAA
          </span>
          <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70 mt-1">
            Strategy Asset Allocation
          </span>
        </span>
      )}
    </span>
  );
}
