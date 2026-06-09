"use client";

import { useEffect } from "react";
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
      className="w-9 h-9 px-0"
    >
      {theme === "dark" ? "☀" : "☾"}
    </Button>
  );
}
