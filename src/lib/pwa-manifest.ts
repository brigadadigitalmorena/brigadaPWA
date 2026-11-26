export const PWA_MANIFEST_ICONS = [
  {
    src: '/icons/icon-72x72.png?v=2',
    sizes: '72x72',
    type: 'image/png',
    purpose: 'maskable any',
  },
  {
    src: '/icons/icon-96x96.png?v=2',
    sizes: '96x96',
    type: 'image/png',
    purpose: 'maskable any',
  },
  {
    src: '/icons/icon-128x128.png?v=2',
    sizes: '128x128',
    type: 'image/png',
    purpose: 'maskable any',
  },
  {
    src: '/icons/icon-144x144.png?v=2',
    sizes: '144x144',
    type: 'image/png',
    purpose: 'maskable any',
  },
  {
    src: '/icons/icon-152x152.png?v=2',
    sizes: '152x152',
    type: 'image/png',
    purpose: 'maskable any',
  },
  {
    src: '/icons/icon-192x192.png?v=2',
    sizes: '192x192',
    type: 'image/png',
    purpose: 'maskable any',
  },
  {
    src: '/icons/icon-384x384.png?v=2',
    sizes: '384x384',
    type: 'image/png',
    purpose: 'maskable any',
  },
  {
    src: '/icons/icon-512x512.png?v=2',
    sizes: '512x512',
    type: 'image/png',
    purpose: 'maskable any',
  },
] as const;

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

export function normalizeHexColor(
  value: string | null | undefined
): string | null {
  if (!value) return null;
  let raw = value.trim();
  try {
    raw = decodeURIComponent(raw);
  } catch {
    // already decoded
  }
  if (!raw.startsWith('#')) raw = `#${raw}`;
  return HEX_COLOR.test(raw) ? raw : null;
}

export function isHexColor(value: string | null | undefined): value is string {
  return normalizeHexColor(value) !== null;
}

/**
 * Color for the installed manifest. The cookie wins over `theme_color` in the
 * URL: Chrome keeps the manifest address from the day the icon was added, so a
 * query pinned to the old swatch would leave the Android nav bar on that color.
 */
export function resolveChromeColor(
  cookieValue: string | null | undefined,
  queryValue: string | null | undefined
): string {
  return normalizeHexColor(cookieValue) ?? normalizeHexColor(queryValue) ?? '#FF1B8D';
}

export function buildPwaManifest(themeColor: string) {
  const color = isHexColor(themeColor) ? themeColor : '#FF1B8D';
  return {
    name: 'Brigada Digital',
    short_name: 'Brigada',
    description: 'Aplicación para brigadistas de campo',
    start_url: '/home',
    id: '/',
    display: 'standalone',
    background_color: color,
    theme_color: color,
    orientation: 'portrait-primary' as const,
    icons: PWA_MANIFEST_ICONS.map((icon) => ({ ...icon })),
    categories: ['business', 'productivity'],
    lang: 'es',
    dir: 'ltr',
  };
}
