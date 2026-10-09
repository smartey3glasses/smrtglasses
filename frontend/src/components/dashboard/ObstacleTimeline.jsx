import { ArrowLeft, ArrowRight, ArrowUp, TriangleAlert } from 'lucide-react'

const DIRECTION_ICON = {
  left: ArrowLeft,
  center: ArrowUp,
  right: ArrowRight,
  multiple: TriangleAlert
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export default function ObstacleTimeline({ events }) {
  return (
    <div className="rounded-lg border border-line bg-white p-5 shadow-panel">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-sm font-semibold text-ash-900">Recent obstacle events</h2>
        <span className="font-mono text-xs text-ash-400">{events.length} logged</span>
      </div>

      {events.length === 0 ? (
        <p className="py-6 text-center text-sm text-ash-600">
          No events yet. They will appear here the moment a sensor trips.
        </p>
      ) : (
        <ul className="flex max-h-80 flex-col divide-y divide-line overflow-y-auto">
          {events.map((event) => {
            const Icon = DIRECTION_ICON[event.direction]
            const severityStyle =
              event.severity === 'danger'
                ? 'bg-danger-soft text-danger'
                : 'bg-amber-soft text-amber'
            return (
              <li key={event.id} className="flex items-center gap-3 py-3">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${severityStyle}`}>
                  <Icon className="h-4 w-4" strokeWidth={2} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ash-900">{event.voiceCommand}</p>
                  <p className="text-xs text-ash-600">
                    {event.distanceCm} cm &middot; {event.severity}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-xs text-ash-400">
                  {formatTime(event.timestamp)}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
