import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { SpeedInsights } from "@vercel/speed-insights/next"
import { Analytics } from "@vercel/analytics/react"

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

const siteUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || process.env.VITE_FRONTEND_URL || 'https://edunook.com';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'EduNook - Modern Education Platform',
    template: '%s | EduNook',
  },
  description: 'Learn and teach with EduNook. Browse courses, create content, take assessments, and connect with educators.',
  applicationName: 'EduNook',
  authors: [{ name: 'EduNook' }],

  openGraph: {
    type: 'website',
    siteName: 'EduNook',
    title: 'EduNook - Modern Education Platform',
    description: 'Learn and teach with EduNook. Browse courses, create content, take assessments, and connect with educators.',
    url: '/',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'EduNook - Modern Education Platform',
    description: 'Learn and teach with EduNook. Browse courses, create content, take assessments, and connect with educators.',
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: '/favicon.png',
    apple: '/favicon.png',
  },
  verification: {
    google: 'rixX_Ha3Ka6W3qmOdvAoZkGYhfvJ8rNsJCURYkZ2CLU',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#050505',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const organizationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'EduNook',
    url: siteUrl,
    logo: `${siteUrl}/logo.png`,
    sameAs: [
      // Add social links here in production
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      email: 'support@edunook.com'
    }
  };

  return (
    <html lang="en" className={`${inter.variable} scroll-smooth`} data-scroll-behavior="smooth">
      <head>
        <link rel="preconnect" href="https://res.cloudinary.com" />
        <link rel="dns-prefetch" href="https://res.cloudinary.com" />
        <link rel="preconnect" href="https://identitytoolkit.googleapis.com" />
        <link rel="dns-prefetch" href="https://identitytoolkit.googleapis.com" />
        <link rel="preconnect" href="https://edunook-website.firebaseapp.com" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
      </head>
      <body className="bg-[#050505] text-white antialiased font-sans selection:bg-primary/30 selection:text-white">
        <Providers>
          {children}
          <SpeedInsights />
          <Analytics />
        </Providers>
      </body>
    </html>
  );
}
