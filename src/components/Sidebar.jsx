import { Camera, Home, MapPin, Search, Shapes, LogOut } from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'
import Brand from './Brand.jsx'
import { useAuth } from '../hooks/useAuth.js'

const links = [
  { label: 'Scan item', to: '/app/scan', icon: Camera },
  { label: 'My items', to: '/app/items', icon: Shapes },
  { label: 'Locations', to: '/app/locations', icon: MapPin },
  { label: 'Find my item', to: '/app/find', icon: Search },
]

export default function Sidebar({ onNavigate, onSignOut }) {
  const { user } = useAuth()
  return (
    <aside className="simple-sidebar">
      <div className="simple-brand"><Brand /></div>
      <Link to="/app" className="simple-home-link" onClick={onNavigate}><Home size={17} />Home</Link>
      <span className="simple-nav-label">YOUR STUFF</span>
      <nav className="simple-side-nav" aria-label="Main navigation">
        {links.map(({ label, to, icon: Icon }) => (
          <NavLink key={to} to={to} onClick={onNavigate} className={({ isActive }) => `simple-nav-link${isActive ? ' active' : ''}`}>
            <Icon size={18} strokeWidth={1.8} /><span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="simple-sidebar-bottom">
        <p>{user.user_metadata?.full_name || user.email}</p>
        <button className="simple-sign-out" onClick={onSignOut}><LogOut size={16} />Sign out</button>
      </div>
    </aside>
  )
}
