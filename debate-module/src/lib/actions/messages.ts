'use server'

import { revalidatePath } from 'next/cache'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'

export async function sendMessage(debateId: string, content: string) {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const { error } = await supabase.from('messages').insert({
    debate_id: debateId,
    user_id: user.id,
    content: content.trim(),
  })

  if (error) return { error: error.message }
  return { success: true }
}

export async function hideMessage(messageId: string) {
  const admin = getSupabaseAdminClient()
  const { error } = await admin
    .from('messages')
    .update({ is_hidden: true })
    .eq('id', messageId)

  if (error) return { error: error.message }
  revalidatePath('/', 'layout')
  return { success: true }
}

export async function restoreMessage(messageId: string) {
  const admin = getSupabaseAdminClient()
  const { error } = await admin
    .from('messages')
    .update({ is_hidden: false })
    .eq('id', messageId)

  if (error) return { error: error.message }
  revalidatePath('/', 'layout')
  return { success: true }
}

export async function deleteMessage(messageId: string) {
  const admin = getSupabaseAdminClient()
  const { error } = await admin
    .from('messages')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', messageId)

  if (error) return { error: error.message }
  revalidatePath('/', 'layout')
  return { success: true }
}

export async function toggleReaction(messageId: string, type: 'like' | 'insightful' | 'disagree') {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const { data: existing } = await supabase
    .from('reactions')
    .select('id')
    .eq('message_id', messageId)
    .eq('user_id', user.id)
    .eq('type', type)
    .maybeSingle()

  if (existing) {
    await supabase.from('reactions').delete().eq('id', existing.id)
    return { action: 'removed' }
  }

  await supabase.from('reactions').insert({
    message_id: messageId,
    user_id: user.id,
    type,
  })
  return { action: 'added' }
}
