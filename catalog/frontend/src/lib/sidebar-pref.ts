/**
 * Свёрнутость сайдбара переживает перезагрузку.
 *
 * Через useSyncExternalStore, а не useState+useEffect: чтение localStorage в
 * эффекте — это setState во время коммита (react-hooks/set-state-in-effect),
 * а чтение при инициализации разошлось бы с серверной разметкой.
 */

const KEY = "sidebar:collapsed";

const listeners = new Set<() => void>();

export function subscribeCollapsed(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function getCollapsed(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

/** На сервере сайдбар всегда развёрнут — гидрация совпадает. */
export function getCollapsedServer(): boolean {
  return false;
}

export function setCollapsed(v: boolean) {
  try {
    localStorage.setItem(KEY, v ? "1" : "0");
  } catch {}
  listeners.forEach((l) => l());
}
