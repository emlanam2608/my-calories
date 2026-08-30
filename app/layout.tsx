import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://nourishwell-private.akirathanhnam.chatgpt.site'),
  title: 'Nourishwell — Private Nutrition & Movement Support',
  description: 'Review-first private meal, measurement, and movement tracking.',
  openGraph: {
    title: 'Nourishwell',
    description: 'Private nutrition & movement support',
    type: 'website',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Nourishwell — Private nutrition and movement support' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nourishwell',
    description: 'Private nutrition & movement support',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
