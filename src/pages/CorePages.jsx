import { useEffect, useRef, useState } from 'react'
import { useOutletContext, Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, ArrowRight, Camera, Check, ImagePlus, MapPin, Pencil,
  Plus, RotateCcw, Search, Trash2, Upload, X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import EmptyState from '../components/EmptyState.jsx'
import { deleteItem, saveItem, updateItem } from '../services/items.js'
import { createLocation, removeLocation, renameLocation } from '../services/locations.js'
import { identifyItem } from '../services/identifyItem.js'

const ITEM_CATEGORIES = [
  'Documents & IDs',
  'Electronics',
  'Clothing & accessories',
  'Kitchen & dining',
  'Home & furniture',
  'Tools & hardware',
  'Personal care',
  'Health & medicine',
  'Toys & games',
  'Books & stationery',
  'Sports & outdoors',
  'Jewelry & valuables',
  'Keys & access',
  'Other',
]

export function HomePage() {
  const { items, search, setSearch, loading, loadError, user } = useOutletContext()
  const navigate = useNavigate()
  const query = search.trim().toLowerCase()
  const results = query ? items.filter((item) => searchableText(item).includes(query)).slice(0, 4) : []

  const firstName = user.user_metadata?.full_name?.trim().split(/\s+/)[0]
  return <div className="simple-home-page">
    <div className="simple-page-title"><div><span className="simple-eyebrow">YOUR HOME</span><h1>{firstName ? `Hello, ${firstName}` : 'Your things, all in one place'}</h1><p>Your belongings, always easy to find.</p></div></div>
    <Link to="/app/scan" className="scan-home-card"><span className="scan-home-icon"><Camera size={24} /></span><span className="scan-home-copy"><strong>Scan your item</strong><small>Take a picture and save where you keep it.</small></span><span className="scan-home-arrow"><ArrowRight size={19} /></span></Link>
    <div className="home-search-block">
      <label className="home-search"><Search size={19} /><input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && navigate('/app/find')} placeholder="Search your belongings…" aria-label="Search your belongings" /><kbd>Enter</kbd></label>
      {search.trim() && <div className="home-search-results">{loadError ? <p className="inline-error">{loadError}</p> : loading ? <p className="simple-muted">Looking through your things…</p> : results.length ? results.map((item) => <Link className="home-result" to="/app/find" key={item.id}><ItemPhoto item={item} small /><span><strong>{displayItemName(item.name)}</strong><small>{item.locationPath || 'No place added yet'}</small></span><ArrowRight size={15} /></Link>) : <p className="simple-muted">No items found for “{search}”. Try a different word.</p>}</div>}
    </div>
    <div className="simple-section-head"><h2>Recently added</h2><Link to="/app/items">See all <ArrowRight size={15} /></Link></div>
    {loading && !items.length ? <p className="simple-muted">Loading your saved items…</p> : loadError ? <p className="inline-error">{loadError}</p> : items.length ? <div className="simple-recent-list">{items.slice(0, 4).map((item) => <ItemRow key={item.id} item={item} />)}</div> : <EmptyState title="Your list is ready" message="Scan or add a photo of something you want to find later." />}
    <div className="simple-quick-links"><Link to="/app/items"><span className="quick-link-icon"><Search size={17} /></span><span><strong>My items</strong><small>See everything you have saved</small></span><ArrowRight size={16} /></Link><Link to="/app/locations"><span className="quick-link-icon"><MapPin size={17} /></span><span><strong>My locations</strong><small>Manage rooms and storage places</small></span><ArrowRight size={16} /></Link></div>
  </div>
}

