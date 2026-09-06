import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Трек",
  description: "Исторический трек стратегии: доходность, просадки, скользящие окна",
};

export default function TrackLayout({ children }: { children: ReactNode }) {
  return children;
}
