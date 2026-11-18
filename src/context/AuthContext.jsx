import { useEffect, useMemo, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabase.js'

import { AuthContext } from './authContext.js'

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)

  useEffect(() => {
    if (!supabase) return undefined

    let active = true
    let authEventObserved = false
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      authEventObserved = true
      setSession(nextSession)
      setLoading(false)
    })

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) console.error('Unable to restore the Supabase session:', error.message)
      if (active && !authEventObserved) {
        setSession(data?.session ?? null)
        setLoading(false)
      }
    }).catch((error) => {
      console.error('Unable to restore the Supabase session:', error.message)
      if (active && !authEventObserved) {
        setSession(null)
        setLoading(false)
      }
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const value = useMemo(() => ({
    session,
    user: session?.user ?? null,
    loading,
    configured: isSupabaseConfigured,
  }), [session, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
