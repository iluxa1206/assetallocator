import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Приглашение",
  description: "Активация доступа по приглашению",
};

export default function InviteLayout({ children }: { children: ReactNode }) {
  return children;
}
