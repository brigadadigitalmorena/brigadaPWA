import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
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

export const metadata: Metadata = {
  title: 'Brigada PWA',
  description: 'Progressive Web App for Brigada Digital',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'Brigada',
    statusBarStyle: 'default',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning data-color-scheme="pink">
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
