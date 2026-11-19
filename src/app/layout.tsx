import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Script from 'next/script';
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
        <Script
          src="/brigada-color-scheme-init.js"
          strategy="beforeInteractive"
        />
        <Script src="/brigada-boot-redirect.js" strategy="beforeInteractive" />
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
