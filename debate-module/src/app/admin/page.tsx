import { getSupabaseServerClient } from '@/lib/supabase/server'
import { MessageSquare, Tags, Users, TrendingUp } from 'lucide-react'
export const dynamic = 'force-dynamic'

export default async function AdminDashboard() {
  const supabase = await getSupabaseServerClient()

  const [{ count: themeCount }, { count: debateCount }, { count: msgCount }, { count: userCount }] =
    await Promise.all([
      supabase.from('debate_themes').select('*', { count: 'exact', head: true }),
      supabase.from('debates').select('*', { count: 'exact', head: true }),
      supabase.from('messages').select('*', { count: 'exact', head: true }).is('deleted_at', null).eq('is_hidden', false),
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
    ])

  const stats = [
    { label: 'Temas', value: themeCount ?? 0, icon: Tags, color: 'text-indigo-600' },
    { label: 'Debates', value: debateCount ?? 0, icon: MessageSquare, color: 'text-green-600' },
    { label: 'Mensagens', value: msgCount ?? 0, icon: TrendingUp, color: 'text-amber-600' },
    { label: 'Usuários', value: userCount ?? 0, icon: Users, color: 'text-pink-600' },
  ]

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">Dashboard</h1>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-5">
            <Icon className={`h-5 w-5 mb-3 ${color}`} />
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-sm text-zinc-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
