import { supabase } from '../lib/supabase.js'

export async function listLocations() {
  if (!supabase) throw new Error('Add your Supabase URL and anon key to .env before using your account.')
  const { data, error } = await supabase.from('locations').select('id,name,parent_id,created_at').order('created_at')
  if (error) throw error
  return data
}

export async function createLocation({ userId, name, parentId = null }) {
  const cleanName = name.trim()
  if (!cleanName) throw new Error('Enter a location name.')
  const { data, error } = await supabase.from('locations')
    .insert({ user_id: userId, name: cleanName, parent_id: parentId })
    .select('id,name,parent_id,created_at').single()
  if (error) throw error
  return data
}

export async function renameLocation({ id, name }) {
  const cleanName = name.trim()
  if (!cleanName) throw new Error('Enter a location name.')
  const { data, error } = await supabase.from('locations').update({ name: cleanName })
    .eq('id', id).select('id,name,parent_id,created_at').single()
  if (error) throw error
  return data
}

export async function removeLocation(location) {
  const { error } = await supabase.from('locations').delete().eq('id', location.id)
  if (error) throw error
}
