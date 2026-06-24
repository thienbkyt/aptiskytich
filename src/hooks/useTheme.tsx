import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { safeLocalStorage } from "@/lib/safeStorage";

type Theme = "light" | "dark" | "auto";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: "light" | "dark";
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function getSystemTheme(): "light" | "dark" {
  try {
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    return (safeLocalStorage.getItem("theme") as Theme) || "light";
  });
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(
    theme === "auto" ? getSystemTheme() : theme
  );

  const setTheme = (t: Theme) => {
    setThemeState(t);
    safeLocalStorage.setItem("theme", t);
  };

  useEffect(() => {
    const resolved = theme === "auto" ? getSystemTheme() : theme;
    setResolvedTheme(resolved);

    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(resolved);

    if (theme === "auto") {
      const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
      const handler = (e: MediaQueryListEvent) => {
        const newTheme = e.matches ? "dark" : "light";
        setResolvedTheme(newTheme);
        root.classList.remove("light", "dark");
        root.classList.add(newTheme);
      };
      if (mq?.addEventListener) mq.addEventListener("change", handler);
      else mq?.addListener?.(handler as any);
      return () => {
        if (mq?.removeEventListener) mq.removeEventListener("change", handler);
        else mq?.removeListener?.(handler as any);
      };
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
