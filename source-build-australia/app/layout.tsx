import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Header from '@/components/Header'
import Footer from '@/components/Footer'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'Source Build Australia | Specialist Building Product Supply',
    template: '%s | Source Build Australia',
  },
  description:
    'Australia\'s specialist building product supply partner. We source premium building products direct from China and deliver them Australia-wide. You brief us, we source it, we deliver it.',
  keywords: [
    'building product supplier Australia',
    'building materials China Australia',
    'commercial building supplies',
    'residential builder supplies',
    'stone benchtops supplier',
    'aluminium windows supplier',
    'cabinetry supplier Australia',
  ],
  metadataBase: new URL('https://sourcebuildaustralia.com.au'),
  openGraph: {
    type: 'website',
    locale: 'en_AU',
    url: 'https://sourcebuildaustralia.com.au',
    siteName: 'Source Build Australia',
    title: 'Source Build Australia | Specialist Building Product Supply',
    description:
      'You brief us. We source it. We deliver it. Premium building products sourced direct from China, delivered Australia-wide.',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en-AU" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  )
}
