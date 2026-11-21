'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getSupabaseServerClient } from '@/lib/supabase/server'

export async function createDebate(formData: FormData) {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const themeId = formData.get('theme_id') as string
  const title = formData.get('title') as string
  const description = formData.get('description') as string
  const endsAt = formData.get('ends_at') as string

  const { error } = await supabase.from('debates').insert({
    theme_id: themeId,
    title,
    description,
    ends_at: endsAt || null,
    created_by: user.id,
  })

  if (error) return { error: error.message }
  revalidatePath('/debates')
  redirect('/admin/debates')
}

export async function updateDebateStatus(id: string, status: 'open' | 'closed' | 'archived') {
  const supabase = await getSupabaseServerClient()
  const { error } = await supabase
    .from('debates')
    .update({ status, ...(status === 'closed' ? { ends_at: new Date().toISOString() } : {}) })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/debates')
  revalidatePath('/admin/debates')
  return { success: true }
}

export async function updateDebate(id: string, formData: FormData) {
  const supabase = await getSupabaseServerClient()

  const title = formData.get('title') as string
  const description = formData.get('description') as string
  const endsAt = formData.get('ends_at') as string
  const isFeatured = formData.get('is_featured') === 'on'

  const { error } = await supabase
    .from('debates')
    .update({ title, description, ends_at: endsAt || null, is_featured: isFeatured })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/debates')
  redirect('/admin/debates')
}
