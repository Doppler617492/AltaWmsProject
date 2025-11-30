import React from 'react';
import Head from 'next/head';
import type { AppProps } from 'next/app';
import ErrorBoundary from '../components/ErrorBoundary';
import { logger } from '../lib/logger';

const DEFAULT_TITLE = process.env.NEXT_PUBLIC_APP_TITLE || 'Alta WMS PWA';
const DEFAULT_DESCRIPTION = process.env.NEXT_PUBLIC_APP_DESCRIPTION || 'Alta WMS Progressive Web App';

export default function App({ Component, pageProps }: AppProps) {
  // Initialize error logging for PWA
  React.useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      logger.error('Unhandled promise rejection', { reason: event.reason }, 'PWA-App');
    };
    
    const handleError = (event: ErrorEvent) => {
      logger.error('Unhandled error', { error: event.error, message: event.message }, 'PWA-App');
    };
    
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleError);
    
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleError);
    };
  }, []);

  return (
    <ErrorBoundary>
      <Head>
        <title>{DEFAULT_TITLE || 'Alta WMS PWA'}</title>
        <meta name="description" content={DEFAULT_DESCRIPTION || 'Alta WMS Progressive Web App'} />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link rel="icon" href="/logo.svg" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192x192.png" />
        <meta name="theme-color" content="#05070d" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Alta WMS" />
        <meta name="msapplication-TileColor" content="#05070d" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
      </Head>
      <script
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: `
            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.register('/sw.js').catch(() => {});
            }
          `,
        }}
      />
      <script
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: `
          (function(){
            var s=document.createElement('script');
            s.src='https://unpkg.com/@lottiefiles/lottie-player@latest/dist/lottie-player.js';
            s.defer=true; document.head.appendChild(s);
          })();
        ` }}
      />
      <script
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: `
          (function(){
            // Load Socket.IO client for real-time notifications
            var si=document.createElement('script');
            si.src='https://cdn.socket.io/4.7.5/socket.io.min.js';
            si.defer=true; document.head.appendChild(si);
          })();
        ` }}
      />
      <style jsx global>{`
        html, body, #__next { height: 100%; }
        body { 
          background: linear-gradient(180deg, #05070d 0%, #020304 100%);
          color: #fff; 
          -webkit-tap-highlight-color: transparent; 
        }
        * { -webkit-touch-callout: none; -webkit-user-select: none; user-select: none; }
        button { min-height: 70px; }
        .focus-ring:focus { outline: 2px solid #ffffff; outline-offset: 2px; box-shadow: 0 0 0 3px rgba(255,195,0,0.35); }
        
        /* Animation for spinning loader */
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
      <Component {...pageProps} />
    </ErrorBoundary>
  );
}

// Register SW and capture install prompt
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(()=>{});
    }
  });
  window.addEventListener('beforeinstallprompt', (e: any) => {
    e.preventDefault();
    (window as any).__pwaInstallPrompt = e;
    const evt = new CustomEvent('pwa-install-available');
    window.dispatchEvent(evt);
  });
}