export function ScanPage() {
  const { locations, reload, user, session } = useOutletContext()
  const [cameraStream, setCameraStream] = useState(null)
  const [cameraError, setCameraError] = useState('')
  const [photo, setPhoto] = useState(null)
  const [photoUrl, setPhotoUrl] = useState('')
  const [step, setStep] = useState('capture')
  const [identifying, setIdentifying] = useState(false)
  const [saving, setSaving] = useState(false)
  const [aiError, setAiError] = useState('')
  const [uncertain, setUncertain] = useState(false)
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [characteristics, setCharacteristics] = useState('')
  const [tags, setTags] = useState('')
  const [rootId, setRootId] = useState('')
  const [childId, setChildId] = useState('')
  const [storageDetail, setStorageDetail] = useState('')
  const [locationName, setLocationName] = useState('')
  const [addingLocation, setAddingLocation] = useState(false)
  const [savedPath, setSavedPath] = useState('')
  const [savedName, setSavedName] = useState('')
  const videoRef = useRef(null)
  const fileInputRef = useRef(null)
  const identificationController = useRef(null)
  const roots = locations.filter((location) => !location.parent_id)
  const leaf = locations.find((location) => location.id === childId) || locations.find((location) => location.id === rootId)

  useEffect(() => {
    if (!cameraStream || !videoRef.current) return
    videoRef.current.srcObject = cameraStream
    videoRef.current.play().catch((error) => setCameraError(`Could not start the camera preview: ${error.message}`))
  }, [cameraStream, step])

  useEffect(() => () => cameraStream?.getTracks().forEach((track) => track.stop()), [cameraStream])
  useEffect(() => () => identificationController.current?.abort(), [])

  useEffect(() => () => photoUrl && URL.revokeObjectURL(photoUrl), [photoUrl])

  async function startCamera() {
    setCameraError('')
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera access is not available here. Choose a photo from your device instead.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1600 }, height: { ideal: 1200 } },
      })
      setCameraStream(stream)
    } catch (error) {
      setCameraError(error.name === 'NotAllowedError'
        ? 'Camera permission is off. Allow camera access in your browser settings, or choose a photo instead.'
        : 'Could not open the camera. Choose a photo from your device instead.')
    }
  }

  async function acceptImage(file) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setCameraError('Choose an image file such as JPG, PNG, or WebP.')
      return
    }
    setCameraError('')
    try {
      const compressed = await compressImage(file)
      setPhoto(compressed)
      setPhotoUrl(URL.createObjectURL(compressed))
      stopCamera()
      setStep('review')
    } catch (error) {
      setCameraError(error.message)
    }
  }

  async function capturePhoto() {
    const video = videoRef.current
    if (!video?.videoWidth || !video.videoHeight) {
      setCameraError('The camera is still starting. Wait a moment and try again.')
      return
    }
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    canvas.toBlob(async (blob) => {
      if (!blob) {
        setCameraError('This photo could not be captured. Try choosing a photo instead.')
        return
      }
      await acceptImage(new File([blob], 'item-photo.jpg', { type: blob.type || 'image/jpeg' }))
    }, 'image/jpeg', 0.88)
  }

  function stopCamera() {
    cameraStream?.getTracks().forEach((track) => track.stop())
    setCameraStream(null)
  }

  async function continueToDetails() {
    setStep('details')
    setAiError('')
    if (!photo || !session?.access_token) return
    setIdentifying(true)
    const controller = new AbortController()
    identificationController.current = controller
    try {
      const dataUrl = await fileToDataUrl(photo)
      const result = await identifyItem(dataUrl, session.access_token, controller.signal)
      setName(result.itemName || '')
      setCategory(result.category || '')
      setDescription(result.description || '')
      setCharacteristics(result.visibleCharacteristics || '')
      setTags((result.tags || []).join(', '))
      setUncertain(result.needsConfirmation || result.confidence < 0.65 || !result.itemName)
    } catch (error) {
      if (error.name !== 'AbortError') setAiError(`${error.message} You can still add the item by hand.`)
    } finally {
      if (identificationController.current === controller) identificationController.current = null
      setIdentifying(false)
    }
  }

  async function addPlace(event) {
    event?.preventDefault()
    try {
      await createLocation({ userId: user.id, name: locationName, parentId: rootId || null })
      setLocationName('')
      setAddingLocation(false)
      await reload()
      toast.success('Place added.')
    } catch (error) {
      toast.error(error.message || 'Could not add that place.')
    }
  }

  async function save(event) {
    event.preventDefault()
    if (!hasWords(name)) {
      toast.error('Use at least one letter or number for the item name.')
      return
    }
    if (!leaf) {
      toast.error('Choose the room or place where you keep this item.')
      return
    }
    setSaving(true)
    try {
      await saveItem({
        userId: user.id,
        photo,
        item: {
          name: name.trim(),
          category: displayCategory(category),
          description: description.trim(),
          characteristics: characteristics.trim(),
          tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean),
        },
        locationId: leaf.id,
        storageDetail: storageDetail.trim(),
      })
      const path = [roots.find((place) => place.id === rootId)?.name, childId ? locations.find((place) => place.id === childId)?.name : null, storageDetail.trim()].filter(Boolean).join(' → ')
      setSavedName(name.trim())
      setSavedPath(path)
      setStep('saved')
      await reload()
      toast.success(`${name.trim()} has been saved.`)
    } catch (error) {
      toast.error(error.message || 'Could not save your item. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  function retake() {
    identificationController.current?.abort()
    identificationController.current = null
    setIdentifying(false)
    stopCamera()
    setPhoto(null)
    setPhotoUrl('')
    setName('')
    setCategory('')
    setDescription('')
    setCharacteristics('')
    setTags('')
    setStep('capture')
  }

  return <div className="scan-page">
    <div className="simple-page-title"><div><span className="simple-eyebrow">SCAN ITEM</span><h1>{step === 'saved' ? 'Saved for later' : 'Add something to your list'}</h1><p>Take a photo, then choose where you keep it.</p></div></div>
    <div className="scan-steps" aria-label="Scan progress"><span className={step === 'capture' || step === 'review' ? 'current' : 'done'}>1 <small>Photo</small></span><i /><span className={step === 'details' ? 'current' : step === 'saved' ? 'done' : ''}>2 <small>Details</small></span><i /><span className={step === 'saved' ? 'done' : ''}>3 <small>Save</small></span></div>

    {step === 'capture' && <section className="scan-workspace">
      <div className={`camera-frame${cameraStream ? ' live-camera' : ''}`}>
        {cameraStream ? <><video ref={videoRef} autoPlay playsInline muted aria-label="Live camera preview" /><div className="camera-guide"><span>Fit one item in the frame</span></div><button className="capture-button" onClick={capturePhoto} aria-label="Take photo"><span /></button><button className="camera-close" onClick={stopCamera} aria-label="Close camera"><X size={20} /></button></>
          : <div className="camera-start"><span className="camera-start-icon"><Camera size={28} /></span><h2>Take a photo of your item</h2><p>Place one item in good light. Make sure it is easy to see.</p><button className="simple-primary-button" onClick={startCamera}><Camera size={17} />Open camera</button><span className="camera-or">or</span><button className="simple-outline-button" onClick={() => fileInputRef.current?.click()}><ImagePlus size={17} />Choose a photo</button><input ref={fileInputRef} className="visually-hidden" type="file" accept="image/*" onChange={(event) => { acceptImage(event.target.files?.[0]); event.target.value = '' }} /><button className="camera-manual" onClick={() => setStep('details')}>Add item details without a photo</button></div>}
      </div>
      {cameraError && <p className="inline-error camera-message" role="alert">{cameraError}</p>}
      <p className="photo-privacy">Photos are resized before use. You choose if a photo is saved with the item.</p>
    </section>}

    {step === 'review' && <section className="scan-review">
      <div className="review-photo-wrap"><img src={photoUrl} alt="Your item preview" /><button className="photo-change" onClick={() => fileInputRef.current?.click()}><Upload size={15} />Change photo</button><input ref={fileInputRef} className="visually-hidden" type="file" accept="image/*" onChange={(event) => { acceptImage(event.target.files?.[0]); event.target.value = '' }} /></div>
      <div className="review-actions"><button className="simple-outline-button" onClick={retake}><RotateCcw size={16} />Retake</button><button className="simple-primary-button" onClick={continueToDetails}>Continue <ArrowRight size={16} /></button></div>
      <button className="review-manual" onClick={() => setStep('details')}>Enter details myself without AI</button>
      <p className="photo-privacy">When you continue, the photo is sent securely to the configured AI service for an item suggestion. It never guesses where you store the item. You can also enter everything yourself.</p>
    </section>}

    {step === 'details' && <section className="scan-details">
      <div className="details-photo">{photoUrl ? <img src={photoUrl} alt="The item you are adding" /> : <span><ImagePlus size={25} /></span>}</div>
      <div className="details-content">
        <div className="details-heading"><div><span className="simple-eyebrow">ITEM DETAILS</span><h2>What is it, and where does it live?</h2></div><button className="simple-icon-button" onClick={retake} aria-label="Retake photo"><RotateCcw size={17} /></button></div>
        {identifying && <p className="ai-status" role="status"><span className="loading-dot" />Looking at the photo… You can change any suggestion.</p>}
        {aiError && <p className="inline-info" role="status">{aiError}</p>}
        {uncertain && <p className="inline-info" role="status">This photo is not very clear. Please check the item details before saving.</p>}
        <form className="details-form" onSubmit={save}>
          <label>Item name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Headphones, Aadhaar card, TV remote" required maxLength={120} /></label>
          <CategoryField value={category} onChange={setCategory} />
          <label>Short description <span className="optional-label">Optional</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="A few words to help you recognize it" rows={2} maxLength={500} /></label>
          <label>Visible details <span className="optional-label">Optional · check the suggestion</span><textarea value={characteristics} onChange={(event) => setCharacteristics(event.target.value)} placeholder="Colour, shape, or other visible details" rows={2} maxLength={300} /></label>
          <div className="form-section-divider"><span>WHERE DO YOU KEEP IT?</span><p>The app will not guess this. Choose the place yourself.</p></div>
          <div className="location-select-grid">
            <label>Room or area<select value={rootId} onChange={(event) => { setRootId(event.target.value); setChildId('') }} required><option value="">Choose a place</option>{roots.map((place) => <option key={place.id} value={place.id}>{place.name}</option>)}</select></label>
            <label>Storage place <span className="optional-label">Optional</span><select value={childId} onChange={(event) => setChildId(event.target.value)} disabled={!rootId}><option value="">Choose if needed</option>{locations.filter((place) => place.parent_id === rootId).map((place) => <option key={place.id} value={place.id}>{place.name}</option>)}</select></label>
          </div>
          <label>More detail <span className="optional-label">Optional</span><input value={storageDetail} onChange={(event) => setStorageDetail(event.target.value)} placeholder="e.g. Top drawer, document folder, blue box" maxLength={100} /></label>
          <button type="button" className="add-place-inline" onClick={() => setAddingLocation((value) => !value)}><Plus size={15} />Add a place</button>
          {addingLocation && <div className="quick-place-form"><input value={locationName} onChange={(event) => setLocationName(event.target.value)} placeholder="e.g. Cupboard, Study table" required maxLength={80} /><button type="button" className="simple-outline-button" onClick={() => addPlace()}>Add</button></div>}
          <label className="tag-field">Tags <span className="optional-label">Optional · separate with commas</span><input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="black, wireless, travel" /></label>
          <div className="details-actions"><button type="button" className="simple-outline-button" onClick={() => setStep('review')}><ArrowLeft size={16} />Back</button><button className="simple-primary-button" disabled={saving || identifying}>{saving ? 'Saving…' : 'Save item'} <Check size={16} /></button></div>
        </form>
      </div>
    </section>}

    {step === 'saved' && <section className="saved-success"><span><Check size={27} /></span><h2>{savedName} has been saved.</h2><p><MapPin size={17} />{savedPath}</p><div><button className="simple-primary-button" onClick={retake}><Camera size={17} />Scan another item</button><Link className="simple-outline-button" to="/app/items">See my items <ArrowRight size={16} /></Link></div></section>}
  </div>
}

