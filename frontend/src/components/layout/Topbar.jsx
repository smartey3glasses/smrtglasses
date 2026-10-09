import { RefreshCw } from 'lucide-react'

export default function Topbar({ status, pageTitle, onRefresh, refreshing }) {
  const demo = status.wifiStatus === 'demo'
  const online = status.wifiStatus === 'online'
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-paper px-5 py-4 md:px-8">
      <div>
        <h1 className="font-display text-lg font-semibold text-ash-900">{pageTitle}</h1>
        <p className="text-sm text-ash-600">{status.deviceName || 'Smart Glasses'}</p>
      </div>
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-2 text-xs font-medium text-ash-600">
          <span className={`h-2 w-2 rounded-full ${demo ? 'bg-amber' : online ? 'bg-signal-light' : 'bg-danger'}`} />
          {demo ? 'Demo mode' : online ? 'Connected' : 'Offline'}
        </span>
        <button type="button" onClick={onRefresh} disabled={refreshing} className="flex items-center gap-2 border border-line bg-white px-3 py-2 text-xs font-medium text-ash-700 hover:bg-ash-50 disabled:opacity-50">
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />Refresh
        </button>
      </div>
    </header>
  )
}
