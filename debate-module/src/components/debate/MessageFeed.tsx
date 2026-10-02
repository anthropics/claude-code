'use client'

import { useEffect, useRef } from 'react'
import { MessageItem } from './MessageItem'
import type { MessageWithReactions } from '@/lib/supabase/types'

interface MessageFeedProps {
  messages: MessageWithReactions[]
  userId: string | null
  isAdmin: boolean
}

export function MessageFeed({ messages, userId, isAdmin }: MessageFeedProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const prevLengthRef = useRef(messages.length)

  useEffect(() => {
    if (messages.length > prevLengthRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
    prevLengthRef.current = messages.length
  }, [messages.length])

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-400 text-sm">
        Nenhuma mensagem ainda. Seja o primeiro a comentar!
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto py-4 space-y-1">
      {messages.map(msg => (
        <MessageItem key={msg.id} message={msg} userId={userId} isAdmin={isAdmin} />
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
