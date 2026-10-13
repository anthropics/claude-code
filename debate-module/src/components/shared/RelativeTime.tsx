'use client'

import { useEffect, useState } from 'react'
import { relativeTime } from '@/lib/utils'

export function RelativeTime({ date }: { date: string }) {
  const [label, setLabel] = useState(() => relativeTime(date))

  useEffect(() => {
    const id = setInterval(() => setLabel(relativeTime(date)), 30000)
    return () => clearInterval(id)
  }, [date])

  return <span title={new Date(date).toLocaleString('pt-BR')}>{label}</span>
}
