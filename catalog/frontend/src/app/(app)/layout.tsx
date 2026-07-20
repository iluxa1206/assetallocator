import { Sidebar } from "@/components/layout/Sidebar";
import { AuditBeacon } from "@/components/layout/AuditBeacon";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <AuditBeacon />
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-4 pt-20 md:p-6 md:pt-6">
        <div className="max-w-7xl mx-auto">{children}</div>
        <footer className="max-w-7xl mx-auto mt-12 pt-5 border-t border-border text-[11px] leading-relaxed text-muted-foreground/70">
          Данные носят справочный характер и не являются индивидуальной инвестиционной рекомендацией.
          Доходность прошлых периодов не гарантирует доходность в будущем. Все ряды нормированы к 100 на стартовую дату;
          показатели рассчитаны по доступным котировкам и могут отличаться от официальной отчётности фондов.
        </footer>
      </main>
    </div>
  );
}
