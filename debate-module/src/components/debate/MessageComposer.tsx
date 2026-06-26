'use client'

import { useRef, useState, useTransition } from 'react'
import { Send } from 'lucide-react'
import { sendMessage } from '@/lib/actions/messages'
import { cn } from '@/lib/utils'

const MAX_LENGTH = 2000

interface MessageComposerProps {
  debateId: string
}

export function MessageComposer({ debateId }: MessageComposerProps) {
  const [content, setContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      submit()
    }
  }

  function submit() {
    const trimmed = content.trim()
    if (!trimmed || isPending) return
    setError(null)
    startTransition(async () => {
      const result = await sendMessage(debateId, trimmed)
      if (result?.error) {
        setError(result.error)
      } else {
        setContent('')
        textareaRef.current?.focus()
      }
    })
  }

  return (
    <div className="border-t border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3">
      {error && (
        <p className="text-red-500 text-xs mb-2">{error}</p>
      )}
      <div className="flex gap-2 items-end">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={e => setContent(e.target.value.slice(0, MAX_LENGTH))}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Escreva sua mensagem... (Ctrl+Enter para enviar)"
            className={cn(
              'w-full resize-none rounded-xl border border-zinc-200 dark:border-zinc-700',
              'bg-zinc-50 dark:bg-zinc-800 px-4 py-2.5 text-sm',
              'focus:outline-none focus:ring-2 focus:ring-indigo-500',
              'max-h-32 overflow-y-auto'
            )}
            style={{ height: 'auto' }}
            onInput={e => {
              const el = e.currentTarget
              el.style.height = 'auto'
              el.style.height = `${el.scrollHeight}px`
            }}
          />
          <span className="absolute bottom-2 right-3 text-[10px] text-zinc-400">
            {content.length}/{MAX_LENGTH}
          </span>
        </div>
        <button
          onClick={submit}
          disabled={!content.trim() || isPending}
          className="rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white p-2.5 transition-colors"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
