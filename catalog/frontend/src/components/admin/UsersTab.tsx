"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Lock, LockOpen } from "lucide-react";
import {
  createInvitation,
  fetchAdminUsers,
  fetchMe,
  updateUser,
  type AdminUser,
} from "@/lib/api";
import { CopyLinkButton, inviteLink, ROLE_LABEL } from "./InvitationsTab";
import { cn } from "@/lib/utils";

export function UsersTab() {
  const qc = useQueryClient();
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: fetchMe });
  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: fetchAdminUsers,
  });
  // user id → freshly created reset-link token
  const [resetTokens, setResetTokens] = useState<Record<string, string>>({});

  const toggleActive = useMutation({
    mutationFn: (u: AdminUser) => updateUser(u.id, { is_active: !u.is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  const resetPassword = useMutation({
    mutationFn: (u: AdminUser) => createInvitation(u.email, u.role),
    onSuccess: (inv, u) => {
      setResetTokens((prev) => ({ ...prev, [u.id]: inv.token }));
      qc.invalidateQueries({ queryKey: ["admin-invitations"] });
    },
  });

  return (
    <div className="glossy rounded-xl overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-[0.12em] text-muted-foreground border-b border-border">
            <th className="px-4 py-3 font-semibold">Сотрудник</th>
            <th className="px-4 py-3 font-semibold">Роль</th>
            <th className="px-4 py-3 font-semibold">Статус</th>
            <th className="px-4 py-3 font-semibold">Добавлен</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {isLoading && (
            <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">Загрузка…</td></tr>
          )}
          {users?.map((u) => {
            const isSelf = me?.id === u.id;
            const resetToken = resetTokens[u.id];
            return (
              <tr key={u.id} className="border-b border-border/50 last:border-0">
                <td className="px-4 py-3">
                  <p className="font-medium text-card-foreground">{u.full_name || "—"}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {u.is_superuser ? "Администратор" : (ROLE_LABEL[u.role] ?? u.role)}
                </td>
                <td className="px-4 py-3">
                  <span className={cn(
                    "text-[11px] uppercase tracking-wider px-1.5 py-0.5 rounded",
                    u.is_active ? "bg-[var(--pos)]/12 text-[var(--pos)]" : "bg-destructive/10 text-destructive",
                  )}>
                    {u.is_active ? "Активен" : "Заблокирован"}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                  {new Date(u.created_at).toLocaleDateString("ru-RU")}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1.5">
                    {resetToken ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="font-mono hidden lg:inline max-w-[220px] truncate">{inviteLink(resetToken)}</span>
                        <CopyLinkButton token={resetToken} />
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => resetPassword.mutate(u)}
                        disabled={resetPassword.isPending}
                        title="Создать ссылку для сброса пароля"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border border-input hover:bg-accent transition-colors disabled:opacity-60"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                        Сброс пароля
                      </button>
                    )}
                    {!isSelf && !u.is_superuser && (
                      <button
                        type="button"
                        onClick={() => toggleActive.mutate(u)}
                        disabled={toggleActive.isPending}
                        title={u.is_active ? "Заблокировать доступ" : "Разблокировать"}
                        className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors disabled:opacity-60",
                          u.is_active
                            ? "border-input text-muted-foreground hover:text-destructive hover:border-destructive/40 hover:bg-destructive/10"
                            : "border-[var(--pos)]/40 text-[var(--pos)] hover:bg-[var(--pos)]/10",
                        )}
                      >
                        {u.is_active ? <Lock className="w-3.5 h-3.5" /> : <LockOpen className="w-3.5 h-3.5" />}
                        {u.is_active ? "Заблокировать" : "Разблокировать"}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
