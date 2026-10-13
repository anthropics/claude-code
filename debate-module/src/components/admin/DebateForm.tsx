'use client'

import { useActionState } from 'react'
import { createDebate, updateDebate } from '@/lib/actions/debates'
import type { Debate, DebateTheme } from '@/lib/supabase/types'

interface DebateFormProps {
  themes: DebateTheme[]
  debate?: Debate
}

export function DebateForm({ themes, debate }: DebateFormProps) {
  const action = debate ? updateDebate.bind(null, debate.id) : createDebate
  const [state, formAction, pending] = useActionState(
    async (_prev: { error?: string } | null, formData: FormData) => {
      return await action(formData) ?? null
    },
    null
  )

  return (
    <form action={formAction} className="space-y-5 max-w-lg">
      {state?.error && (
        <p className="text-red-600 text-sm bg-red-50 dark:bg-red-900/20 rounded-lg px-4 py-2">{state.error}</p>
      )}

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          Tema <span className="text-red-500">*</span>
        </label>
        <select
          name="theme_id"
          defaultValue={debate?.theme_id}
          required
          className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Selecione um tema...</option>
          {themes.map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          Título <span className="text-red-500">*</span>
        </label>
        <input
          name="title"
          defaultValue={debate?.title}
          required
          className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Tema do debate..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          Descrição
        </label>
        <textarea
          name="description"
          defaultValue={debate?.description ?? ''}
          rows={3}
          className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Contexto ou pergunta central do debate..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          Data de encerramento (opcional)
        </label>
        <input
          type="datetime-local"
          name="ends_at"
          defaultValue={debate?.ends_at ? new Date(debate.ends_at).toISOString().slice(0, 16) : ''}
          className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {debate && (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="is_featured"
            name="is_featured"
            defaultChecked={debate.is_featured}
            className="rounded border-zinc-300"
          />
          <label htmlFor="is_featured" className="text-sm text-zinc-700 dark:text-zinc-300">
            Debate em destaque
          </label>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-5 py-2 text-sm font-medium transition-colors"
        >
          {pending ? 'Salvando...' : debate ? 'Atualizar debate' : 'Criar debate'}
        </button>
        <a
          href="/admin/debates"
          className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-5 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
        >
          Cancelar
        </a>
      </div>
    </form>
  )
}
