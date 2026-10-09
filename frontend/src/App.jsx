import { LoaderCircle } from 'lucide-react'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import { isSupabaseConfigured } from '@/lib/supabaseClient'

function Gate() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper">
        <LoaderCircle className="h-6 w-6 animate-spin text-signal-light" />
      </div>
    )
  }

  return session ? <Dashboard /> : <Login />
}

export default function App() {
  if (!isSupabaseConfigured) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-paper px-6 py-12">
        <section className="w-full max-w-xl border border-line bg-white p-8 sm:p-10">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-signal">Setup required</p>
          <h1 className="font-display text-3xl font-semibold text-ash-900">Connect your database</h1>
          <p className="mt-4 text-sm leading-6 text-ash-600">Add your Supabase project URL and anon or publishable key to a <code>.env.local</code> file using <code>.env.example</code> as the template, then restart the development server.</p>
        </section>
      </main>
    )
  }

  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  )
}
