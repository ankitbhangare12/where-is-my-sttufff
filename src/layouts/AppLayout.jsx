import { useCallback, useEffect, useState } from 'react'
import { Menu, Search, X } from 'lucide-react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import Sidebar from '../components/Sidebar.jsx'
import { useAuth } from '../hooks/useAuth.js'
import { listItems } from '../services/items.js'
import { listLocations } from '../services/locations.js'
import { supabase } from '../lib/supabase.js'

const pageTitles = {
  scan: 'Scan item',
  items: 'My items',
  locations: 'My locations',
  find: 'Find my item',
}

export default function AppLayout() {
  const { user, session } = useAuth()
  const [items, setItems] = useState([])
  const [locations, setLocations] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [showNav, setShowNav] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const currentPage = location.pathname.split('/').filter(Boolean).at(-1) || 'scan'

  const reload = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const [nextItems, nextLocations] = await fetchInventory()
      setItems(nextItems)
      setLocations(nextLocations)
    } catch (error) {
      setLoadError(error.message || 'Could not load your saved items.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    fetchInventory().then(([nextItems, nextLocations]) => {
      if (active) {
        setItems(nextItems)
        setLocations(nextLocations)
      }
    }).catch((error) => {
      if (active) setLoadError(error.message || 'Could not load your saved items.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [user.id])

  async function signOut() {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) toast.error(error.message)
      else navigate('/login', { replace: true })
    } catch (error) {
      toast.error(error.message || 'Could not sign out. Try again.')
    }
  }

  const outletContext = {
    items,
    locations,
    search,
    setSearch,
    loading,
    loadError,
    reload,
    user,
    session,
  }

  return (
    <div className={`simple-shell${showNav ? ' nav-open' : ''}`}>
      {showNav && <button className="simple-scrim" onClick={() => setShowNav(false)} aria-label="Close navigation" />}
      <Sidebar onNavigate={() => setShowNav(false)} onSignOut={signOut} />
      <div className="simple-main">
        <header className="simple-topbar">
          <button className="simple-menu" onClick={() => setShowNav((value) => !value)} aria-label={showNav ? 'Close menu' : 'Open menu'}>
            {showNav ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="simple-crumb"><Link to="/app">My home</Link><span>/</span><strong>{pageTitles[currentPage] || 'My home'}</strong></div>
          <form className="simple-header-search" onSubmit={(event) => {
            event.preventDefault()
            navigate('/app/find')
          }}>
            <Search size={16} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search your belongings…" aria-label="Search your belongings" />
          </form>
          <Link to="/app/scan" className="simple-scan-link"><span>+</span><span>Scan item</span></Link>
        </header>
        <main className="simple-content">
          {loadError && <div className="load-error" role="alert"><strong>We couldn’t load your saved things.</strong><span>{loadError}</span><button className="text-button" onClick={reload}>Try again</button></div>}
          <Outlet context={outletContext} />
        </main>
        <nav className="simple-mobile-nav" aria-label="Main navigation">
          <MobileLink to="/app" label="Home" symbol="⌂" active={currentPage === 'app'} />
          <MobileLink to="/app/scan" label="Scan" symbol="＋" active={currentPage === 'scan'} />
          <MobileLink to="/app/items" label="My items" symbol="▤" active={currentPage === 'items'} />
          <MobileLink to="/app/locations" label="Locations" symbol="⌖" active={currentPage === 'locations'} />
          <MobileLink to="/app/find" label="Find" symbol="⌕" active={currentPage === 'find'} />
        </nav>
      </div>
    </div>
  )
}

function fetchInventory() {
  return Promise.all([listItems(), listLocations()])
}

function MobileLink({ to, label, symbol, active }) {
  return <Link to={to} className={`simple-mobile-link${active ? ' active' : ''}`} aria-current={active ? 'page' : undefined}>
    <span>{symbol}</span><small>{label}</small>
  </Link>
}
