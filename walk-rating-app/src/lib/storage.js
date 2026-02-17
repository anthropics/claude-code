import { supabase, isSupabaseConfigured } from './supabase'

const LOCAL_STORAGE_KEY = 'ns-walk-ratings'

function getLocal() {
  const data = localStorage.getItem(LOCAL_STORAGE_KEY)
  return data ? JSON.parse(data) : []
}

function saveLocal(walks) {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(walks))
}

export async function getWalks() {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('walks')
      .select('*')
      .order('date', { ascending: false })
    if (error) throw error
    return data
  }
  return getLocal().sort((a, b) => new Date(b.date) - new Date(a.date))
}

export async function addWalk(walk) {
  const newWalk = {
    ...walk,
    id: walk.id || crypto.randomUUID(),
    created_at: new Date().toISOString(),
  }

  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('walks')
      .insert([newWalk])
      .select()
      .single()
    if (error) throw error
    return data
  }

  const walks = getLocal()
  walks.push(newWalk)
  saveLocal(walks)
  return newWalk
}

export async function updateWalk(id, updates) {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('walks')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  }

  const walks = getLocal()
  const idx = walks.findIndex(w => w.id === id)
  if (idx === -1) throw new Error('Walk not found')
  walks[idx] = { ...walks[idx], ...updates }
  saveLocal(walks)
  return walks[idx]
}

export async function deleteWalk(id) {
  if (isSupabaseConfigured()) {
    const { error } = await supabase
      .from('walks')
      .delete()
      .eq('id', id)
    if (error) throw error
    return
  }

  const walks = getLocal().filter(w => w.id !== id)
  saveLocal(walks)
}
