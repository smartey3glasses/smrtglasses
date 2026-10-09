import { Compass, History, LayoutGrid, LogOut, Settings2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

const NAV_ITEMS = [
  { label: 'Overview', icon: LayoutGrid, active: true },
  { label: 'Live map', icon: Compass, comingInPhase: 4 },
  { label: 'Event log', icon: History, comingInPhase: 5 },
  { label: 'Settings', icon: Settings2, comingInPhase: 7 }
]

export default function Sidebar() {
  const { profile, session, signOut } = useAuth()

  return (
    <aside className="hidden w-64 shrink-0 flex-col justify-between bg-ink px-5 py-6 md:flex">
      <div>
        <div className="mb-10 flex items-center gap-2.5 px-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-signal-light">
            <Compass className="h-4 w-4 text-ink" strokeWidth={2.5} />
          </div>
          <div>
            <p className="font-display text-sm font-semibold tracking-wide text-white">
              Smart Glasses
            </p>
            <p className="text-[11px] text-ash-400">Monitoring system</p>
          </div>
        </div>

        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.label}
                type="button"
                disabled={!item.active}
                className={`flex items-center justify-between rounded-md px-3 py-2.5 text-left text-sm transition-colors ${
                  item.active
                    ? 'bg-ink-600 text-white'
                    : 'text-ash-400 hover:text-ash-200 disabled:cursor-not-allowed'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon className="h-4 w-4" strokeWidth={2} />
                  {item.label}
                </span>
                {item.comingInPhase && (
                  <span className="rounded-sm border border-ink-600 px-1.5 py-0.5 font-mono text-[10px] text-ash-400">
                    P{item.comingInPhase}
                  </span>
                )}
              </button>
            )
          })}
        </nav>
      </div>

      <div className="rounded-md border border-ink-600 px-3 py-3">
        <p className="truncate text-sm font-medium text-white">
          {profile?.name || session?.user?.email || 'Signed in'}
        </p>
        <p className="mb-3 text-[11px] capitalize text-ash-400">
          {profile?.role?.replace(/_/g, ' ') || 'Loading role\u2026'}
        </p>
        <button
          type="button"
          onClick={signOut}
          className="flex w-full items-center gap-2 rounded-sm border border-ink-600 px-2.5 py-1.5 text-xs text-ash-200 transition-colors hover:bg-ink-600"
        >
          <LogOut className="h-3.5 w-3.5" strokeWidth={2} />
          Sign out
        </button>
      </div>
    </aside>
  )
}
