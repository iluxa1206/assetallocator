import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Подбор стратегии",
  description: "Модельный портфель: аллокация, бэктест и сравнение с бенчмарками",
};

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return children;
}
