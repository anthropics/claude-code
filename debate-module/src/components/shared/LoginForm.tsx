'use client'

import { useState, useTransition } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { MessageSquare } from 'lucide-react'

interface Props {
  initialError: string | null
}

export function LoginForm({ initialError }: Props) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(initialError)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${location.origin}/auth/callback`,
        },
      })
      if (error) {
        setError(error.message)
      } else {
        setSent(true)
      }
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <MessageSquare className="h-8 w-8 text-indigo-600" />
          <span className="text-xl font-semibold">Chat de Debates</span>
        </div>

        {sent ? (
          <div className="text-center">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold mb-2">Verifique seu email</h2>
            <p className="text-sm text-zinc-500">
              Enviamos um link de acesso para <strong>{email}</strong>. Clique no link para entrar.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-8 shadow-sm">
            <h1 className="text-lg font-semibold mb-1">Entrar</h1>
            <p className="text-sm text-zinc-500 mb-6">
              Insira seu email para receber um link de acesso.
            </p>

            {error && (
              <p className="text-red-600 text-sm bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2 mb-4">{error}</p>
            )}

            <div className="mb-4">
              <label htmlFor="email" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-2.5 text-sm font-medium transition-colors"
            >
              {isPending ? 'Enviando...' : 'Enviar link de acesso'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
