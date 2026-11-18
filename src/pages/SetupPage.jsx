import { ArrowLeft, CircleHelp } from 'lucide-react'
import { Link } from 'react-router-dom'
import Brand from '../components/Brand.jsx'

export default function SetupPage() {
  return <main className="simple-setup-page">
    <Brand />
    <section className="simple-setup-card">
      <span className="simple-setup-icon"><CircleHelp size={22} /></span>
      <p className="simple-eyebrow">ONE QUICK SETUP</p>
      <h1>Connect your Supabase project</h1>
      <p>This app needs Supabase for your account, saved items, and private photos. No demo data will be shown as if it were yours.</p>
      <ol>
        <li>Create a <strong>`.env`</strong> file from <strong>`.env.example`</strong>.</li>
        <li>Add your Supabase project URL and publishable anon key.</li>
        <li>Run the SQL in <strong>`supabase/schema.sql`</strong> in the Supabase SQL Editor.</li>
        <li>Restart the app with <strong>`npm run dev`</strong>.</li>
      </ol>
      <div className="simple-setup-note">The OpenAI key is only needed for photo suggestions. You can still add items manually without it.</div>
      <Link to="/" className="simple-back-link"><ArrowLeft size={15} />Back to the home page</Link>
    </section>
  </main>
}
