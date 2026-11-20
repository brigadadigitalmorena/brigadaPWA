/**
 * Color scheme catalog for PWA (parity with mobile color-schemes).
 * CSS token overrides live in styles/brigada-tokens.css via data-color-scheme.
 */

export interface ColorSchemeMeta {
  id: string;
  name: string;
  description: string;
  /** Swatch for light mode primary */
  swatchLight: string;
  /** Swatch for dark mode primary (brand accent, not mobile white-primary) */
  swatchDark: string;
}

export const colorSchemes: ColorSchemeMeta[] = [
  {
    id: 'pink',
    name: 'Rosa Vibrante',
    description: 'Esquema original rosa enérgico',
    swatchLight: '#FF1B8D',
    swatchDark: '#FF4DA6',
  },
  {
    id: 'blue',
    name: 'Azul Profesional',
    description: 'Elegante y corporativo',
    swatchLight: '#0284C7',
    swatchDark: '#38BDF8',
  },
  {
    id: 'purple',
    name: 'Púrpura Moderno',
    description: 'Creativo y sofisticado',
    swatchLight: '#7C3AED',
    swatchDark: '#A78BFA',
  },
  {
    id: 'green',
    name: 'Verde Natural',
    description: 'Fresco y orgánico',
    swatchLight: '#16A34A',
    swatchDark: '#4ADE80',
  },
  {
    id: 'orange',
    name: 'Naranja Cálido',
    description: 'Energético y acogedor',
    swatchLight: '#EA580C',
    swatchDark: '#FB923C',
  },
  {
    id: 'red',
    name: 'Rojo Intenso',
    description: 'Poderoso y apasionado',
    swatchLight: '#DC2626',
    swatchDark: '#F87171',
  },
  {
    id: 'darkElegant',
    name: 'Oscuro Elegante',
    description: 'Minimalista y sofisticado',
    swatchLight: '#111827',
    swatchDark: '#F3F4F6',
  },
  {
    id: 'indigo',
    name: 'Índigo Corporativo',
    description: 'Profesional y confiable',
    swatchLight: '#4F46E5',
    swatchDark: '#818CF8',
  },
  {
    id: 'teal',
    name: 'Aguamarina Premium',
    description: 'Fresco y moderno',
    swatchLight: '#14B8A6',
    swatchDark: '#2DD4BF',
  },
];

export const DEFAULT_COLOR_SCHEME = 'pink';

export const COLOR_SCHEME_STORAGE_KEY = 'brigada-pwa-color-scheme';

export function isValidColorScheme(id: string): boolean {
  return colorSchemes.some((s) => s.id === id);
}

export function getColorScheme(id: string): ColorSchemeMeta | undefined {
  return colorSchemes.find((s) => s.id === id);
}

/** Status / nav bar color for the installed PWA chrome. */
export function getChromeColor(schemeId: string, isDark: boolean): string {
  const scheme =
    getColorScheme(schemeId) ?? getColorScheme(DEFAULT_COLOR_SCHEME);
  if (!scheme) return '#FF1B8D';
  return isDark ? scheme.swatchDark : scheme.swatchLight;
}

const CHROME_COOKIE = 'brigada-pwa-chrome';

function updateMeta(name: string, content: string) {
  const node = document.querySelector(`meta[name="${name}"]`);
  if (!node) {
    const meta = document.createElement('meta');
    meta.setAttribute('name', name);
    meta.setAttribute('content', content);
    document.head.appendChild(meta);
    return;
  }
  if (node.getAttribute('content') !== content) {
    node.setAttribute('content', content);
  }
}

function syncManifestLink(color: string) {
  const href = `/manifest.json?theme_color=${encodeURIComponent(color)}&v=${Date.now()}`;
  const existing = document.querySelector('link[rel="manifest"]');
  if (!existing) {
    const next = document.createElement('link');
    next.setAttribute('rel', 'manifest');
    next.setAttribute('href', href);
    document.head.appendChild(next);
    return;
  }
  const current = existing.getAttribute('href') ?? '';
  if (current.includes(encodeURIComponent(color))) return;
  existing.setAttribute('href', href);
}

function isInstalledPwa() {
  const nav = navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    nav.standalone === true
  );
}

export function applyThemeColorMeta(color: string) {
  if (typeof document === 'undefined') return;
  const painted = document.documentElement.dataset.chromeColor || '';
  // Keep the nodes Next rendered. Removing them makes the next navigation
  // call removeChild on a parent that is already null.
  updateMeta('theme-color', color);
  updateMeta('msapplication-navbutton-color', color);
  try {
    document.cookie = `${CHROME_COOKIE}=${color};path=/;max-age=31536000;samesite=lax`;
  } catch {
    // Private mode.
  }
  syncManifestLink(color);
  // The Android nav bar latches the theme-color from the first HTML.
  // A reload lets the server paint the new color before Chrome draws the bar.
  if (
    isInstalledPwa() &&
    painted &&
    painted.toLowerCase() !== color.toLowerCase()
  ) {
    document.documentElement.dataset.chromeColor = color;
    window.location.reload();
  }
}