export function ItemsPage() {
  const { items, locations, search, setSearch, loading, loadError, reload } = useOutletContext()
  const [category, setCategory] = useState('')
  const [locationId, setLocationId] = useState('')
  const [selectedItem, setSelectedItem] = useState(null)
  const [editingItem, setEditingItem] = useState(null)
  const categories = [...new Set([...ITEM_CATEGORIES, ...items.map((item) => displayCategory(item.category))])]
  const shown = items.filter((item) => {
    const matchesSearch = !search.trim() || searchableText(item).includes(search.trim().toLowerCase())
    const matchesCategory = !category || displayCategory(item.category).toLowerCase() === category.toLowerCase()
    const matchesLocation = !locationId || locationContains(item.location_id, locationId, locations)
    return matchesSearch && matchesCategory && matchesLocation
  })

  async function editItem(values) {
    try {
      await updateItem(values)
      setEditingItem(null)
      await reload()
      toast.success('Item updated.')
    } catch (error) {
      toast.error(error.message || 'Could not update this item.')
    }
  }

  async function remove(item) {
    if (!window.confirm(`Delete “${displayItemName(item.name)}” and its saved photo?`)) return
    try {
      const photoError = await deleteItem(item)
      await reload()
      if (photoError) toast.error(`Item deleted, but its photo could not be removed: ${photoError}`)
      else toast.success('Item deleted.')
    } catch (error) {
      toast.error(error.message || 'Could not delete this item.')
    }
  }

  return <div className="items-page">
    <div className="simple-page-title"><div><span className="simple-eyebrow">YOUR LIST</span><h1>My items</h1><p>Things you have saved and where you keep them.</p></div><Link to="/app/scan" className="simple-primary-button"><Camera size={17} />Scan item</Link></div>
    <div className="items-filters"><label className="items-search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, category, or place" aria-label="Search items" /></label><select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filter by category"><option value="">All categories</option>{categories.map((value) => <option key={value} value={value}>{value}</option>)}</select><select value={locationId} onChange={(event) => setLocationId(event.target.value)} aria-label="Filter by location"><option value="">All places</option>{locations.map((place) => <option key={place.id} value={place.id}>{locationLabel(place, locations)}</option>)}</select><span className="item-total">{shown.length} {shown.length === 1 ? 'item' : 'items'}</span></div>
    {loadError ? <p className="inline-error">{loadError}</p> : loading ? <p className="simple-muted">Loading your saved items…</p> : shown.length ? <div className="saved-item-grid">{shown.map((item) => <article className="saved-item-card" key={item.id}><button className="saved-item-photo" onClick={() => setSelectedItem(item)} aria-label={`View ${displayItemName(item.name)}`}><ItemPhoto item={item} /></button><div className="saved-item-info"><span className="saved-item-category">{displayCategory(item.category)}</span><button className="saved-item-name" onClick={() => setSelectedItem(item)}>{displayItemName(item.name)}</button><p><MapPin size={14} />{item.locationPath || 'Place not set'}</p><div className="saved-item-actions"><button onClick={() => setSelectedItem(item)}>View</button><button onClick={() => setEditingItem(item)}><Pencil size={14} />Edit</button><button onClick={() => remove(item)}><Trash2 size={14} />Delete</button></div></div></article>)}</div> : <EmptyState title={search || category || locationId ? 'No matching items' : 'No items saved yet'} message={search || category || locationId ? 'Try another search or filter.' : 'Scan something you want to find later.'} />}
    {selectedItem && <ItemDetails item={selectedItem} onClose={() => setSelectedItem(null)} />}
    {editingItem && <EditItemDialog item={editingItem} locations={locations} onClose={() => setEditingItem(null)} onSave={editItem} />}
  </div>
}

