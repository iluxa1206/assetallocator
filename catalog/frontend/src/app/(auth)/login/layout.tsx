import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Вход",
  description: "Вход в Strategy Asset Allocation",
};

export default function LoginLayout({ children }: { children: ReactNode }) {
  return children;
}
