'use client'

import { useTransition } from 'react'
import { assignRole, revokeRole } from '@/lib/actions/roles'
import { UserAvatar } from '@/components/shared/UserAvatar'

interface UserEntry {
  id: string
  email: string
  display_name: string | null
  avatar_url: string | null
  roles: ('admin' | 'moderator')[]
}

interface UserRoleManagerProps {
  users: UserEntry[]
}

export function UserRoleManager({ users }: UserRoleManagerProps) {
  const [isPending, startTransition] = useTransition()

  function toggleRole(userId: string, role: 'admin' | 'moderator', hasRole: boolean) {
    startTransition(() => {
      if (hasRole) {
        revokeRole(userId, role)
      } else {
        assignRole(userId, role)
      }
    })
  }

  return (
    <div className="space-y-3">
      {users.map(user => {
        const isAdmin = user.roles.includes('admin')
        const isMod = user.roles.includes('moderator')
        return (
          <div
            key={user.id}
            className="flex items-center gap-4 p-4 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900"
          >
            <UserAvatar name={user.display_name} avatarUrl={user.avatar_url} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                {user.display_name ?? user.email}
              </p>
              <p className="text-xs text-zinc-400 truncate">{user.email}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              {(['moderator', 'admin'] as const).map(role => {
                const active = role === 'admin' ? isAdmin : isMod
                return (
                  <button
                    key={role}
                    disabled={isPending}
                    onClick={() => toggleRole(user.id, role, active)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      active
                        ? 'bg-indigo-600 text-white'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                    }`}
                  >
                    {role}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
