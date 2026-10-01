import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { safeLocalStorage } from "@/lib/safeStorage";
import { HALLOWEEN_END, isHalloweenSeason } from "@/lib/halloween";

export type Theme = "light" | "dark" | "halloween";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: "light" | "dark";
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/** Lựa chọn giao diện trong mùa Halloween (tách riêng để mặc định ai cũng là halloween). */
const HW_KEY = "theme_hw2026";

function getBaseTheme(): "light" | "dark" {
  const stored = safeLocalStorage.getItem("theme");
  if (stored === "dark") return "dark";
  // "auto" (legacy) or anything else falls back to light; overwrite legacy value.
  if (stored === "auto") safeLocalStorage.setItem("theme", "light");
  return "light";
}

function getInitialTheme(): Theme {
  const base = getBaseTheme();
  if (isHalloweenSeason()) {
    const c = safeLocalStorage.getItem(HW_KEY);
    if (c === "light" || c === "dark") return c;
    return "halloween";
  }
  return base;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  const setTheme = (t: Theme) => {
    if (t === "halloween" && !isHalloweenSeason()) t = "light";
    setThemeState(t);
    if (isHalloweenSeason()) safeLocalStorage.setItem(HW_KEY, t);
    if (t !== "halloween") safeLocalStorage.setItem("theme", t);
  };

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark", "halloween");
    if (theme === "halloween") root.classList.add("light", "halloween");
    else root.classList.add(theme);
  }, [theme]);

  // Hết mùa khi tab vẫn đang mở → tự về giao diện thường.
  useEffect(() => {
    if (theme !== "halloween") return;
    const left = HALLOWEEN_END - Date.now();
    if (left <= 0) { setThemeState(getBaseTheme()); return; }
    if (left > 2_000_000_000) return; // setTimeout tối đa ~24 ngày
    const t = window.setTimeout(() => setThemeState(getBaseTheme()), left);
    return () => clearTimeout(t);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme: theme === "dark" ? "dark" : "light" }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
