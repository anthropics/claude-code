import { Lock, Clock } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import type { Debate, DebateTheme } from '@/lib/supabase/types'

interface DebateHeaderProps {
  debate: Debate
  theme: DebateTheme
}

const statusConfig = {
  open: { label: 'Ao vivo', className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  closed: { label: 'Encerrado', className: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400' },
  archived: { label: 'Arquivado', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' },
}

export function DebateHeader({ debate, theme }: DebateHeaderProps) {
  const { label, className } = statusConfig[debate.status]

  return (
    <div className="border-b border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-6 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: theme.color }}
            />
            <span className="text-xs text-zinc-500 truncate">{theme.name}</span>
          </div>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 leading-tight">
            {debate.title}
          </h1>
          {debate.description && (
            <p className="text-sm text-zinc-500 mt-1">{debate.description}</p>
          )}
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', className)}>
            {debate.status === 'open' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse mr-1.5" />}
            {label}
          </span>
          {debate.ends_at && debate.status === 'open' && (
            <span className="flex items-center gap-1 text-[10px] text-zinc-400">
              <Clock className="h-3 w-3" /> até {formatDate(debate.ends_at)}
            </span>
          )}
          {debate.status !== 'open' && (
            <span className="flex items-center gap-1 text-[10px] text-zinc-400">
              <Lock className="h-3 w-3" /> somente leitura
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
