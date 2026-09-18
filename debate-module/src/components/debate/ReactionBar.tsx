'use client'

import { useTransition } from 'react'
import { ThumbsUp, Lightbulb, ThumbsDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toggleReaction } from '@/lib/actions/messages'
import type { ReactionType } from '@/lib/supabase/types'

interface ReactionBarProps {
  messageId: string
  counts: Record<ReactionType, number>
  userReactions: ReactionType[]
  isAuthenticated: boolean
}

const REACTIONS: { type: ReactionType; icon: typeof ThumbsUp; label: string }[] = [
  { type: 'like', icon: ThumbsUp, label: 'Curtir' },
  { type: 'insightful', icon: Lightbulb, label: 'Perspicaz' },
  { type: 'disagree', icon: ThumbsDown, label: 'Discordar' },
]

export function ReactionBar({ messageId, counts, userReactions, isAuthenticated }: ReactionBarProps) {
  const [isPending, startTransition] = useTransition()

  function handleReaction(type: ReactionType) {
    if (!isAuthenticated) return
    startTransition(async () => { await toggleReaction(messageId, type) })
  }

  return (
    <div className="flex items-center gap-1 mt-1">
      {REACTIONS.map(({ type, icon: Icon, label }) => {
        const active = userReactions.includes(type)
        const count = counts[type] || 0
        return (
          <button
            key={type}
            onClick={() => handleReaction(type)}
            disabled={!isAuthenticated || isPending}
            title={label}
            className={cn(
              'flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition-colors',
              active
                ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300'
                : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800',
              !isAuthenticated && 'cursor-default'
            )}
          >
            <Icon className="h-3 w-3" />
            {count > 0 && <span>{count}</span>}
          </button>
        )
      })}
    </div>
  )
}
