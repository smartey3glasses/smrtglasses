import { useEffect, useState } from 'react'

function formatTimeAgo(iso) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (seconds < 5) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  return `${minutes}m ago`
}

export default function Topbar({ status }) {
  const [, forceTick] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => forceTick((n) => n + 1), 1000)
    return () => clearInterval(interval)
  }, [])

  const isOnline = status.wifiStatus === 'online'

  return (
    <header className="flex items-center justify-between border-b border-line bg-paper px-6 py-4 md:px-8">
      <div>
        <h1 className="font-display text-lg font-semibold text-ash-900">Overview</h1>
        <p className="text-sm text-ash-600">{status.deviceName}</p>
      </div>

      <div className="flex items-center gap-2 rounded-md border border-line bg-white px-3 py-1.5">
        <span className="relative flex h-2 w-2">
          {isOnline && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-signal-light opacity-60" />
          )}
          <span
            className={`relative inline-flex h-2 w-2 rounded-full ${
              isOnline ? 'bg-signal-light' : 'bg-danger'
            }`}
          />
        </span>
        <span className="text-xs font-medium text-ash-600">
          {isOnline ? 'Connected' : 'Offline'} &middot; last seen {formatTimeAgo(status.lastSeen)}
        </span>
      </div>
    </header>
  )
}
