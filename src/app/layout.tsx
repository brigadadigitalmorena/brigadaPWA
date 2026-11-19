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
import { COLOR_SCHEME_STORAGE_KEY } from '@/lib/color-schemes';

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
  themeColor: '#FF1B8D',
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
          id="brigada-color-scheme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var k=${JSON.stringify(COLOR_SCHEME_STORAGE_KEY)};var v=localStorage.getItem(k);var ids=['pink','blue','purple','green','orange','red','darkElegant','indigo','teal'];if(v&&ids.indexOf(v)!==-1){document.documentElement.setAttribute('data-color-scheme',v);}var light={pink:'#FF1B8D',blue:'#0284C7',purple:'#7C3AED',green:'#16A34A',orange:'#EA580C',red:'#DC2626',darkElegant:'#111827',indigo:'#4F46E5',teal:'#14B8A6'};var dark={pink:'#FF4DA6',blue:'#38BDF8',purple:'#A78BFA',green:'#4ADE80',orange:'#FB923C',red:'#F87171',darkElegant:'#F3F4F6',indigo:'#818CF8',teal:'#2DD4BF'};var theme=localStorage.getItem('brigada-pwa-theme');var isDark=theme==='dark'||(theme!=='light'&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);var scheme=v&&ids.indexOf(v)!==-1?v:'pink';var color=(isDark?dark:light)[scheme]||'#FF1B8D';var meta=document.querySelector('meta[name="theme-color"]');if(!meta){meta=document.createElement('meta');meta.setAttribute('name','theme-color');document.head.appendChild(meta);}meta.setAttribute('content',color);}catch(e){}})();`,
          }}
        />
        <Script
          id="brigada-boot-redirect"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var p=location.pathname;var token=localStorage.getItem('brigada_access_token');var seen=localStorage.getItem('brigada_welcome_seen')==='1';var guest=seen?'/login':'/welcome';if(p==='/'||p===''){location.replace(token?'/home':guest);return;}if(p==='/home'&&!token)location.replace(guest);}catch(e){}})();`,
          }}
        />
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
