import { supabase } from '../lib/supabase.js'

function requireSupabase() {
  if (!supabase) throw new Error('Add your Supabase URL and anon key to .env before using your account.')
  return supabase
}

export async function listItems() {
  const client = requireSupabase()
  const { data, error } = await client
    .from('items')
    .select('id,name,category,description,characteristics,tags,image_path,location_id,storage_detail,created_at,locations(id,name,parent_id)')
    .order('created_at', { ascending: false })
  if (error) throw error

  const paths = await Promise.all((data ?? []).map(async (item) => {
    let location = item.locations
    const segments = location ? [location.name] : []
    while (location?.parent_id) {
      const { data: parent, error: parentError } = await client
        .from('locations').select('id,name,parent_id').eq('id', location.parent_id).single()
      if (parentError) throw parentError
      location = parent
      segments.unshift(location.name)
    }
    const locationPath = [segments.join(' → '), item.storage_detail].filter(Boolean).join(' → ')
    const imageUrl = item.image_path
      ? await getItemPhotoUrl(item.image_path)
      : null
    return { ...item, locationPath, imageUrl }
  }))
  return paths
}

export async function saveItem({ userId, photo, item, locationId, storageDetail }) {
  const client = requireSupabase()
  let imagePath = null
  if (photo) {
    const extension = photo.type === 'image/png' ? 'png' : 'jpg'
    imagePath = `${userId}/${crypto.randomUUID()}.${extension}`
    const { error: uploadError } = await client.storage.from('item-photos').upload(imagePath, photo, {
      contentType: photo.type,
      cacheControl: '3600',
      upsert: false,
    })
    if (uploadError) throw uploadError
  }

  const { data, error } = await client.from('items').insert({
    user_id: userId,
    name: item.name,
    category: item.category,
    description: item.description ?? '',
    characteristics: item.characteristics ?? '',
    tags: item.tags ?? [],
    location_id: locationId,
    storage_detail: storageDetail ?? '',
    image_path: imagePath,
  }).select('id').single()

  if (error) {
    if (imagePath) {
      const { error: cleanupError } = await client.storage.from('item-photos').remove([imagePath])
      if (cleanupError) console.error('Unable to remove the uploaded photo after item save failed:', cleanupError.message)
    }
    throw error
  }
  return data
}

export async function getItemPhotoUrl(imagePath) {
  if (!imagePath) return null
  const { data, error } = await requireSupabase().storage.from('item-photos').createSignedUrl(imagePath, 60 * 60)
  if (error) throw error
  return data.signedUrl
}

export async function deleteItem(item) {
  const client = requireSupabase()
  const { error } = await client.from('items').delete().eq('id', item.id)
  if (error) throw error
  if (item.image_path) {
    const { error: imageError } = await client.storage.from('item-photos').remove([item.image_path])
    return imageError?.message ?? null
  }
  return null
}

export async function updateItem({ id, name, category, description, characteristics, tags, locationId, storageDetail }) {
  const { error } = await requireSupabase().from('items').update({
    name,
    category,
    description: description ?? '',
    characteristics: characteristics ?? '',
    tags,
    location_id: locationId,
    storage_detail: storageDetail ?? '',
    updated_at: new Date().toISOString(),
  }).eq('id', id)
  if (error) throw error
}
