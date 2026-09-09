import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { UserRoleManager } from '@/components/admin/UserRoleManager'
export const dynamic = 'force-dynamic'

export default async function AdminUsersPage() {
  const supabase = await getSupabaseServerClient()
  const admin = getSupabaseAdminClient()

  // Get all auth users (admin only)
  const { data: authUsersData } = await admin.auth.admin.listUsers()
  const authUsers = authUsersData?.users ?? []

  const { data: profiles } = await supabase.from('profiles').select('*')
  const { data: roles } = await supabase.from('user_roles').select('*')

  type ProfileRow = { id: string; display_name: string | null; avatar_url: string | null; updated_at: string }
  const profileMap: Record<string, ProfileRow> = {}
  for (const p of profiles ?? []) profileMap[p.id] = p as ProfileRow

  const roleMap: Record<string, ('admin' | 'moderator')[]> = {}
  for (const r of roles ?? []) {
    if (!roleMap[r.user_id]) roleMap[r.user_id] = []
    roleMap[r.user_id].push(r.role as 'admin' | 'moderator')
  }

  const users = authUsers.map(u => ({
    id: u.id,
    email: u.email ?? '',
    display_name: profileMap[u.id]?.display_name ?? null,
    avatar_url: profileMap[u.id]?.avatar_url ?? null,
    roles: roleMap[u.id] ?? [],
  }))

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">Gerenciar Usuários</h1>
      <UserRoleManager users={users} />
    </div>
  )
}
