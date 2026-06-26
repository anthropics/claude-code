import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Plus } from 'lucide-react'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { DebateList } from '@/components/debates/DebateList'
export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ themeSlug: string }>
}

export default async function ThemePage({ params }: Props) {
  const { themeSlug } = await params
  const supabase = await getSupabaseServerClient()

  const { data: theme } = await supabase
    .from('debate_themes')
    .select('*')
    .eq('slug', themeSlug)
    .eq('is_active', true)
    .single()

  if (!theme) notFound()

  const { data: debates } = await supabase
    .from('debates')
    .select('*')
    .eq('theme_id', theme.id)
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

  const debatesWithCount = (debates ?? []).map(d => ({
    ...d,
    message_count: countMap[d.id] ?? 0,
  }))

  return (
    <div className="min-h-screen">
      <header className="border-b border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link href="/debates" className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div
            className="w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: theme.color }}
          />
          <h1 className="font-semibold">{theme.name}</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        {theme.description && (
          <p className="text-zinc-500 text-sm mb-6">{theme.description}</p>
        )}
        <DebateList debates={debatesWithCount} themeSlug={themeSlug} />
      </main>
    </div>
  )
}
