import { ArrowRight, Camera, MapPin, Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import Brand from '../components/Brand.jsx'

export default function LandingPage() {
  return (
    <div className="simple-landing">
      <header className="simple-landing-header"><Brand /><Link to="/login" className="simple-login-link">Sign in <ArrowRight size={15} /></Link></header>
      <main>
        <section className="simple-hero">
          <div className="simple-hero-copy">
            <span className="simple-eyebrow">A LITTLE LESS LOOKING</span>
            <h1>Your belongings,<br /><span>always easy to find.</span></h1>
            <p>Take a photo, add where you keep it, and find it again whenever you need it.</p>
            <div className="simple-hero-actions"><Link to="/signup" className="simple-primary-button">Get started <ArrowRight size={16} /></Link><Link to="/login" className="simple-secondary-link">I already have an account</Link></div>
            <div className="simple-steps"><span><Camera size={16} /> Take a photo</span><i /><span><MapPin size={16} /> Add its place</span><i /><span><Search size={16} /> Find it later</span></div>
          </div>
          <div className="simple-hero-photo" aria-hidden="true"><div className="simple-photo-card"><div className="simple-photo-graphic"><span className="photo-case" /><span className="photo-cup" /><span className="photo-plant">✳</span><span className="photo-book" /></div><div className="simple-photo-caption"><span><strong>Headphones</strong><small>Bedroom → Study table → Top drawer</small></span><MapPin size={18} /></div></div></div>
        </section>
        <section className="simple-landing-foot"><span>Simple to use. Private to you.</span><span>Your saved photos are private to your account.</span></section>
      </main>
    </div>
  )
}
