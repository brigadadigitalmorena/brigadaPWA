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
const CHROME_RELOAD_KEY = 'brigada-chrome-nav';
const OWNED_THEME_META = 'data-brigada-chrome';

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

/** A second theme-color node we own. React never removes it, and some
 *  Android browsers only retint the nav bar when a theme-color node is added. */
function pulseOwnedThemeColor(color: string) {
  const existing = document.querySelector(`meta[${OWNED_THEME_META}]`);
  if (existing?.getAttribute('content') === color) return;
  existing?.remove();
  const meta = document.createElement('meta');
  meta.setAttribute('name', 'theme-color');
  meta.setAttribute('content', color);
  meta.setAttribute(OWNED_THEME_META, '');
  document.head.appendChild(meta);
}

function writeChromeCookie(color: string) {
  const bare = color.replace('#', '');
  const secure = window.location.protocol === 'https:' ? ';secure' : '';
  document.cookie = `${CHROME_COOKIE}=${bare};path=/;max-age=31536000;samesite=lax${secure}`;
}

function syncManifestLink() {
  const existing = document.querySelector('link[rel="manifest"]');
  if (!existing) {
    const next = document.createElement('link');
    next.setAttribute('rel', 'manifest');
    next.setAttribute('href', '/manifest.json');
    document.head.appendChild(next);
    return;
  }
  const current = existing.getAttribute('href') ?? '';
  if (current === '/manifest.json') return;
  existing.setAttribute('href', '/manifest.json');
}

function stripChromeParam() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has('_chrome')) return;
  url.searchParams.delete('_chrome');
  const next = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState(window.history.state, '', next);
}

function androidDevice() {
  return /Android/i.test(navigator.userAgent);
}

function reloadForNavBar(color: string) {
  if (!androidDevice()) return;
  const painted = (document.documentElement.dataset.chromeColor || '').toLowerCase();
  const next = color.toLowerCase();
  if (!painted || painted === next) return;

  let already = '';
  try {
    already = sessionStorage.getItem(CHROME_RELOAD_KEY) ?? '';
    if (already === next) return;
    sessionStorage.setItem(CHROME_RELOAD_KEY, next);
  } catch {
    return;
  }

  let left = false;
  const go = () => {
    if (left) return;
    left = true;
    const url = new URL(window.location.href);
    url.searchParams.set('_chrome', Date.now().toString(36));
    window.location.replace(url.toString());
  };
  const timer = window.setTimeout(go, 400);
  if (!('caches' in window)) return;
  void caches.delete('manifest-cache-v1').finally(() => {
    window.clearTimeout(timer);
    go();
  });
}

export function applyThemeColorMeta(color: string) {
  if (typeof document === 'undefined') return;
  stripChromeParam();
  document.documentElement.style.setProperty('--system-chrome', color);
  // Keep the nodes Next rendered. Removing them makes the next navigation
  // call removeChild on a parent that is already null.
  updateMeta('theme-color', color);
  updateMeta('msapplication-navbutton-color', color);
  pulseOwnedThemeColor(color);
  try {
    writeChromeCookie(color);
  } catch {
    // Private mode.
  }
  syncManifestLink();
  // Android paints the nav bar from the theme-color in the first HTML.
  // Editing the meta later updates the status bar only, so reload once
  // with a fresh document that already carries the chosen color.
  reloadForNavBar(color);
}
