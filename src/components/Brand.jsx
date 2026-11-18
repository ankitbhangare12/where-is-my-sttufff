import { Box } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function Brand({ light = false }) {
  return (
    <Link className={`brand${light ? ' brand-light' : ''}`} to="/" aria-label="Where Is My Stuff home">
      <span className="brand-mark"><Box size={17} strokeWidth={2.2} /></span>
      <span>where is my <strong>stuff?</strong></span>
    </Link>
  )
}
