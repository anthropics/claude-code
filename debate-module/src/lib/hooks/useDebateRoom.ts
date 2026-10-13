'use client'

import { useEffect, useRef, useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import type { Message, Reaction, ReactionType, MessageWithReactions } from '@/lib/supabase/types'

function buildMessageWithReactions(
  msg: Message,
  reactions: Reaction[],
  userId: string | null
): MessageWithReactions {
  const msgReactions = reactions.filter(r => r.message_id === msg.id)
  const counts: Record<ReactionType, number> = { like: 0, insightful: 0, disagree: 0 }
  const userReactions: ReactionType[] = []

  for (const r of msgReactions) {
    counts[r.type] = (counts[r.type] || 0) + 1
    if (r.user_id === userId) userReactions.push(r.type)
  }

  return { ...msg, reactionCounts: counts, userReactions }
}

export function useDebateRoom(
  debateId: string,
  initialMessages: Message[],
  initialReactions: Reaction[],
  userId: string | null
) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [reactions, setReactions] = useState<Reaction[]>(initialReactions)
  const channelRef = useRef<ReturnType<ReturnType<typeof getSupabaseBrowserClient>['channel']> | null>(null)

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()

    channelRef.current = supabase
      .channel(`debate:${debateId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `debate_id=eq.${debateId}` },
        async (payload: { new: Record<string, unknown> }) => {
          const newMsg = payload.new as unknown as Message
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', newMsg.user_id)
            .single()
          setMessages(prev => [...prev, { ...newMsg, profiles: profile ?? undefined }])
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages' },
        (payload: { old: Record<string, unknown> }) => {
          setMessages(prev => prev.filter(m => m.id !== (payload.old as unknown as Message).id))
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `debate_id=eq.${debateId}` },
        (payload: { new: Record<string, unknown> }) => {
          const updated = payload.new as unknown as Message
          if (updated.is_hidden) {
            setMessages(prev => prev.filter(m => m.id !== updated.id))
          } else {
            setMessages(prev => prev.map(m => m.id === updated.id ? { ...m, ...updated } : m))
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'reactions' },
        (payload: { new: Record<string, unknown> }) => {
          const newReaction = payload.new as unknown as Reaction
          setReactions(prev => {
            if (prev.some(r => r.id === newReaction.id)) return prev
            return [...prev, newReaction]
          })
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'reactions' },
        (payload: { old: Record<string, unknown> }) => {
          setReactions(prev => prev.filter(r => r.id !== (payload.old as unknown as Reaction).id))
        }
      )
      .subscribe()

    return () => {
      channelRef.current?.unsubscribe()
    }
  }, [debateId])

  const messagesWithReactions = messages.map(m =>
    buildMessageWithReactions(m, reactions, userId)
  )

  return { messages: messagesWithReactions }
}
