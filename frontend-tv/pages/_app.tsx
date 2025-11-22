import Head from 'next/head';
import type { AppProps } from 'next/app';

const DEFAULT_TITLE = 'Alta WMS TV Dashboard';
const DEFAULT_DESCRIPTION = 'Alta WMS TV dashboard view';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>{DEFAULT_TITLE}</title>
        <meta name="description" content={DEFAULT_DESCRIPTION} />
        <link rel="icon" href="/logo.svg" />
        <meta name="theme-color" content="#05070d" />
      </Head>
      <Component {...pageProps} />
    </>
  );
}