export function FindPage() {
  const { items, search, setSearch, loading, loadError } = useOutletContext()
  const results = items.filter((item) => !search.trim() || searchableText(item).includes(search.trim().toLowerCase()))
  return <div className="find-page">
    <div className="simple-page-title"><div><span className="simple-eyebrow">FIND MY ITEM</span><h1>Where did I put it?</h1><p>Search by name, category, details, or the place you keep it.</p></div></div>
    <label className="find-search"><Search size={21} /><input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Try “Aadhaar card” or “kitchen”" aria-label="Find a saved item" /></label>
    {search.trim() && <p className="find-count">{results.length} {results.length === 1 ? 'item' : 'items'} found for “{search}”</p>}
    {loadError ? <p className="inline-error">{loadError}</p> : loading ? <p className="simple-muted">Looking through your saved items…</p> : search.trim() ? results.length ? <div className="find-result-list">{results.map((item) => <article className="find-result" key={item.id}><ItemPhoto item={item} /><div><span className="saved-item-category">{displayCategory(item.category)}</span><h2>{displayItemName(item.name)}</h2><p>{item.description || item.characteristics}</p><strong><MapPin size={16} />{item.locationPath || 'Place not set'}</strong></div></article>)}</div> : <EmptyState title="No item found" message="Try a shorter search or another word." /> : <div className="find-suggestions"><span>Try a search like</span>{['House keys', 'Important documents', 'TV remote', 'Chargers'].map((term) => <button key={term} onClick={() => setSearch(term)}>{term}</button>)}</div>}
  </div>
}

