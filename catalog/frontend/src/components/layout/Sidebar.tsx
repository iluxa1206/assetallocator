"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, BookOpen, ChartSpline,
  ChevronLeft, ChevronRight, Menu, X, LogOut,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchMe } from "@/lib/api";
import { ThemeToggle } from "./ThemeToggle";
import { Logo, LogoMark } from "./Logo";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Дашборд", Icon: LayoutDashboard, ready: true },
  { href: "/catalog",   label: "Каталог",  Icon: BookOpen,        ready: true },
  { href: "/track",     label: "Трек",     Icon: ChartSpline,     ready: true },
];

function NavItems({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <>
      {NAV.map(({ href, label, Icon, ready }) =>
        ready ? (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            title={collapsed ? label : undefined}
            className={cn(
              "relative flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors",
              collapsed && "justify-center",
              pathname.startsWith(href)
                ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            )}
          >
            <Icon
              className={cn("w-4 h-4 shrink-0", pathname.startsWith(href) ? "text-primary" : "")}
              strokeWidth={pathname.startsWith(href) ? 2 : 1.75}
            />
            {!collapsed && label}
          </Link>
        ) : (
          <span
            key={href}
            aria-label={`${label} — скоро`}
            role="presentation"
            className={cn(
              "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm",
              "text-sidebar-foreground/40 cursor-not-allowed select-none",
              collapsed && "justify-center",
            )}
          >
            <Icon className="w-4 h-4 shrink-0" strokeWidth={1.75} />
            {!collapsed && (
              <>
                {label}
                <span className="ml-auto text-[9px] bg-muted text-muted-foreground/60 px-1.5 py-0.5 rounded uppercase tracking-wider">
                  Скоро
                </span>
              </>
            )}
          </span>
        )
      )}
    </>
  );
}

export function Sidebar() {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: fetchMe });

  async function logout() {
    try {
      await fetch("/api/v1/auth/jwt/logout", { method: "POST", credentials: "include" });
    } catch {}
    document.cookie = "access_token=; path=/; max-age=0; samesite=lax";
    try { localStorage.removeItem("access_token"); } catch {}
    router.push("/login");
  }

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside className={cn(
        "hidden md:flex flex-col h-full bg-sidebar border-r border-sidebar-border shrink-0 backdrop-blur-xl",
        "transition-[width] duration-200 ease-in-out",
        collapsed ? "w-14" : "w-56",
      )}>
        <div className="flex items-center h-16 border-b border-sidebar-border px-3">
          {collapsed ? (
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              aria-label="Развернуть меню"
              className="group mx-auto relative"
            >
              <LogoMark className="h-8 w-8 transition-transform group-hover:scale-105" />
              <ChevronRight className="w-3 h-3 absolute -right-1 -bottom-1 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          ) : (
            <>
              <Logo className="flex-1 min-w-0" />
              <ThemeToggle />
              <button
                type="button"
                onClick={() => setCollapsed(true)}
                aria-label="Свернуть меню"
                className="p-1.5 rounded-md hover:bg-sidebar-accent/50 text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </>
          )}
        </div>

        <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
          <NavItems collapsed={collapsed} />
        </nav>

        <div className="border-t border-sidebar-border p-2">
          {collapsed && (
            <div className="flex justify-center mb-1">
              <ThemeToggle />
            </div>
          )}
          {!collapsed && me?.email && (
            <p className="px-3 py-1 text-[11px] text-sidebar-foreground/40 truncate">{me.email}</p>
          )}
          <button
            type="button"
            onClick={logout}
            title={collapsed ? "Выйти" : undefined}
            className={cn(
              "flex items-center gap-2.5 px-3 py-2 w-full rounded-md text-sm",
              "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors",
              collapsed && "justify-center",
            )}
          >
            <LogOut className="w-4 h-4 shrink-0" strokeWidth={1.75} />
            {!collapsed && "Выйти"}
          </button>
        </div>
      </aside>

      {/* ── Mobile ── */}
      <div className="md:hidden">
        {/* Sticky top bar */}
        <div className="fixed top-0 left-0 right-0 z-40 h-16 bg-sidebar border-b border-sidebar-border flex items-center px-4 gap-3 backdrop-blur-xl">
          <button
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label="Открыть меню"
            className="p-1.5 rounded-md hover:bg-sidebar-accent/50 text-sidebar-foreground"
          >
            <Menu className="w-5 h-5" />
          </button>
          <Logo />
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>

        {/* Backdrop */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Drawer */}
        <aside className={cn(
          "fixed top-0 left-0 bottom-0 z-50 w-64 flex flex-col",
          "bg-sidebar border-r border-sidebar-border backdrop-blur-xl",
          "transition-transform duration-200 ease-in-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}>
          <div className="flex items-center h-16 border-b border-sidebar-border px-4 gap-3">
            <Logo className="flex-1 min-w-0" />
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Закрыть меню"
              className="p-1.5 rounded-md hover:bg-sidebar-accent/50 text-sidebar-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
            <NavItems collapsed={false} onNavigate={() => setMobileOpen(false)} />
          </nav>

          <div className="border-t border-sidebar-border p-2">
            {me?.email && (
              <p className="px-3 py-1 text-[11px] text-sidebar-foreground/40 truncate">{me.email}</p>
            )}
            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-2.5 px-3 py-2 w-full rounded-md text-sm text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
            >
              <LogOut className="w-4 h-4 shrink-0" strokeWidth={1.75} />
              Выйти
            </button>
          </div>
        </aside>
      </div>
    </>
  );
}
