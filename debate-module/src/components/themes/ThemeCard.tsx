import Link from 'next/link'
import { MessageSquare } from 'lucide-react'
import type { DebateTheme } from '@/lib/supabase/types'

interface ThemeCardProps {
  theme: DebateTheme
  debateCount: number
}

export function ThemeCard({ theme, debateCount }: ThemeCardProps) {
  return (
    <Link
      href={`/debates/${theme.slug}`}
      className="group block rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-6 hover:shadow-md hover:border-zinc-300 dark:hover:border-zinc-600 transition-all"
    >
      <div
        className="w-10 h-10 rounded-xl mb-4 flex items-center justify-center"
        style={{ backgroundColor: `${theme.color}20` }}
      >
        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: theme.color }} />
      </div>
      <h2 className="font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
        {theme.name}
      </h2>
      {theme.description && (
        <p className="text-sm text-zinc-500 mt-1 line-clamp-2">{theme.description}</p>
      )}
      <div className="flex items-center gap-1.5 mt-4 text-xs text-zinc-400">
        <MessageSquare className="h-3.5 w-3.5" />
        {debateCount} {debateCount === 1 ? 'debate' : 'debates'}
      </div>
    </Link>
  )
}
