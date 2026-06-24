/**
 * Safari (private mode / cookie-blocked) can throw when accessing localStorage
 * or sessionStorage. Wrap all calls in try/catch to keep the app from
 * white-screening at boot.
 */

type StorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  clear: () => void;
  key: (i: number) => string | null;
  length: number;
};

function wrap(getStore: () => Storage | null): StorageLike {
  return {
    getItem(key) {
      try {
        return getStore()?.getItem(key) ?? null;
      } catch {
        return null;
      }
    },
    setItem(key, value) {
      try {
        getStore()?.setItem(key, value);
      } catch {
        /* ignore quota / privacy */
      }
    },
    removeItem(key) {
      try {
        getStore()?.removeItem(key);
      } catch {
        /* ignore */
      }
    },
    clear() {
      try {
        getStore()?.clear();
      } catch {
        /* ignore */
      }
    },
    key(i) {
      try {
        return getStore()?.key(i) ?? null;
      } catch {
        return null;
      }
    },
    get length() {
      try {
        return getStore()?.length ?? 0;
      } catch {
        return 0;
      }
    },
  };
}

export const safeLocalStorage: StorageLike = wrap(() =>
  typeof window === "undefined" ? null : window.localStorage,
);

export const safeSessionStorage: StorageLike = wrap(() =>
  typeof window === "undefined" ? null : window.sessionStorage,
);
