'use client'

import { useTransition } from 'react'
import { Eye, EyeOff, Trash2 } from 'lucide-react'
import { hideMessage, restoreMessage, deleteMessage } from '@/lib/actions/messages'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { formatDate } from '@/lib/utils'
import type { Message } from '@/lib/supabase/types'

interface MessageModerationRowProps {
  message: Message & { profiles?: { display_name: string | null; avatar_url: string | null } }
}

export function MessageModerationRow({ message }: MessageModerationRowProps) {
  const [isPending, startTransition] = useTransition()

  return (
    <div className="flex items-start gap-3 p-4 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900">
      <UserAvatar name={message.profiles?.display_name ?? null} avatarUrl={message.profiles?.avatar_url} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {message.profiles?.display_name ?? 'Usuário'}
          </span>
          <span className="text-xs text-zinc-400">{formatDate(message.created_at)}</span>
          {message.is_hidden && (
            <span className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 px-2 py-0.5 rounded-full">
              oculto
            </span>
          )}
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 break-words">{message.content}</p>
      </div>
      <div className="flex gap-1 shrink-0">
        {message.is_hidden ? (
          <button
            disabled={isPending}
            onClick={() => startTransition(async () => { await restoreMessage(message.id) })}
            title="Restaurar mensagem"
            className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-green-600 transition-colors"
          >
            <Eye className="h-4 w-4" />
          </button>
        ) : (
          <button
            disabled={isPending}
            onClick={() => startTransition(async () => { await hideMessage(message.id) })}
            title="Ocultar mensagem"
            className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-amber-600 transition-colors"
          >
            <EyeOff className="h-4 w-4" />
          </button>
        )}
        <button
          disabled={isPending}
          onClick={() => startTransition(async () => { await deleteMessage(message.id) })}
          title="Deletar permanentemente"
          className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-red-600 transition-colors"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
