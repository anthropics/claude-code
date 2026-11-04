import { DebateCard } from './DebateCard'
import type { Debate } from '@/lib/supabase/types'

interface DebateListProps {
  debates: (Debate & { message_count: number })[]
  themeSlug: string
}

export function DebateList({ debates, themeSlug }: DebateListProps) {
  if (debates.length === 0) {
    return (
      <div className="text-center py-16 text-zinc-400 text-sm">
        Nenhum debate neste tema ainda.
      </div>
    )
  }

  const open = debates.filter(d => d.status === 'open')
  const others = debates.filter(d => d.status !== 'open')

  return (
    <div className="space-y-6">
      {open.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
            Ao vivo agora
          </h2>
          <div className="space-y-3">
            {open.map(d => (
              <DebateCard key={d.id} debate={d} themeSlug={themeSlug} messageCount={d.message_count} />
            ))}
          </div>
        </section>
      )}
      {others.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
            Histórico
          </h2>
          <div className="space-y-3">
            {others.map(d => (
              <DebateCard key={d.id} debate={d} themeSlug={themeSlug} messageCount={d.message_count} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
