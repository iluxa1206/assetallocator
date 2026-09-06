import { Sidebar } from "@/components/layout/Sidebar";
import { AuditBeacon } from "@/components/layout/AuditBeacon";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <AuditBeacon />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground"
      >
        Перейти к содержимому
      </a>
      <Sidebar />
      <main id="main" tabIndex={-1} className="flex-1 overflow-y-auto p-4 pt-20 md:p-6 md:pt-6">
        <div className="max-w-7xl mx-auto">{children}</div>
        <footer className="max-w-7xl mx-auto mt-12 pt-5 border-t border-border text-[11px] leading-relaxed text-muted-foreground-2">
          Данные носят справочный характер и не являются индивидуальной инвестиционной рекомендацией.
          Доходность прошлых периодов не гарантирует доходность в будущем. Все ряды нормированы к 100 на стартовую дату;
          показатели рассчитаны по доступным котировкам и могут отличаться от официальной отчётности фондов.
        </footer>
      </main>
    </div>
  );
}
