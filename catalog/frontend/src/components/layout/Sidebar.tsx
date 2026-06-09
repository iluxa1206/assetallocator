"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Дашборд" },
  { href: "/catalog", label: "Каталог" },
  { href: "/clients", label: "Клиенты" },
  { href: "/proposals", label: "Предложения" },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-56 shrink-0 flex flex-col h-full bg-sidebar border-r border-sidebar-border">
      <div className="flex items-center justify-between px-4 h-14 border-b border-sidebar-border">
        <span className="font-semibold text-primary tracking-wide text-sm uppercase">
          Astra AM
        </span>
        <ThemeToggle />
      </div>
      <nav className="flex-1 py-4 space-y-1 px-2">
        {NAV.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center px-3 py-2 rounded-md text-sm transition-colors",
              pathname.startsWith(href)
                ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                : "text-sidebar-foreground hover:bg-sidebar-accent/50"
            )}
          >
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
