'use client'

import { useActionState } from 'react'
import { createTheme, updateTheme } from '@/lib/actions/themes'
import type { DebateTheme } from '@/lib/supabase/types'

interface ThemeFormProps {
  theme?: DebateTheme
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#0ea5e9', '#ec4899', '#14b8a6']

export function ThemeForm({ theme }: ThemeFormProps) {
  const action = theme ? updateTheme.bind(null, theme.id) : createTheme
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
          Nome do tema <span className="text-red-500">*</span>
        </label>
        <input
          name="name"
          defaultValue={theme?.name}
          required
          className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Ex: Política, Tecnologia, Economia..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          Descrição
        </label>
        <textarea
          name="description"
          defaultValue={theme?.description ?? ''}
          rows={3}
          className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Descrição opcional do tema..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
          Cor
        </label>
        <div className="flex gap-2 flex-wrap">
          {COLORS.map(color => (
            <label key={color} className="cursor-pointer">
              <input type="radio" name="color" value={color} defaultChecked={theme?.color === color || (!theme && color === '#6366f1')} className="sr-only peer" />
              <span
                className="block w-8 h-8 rounded-full ring-2 ring-offset-2 ring-transparent peer-checked:ring-zinc-900 dark:peer-checked:ring-white transition-all"
                style={{ backgroundColor: color }}
              />
            </label>
          ))}
        </div>
      </div>

      {theme && (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="is_active"
            name="is_active"
            defaultChecked={theme.is_active}
            className="rounded border-zinc-300"
          />
          <label htmlFor="is_active" className="text-sm text-zinc-700 dark:text-zinc-300">
            Tema ativo (visível publicamente)
          </label>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-5 py-2 text-sm font-medium transition-colors"
        >
          {pending ? 'Salvando...' : theme ? 'Atualizar tema' : 'Criar tema'}
        </button>
        <a
          href="/admin/themes"
          className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-5 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
        >
          Cancelar
        </a>
      </div>
    </form>
  )
}
