import Link from 'next/link'
import { Plus } from 'lucide-react'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { updateDebateStatus } from '@/lib/actions/debates'
import { cn } from '@/lib/utils'
export const dynamic = 'force-dynamic'

const statusLabels = { open: 'Ao vivo', closed: 'Encerrado', archived: 'Arquivado' }
const statusStyles = {
  open: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  closed: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
  archived: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
}

export default async function AdminDebatesPage() {
  const supabase = await getSupabaseServerClient()
  const { data: debates } = await supabase
    .from('debates')
    .select('*, debate_themes(name, color)')
    .order('created_at', { ascending: false })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Debates</h1>
        <Link
          href="/admin/debates/new"
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="h-4 w-4" /> Novo debate
        </Link>
      </div>

      <div className="space-y-3">
        {(debates ?? []).map(debate => {
          const theme = debate.debate_themes as { name: string; color: string }
          return (
            <div
              key={debate.id}
              className="flex items-start gap-4 p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl"
            >
              <div className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: theme.color }} />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{debate.title}</p>
                <p className="text-xs text-zinc-400 mt-0.5">{theme.name}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', statusStyles[debate.status as keyof typeof statusStyles])}>
                  {statusLabels[debate.status as keyof typeof statusLabels]}
                </span>

                {debate.status === 'open' && (
                  <form action={async () => { await updateDebateStatus(debate.id, 'closed') }}>
                    <button type="submit" className="text-xs text-zinc-500 hover:text-red-600 underline">
                      Encerrar
                    </button>
                  </form>
                )}
                {debate.status === 'closed' && (
                  <form action={async () => { await updateDebateStatus(debate.id, 'archived') }}>
                    <button type="submit" className="text-xs text-zinc-500 hover:text-amber-600 underline">
                      Arquivar
                    </button>
                  </form>
                )}

                <Link
                  href={`/admin/debates/${debate.id}`}
                  className="text-xs text-indigo-600 hover:underline"
                >
                  Moderar
                </Link>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
