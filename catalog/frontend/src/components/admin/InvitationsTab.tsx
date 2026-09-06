"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Trash2 } from "lucide-react";
import {
  createInvitation,
  fetchInvitations,
  revokeInvitation,
  type InvitationRow,
} from "@/lib/api";
import { cn } from "@/lib/utils";

export const ROLE_LABEL: Record<string, string> = {
  manager: "Менеджер",
  analyst: "Аналитик",
  sales: "Продажи",
};

const STATUS_META: Record<InvitationRow["status"], { label: string; cls: string }> = {
  pending: { label: "Ожидает", cls: "bg-primary/15 text-primary" },
  used: { label: "Использовано", cls: "bg-[var(--pos)]/12 text-[var(--pos)]" },
  expired: { label: "Истекло", cls: "bg-destructive/10 text-destructive" },
};

export function inviteLink(token: string): string {
  return `${window.location.origin}/invite/${token}`;
}

export function CopyLinkButton({ token, className }: { token: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(inviteLink(token));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard unavailable */ }
  }
  return (
    <button
      type="button"
      onClick={copy}
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border border-input hover:bg-accent transition-colors",
        copied && "text-[var(--pos)] border-[var(--pos)]/40",
        className,
      )}
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? "Скопировано" : "Ссылка"}
    </button>
  );
}

export function InvitationsTab() {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("manager");
  const [error, setError] = useState("");
  const [lastCreated, setLastCreated] = useState<InvitationRow | null>(null);

  const { data: invitations, isLoading } = useQuery({
    queryKey: ["admin-invitations"],
    queryFn: fetchInvitations,
  });

  const create = useMutation({
    mutationFn: () => createInvitation(email.trim(), role),
    onSuccess: (inv) => {
      setLastCreated(inv);
      setEmail("");
      setError("");
      qc.invalidateQueries({ queryKey: ["admin-invitations"] });
    },
    onError: () => setError("Не удалось создать приглашение"),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => revokeInvitation(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-invitations"] }),
  });

  return (
    <div className="space-y-6">
      {/* ── Create form ── */}
      <form
        onSubmit={(e) => { e.preventDefault(); if (email.trim()) create.mutate(); }}
        className="glossy rounded-xl p-4 space-y-3"
      >
        <p className="text-sm font-semibold text-card-foreground">Пригласить сотрудника</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(""); }}
            placeholder="employee@company.com"
            className="t-input flex-1 px-3 py-2 text-sm border border-input rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="px-3 py-2 text-sm border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="manager">Менеджер — Дашборд, Каталог, Трек</option>
            <option value="analyst">Аналитик — полный доступ</option>
          </select>
          <button
            type="submit"
            disabled={create.isPending || !email.trim()}
            className="px-4 py-2 text-sm font-semibold text-primary-foreground bg-primary rounded-lg disabled:opacity-60 hover:bg-primary/90 transition-colors"
          >
            {create.isPending ? "Создаём…" : "Создать ссылку"}
          </button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {lastCreated && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 bg-primary/8 border border-primary/20 rounded-lg px-3 py-2">
            <p className="text-xs text-muted-foreground flex-1 break-all">
              {lastCreated.is_reset ? "Ссылка для сброса пароля" : "Ссылка-приглашение"} для{" "}
              <span className="text-foreground font-medium">{lastCreated.email}</span>:{" "}
              <span className="font-mono">{inviteLink(lastCreated.token)}</span>
            </p>
            <CopyLinkButton token={lastCreated.token} />
          </div>
        )}
      </form>

      {/* ── Invitations table ── */}
      <div className="glossy rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-[0.12em] text-muted-foreground border-b border-border">
              <th className="px-4 py-3 font-semibold">Email</th>
              <th className="px-4 py-3 font-semibold">Роль</th>
              <th className="px-4 py-3 font-semibold">Тип</th>
              <th className="px-4 py-3 font-semibold">Статус</th>
              <th className="px-4 py-3 font-semibold">Действует до</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">Загрузка…</td></tr>
            )}
            {!isLoading && !invitations?.length && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">Приглашений пока нет</td></tr>
            )}
            {invitations?.map((inv) => (
              <tr key={inv.id} className="border-b border-border/50 last:border-0">
                <td className="px-4 py-3 font-medium text-card-foreground">{inv.email}</td>
                <td className="px-4 py-3 text-muted-foreground">{ROLE_LABEL[inv.role] ?? inv.role}</td>
                <td className="px-4 py-3 text-muted-foreground">{inv.is_reset ? "Сброс пароля" : "Регистрация"}</td>
                <td className="px-4 py-3">
                  <span className={cn("text-[11px] uppercase tracking-wider px-1.5 py-0.5 rounded", STATUS_META[inv.status].cls)}>
                    {STATUS_META[inv.status].label}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                  {new Date(inv.expires_at).toLocaleDateString("ru-RU")}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1.5">
                    {inv.status === "pending" && <CopyLinkButton token={inv.token} />}
                    <button
                      type="button"
                      onClick={() => revoke.mutate(inv.id)}
                      title="Удалить приглашение"
                      className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
