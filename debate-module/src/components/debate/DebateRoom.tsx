'use client'

import { useDebateRoom } from '@/lib/hooks/useDebateRoom'
import { MessageFeed } from './MessageFeed'
import { MessageComposer } from './MessageComposer'
import { ClosedDebateBanner } from './ClosedDebateBanner'
import type { Message, Reaction } from '@/lib/supabase/types'

interface DebateRoomProps {
  debateId: string
  status: 'open' | 'closed' | 'archived'
  initialMessages: Message[]
  initialReactions: Reaction[]
  userId: string | null
  isAdmin: boolean
}

export function DebateRoom({
  debateId,
  status,
  initialMessages,
  initialReactions,
  userId,
  isAdmin,
}: DebateRoomProps) {
  const { messages } = useDebateRoom(debateId, initialMessages, initialReactions, userId)

  return (
    <div className="flex flex-col h-full">
      <MessageFeed messages={messages} userId={userId} isAdmin={isAdmin} />
      {status === 'open' && userId ? (
        <MessageComposer debateId={debateId} />
      ) : status === 'open' && !userId ? (
        <div className="border-t border-zinc-200 dark:border-zinc-700 px-6 py-4 bg-zinc-50 dark:bg-zinc-800/50 text-sm text-center text-zinc-500">
          <a href="/auth/login" className="text-indigo-600 hover:underline font-medium">Faça login</a>{' '}
          para participar do debate.
        </div>
      ) : (
        <ClosedDebateBanner />
      )}
    </div>
  )
}
