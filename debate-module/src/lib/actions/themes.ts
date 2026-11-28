'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { slugify } from '@/lib/utils'

export async function createTheme(formData: FormData) {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const name = formData.get('name') as string
  const description = formData.get('description') as string
  const color = formData.get('color') as string

  const { error } = await supabase.from('debate_themes').insert({
    name,
    slug: slugify(name),
    description,
    color: color || '#6366f1',
    created_by: user.id,
  })

  if (error) return { error: error.message }
  revalidatePath('/debates')
  redirect('/admin/themes')
}

export async function updateTheme(id: string, formData: FormData) {
  const supabase = await getSupabaseServerClient()

  const name = formData.get('name') as string
  const description = formData.get('description') as string
  const color = formData.get('color') as string
  const isActive = formData.get('is_active') === 'on'

  const { error } = await supabase
    .from('debate_themes')
    .update({ name, slug: slugify(name), description, color, is_active: isActive })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/debates')
  redirect('/admin/themes')
}