export function LocationsPage() {
  const { locations, items, user, reload, loading, loadError } = useOutletContext()
  const [name, setName] = useState('')
  const [parentId, setParentId] = useState('')
  const [editing, setEditing] = useState(null)
  const roots = locations.filter((location) => !location.parent_id)
  const children = locations.filter((location) => location.parent_id)

  async function addLocation(event) {
    event.preventDefault()
    try {
      await createLocation({ userId: user.id, name, parentId: parentId || null })
      setName('')
      toast.success('Place added.')
      await reload()
    } catch (error) {
      toast.error(error.message || 'Could not add that place.')
    }
  }

  async function saveRename(event) {
    event.preventDefault()
    try {
      await renameLocation({ id: editing.id, name: editing.name })
      setEditing(null)
      await reload()
      toast.success('Place renamed.')
    } catch (error) {
      toast.error(error.message || 'Could not rename this place.')
    }
  }

  async function deletePlace(place) {
    if (!window.confirm(`Delete “${place.name}”? Items or places inside it must be moved first.`)) return
    try {
      await removeLocation(place)
      await reload()
      toast.success('Place deleted.')
    } catch (error) {
      toast.error(error.message || 'Could not delete this place. Move its items or sub-places first.')
    }
  }

  return <div className="locations-page">
    <div className="simple-page-title"><div><span className="simple-eyebrow">YOUR HOME</span><h1>My locations</h1><p>Use rooms, cupboards, drawers, or names that make sense to you.</p></div></div>
    <section className="add-location-panel"><div><span className="add-location-icon"><MapPin size={19} /></span><span><strong>Add a place</strong><small>Make a room or a smaller storage place.</small></span></div><form onSubmit={addLocation}><input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Wardrobe, Drawer, Storage box" required maxLength={80} aria-label="New place name" /><select value={parentId} onChange={(event) => setParentId(event.target.value)} aria-label="Place inside"><option value="">Main room or area</option>{roots.map((place) => <option key={place.id} value={place.id}>Inside {place.name}</option>)}</select><button className="simple-primary-button"><Plus size={16} />Add place</button></form></section>
    {loadError ? <p className="inline-error">{loadError}</p> : loading ? <p className="simple-muted">Loading your places…</p> : roots.length ? <div className="location-tree">{roots.map((root) => <section className="location-tree-group" key={root.id}><div className="location-tree-row"><span className="location-tree-icon"><MapPin size={17} /></span>{editing?.id === root.id ? <form className="rename-location-form" onSubmit={saveRename}><input value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} autoFocus /><button className="text-button">Save</button><button type="button" className="text-button" onClick={() => setEditing(null)}>Cancel</button></form> : <><strong>{root.name}</strong><span className="location-item-count">{items.filter((item) => locationContains(item.location_id, root.id, locations)).length} items</span><button className="location-action" onClick={() => setEditing({ id: root.id, name: root.name })} aria-label={`Rename ${root.name}`}><Pencil size={14} /></button><button className="location-action" onClick={() => deletePlace(root)} aria-label={`Delete ${root.name}`}><Trash2 size={14} /></button></>}</div>{children.filter((child) => child.parent_id === root.id).map((child) => <div className="location-tree-row child-location" key={child.id}><span className="location-branch">└</span>{editing?.id === child.id ? <form className="rename-location-form" onSubmit={saveRename}><input value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} autoFocus /><button className="text-button">Save</button><button type="button" className="text-button" onClick={() => setEditing(null)}>Cancel</button></form> : <><strong>{child.name}</strong><span className="location-item-count">{items.filter((item) => item.location_id === child.id).length} items</span><button className="location-action" onClick={() => setEditing({ id: child.id, name: child.name })} aria-label={`Rename ${child.name}`}><Pencil size={14} /></button><button className="location-action" onClick={() => deletePlace(child)} aria-label={`Delete ${child.name}`}><Trash2 size={14} /></button></>}</div>)}</section>)}</div> : <EmptyState title="Add your first place" message="Start with a room like Bedroom, Kitchen, or Hall." />}
  </div>
}

