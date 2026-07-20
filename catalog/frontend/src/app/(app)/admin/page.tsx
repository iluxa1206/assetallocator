"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { fetchMe } from "@/lib/api";
import { UsersTab } from "@/components/admin/UsersTab";
import { InvitationsTab } from "@/components/admin/InvitationsTab";
import { ActivityTab } from "@/components/admin/ActivityTab";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "users", label: "Сотрудники" },
  { key: "invitations", label: "Приглашения" },
  { key: "activity", label: "Активность" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function AdminPage() {
  const router = useRouter();
  const { data: me, isLoading } = useQuery({ queryKey: ["me"], queryFn: fetchMe });
  const [tab, setTab] = useState<TabKey>("users");

  useEffect(() => {
    if (!isLoading && me && !me.is_superuser) router.replace("/dashboard");
  }, [me, isLoading, router]);

  if (isLoading || !me?.is_superuser) return null;

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-5xl">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-foreground">Администрирование</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Доступ сотрудников, приглашения и активность
        </p>
      </div>

      <div className="flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "px-3.5 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === t.key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "users" && <UsersTab />}
      {tab === "invitations" && <InvitationsTab />}
      {tab === "activity" && <ActivityTab />}
    </div>
  );
}
