"use client";

import { useEffect, useRef } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

interface Options {
  /** Блокировать скролл документа, пока слой открыт (модалка — да, дропдаун — нет). */
  lockScroll?: boolean;
  /** Уводить фокус внутрь слоя при открытии и держать его там по Tab. */
  trapFocus?: boolean;
}

/**
 * Клавиатурный контракт для оверлеев: Escape закрывает, фокус уезжает внутрь и
 * не выпадает по Tab, при закрытии возвращается на элемент-триггер.
 *
 * Возвращает ref на контейнер слоя — повесить на корневой элемент оверлея.
 */
export function useModalA11y<T extends HTMLElement>(
  open: boolean,
  onClose: () => void,
  { lockScroll = false, trapFocus = false }: Options = {},
) {
  const containerRef = useRef<T | null>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    // Куда вернуть фокус после закрытия.
    restoreRef.current = document.activeElement as HTMLElement | null;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (!trapFocus || e.key !== "Tab") return;

      const root = containerRef.current;
      if (!root) return;
      const items = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !root.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);

    let prevOverflow = "";
    if (lockScroll) {
      prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }

    // Первый фокус — на сам контейнер, чтобы читалка объявила слой целиком,
    // а не выдернула пользователя сразу в первую кнопку.
    const raf = requestAnimationFrame(() => {
      if (!trapFocus) return;
      const root = containerRef.current;
      if (!root) return;
      if (root.contains(document.activeElement)) return;
      const target = root.querySelector<HTMLElement>(FOCUSABLE) ?? root;
      target.focus({ preventScroll: true });
    });

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKeyDown);
      if (lockScroll) document.body.style.overflow = prevOverflow;
      restoreRef.current?.focus?.({ preventScroll: true });
    };
  }, [open, onClose, lockScroll, trapFocus]);

  return containerRef;
}
