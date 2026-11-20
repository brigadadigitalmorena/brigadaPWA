'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  COLOR_SCHEME_STORAGE_KEY,
  DEFAULT_COLOR_SCHEME,
  applyThemeColorMeta,
  colorSchemes,
  getChromeColor,
  isValidColorScheme,
  type ColorSchemeMeta,
} from '@/lib/color-schemes';
import { StableTree } from '@/components/common/stable-tree';

const THEME_STORAGE_KEY = 'brigada-pwa-theme';
type ThemeMode = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';

function applyColorSchemeAttr(schemeId: string) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-color-scheme', schemeId);
}

function readStoredColorScheme(): string {
  if (typeof window === 'undefined') return DEFAULT_COLOR_SCHEME;
  try {
    const saved = localStorage.getItem(COLOR_SCHEME_STORAGE_KEY);
    if (saved && isValidColorScheme(saved)) return saved;
  } catch {
    // ignore
  }
  return DEFAULT_COLOR_SCHEME;
}

interface ColorSchemeContextValue {
  colorScheme: string;
  availableSchemes: ColorSchemeMeta[];
  setColorScheme: (schemeId: string) => void;
}

const ColorSchemeContext = createContext<ColorSchemeContextValue | undefined>(
  undefined
);

function ColorSchemeProvider({ children }: { children: ReactNode }) {
  const [colorScheme, setColorSchemeState] = useState(DEFAULT_COLOR_SCHEME);

  useEffect(() => {
    const initial = readStoredColorScheme();
    setColorSchemeState(initial);
    applyColorSchemeAttr(initial);
  }, []);

  const setColorScheme = useCallback((schemeId: string) => {
    if (!isValidColorScheme(schemeId)) return;
    setColorSchemeState(schemeId);
    applyColorSchemeAttr(schemeId);
    const isDark =
      typeof document !== 'undefined' &&
      document.documentElement.classList.contains('dark');
    applyThemeColorMeta(getChromeColor(schemeId, isDark));
    try {
      localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, schemeId);
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo(
    () => ({
      colorScheme,
      availableSchemes: colorSchemes,
      setColorScheme,
    }),
    [colorScheme, setColorScheme]
  );

  return (
    <ColorSchemeContext.Provider value={value}>
      <StableTree>{children}</StableTree>
    </ColorSchemeContext.Provider>
  );
}

function systemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function readStoredMode(): ThemeMode {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
  } catch {
    // ignore
  }
  return 'system';
}

function resolveMode(mode: ThemeMode): ResolvedTheme {
  if (mode === 'system') return systemPrefersDark() ? 'dark' : 'light';
  return mode;
}

function applyDarkClass(isDark: boolean) {
  document.documentElement.classList.toggle('dark', isDark);
  document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
}

interface ModeContextValue {
  theme: ResolvedTheme;
  setTheme: (theme: ResolvedTheme) => void;
  mounted: boolean;
}

const ModeContext = createContext<ModeContextValue | undefined>(undefined);

function ModeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ResolvedTheme>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const resolved = resolveMode(readStoredMode());
    setThemeState(resolved);
    applyDarkClass(resolved === 'dark');
    setMounted(true);
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (readStoredMode() !== 'system') return;
      const resolved = media.matches ? 'dark' : 'light';
      setThemeState(resolved);
      applyDarkClass(resolved === 'dark');
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const setTheme = useCallback((next: ResolvedTheme) => {
    setThemeState(next);
    applyDarkClass(next === 'dark');
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo(
    () => ({ theme, setTheme, mounted }),
    [theme, setTheme, mounted]
  );

  return (
    <ModeContext.Provider value={value}>
      <StableTree>{children}</StableTree>
    </ModeContext.Provider>
  );
}

function ChromeColorSync() {
  const mode = useContext(ModeContext);
  const colorSchemeCtx = useContext(ColorSchemeContext);

  useEffect(() => {
    if (!mode?.mounted) return;
    const apply = () =>
      applyThemeColorMeta(
        getChromeColor(
          colorSchemeCtx?.colorScheme ?? DEFAULT_COLOR_SCHEME,
          mode.theme === 'dark'
        )
      );
    apply();
    const onShow = () => {
      if (document.visibilityState === 'visible') apply();
    };
    document.addEventListener('visibilitychange', onShow);
    window.addEventListener('pageshow', apply);
    return () => {
      document.removeEventListener('visibilitychange', onShow);
      window.removeEventListener('pageshow', apply);
    };
  }, [colorSchemeCtx?.colorScheme, mode?.mounted, mode?.theme]);

  return null;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <ModeProvider>
      <ColorSchemeProvider>
        <ChromeColorSync />
        {children}
      </ColorSchemeProvider>
    </ModeProvider>
  );
}

const noopSetTheme = (_theme: ResolvedTheme) => undefined;
const noopSetColorScheme = (_schemeId: string) => undefined;

export function useTheme() {
  const mode = useContext(ModeContext);
  const colorSchemeCtx = useContext(ColorSchemeContext);
  const theme = mode?.theme ?? 'light';
  const setTheme = mode?.setTheme ?? noopSetTheme;
  const setColorScheme = colorSchemeCtx?.setColorScheme ?? noopSetColorScheme;
  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [setTheme, theme]);

  return useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme,
      mounted: mode?.mounted ?? false,
      colorScheme: colorSchemeCtx?.colorScheme ?? DEFAULT_COLOR_SCHEME,
      availableSchemes: colorSchemeCtx?.availableSchemes ?? colorSchemes,
      setColorScheme,
    }),
    [
      theme,
      setTheme,
      toggleTheme,
      mode?.mounted,
      colorSchemeCtx?.colorScheme,
      colorSchemeCtx?.availableSchemes,
      setColorScheme,
    ]
  );
}
