"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/layout/Logo";


export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const emailRef = useRef<HTMLInputElement>(null);
  const pwdRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!error) return;
    const shake = (el: HTMLInputElement | null) => {
      if (!el) return;
      el.classList.remove("is-shaking");
      void el.offsetWidth;
      el.classList.add("is-shaking");
      setTimeout(() => el.classList.remove("is-shaking"), 300);
    };
    shake(emailRef.current);
    shake(pwdRef.current);
  }, [error]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const body = new URLSearchParams({ username: email, password });
      // Bearer endpoint — returns {access_token, token_type}. We set the cookie ourselves so the
      // middleware proxy.ts sees it regardless of Next dev rewrite stripping Set-Cookie headers.
      const res = await fetch(`/api/v1/auth/jwt/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
        credentials: "include",
      });
      if (!res.ok) {
        setError("Неверный email или пароль");
        return;
      }
      const { access_token } = (await res.json()) as { access_token: string; token_type: string };
      // 8 hours, matches backend JWT lifetime
      const maxAge = 8 * 60 * 60;
      document.cookie = `access_token=${access_token}; path=/; max-age=${maxAge}; samesite=lax`;
      try {
        localStorage.setItem("access_token", access_token);
      } catch {
        /* private mode — ignore */
      }
      window.location.href = "/dashboard";
    } catch (err) {
      setError("Ошибка подключения к серверу");
    } finally {
      setLoading(false);
    }
  }

  const clearError = () => { if (error) setError(""); };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="glossy w-full max-w-sm rounded-xl p-8 backdrop-blur-xl">
        <div className="flex justify-center mb-6">
          <Logo />
        </div>
        <h1 className="text-[1.6rem] font-extrabold tracking-tight text-center text-card-foreground">
          С возвращением
        </h1>
        <p className="text-sm text-muted-foreground text-center mt-1 mb-7">
          Войдите, чтобы собирать модельные портфели
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-sm font-medium text-foreground">
              Email
            </label>
            <input
              ref={emailRef}
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => { setEmail(e.target.value); clearError(); }}
              className={`t-input w-full px-3 py-2 text-sm border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary${error ? " border-destructive is-error" : " border-input"}`}
              placeholder="you@company.com"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="block text-sm font-medium text-foreground">
              Пароль
            </label>
            <input
              ref={pwdRef}
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => { setPassword(e.target.value); clearError(); }}
              className={`t-input w-full px-3 py-2 text-sm border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary${error ? " border-destructive is-error" : " border-input"}`}
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 text-sm font-semibold text-primary-foreground bg-primary rounded-lg disabled:opacity-60 disabled:cursor-not-allowed transition-all hover:bg-primary/90 active:scale-[0.99]"
          >
            <span className="inline-flex items-center justify-center gap-2">
              {loading && (
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              )}
              {loading ? "Вход…" : "Войти"}
            </span>
          </button>
        </form>
      </div>
    </div>
  );
}
