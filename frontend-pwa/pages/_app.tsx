import Head from 'next/head';
import type { AppProps } from 'next/app';

const DEFAULT_TITLE = 'Alta WMS PWA';
const DEFAULT_DESCRIPTION = 'Alta WMS Progressive Web App';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>{DEFAULT_TITLE}</title>
        <meta name="description" content={DEFAULT_DESCRIPTION} />
        <link rel="icon" href="/logo.svg" />
        <meta name="theme-color" content="#05070d" />
      </Head>
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
      `}</style>
      <Component {...pageProps} />
    </>
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
