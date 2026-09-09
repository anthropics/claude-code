import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { LayoutDashboard, Tags, MessageSquare, Users } from 'lucide-react'
export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login?next=/admin')

  const { data: role } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .maybeSingle()

  if (!role) redirect('/debates')

  const navItems = [
    { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/themes', label: 'Temas', icon: Tags },
    { href: '/admin/debates', label: 'Debates', icon: MessageSquare },
    { href: '/admin/users', label: 'Usuários', icon: Users },
  ]

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 flex flex-col">
        <div className="px-5 py-5 border-b border-zinc-200 dark:border-zinc-700">
          <p className="font-semibold text-sm">Painel Admin</p>
          <p className="text-xs text-zinc-500 truncate mt-0.5">{user.email}</p>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="px-3 pb-4">
          <Link
            href="/debates"
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            ← Voltar ao chat
          </Link>
        </div>
      </aside>
      <main className="flex-1 overflow-auto bg-zinc-50 dark:bg-zinc-950 p-8">
        {children}
      </main>
    </div>
  )
}
