"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { fetchMe } from "@/lib/api";
import { StrategyForm } from "@/components/catalog/admin/StrategyForm";

export default function NewStrategyPage() {
  const router = useRouter();
  const { data: me, isLoading } = useQuery({ queryKey: ["me"], queryFn: fetchMe });

  useEffect(() => {
    if (!isLoading && me && !me.is_superuser) router.replace("/catalog/strategies");
  }, [me, isLoading, router]);

  if (isLoading) return <div className="text-muted-foreground text-sm">Загрузка…</div>;
  if (!me?.is_superuser) return null;

  return <StrategyForm initial={undefined} isNew />;
}