function ItemRow({ item }) {
  return <Link to="/app/find" className="simple-item-row"><ItemPhoto item={item} small /><span className="simple-item-row-info"><strong>{displayItemName(item.name)}</strong><small><MapPin size={13} />{item.locationPath || 'Place not set'}</small></span><span className="simple-category">{displayCategory(item.category)}</span><ArrowRight size={16} /></Link>
}

function CategoryField({ value, onChange }) {
  const [customSelected, setCustomSelected] = useState(false)
  const customMode = !ITEM_CATEGORIES.includes(value) && (customSelected || Boolean(value))

  return <label className="category-field">
    <span>Category</span>
    <select value={customMode ? '__custom__' : value} onChange={(event) => {
      if (event.target.value === '__custom__') {
        setCustomSelected(true)
        if (ITEM_CATEGORIES.includes(value)) onChange('')
      } else {
        setCustomSelected(false)
        onChange(event.target.value)
      }
    }}>
      <option value="">Choose a category</option>
      {ITEM_CATEGORIES.map((itemCategory) => <option key={itemCategory} value={itemCategory}>{itemCategory}</option>)}
      <option value="__custom__">Custom category…</option>
    </select>
    {customMode && <input value={value} onChange={(event) => onChange(event.target.value)} placeholder="Enter a category" maxLength={80} aria-label="Custom category" />}
  </label>
}

