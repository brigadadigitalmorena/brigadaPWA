'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  ThemeProvider as NextThemesProvider,
  useTheme as useNextTheme,
} from 'next-themes';
import {
  COLOR_SCHEME_STORAGE_KEY,
  DEFAULT_COLOR_SCHEME,
  colorSchemes,
  isValidColorScheme,
  type ColorSchemeMeta,
} from '@/lib/color-schemes';

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
    try {
      localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, schemeId);
    } catch {
      // ignore
    }
  }, []);

  return (
    <ColorSchemeContext.Provider
      value={{
        colorScheme,
        availableSchemes: colorSchemes,
        setColorScheme,
      }}
    >
      {children}
    </ColorSchemeContext.Provider>
  );
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey="brigada-pwa-theme"
    >
      <ColorSchemeProvider>{children}</ColorSchemeProvider>
    </NextThemesProvider>
  );
}

export function useTheme() {
  const { theme, setTheme, resolvedTheme } = useNextTheme();
  const colorSchemeCtx = useContext(ColorSchemeContext);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  return {
    theme: (resolvedTheme ?? 'light') as 'light' | 'dark',
    setTheme,
    toggleTheme,
    mounted,
    colorScheme: colorSchemeCtx?.colorScheme ?? DEFAULT_COLOR_SCHEME,
    availableSchemes: colorSchemeCtx?.availableSchemes ?? colorSchemes,
    setColorScheme:
      colorSchemeCtx?.setColorScheme ??
      ((_id: string) => {
        /* no-op outside provider */
      }),
  };
}
