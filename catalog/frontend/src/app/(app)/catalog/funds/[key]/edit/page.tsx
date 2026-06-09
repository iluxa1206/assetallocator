"use client";

import { use, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { fetchFund, fetchMe } from "@/lib/api";
import { FundForm } from "@/components/catalog/admin/FundForm";
import { QuotesEditor } from "@/components/catalog/admin/QuotesEditor";

export default function EditFundPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = use(params);
  const router = useRouter();
  const { data: me, isLoading: meLoading } = useQuery({ queryKey: ["me"], queryFn: fetchMe });
  const { data: fund, isLoading: fundLoading } = useQuery({
    queryKey: ["fund", key],
    queryFn: () => fetchFund(key),
  });

  useEffect(() => {
    if (!meLoading && me && !me.is_superuser) router.replace(`/catalog/funds/${key}`);
  }, [me, meLoading, router, key]);

  if (meLoading || fundLoading) return <div className="text-muted-foreground text-sm">Загрузка…</div>;
  if (!me?.is_superuser || !fund) return null;

  return (
    <div className="space-y-6">
      <FundForm initial={fund} isNew={false} />
      <QuotesEditor fundKey={fund.key} ccy={fund.native_currency} />
    </div>
  );
}
