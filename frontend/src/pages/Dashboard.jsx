import { useTelemetry } from '@/lib/useTelemetry'
import { useLinkedDevice } from '@/lib/useLinkedDevice'
import DashboardLayout from '@/components/layout/DashboardLayout'
import ObstacleRadar from '@/components/dashboard/ObstacleRadar'
import DeviceStatusCard from '@/components/dashboard/DeviceStatusCard'
import ObstacleTimeline from '@/components/dashboard/ObstacleTimeline'
import LiveMap from '@/components/dashboard/LiveMap'
import StatPill from '@/components/dashboard/StatPill'
import DeviceLinkBanner from '@/components/dashboard/DeviceLinkBanner'
import { FlaskConical } from 'lucide-react'

export default function Dashboard() {
  const { events, status, history, currentLocation } = useTelemetry()
  const { device, loading: deviceLoading, error: deviceError } = useLinkedDevice()

  const dangerCount = events.filter((e) => e.severity === 'danger').length
  const averageDistance =
    events.length > 0
      ? Math.round(events.reduce((sum, e) => sum + e.distanceCm, 0) / events.length)
      : null

  return (
    <DashboardLayout status={status}>
      <div className="dashboard-main">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div><p className="mb-2 text-[10px] font-bold uppercase tracking-[1.7px] text-ash-600">Smart Glasses / Monitoring system</p><h1 className="dashboard-heading">Your overview</h1><p className="mt-2 text-sm text-ash-600">A quick read on device status, movement, and nearby obstacles.</p></div>
        <p className="text-xs text-ash-600">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</p>
      </header>
      <div className="sample-banner mb-5 flex items-start gap-3"><FlaskConical size={17} className="mt-0.5 shrink-0"/><p><strong>Prototype preview · sample data</strong><br/>The glasses and sensors are not connected yet. Readings, movement, and device status shown here are simulated for testing, not live safety information.</p></div>
      <DeviceLinkBanner device={device} loading={deviceLoading} error={deviceError} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatPill label="Events logged" value={String(events.length)} hint="last session" />
        <StatPill
          label="Danger alerts"
          value={String(dangerCount)}
          hint="distance under 50 cm"
        />
        <StatPill
          label="Average distance"
          value={averageDistance !== null ? `${averageDistance} cm` : '\u2014'}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <LiveMap current={currentLocation} history={history} />
        </div>
        <div className="rounded-lg border border-line bg-white p-5 shadow-panel">
          <h2 className="font-display text-sm font-semibold text-ash-900">Obstacle zones</h2>
          <p className="mt-1 text-xs text-ash-600">Live reading from the three ToF sensors</p>
          <div className="mt-2">
            <ObstacleRadar latest={events[0]} />
          </div>
        </div>
      </div>

      <div className="mt-7 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2"><ObstacleTimeline events={events} /></div>
        <DeviceStatusCard status={status} />
      </div>
      <p className="mt-7 border-t border-line pt-4 text-[10px] leading-5 text-ash-400">Prototype data is generated locally in this browser session. Do not use these readings for navigation or emergency decisions.</p>
      </div>
    </DashboardLayout>
  )
}