function ItemPhoto({ item, small = false }) {
  return item.imageUrl
    ? <img className={`item-photo${small ? ' small' : ''}`} src={item.imageUrl} alt={displayItemName(item.name)} loading="lazy" />
    : <span className={`item-photo-placeholder${small ? ' small' : ''}`}><ImagePlus size={small ? 17 : 24} /></span>
}

function ItemDetails({ item, onClose }) {
  return <div className="simple-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="simple-modal" role="dialog" aria-modal="true" aria-labelledby="item-detail-name">
      <div className="simple-modal-head"><span className="simple-eyebrow">SAVED ITEM</span><button className="simple-icon-button" onClick={onClose} aria-label="Close"><X size={19} /></button></div>
      <ItemPhoto item={item} /><span className="saved-item-category">{displayCategory(item.category)}</span><h2 id="item-detail-name">{displayItemName(item.name)}</h2>{item.description && <p>{item.description}</p>}{item.characteristics && <p>{item.characteristics}</p>}<strong className="detail-location"><MapPin size={17} />{item.locationPath || 'Place not set'}</strong><button className="simple-outline-button modal-done" onClick={onClose}>Done</button>
    </section>
  </div>
}

function EditItemDialog({ item, locations, onClose, onSave }) {
  const [name, setName] = useState(item.name)
  const [category, setCategory] = useState(item.category || '')
  const [description, setDescription] = useState(item.description || '')
  const [locationId, setLocationId] = useState(item.location_id)
  const [storageDetail, setStorageDetail] = useState(item.storage_detail || '')
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    if (!hasWords(name)) {
      toast.error('Use at least one letter or number for the item name.')
      return
    }
    setBusy(true)
    await onSave({
      id: item.id,
      name: name.trim(),
      category: displayCategory(category),
      description: description.trim(),
      characteristics: item.characteristics,
      tags: item.tags,
      locationId,
      storageDetail: storageDetail.trim(),
    })
    setBusy(false)
  }

  return <div className="simple-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="simple-modal edit-item-modal" role="dialog" aria-modal="true" aria-labelledby="edit-item-title">
      <div className="simple-modal-head"><span className="simple-eyebrow">EDIT ITEM</span><button type="button" className="simple-icon-button" onClick={onClose} aria-label="Close"><X size={19} /></button></div>
      <h2 id="edit-item-title">Update your item</h2>
      <form className="details-form" onSubmit={submit}>
        <label>Item name<input value={name} onChange={(event) => setName(event.target.value)} required maxLength={120} /></label>
        <CategoryField value={category} onChange={setCategory} />
        <label>Description <span className="optional-label">Optional</span><textarea rows={2} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
        <label>Room or storage place<select required value={locationId} onChange={(event) => setLocationId(event.target.value)}>{locations.map((place) => <option key={place.id} value={place.id}>{locationLabel(place, locations)}</option>)}</select></label>
        <label>More detail <span className="optional-label">Optional</span><input value={storageDetail} onChange={(event) => setStorageDetail(event.target.value)} maxLength={100} /></label>
        <div className="details-actions"><button type="button" className="simple-outline-button" onClick={onClose}>Cancel</button><button className="simple-primary-button" disabled={busy}>{busy ? 'Saving…' : 'Save changes'} <Check size={16} /></button></div>
      </form>
    </section>
  </div>
}

