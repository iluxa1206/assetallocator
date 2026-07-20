"use client";

import { useQuery } from "@tanstack/react-query";
import { FolderDown } from "lucide-react";
import { fetchAttachment } from "@/lib/api";
import { PresentationBlock } from "./PresentationBlock";

/** Company-wide presentation decks, shown at the top of the catalog. */
const GENERAL_DOCS = [
  { id: "overview", label: "Общая презентация" },
  { id: "overview-idx", label: "Общая презентация + индексы" },
  { id: "results", label: "Результаты фондов" },
  { id: "vs-index", label: "Сравнение с индексами" },
] as const;

export function CompanyPresentations({ isAdmin }: { isAdmin: boolean }) {
  // Peek at whether any deck is uploaded so non-admins don't see an empty header.
  const { data: infos } = useQuery({
    queryKey: ["general-presentations"],
    queryFn: () => Promise.all(GENERAL_DOCS.map((d) => fetchAttachment("general", d.id))),
  });
  const hasAny = (infos ?? []).some(Boolean);

  if (!isAdmin && !hasAny) return null;

  return (
    <section className="glossy rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <FolderDown className="w-4 h-4 text-primary" strokeWidth={2} />
        <span className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
          Презентации компании
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {GENERAL_DOCS.map((d) => (
          <PresentationBlock
            key={d.id}
            entityType="general"
            entityId={d.id}
            isAdmin={isAdmin}
            label={d.label}
            nowrap
          />
        ))}
      </div>
    </section>
  );
}
