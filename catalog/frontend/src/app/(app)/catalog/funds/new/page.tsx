"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { fetchMe } from "@/lib/api";
import { FundForm } from "@/components/catalog/admin/FundForm";

export default function NewFundPage() {
  const router = useRouter();
  const { data: me, isLoading } = useQuery({ queryKey: ["me"], queryFn: fetchMe });

  useEffect(() => {
    if (!isLoading && me && !me.is_superuser) router.replace("/catalog/funds");
  }, [me, isLoading, router]);

  if (isLoading) return <div className="text-muted-foreground text-sm">Загрузка…</div>;
  if (!me?.is_superuser) return null;

  return <FundForm initial={undefined} isNew />;
}
