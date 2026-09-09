import { cn } from '@/lib/utils'

interface UserAvatarProps {
  name: string | null
  avatarUrl?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeMap = { sm: 'h-7 w-7 text-xs', md: 'h-9 w-9 text-sm', lg: 'h-12 w-12 text-base' }

export function UserAvatar({ name, avatarUrl, size = 'md', className }: UserAvatarProps) {
  const initials = name
    ? name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name ?? 'usuário'}
        className={cn('rounded-full object-cover', sizeMap[size], className)}
      />
    )
  }

  return (
    <div
      className={cn(
        'rounded-full bg-indigo-500 text-white flex items-center justify-center font-medium',
        sizeMap[size],
        className
      )}
    >
      {initials}
    </div>
  )
}
