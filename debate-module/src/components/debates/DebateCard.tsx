import Link from 'next/link'
import { Users, Clock } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import type { Debate } from '@/lib/supabase/types'

interface DebateCardProps {
  debate: Debate
  themeSlug: string
  messageCount: number
}

const statusStyles = {
  open: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  closed: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
  archived: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
}

const statusLabels = { open: 'Ao vivo', closed: 'Encerrado', archived: 'Arquivado' }

export function DebateCard({ debate, themeSlug, messageCount }: DebateCardProps) {
  return (
    <Link
      href={`/debates/${themeSlug}/${debate.id}`}
      className="group block rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5 hover:shadow-md hover:border-zinc-300 dark:hover:border-zinc-600 transition-all"
    >
      <div className="flex items-start justify-between gap-4 mb-3">
        <h3 className="font-medium text-zinc-900 dark:text-zinc-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors leading-snug">
          {debate.title}
        </h3>
        <span className={cn('text-xs px-2 py-0.5 rounded-full shrink-0 font-medium', statusStyles[debate.status])}>
          {debate.status === 'open' && (
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse mr-1.5" />
          )}
          {statusLabels[debate.status]}
        </span>
      </div>

      {debate.description && (
        <p className="text-sm text-zinc-500 line-clamp-2 mb-3">{debate.description}</p>
      )}

      <div className="flex items-center gap-4 text-xs text-zinc-400">
        <span className="flex items-center gap-1">
          <Users className="h-3.5 w-3.5" /> {messageCount} mensagens
        </span>
        {debate.ends_at && debate.status === 'open' && (
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" /> até {formatDate(debate.ends_at)}
          </span>
        )}
      </div>
    </Link>
  )
}
