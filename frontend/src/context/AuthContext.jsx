import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return
      if (error) console.error('Session restore failed:', error.message)
      setSession(data?.session ?? null)
      setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setLoading(false)
    })
    return () => { active = false; listener.subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    let active = true
    async function loadProfile() {
      if (!session?.user) { setProfile(null); return }
      const user = session.user
      const meta = user.user_metadata || {}
      const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
      if (error) console.error('Profile lookup failed:', error.message)
      if (data) { if (active) setProfile(data); return }
      const { data: created, error: createError } = await supabase.from('profiles').upsert({
        id: user.id, name: meta.name || user.email?.split('@')[0] || 'User', email: user.email || '',
        role: ['family_member', 'caregiver', 'visually_impaired_user', 'admin'].includes(meta.role) ? meta.role : 'family_member'
      }).select().maybeSingle()
      if (createError) console.error('Profile setup failed:', createError.message)
      if (active && created) setProfile(created)
    }
    loadProfile()
    return () => { active = false }
  }, [session?.user?.id])

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    return { error }
  }
  async function signUp(email, password, name, role) {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(), password,
      options: { data: { name: name.trim(), role } }
    })
    if (error) return { error }
    if (data.session && data.user) {
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: data.user.id, name: name.trim(), email: data.user.email || email.trim(), role
      })
      if (profileError) return { error: new Error(`Your account was created, but profile setup failed: ${profileError.message}. Run the latest supabase/schema.sql in your Supabase SQL Editor.`) }
    }
    return { error: null, needsConfirmation: !data.session }
  }
  async function resetPassword(email) {
    return supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin })
  }
  async function signOut() { await supabase.auth.signOut() }

  return <AuthContext.Provider value={{ session, profile, loading, signIn, signUp, resetPassword, signOut }}>{children}</AuthContext.Provider>
}
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside an AuthProvider')
  return context
}
