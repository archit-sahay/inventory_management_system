import { useEffect, useRef } from "react";

/**
 * Re-runs `callback` whenever the tab regains focus / becomes visible again.
 * Keeps list views in sync with the database without manual reloads.
 * Uses a ref so the latest callback is invoked without re-binding listeners.
 */
export function useRefreshOnFocus(callback) {
  const cbRef = useRef(callback);
  cbRef.current = callback;

  useEffect(() => {
    const onFocus = () => cbRef.current?.();
    const onVisible = () => {
      if (document.visibilityState === "visible") cbRef.current?.();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
}
