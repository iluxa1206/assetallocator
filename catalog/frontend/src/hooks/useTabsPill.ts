"use client";

import { useRef, useCallback, useEffect } from "react";

export function useTabsPill<T>(activeKey: T, ready = true) {
  const barRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);

  const movePill = useCallback((animate: boolean) => {
    const bar = barRef.current;
    const pill = pillRef.current;
    if (!bar || !pill) return;
    const active = bar.querySelector<HTMLElement>("[data-selected='true']");
    if (!active) return;
    if (!animate) {
      const prev = pill.style.transition;
      pill.style.transition = "none";
      pill.style.transform = `translateX(${active.offsetLeft}px)`;
      pill.style.width = `${active.offsetWidth}px`;
      void pill.offsetWidth;
      pill.style.transition = prev;
    } else {
      pill.style.transform = `translateX(${active.offsetLeft}px)`;
      pill.style.width = `${active.offsetWidth}px`;
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    const snap = () => movePill(false);
    snap();
    window.addEventListener("resize", snap);
    return () => window.removeEventListener("resize", snap);
  }, [movePill, ready]);

  useEffect(() => {
    if (!ready) return;
    movePill(true);
  }, [activeKey, movePill, ready]);

  return { barRef, pillRef };
}
