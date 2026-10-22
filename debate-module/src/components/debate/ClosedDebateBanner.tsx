import { Lock } from 'lucide-react'

export function ClosedDebateBanner() {
  return (
    <div className="border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 px-6 py-4">
      <div className="flex items-center gap-3 text-zinc-500 dark:text-zinc-400">
        <Lock className="h-4 w-4 shrink-0" />
        <p className="text-sm">
          Este debate foi encerrado. O histórico está disponível para leitura.
        </p>
      </div>
    </div>
  )
}
