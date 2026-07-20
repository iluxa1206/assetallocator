"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** Posts a page-view audit event on every route change inside the app shell. */
export function AuditBeacon() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    fetch("/api/v1/audit/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      keepalive: true,
      body: JSON.stringify({ action: "page.view", payload: { path: pathname } }),
    }).catch(() => { /* audit must never break navigation */ });
  }, [pathname]);

  return null;
}
