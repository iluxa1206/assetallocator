import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Конкуренты",
  description: "Сравнение облигационных фондов с рынком",
};

export default function CompetitorsLayout({ children }: { children: ReactNode }) {
  return children;
}
