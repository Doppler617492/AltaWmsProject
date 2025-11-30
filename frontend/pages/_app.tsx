import React from 'react';
import { AppProps } from 'next/app';
import Head from 'next/head';
import ErrorBoundary from '../components/ErrorBoundary';
import { logger } from '../lib/logger';
import '../styles/globals.css';

export default function App({ Component, pageProps }: AppProps) {
  // Initialize error logging
  React.useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      logger.error('Unhandled promise rejection', { reason: event.reason }, 'App');
    };
    
    const handleError = (event: ErrorEvent) => {
      logger.error('Unhandled error', { error: event.error, message: event.message }, 'App');
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
        <title>Alta WMS</title>
        <meta name="description" content="Alta Warehouse Management System" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <script
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: `
            (function(){
              if (typeof window === 'undefined') return;
              if (document.querySelector('script[data-socket-io-admin]')) return;
              var si=document.createElement('script');
              si.src='https://cdn.socket.io/4.7.5/socket.io.min.js';
              si.defer=true;
              si.setAttribute('data-socket-io-admin','true');
              document.head.appendChild(si);
            })();
          `,
        }}
      />
      <script
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: `window.__TV_KIOSK_TOKEN=${JSON.stringify(process.env.NEXT_PUBLIC_TV_KIOSK_TOKEN || '')};`,
        }}
      />
      <Component {...pageProps} />
    </ErrorBoundary>
  );
}
