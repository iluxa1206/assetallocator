"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Trash2, Upload } from "lucide-react";
import {
  attachmentDownloadUrl,
  deleteAttachment,
  fetchAttachment,
  uploadAttachment,
  type AttachmentEntity,
} from "@/lib/api";

function fmtSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
  return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
}

/** «Скачать презентацию» button on a fund/strategy card + admin upload/delete controls. */
export function PresentationBlock({
  entityType,
  entityId,
  isAdmin,
  label = "Презентация",
  nowrap = false,
}: {
  entityType: AttachmentEntity;
  entityId: string;
  isAdmin: boolean;
  label?: string;
  /** Keep download + admin controls on one line and truncate a long label (grid cells). */
  nowrap?: boolean;
}) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");

  const queryKey = ["attachment", entityType, entityId];
  const { data: att } = useQuery({
    queryKey,
    queryFn: () => fetchAttachment(entityType, entityId),
  });

  const upload = useMutation({
    mutationFn: (file: File) => uploadAttachment(entityType, entityId, file),
    onSuccess: () => { setError(""); qc.invalidateQueries({ queryKey }); },
    onError: () => setError("Не удалось загрузить файл (только PDF до 50 МБ)"),
  });

  const remove = useMutation({
    mutationFn: () => deleteAttachment(entityType, entityId),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  if (!att && !isAdmin) return null;

  return (
    <div className={`flex items-center gap-2 ${nowrap ? "flex-nowrap min-w-0" : "flex-wrap"}`}>
      {att && (
        <a
          href={attachmentDownloadUrl(entityType, entityId)}
          className={`inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-accent transition-colors ${nowrap ? "min-w-0 flex-1" : ""}`}
        >
          <FileText className="w-4 h-4 text-primary shrink-0" strokeWidth={1.75} />
          <span className={nowrap ? "truncate" : ""}>{label}</span>
          <span className="text-xs text-muted-foreground shrink-0">PDF, {fmtSize(att.size)}</span>
        </a>
      )}

      {isAdmin && (
        <>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload.mutate(f);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={upload.isPending}
            className={`inline-flex items-center gap-1.5 rounded-md border border-input px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-60 ${nowrap ? "shrink-0" : ""}`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span className={nowrap ? "hidden sm:inline" : ""}>
              {upload.isPending ? "Загрузка…" : att ? "Заменить PDF" : "Загрузить презентацию"}
            </span>
          </button>
          {att && (
            <button
              type="button"
              onClick={() => remove.mutate()}
              disabled={remove.isPending}
              title="Удалить презентацию"
              className={`p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors ${nowrap ? "shrink-0" : ""}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          {error && <span className="text-xs text-destructive">{error}</span>}
        </>
      )}
    </div>
  );
}
