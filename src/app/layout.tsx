import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import './graphite/index.css';
import './globals.css';

import type { Metadata } from 'next';
import { ViewTransition } from 'react';
import localFont from 'next/font/local';
import { ColorSchemeScript, MantineProvider, createTheme, mantineHtmlProps } from '@mantine/core';
import { Notifications } from '@mantine/notifications';

const suit = localFont({
  src: './fonts/SUIT-Variable.woff2',
  weight: '100 900',
  display: 'swap',
  variable: '--font-suit',
});

const theme = createTheme({
  fontFamily: 'var(--font-suit), sans-serif',
  headings: { fontFamily: 'var(--font-suit), sans-serif' },
});

export const metadata: Metadata = {
  title: '문서 자동생성',
  description: 'HWP 템플릿 기반 문서 자동생성',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={suit.variable} {...mantineHtmlProps}>
      <head>
        <ColorSchemeScript defaultColorScheme="light" />
      </head>
      <body>
        <MantineProvider theme={theme} defaultColorScheme="light">
          <Notifications />
          <ViewTransition>{children}</ViewTransition>
        </MantineProvider>
      </body>
    </html>
  );
}
