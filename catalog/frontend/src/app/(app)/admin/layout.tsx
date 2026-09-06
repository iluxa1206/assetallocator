import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Администрирование",
  description: "Пользователи, приглашения и журнал активности",
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return children;
}
