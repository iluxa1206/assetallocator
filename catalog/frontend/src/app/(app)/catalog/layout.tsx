import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Каталог фондов",
  description: "10 фондов: акции, облигации, хедж, ликвидность",
};

export default function CatalogLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-border">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] brand-text mb-1.5 w-fit">Каталог</p>
        <h1 className="text-[1.7rem] font-extrabold tracking-tight">Фонды и инструменты</h1>
        <p className="text-sm text-muted-foreground mt-1">10 фондов · акции, облигации, хедж, ликвидность</p>
      </div>
      {children}
    </div>
  );
}
