"use client";

import { use, useEffect, useState } from "react";
import { Logo } from "@/components/layout/Logo";

type InviteInfo = { email: string; is_reset: boolean };
type Status = "loading" | "invalid" | "form" | "submitting";

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);

  const [status, setStatus] = useState<Status>("loading");
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [invalidMsg, setInvalidMsg] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/v1/auth/invitations/${token}`);
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          setInvalidMsg(body?.detail ?? "Приглашение не найдено или уже использовано");
          setStatus("invalid");
          return;
        }
        setInfo((await res.json()) as InviteInfo);
        setStatus("form");
      } catch {
        if (!cancelled) {
          setInvalidMsg("Ошибка подключения к серверу");
          setStatus("invalid");
        }
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Пароль должен быть не короче 8 символов");
      return;
    }
    if (password !== confirm) {
      setError("Пароли не совпадают");
      return;
    }
    setStatus("submitting");
    try {
      const res = await fetch(`/api/v1/auth/invitations/${token}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.detail ?? "Не удалось создать аккаунт");
        setStatus("form");
        return;
      }
      // Auto-login with the just-set credentials, same flow as /login.
      const loginRes = await fetch(`/api/v1/auth/jwt/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ username: info!.email, password }).toString(),
        credentials: "include",
      });
      if (loginRes.ok) {
        const { access_token } = (await loginRes.json()) as { access_token: string };
        const maxAge = 8 * 60 * 60;
        document.cookie = `access_token=${access_token}; path=/; max-age=${maxAge}; samesite=lax`;
        try { localStorage.setItem("access_token", access_token); } catch { /* private mode */ }
        window.location.href = "/dashboard";
      } else {
        window.location.href = "/login";
      }
    } catch {
      setError("Ошибка подключения к серверу");
      setStatus("form");
    }
  }

  const inputCls =
    "t-input w-full px-3 py-2 text-sm border border-input rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary";

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="glossy w-full max-w-sm rounded-xl p-8 backdrop-blur-xl">
        <div className="flex justify-center mb-6">
          <Logo />
        </div>

        {status === "loading" && (
          <p className="text-sm text-muted-foreground text-center">Проверяем приглашение…</p>
        )}

        {status === "invalid" && (
          <>
            <h1 className="text-[1.4rem] font-extrabold tracking-tight text-center text-card-foreground">
              Ссылка недействительна
            </h1>
            <p className="text-sm text-muted-foreground text-center mt-2">{invalidMsg}</p>
            <p className="text-sm text-muted-foreground text-center mt-4">
              Запросите новую ссылку у администратора.
            </p>
          </>
        )}

        {(status === "form" || status === "submitting") && info && (
          <>
            <h1 className="text-[1.6rem] font-extrabold tracking-tight text-center text-card-foreground">
              {info.is_reset ? "Новый пароль" : "Добро пожаловать"}
            </h1>
            <p className="text-sm text-muted-foreground text-center mt-1 mb-7">
              {info.is_reset
                ? "Задайте новый пароль для входа"
                : "Придумайте пароль — логин уже закреплён за вами"}
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Логин — почта из приглашения, менять нельзя */}
              <div className="space-y-1.5">
                <label htmlFor="login" className="block text-sm font-medium text-foreground">
                  Логин
                </label>
                <input
                  id="login"
                  type="email"
                  value={info.email}
                  disabled
                  readOnly
                  className={`${inputCls} opacity-60 cursor-not-allowed`}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="password" className="block text-sm font-medium text-foreground">
                  Пароль
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  className={inputCls}
                  placeholder="Минимум 8 символов"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="confirm" className="block text-sm font-medium text-foreground">
                  Пароль ещё раз
                </label>
                <input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirm}
                  onChange={(e) => { setConfirm(e.target.value); setError(""); }}
                  className={inputCls}
                />
              </div>

              {error && (
                <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>
              )}

              <button
                type="submit"
                disabled={status === "submitting"}
                className="w-full py-2.5 px-4 text-sm font-semibold text-primary-foreground bg-primary rounded-lg disabled:opacity-60 disabled:cursor-not-allowed transition-all hover:bg-primary/90 active:scale-[0.99]"
              >
                {status === "submitting"
                  ? "Сохраняем…"
                  : info.is_reset ? "Сохранить пароль" : "Создать аккаунт"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
