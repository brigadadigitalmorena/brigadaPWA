import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { normalizeHexColor } from '@/lib/pwa-manifest';
import { AuthProvider } from '@/contexts/auth.context';
import { SyncProvider } from '@/contexts/sync.context';
import { ThemeProvider } from '@/contexts/theme-context';
import { Toaster } from '@/components/ui/sonner';
import { ServiceWorkerRegistrar } from '@/components/common/service-worker-registrar';
import { InstallPrompt } from '@/components/common/install-prompt';

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
  const color = await chromeColor();
  return {
    title: 'Brigada PWA',
    description: 'Progressive Web App for Brigada Digital',
    manifest: `/manifest.json?theme_color=${encodeURIComponent(color)}`,
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
  return (
    <html
      lang="es"
      suppressHydrationWarning
      data-color-scheme="pink"
      data-chrome-color={color}
    >
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* Native tags: next/script beforeInteractive updates state during render and times out the layout chunk. */}
        <script src="/brigada-color-scheme-init.js" />
        <script src="/brigada-boot-redirect.js" />
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
