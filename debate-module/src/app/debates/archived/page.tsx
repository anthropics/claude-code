import Link from 'next/link'
import { ChevronLeft, Archive } from 'lucide-react'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { DebateCard } from '@/components/debates/DebateCard'
export const dynamic = 'force-dynamic'

export default async function ArchivedPage() {
  const supabase = await getSupabaseServerClient()

  const { data: debates } = await supabase
    .from('debates')
    .select('*, debate_themes(slug)')
    .in('status', ['closed', 'archived'])
    .order('created_at', { ascending: false })

  const { data: msgCounts } = await supabase
    .from('messages')
    .select('debate_id')
    .is('deleted_at', null)
    .eq('is_hidden', false)

  const countMap: Record<string, number> = {}
  for (const row of msgCounts ?? []) {
    countMap[row.debate_id] = (countMap[row.debate_id] || 0) + 1
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link href="/debates" className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <Archive className="h-5 w-5 text-zinc-500" />
          <h1 className="font-semibold">Debates Arquivados</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        {(debates ?? []).length === 0 ? (
          <p className="text-center text-zinc-400 py-16 text-sm">Nenhum debate arquivado.</p>
        ) : (
          <div className="space-y-3">
            {(debates ?? []).map(d => (
              <DebateCard
                key={d.id}
                debate={d}
                themeSlug={(d.debate_themes as { slug: string }).slug}
                messageCount={countMap[d.id] ?? 0}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
