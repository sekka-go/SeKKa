import { useEffect, useRef } from "react";

type SilentRefreshOptions = {
  enabled?: boolean;
  intervalMs?: number;
  minIntervalMs?: number;
  maxIntervalMs?: number;
};

/** Runs background refreshes without exposing request state to the UI. */
export function useSilentRefresh(
  refresh: ((signal: AbortSignal) => Promise<boolean | void>) | null,
  { enabled = true, intervalMs = 20_000, minIntervalMs = intervalMs, maxIntervalMs = Math.min(60_000, intervalMs * 3) }: SilentRefreshOptions = {},
) {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    if (!enabled || !refresh) return;
    let disposed = false;
    let timer = 0;
    let controller: AbortController | null = null;
    let unchangedCount = 0;
    let running = false;
    let immediateAfterRun = false;

    const schedule = () => {
      window.clearTimeout(timer);
      if (disposed || document.visibilityState === "hidden") return;
      const backoff = Math.min(maxIntervalMs, intervalMs * (2 ** unchangedCount));
      const base = Math.max(minIntervalMs, backoff);
      const jittered = Math.min(maxIntervalMs, base * (0.8 + Math.random() * 0.4));
      timer = window.setTimeout(() => { void run(); }, jittered);
    };

    const run = async () => {
      if (disposed || running || document.visibilityState === "hidden" || !navigator.onLine) return;
      running = true;
      controller = new AbortController();
      try {
        const changed = await refreshRef.current?.(controller.signal);
        unchangedCount = changed ? 0 : unchangedCount + 1;
      } catch {
        unchangedCount += 1;
      } finally {
        running = false;
        controller = null;
        if (immediateAfterRun && !disposed && document.visibilityState === "visible" && navigator.onLine) {
          immediateAfterRun = false;
          queueMicrotask(() => { void run(); });
        } else schedule();
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        window.clearTimeout(timer);
        controller?.abort();
      } else {
        unchangedCount = 0;
        if (running) { immediateAfterRun = true; controller?.abort(); }
        else { immediateAfterRun = false; void run(); }
      }
    };
    const onOnline = () => { unchangedCount = 0; if (running) immediateAfterRun = true; else { immediateAfterRun = false; void run(); } };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("online", onOnline);
    schedule();
    return () => {
      disposed = true;
      window.clearTimeout(timer);
      controller?.abort();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("online", onOnline);
    };
  }, [enabled, intervalMs, minIntervalMs, maxIntervalMs]);
}

/** Compares fetched JSON data while preserving the previous reference if unchanged. */
export function sameData<T>(previous: T, next: T): boolean {
  return JSON.stringify(previous) === JSON.stringify(next);
}
