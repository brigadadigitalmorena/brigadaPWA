export const PWA_MANIFEST_ICONS = [
  {
    src: '/icons/icon-72x72.png',
    sizes: '72x72',
    type: 'image/png',
    purpose: 'maskable any',
  },
  {
    src: '/icons/icon-96x96.png',
    sizes: '96x96',
    type: 'image/png',
    purpose: 'maskable any',
  },
  {
    src: '/icons/icon-128x128.png',
    sizes: '128x128',
    type: 'image/png',
    purpose: 'maskable any',
  },
  {
    src: '/icons/icon-144x144.png',
    sizes: '144x144',
    type: 'image/png',
    purpose: 'maskable any',
  },
  {
    src: '/icons/icon-152x152.png',
    sizes: '152x152',
    type: 'image/png',
    purpose: 'maskable any',
  },
  {
    src: '/icons/icon-192x192.png',
    sizes: '192x192',
    type: 'image/png',
    purpose: 'maskable any',
  },
  {
    src: '/icons/icon-384x384.png',
    sizes: '384x384',
    type: 'image/png',
    purpose: 'maskable any',
  },
  {
    src: '/icons/icon-512x512.png',
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
