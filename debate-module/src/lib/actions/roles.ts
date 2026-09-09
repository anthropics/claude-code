'use server'

import { revalidatePath } from 'next/cache'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'

export async function assignRole(userId: string, role: 'admin' | 'moderator') {
  const admin = getSupabaseAdminClient()
  const { error } = await admin
    .from('user_roles')
    .upsert({ user_id: userId, role }, { onConflict: 'user_id,role' })

  if (error) return { error: error.message }
  revalidatePath('/admin/users')
  return { success: true }
}

export async function revokeRole(userId: string, role: 'admin' | 'moderator') {
  const admin = getSupabaseAdminClient()
  const { error } = await admin
    .from('user_roles')
    .delete()
    .eq('user_id', userId)
    .eq('role', role)

  if (error) return { error: error.message }
  revalidatePath('/admin/users')
  return { success: true }
}
