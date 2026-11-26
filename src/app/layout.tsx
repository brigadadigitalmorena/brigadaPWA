import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { preinit } from 'react-dom';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { normalizeHexColor } from '@/lib/pwa-manifest';
import { AuthProvider } from '@/contexts/auth.context';
import { SyncProvider } from '@/contexts/sync.context';
import { ThemeProvider } from '@/contexts/theme-context';
import { Toaster } from '@/components/ui/sonner';
import { ServiceWorkerRegistrar } from '@/components/common/service-worker-registrar';
import { InstallPrompt } from '@/components/common/install-prompt';

export const dynamic = 'force-dynamic';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

async function chromeColor(): Promise<string> {
  const jar = await cookies();
  return normalizeHexColor(jar.get('brigada-pwa-chrome')?.value) ?? '#FF1B8D';
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Brigada PWA',
    description: 'Progressive Web App for Brigada Digital',
    manifest: '/manifest.json',
    appleWebApp: {
      capable: true,
      title: 'Brigada',
      statusBarStyle: 'default',
    },
  };
}

export async function generateViewport(): Promise<Viewport> {
  return {
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
    interactiveWidget: 'resizes-content',
    themeColor: await chromeColor(),
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const color = await chromeColor();
  // Hoisted by React into <head>. A <script> child of the layout is not
  // executed on the client and makes the layout chunk fail to load.
  preinit('/brigada-color-scheme-init.js', { as: 'script' });
  preinit('/brigada-boot-redirect.js', { as: 'script' });
  return (
    <html
      lang="es"
      suppressHydrationWarning
      data-color-scheme="pink"
      data-chrome-color={color}
      style={
        {
          backgroundColor: color,
          '--system-chrome': color,
        } as React.CSSProperties
      }
    >
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider>
          <AuthProvider>
            <SyncProvider>
              {children}
              <InstallPrompt />
              <Toaster />
              <ServiceWorkerRegistrar />
            </SyncProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