function locationLabel(location, locations) {
  const names = [location.name]
  let parent = locations.find((place) => place.id === location.parent_id)
  while (parent) {
    names.unshift(parent.name)
    parent = locations.find((place) => place.id === parent.parent_id)
  }
  return names.join(' → ')
}

function locationContains(itemLocationId, selectedId, locations) {
  let location = locations.find((place) => place.id === itemLocationId)
  while (location) {
    if (location.id === selectedId) return true
    location = locations.find((place) => place.id === location.parent_id)
  }
  return false
}

function searchableText(item) {
  return [item.name, item.category, item.description, item.characteristics, item.storage_detail, item.locationPath, ...(item.tags ?? [])]
    .filter(Boolean).join(' ').toLowerCase()
}

function hasWords(value) {
  return /[\p{L}\p{N}]/u.test(value?.trim() || '')
}

function displayItemName(value) {
  const name = value?.trim() || ''
  return hasWords(name) ? name : 'Untitled item'
}

function displayCategory(value) {
  const category = value?.trim() || ''
  return hasWords(category) ? category : 'Other'
}

async function compressImage(file) {
  let bitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error('This photo could not be opened. Try a JPG, PNG, or WebP image.')
  }
  const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  let quality = 0.86
  let blob = await canvasToBlob(canvas, quality)
  while (blob.size > 5_800_000 && quality > 0.42) {
    quality -= 0.12
    blob = await canvasToBlob(canvas, quality)
  }
  if (blob.size > 5_800_000) throw new Error('This photo is too large to save. Choose a smaller image.')
  return new File([blob], 'item-photo.jpg', { type: 'image/jpeg' })
}

function canvasToBlob(canvas, quality) {
  return new Promise((resolve, reject) => canvas.toBlob(
    (blob) => blob ? resolve(blob) : reject(new Error('Could not prepare this photo. Try another image.')),
    'image/jpeg',
    quality,
  ))
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Could not prepare this photo for recognition.'))
    reader.readAsDataURL(file)
  })
}
