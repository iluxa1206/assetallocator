"use client";

import { useState, type RefObject } from "react";
import { toPng } from "html-to-image";
import { Download, Printer } from "lucide-react";

/** PNG snapshot + browser print-to-PDF of a report node. Excludes [data-noexport] subtrees. */
export function ExportButtons({
  targetRef,
  fileName,
}: {
  targetRef: RefObject<HTMLElement | null>;
  fileName: string;
}) {
  const [busy, setBusy] = useState(false);

  async function exportPng() {
    const node = targetRef.current;
    if (!node) return;
    setBusy(true);
    try {
      const bg = getComputedStyle(document.body).backgroundColor || "#ffffff";
      const dataUrl = await toPng(node, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: bg,
        filter: (el) => !(el instanceof HTMLElement && el.dataset.noexport != null),
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${fileName}.png`;
      a.click();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex gap-2" data-noexport>
      <button
        type="button"
        onClick={exportPng}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-lg glossy px-3 py-2 text-sm font-semibold hover:-translate-y-0.5 transition-transform disabled:opacity-60"
      >
        <Download className="w-4 h-4" strokeWidth={2} />
        {busy ? "Готовим…" : "Скачать PNG"}
      </button>
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm font-semibold hover:bg-primary/90 active:scale-[0.99] transition-all"
      >
        <Printer className="w-4 h-4" strokeWidth={2} />
        Печать / PDF
      </button>
    </div>
  );
}
