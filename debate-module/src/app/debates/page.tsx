import Link from 'next/link'
import { MessageSquare, LogOut } from 'lucide-react'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { ThemeGrid } from '@/components/themes/ThemeGrid'
export const dynamic = 'force-dynamic'

export default async function DebatesPage() {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: themes } = await supabase
    .from('debate_themes')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  // Count debates per theme
  const { data: counts } = await supabase
    .from('debates')
    .select('theme_id')

  const countMap: Record<string, number> = {}
  for (const row of counts ?? []) {
    countMap[row.theme_id] = (countMap[row.theme_id] || 0) + 1
  }

  const themesWithCount = (themes ?? []).map(t => ({
    ...t,
    debate_count: countMap[t.id] ?? 0,
  }))

  return (
    <div className="min-h-screen">
      <header className="border-b border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-indigo-600" />
            <span className="font-semibold">Chat de Debates</span>
          </div>
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <span className="text-sm text-zinc-500 hidden sm:block">{user.email}</span>
                <form action="/auth/signout" method="POST">
                  <button className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
                    <LogOut className="h-4 w-4" /> Sair
                  </button>
                </form>
              </>
            ) : (
              <Link href="/auth/login" className="text-sm text-indigo-600 hover:underline font-medium">
                Entrar
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Temas de Debate</h1>
          <p className="text-zinc-500 mt-1">Escolha um tema e participe da conversa.</p>
        </div>
        <ThemeGrid themes={themesWithCount} />
      </main>
    </div>
  )
}
