'use client'

import { useState, useTransition } from 'react'
import { MoreVertical, EyeOff, Trash2 } from 'lucide-react'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { RelativeTime } from '@/components/shared/RelativeTime'
import { ReactionBar } from './ReactionBar'
import { hideMessage, deleteMessage } from '@/lib/actions/messages'
import { cn } from '@/lib/utils'
import type { MessageWithReactions } from '@/lib/supabase/types'

interface MessageItemProps {
  message: MessageWithReactions
  userId: string | null
  isAdmin: boolean
}

export function MessageItem({ message, userId, isAdmin }: MessageItemProps) {
  const [showMenu, setShowMenu] = useState(false)
  const [isPending, startTransition] = useTransition()
  const profile = message.profiles
  const isOwn = message.user_id === userId

  return (
    <div
      className={cn(
        'flex gap-3 group px-4 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 rounded-lg transition-colors',
        isOwn && 'flex-row-reverse'
      )}
    >
      <UserAvatar
        name={profile?.display_name ?? null}
        avatarUrl={profile?.avatar_url}
        size="sm"
        className="shrink-0 mt-0.5"
      />

      <div className={cn('flex flex-col max-w-[70%]', isOwn && 'items-end')}>
        <div className="flex items-baseline gap-2 mb-0.5">
          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            {profile?.display_name ?? 'Usuário'}
          </span>
          <span className="text-[10px] text-zinc-400">
            <RelativeTime date={message.created_at} />
          </span>
        </div>

        <div
          className={cn(
            'rounded-2xl px-4 py-2 text-sm break-words',
            isOwn
              ? 'bg-indigo-600 text-white rounded-tr-sm'
              : 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm rounded-tl-sm'
          )}
        >
          {message.content}
        </div>

        <ReactionBar
          messageId={message.id}
          counts={message.reactionCounts}
          userReactions={message.userReactions}
          isAuthenticated={!!userId}
        />
      </div>

      {isAdmin && (
        <div className="relative self-start opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => setShowMenu(v => !v)}
            className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700"
          >
            <MoreVertical className="h-4 w-4 text-zinc-500" />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-6 z-10 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg min-w-32 py-1">
              <button
                disabled={isPending}
                onClick={() => {
                  setShowMenu(false)
                  startTransition(async () => { await hideMessage(message.id) })
                }}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700"
              >
                <EyeOff className="h-3.5 w-3.5" /> Ocultar
              </button>
              <button
                disabled={isPending}
                onClick={() => {
                  setShowMenu(false)
                  startTransition(async () => { await deleteMessage(message.id) })
                }}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-red-600 hover:bg-zinc-100 dark:hover:bg-zinc-700"
              >
                <Trash2 className="h-3.5 w-3.5" /> Deletar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
