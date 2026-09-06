import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Стратегии",
  description: "Модельные стратегии и их состав",
};

export default function StrategiesLayout({ children }: { children: ReactNode }) {
  return children;
}
