import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export type Theme = 'light' | 'dark';
const KEY = 'apex-theme';

function readTheme(): Theme {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === 'light' || stored === 'dark') return stored;
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
  } catch {}
  return 'light';
}

function apply(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

interface ThemeCtx {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
}

const Ctx = createContext<ThemeCtx>(null as unknown as ThemeCtx);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readTheme);

  useEffect(() => {
    apply(theme);
    try { localStorage.setItem(KEY, theme); } catch {}
  }, [theme]);

  const setTheme = (t: Theme) => setThemeState(t);
  const toggle = () => setThemeState((t) => (t === 'dark' ? 'light' : 'dark'));

  return <Ctx.Provider value={{ theme, setTheme, toggle }}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);
