import { useEffect, useRef, useState } from "react";
import { safeSessionStorage } from "@/lib/safeStorage";

/**
 * useState backed by sessionStorage so component state survives
 * accidental remounts (Lovable preview HMR / Fast Refresh / route transitions).
 *
 * - Reads initial value from sessionStorage on first render
 * - Writes the (optionally filtered) state back on every change
 * - Pass `omitKeys` to skip non-serializable fields (e.g. fetched data blobs)
 */
export function useSessionState<T>(
  key: string,
  initial: T,
  options?: { omitKeys?: (keyof T)[] },
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const omitKeysRef = useRef(options?.omitKeys);
  const [state, setState] = useState<T>(() => {
    if (typeof window === "undefined") return initial;
    try {
      const raw = safeSessionStorage.getItem(key);
      if (raw == null) return initial;
      const parsed = JSON.parse(raw);
      return { ...(initial as any), ...parsed } as T;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const toStore: any = { ...(state as any) };
      const omit = omitKeysRef.current;
      if (omit) for (const k of omit) delete toStore[k as string];
      safeSessionStorage.setItem(key, JSON.stringify(toStore));
    } catch {
      // quota / circular refs — ignore
    }
  }, [key, state]);

  return [state, setState];
}

export function clearSessionState(key: string) {
  safeSessionStorage.removeItem(key);
}
