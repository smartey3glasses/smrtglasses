import { Activity, Compass, History, LayoutGrid, LogOut, Settings2, Watch } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'location', label: 'Location', icon: Compass },
  { id: 'events', label: 'Event log', icon: History },
  { id: 'device', label: 'Device status', icon: Watch },
  { id: 'settings', label: 'Settings', icon: Settings2 }
]

export default function Sidebar({ page, onNavigate }) {
  const { profile, session, signOut } = useAuth()

  return (
    <aside className="flex w-full shrink-0 flex-col justify-between bg-ink px-4 py-4 md:min-h-screen md:w-64 md:px-5 md:py-6">
      <div>
        <div className="mb-5 flex items-center gap-2.5 px-1 md:mb-10">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-signal-light">
            <Activity className="h-4 w-4 text-ink" strokeWidth={2.5} />
          </div>
          <div>
            <p className="font-display text-sm font-semibold tracking-wide text-white">Smart Glasses</p>
            <p className="text-[11px] text-ash-400">Monitoring system</p>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto md:flex-col" aria-label="Main navigation">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" onClick={() => onNavigate(id)} aria-current={page === id ? 'page' : undefined}
              className={`flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2.5 text-left text-sm transition-colors ${page === id ? 'bg-ink-600 text-white' : 'text-ash-400 hover:bg-ink-600 hover:text-white'}`}>
              <Icon className="h-4 w-4" strokeWidth={2} />{label}
            </button>
          ))}
        </nav>
      </div>
      <div className="mt-3 rounded-md border border-ink-600 px-3 py-3 md:mt-4">
        <p className="truncate text-sm font-medium text-white">{profile?.name || session?.user?.email || 'Signed in'}</p>
        <p className="mb-3 text-[11px] capitalize text-ash-400">{profile?.role?.replace(/_/g, ' ') || 'Caregiver account'}</p>
        <button type="button" onClick={signOut} className="flex w-full items-center gap-2 rounded-sm border border-ink-600 px-2.5 py-1.5 text-xs text-ash-200 transition-colors hover:bg-ink-600">
          <LogOut className="h-3.5 w-3.5" strokeWidth={2} />Sign out
        </button>
      </div>
    </aside>
  )
}
