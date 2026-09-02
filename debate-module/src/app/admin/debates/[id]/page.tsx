import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { MessageModerationRow } from '@/components/admin/MessageModerationRow'
export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ModerateDebatePage({ params }: Props) {
  const { id } = await params
  const supabase = await getSupabaseServerClient()
  const admin = getSupabaseAdminClient()

  const { data: debate } = await supabase.from('debates').select('*, debate_themes(name)').eq('id', id).single()
  if (!debate) notFound()

  // Admin sees hidden messages too
  const { data: messages } = await admin
    .from('messages')
    .select('*, profiles(id, display_name, avatar_url)')
    .eq('debate_id', id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(100)

  const theme = debate.debate_themes as { name: string }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/debates" className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold">{debate.title}</h1>
          <p className="text-sm text-zinc-500">{theme.name} · Moderação de mensagens</p>
        </div>
      </div>

      <div className="space-y-3">
        {(messages ?? []).length === 0 ? (
          <p className="text-center text-zinc-400 py-10 text-sm">Nenhuma mensagem neste debate.</p>
        ) : (
          (messages ?? []).map(msg => (
            <MessageModerationRow key={msg.id} message={msg as never} />
          ))
        )}
      </div>
    </div>
  )
}
