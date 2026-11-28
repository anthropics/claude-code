import { ThemeCard } from './ThemeCard'
import type { DebateTheme } from '@/lib/supabase/types'

interface ThemeGridProps {
  themes: (DebateTheme & { debate_count: number })[]
}

export function ThemeGrid({ themes }: ThemeGridProps) {
  if (themes.length === 0) {
    return (
      <div className="text-center py-20 text-zinc-400">
        Nenhum tema disponível ainda.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {themes.map(theme => (
        <ThemeCard key={theme.id} theme={theme} debateCount={theme.debate_count} />
      ))}
    </div>
  )
}
