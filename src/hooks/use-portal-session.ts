import { useCallback, useEffect, useState } from "react";

const KEY = "portal_token";

export function readPortalToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(KEY);
}

export function usePortalSession() {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setToken(readPortalToken());
    setReady(true);
  }, []);

  const save = useCallback((value: string) => {
    window.localStorage.setItem(KEY, value);
    setToken(value);
  }, []);

  const clear = useCallback(() => {
    window.localStorage.removeItem(KEY);
    setToken(null);
  }, []);

  return { token, ready, save, clear };
}
