import Link from 'next/link'
import { Plus } from 'lucide-react'
import { getSupabaseServerClient } from '@/lib/supabase/server'
export const dynamic = 'force-dynamic'

export default async function AdminThemesPage() {
  const supabase = await getSupabaseServerClient()
  const { data: themes } = await supabase
    .from('debate_themes')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Temas</h1>
        <Link
          href="/admin/themes/new"
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="h-4 w-4" /> Novo tema
        </Link>
      </div>

      <div className="space-y-3">
        {(themes ?? []).map(theme => (
          <div
            key={theme.id}
            className="flex items-center gap-4 p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl"
          >
            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: theme.color }} />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">{theme.name}</p>
              <p className="text-xs text-zinc-500 truncate">{theme.description ?? '—'}</p>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full ${theme.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-zinc-100 text-zinc-500'}`}>
              {theme.is_active ? 'ativo' : 'inativo'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
