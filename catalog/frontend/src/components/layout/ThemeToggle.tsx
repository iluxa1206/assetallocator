"use client";

import { useEffect } from "react";
import { Sun, Moon } from "lucide-react";
import { useThemeStore } from "@/stores/themeStore";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { theme, toggle, setTheme } = useThemeStore();

  useEffect(() => {
    setTheme(
      document.documentElement.classList.contains("dark") ? "dark" : "light"
    );
  }, [setTheme]);

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggle}
      aria-label="Переключить тему"
      className="w-9 h-9 px-0 text-sidebar-foreground/60 hover:text-sidebar-foreground"
    >
      {theme === "dark"
        ? <Sun className="w-4 h-4" strokeWidth={1.75} />
        : <Moon className="w-4 h-4" strokeWidth={1.75} />
      }
    </Button>
  );
}
