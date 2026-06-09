"use client";

import { use, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { fetchStrategy, fetchMe } from "@/lib/api";
import { StrategyForm } from "@/components/catalog/admin/StrategyForm";

export default function EditStrategyPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();
  const { data: me, isLoading: meLoading } = useQuery({ queryKey: ["me"], queryFn: fetchMe });
  const { data: strategy, isLoading: stratLoading } = useQuery({
    queryKey: ["strategy", code],
    queryFn: () => fetchStrategy(code),
  });

  useEffect(() => {
    if (!meLoading && me && !me.is_superuser) router.replace(`/catalog/strategies/${code}`);
  }, [me, meLoading, router, code]);

  if (meLoading || stratLoading) return <div className="text-muted-foreground text-sm">Загрузка…</div>;
  if (!me?.is_superuser || !strategy) return null;

  return <StrategyForm initial={strategy} isNew={false} />;
}
