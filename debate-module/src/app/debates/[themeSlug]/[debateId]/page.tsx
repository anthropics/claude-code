import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { DebateHeader } from '@/components/debate/DebateHeader'
import { DebateRoom } from '@/components/debate/DebateRoom'
export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ themeSlug: string; debateId: string }>
}

export default async function DebatePage({ params }: Props) {
  const { themeSlug, debateId } = await params
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: debate } = await supabase
    .from('debates')
    .select('*, debate_themes(*)')
    .eq('id', debateId)
    .single()

  if (!debate) notFound()

  const theme = (debate as { debate_themes: typeof debate }['debate_themes'])

  // Initial messages (last 50)
  const { data: messages } = await supabase
    .from('messages')
    .select('*, profiles(id, display_name, avatar_url)')
    .eq('debate_id', debateId)
    .eq('is_hidden', false)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(50)

  const initialMessages = (messages ?? []).reverse()

  // Reactions for these messages
  const messageIds = initialMessages.map(m => m.id)
  const { data: reactions } = messageIds.length
    ? await supabase.from('reactions').select('*').in('message_id', messageIds)
    : { data: [] }

  // Check if user is admin/moderator
  let isAdmin = false
  if (user) {
    const { data: role } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['admin', 'moderator'])
      .single()
    isAdmin = !!role
  }

  return (
    <div className="flex flex-col h-screen">
      <div className="border-b border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 flex items-center gap-2">
        <Link href={`/debates/${themeSlug}`} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300">
          <ChevronLeft className="h-5 w-5" />
        </Link>
      </div>

      <DebateHeader debate={debate} theme={theme as never} />

      <div className="flex-1 overflow-hidden">
        <DebateRoom
          debateId={debateId}
          status={debate.status as 'open' | 'closed' | 'archived'}
          initialMessages={initialMessages as never}
          initialReactions={reactions ?? []}
          userId={user?.id ?? null}
          isAdmin={isAdmin}
        />
      </div>
    </div>
  )
}
