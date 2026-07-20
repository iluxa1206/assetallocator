"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toSvg } from "html-to-image";
import { Check, Copy, Download, FileText, Printer, X } from "lucide-react";
import type { PortfolioResponse } from "@/lib/types";
import { PortfolioReport, type ReportParams } from "./PortfolioReport";
import { buildEmailHtml, buildEmailText } from "./reportEmail";

/**
 * Экспорт рекомендации: модалка с предпросмотром чистого отчёта.
 * PNG и печать снимаются с отдельного light-узла (не со страницы приложения),
 * «текст для письма» кладёт в буфер HTML + plaintext.
 */
/**
 * SVG → PNG своими руками: toPng() из html-to-image растеризует через
 * img.decode(), а его reject не ловится — при сбое декодера промис висит вечно.
 * onload-путь надёжнее и работает в тех же браузерах.
 */
function auditExport(action: "export.png" | "export.print" | "export.copy", payload: Record<string, string>) {
  fetch("/api/v1/audit/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    keepalive: true,
    body: JSON.stringify({ action, payload }),
  }).catch(() => { /* аудит не должен ломать экспорт */ });
}

async function svgToPng(svgDataUrl: string, width: number, height: number, pixelRatio = 2): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("SVG image failed to load"));
    i.src = svgDataUrl;
  });
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(height * pixelRatio);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d context unavailable");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

export function ExportDialog({
  data,
  params,
  fileName,
}: {
  data: PortfolioResponse;
  params: ReportParams;
  fileName: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pngFailed, setPngFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  async function exportPng() {
    const node = reportRef.current;
    if (!node) return;
    setBusy(true);
    try {
      // skipFonts: embed-этап html-to-image фетчит все @font-face приложения
      // и подвисает; отчёт свёрстан на системном стеке, потери нет.
      const svgUrl = await toSvg(node, { backgroundColor: "#ffffff", skipFonts: true });
      const rect = node.getBoundingClientRect();
      const dataUrl = await svgToPng(svgUrl, rect.width, rect.height);
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${fileName}.png`;
      a.click();
      auditExport("export.png", { file: `${fileName}.png` });
    } catch {
      setPngFailed(true);
      setTimeout(() => setPngFailed(false), 2500);
    } finally {
      setBusy(false);
    }
  }

  function printReport() {
    document.body.classList.add("print-report-mode");
    const cleanup = () => {
      document.body.classList.remove("print-report-mode");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    auditExport("export.print", { file: fileName });
    window.print();
    // Safari may not fire afterprint — снимем класс и по таймеру.
    setTimeout(cleanup, 2000);
  }

  async function copyForEmail() {
    const html = buildEmailHtml(data, params);
    const text = buildEmailText(data, params);
    let ok = false;
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([text], { type: "text/plain" }),
        }),
      ]);
      ok = true;
    } catch {
      try {
        await navigator.clipboard.writeText(text);
        ok = true;
      } catch {
        // Clipboard API запрещён (WebView/строгие политики) — legacy-фолбэк.
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        try {
          ok = document.execCommand("copy");
        } finally {
          ta.remove();
        }
      }
    }
    if (ok) auditExport("export.copy", { file: fileName });
    setCopied(ok);
    setCopyFailed(!ok);
    setTimeout(() => { setCopied(false); setCopyFailed(false); }, 2500);
  }

  const actionCls =
    "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-60";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm font-semibold hover:bg-primary/90 active:scale-[0.99] transition-all"
      >
        <FileText className="w-4 h-4" strokeWidth={2} />
        Сформировать отчёт
      </button>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex flex-col" role="dialog" aria-modal="true">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={() => setOpen(false)} aria-hidden="true" />

            {/* Toolbar */}
            <div className="relative z-10 flex items-center justify-center gap-2 px-4 py-3 flex-wrap" data-noexport>
              <button type="button" onClick={exportPng} disabled={busy} className={`${actionCls} bg-primary text-primary-foreground hover:bg-primary/90`}>
                <Download className="w-4 h-4" strokeWidth={2} />
                {busy ? "Готовим…" : pngFailed ? "Ошибка экспорта" : "Скачать PNG"}
              </button>
              <button type="button" onClick={printReport} className={`${actionCls} bg-white/95 text-gray-900 hover:bg-white`}>
                <Printer className="w-4 h-4" strokeWidth={2} />
                Печать / PDF
              </button>
              <button type="button" onClick={copyForEmail} className={`${actionCls} bg-white/95 text-gray-900 hover:bg-white`}>
                {copied ? <Check className="w-4 h-4 text-[var(--pos)]" strokeWidth={2} /> : <Copy className="w-4 h-4" strokeWidth={2} />}
                {copied ? "Скопировано" : copyFailed ? "Буфер недоступен" : "Текст для письма"}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Закрыть"
                className="absolute right-4 p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Preview */}
            <div className="relative z-10 flex-1 overflow-auto pb-8">
              <div className="mx-auto w-fit shadow-2xl rounded-lg overflow-hidden">
                <div ref={reportRef}>
                  <PortfolioReport data={data} params={params} />
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Отдельная копия отчёта прямо под <body> — печать без клиппинга
          скролл-контейнерами приложения (см. print-report-mode в globals.css). */}
      {open &&
        createPortal(
          <div id="print-report-root">
            <PortfolioReport data={data} params={params} />
          </div>,
          document.body,
        )}
    </>
  );
}
