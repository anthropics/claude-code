import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import { SupabaseProvider } from '@/components/shared/SupabaseProvider'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Chat de Debates',
  description: 'Participe de debates temáticos com outros assinantes',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
        <SupabaseProvider>{children}</SupabaseProvider>
      </body>
    </html>
  )
}
