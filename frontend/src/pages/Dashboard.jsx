import { useMemo, useState } from 'react'
import { Download, MapPin, Search, Settings2, ShieldCheck, Watch, Bell, BellOff, RotateCcw, Activity, FileBarChart, AlertTriangle } from 'lucide-react'
import { useTelemetry } from '@/lib/useTelemetry'
import { useLinkedDevice } from '@/lib/useLinkedDevice'
import DashboardLayout from '@/components/layout/DashboardLayout'
import ObstacleRadar from '@/components/dashboard/ObstacleRadar'
import DeviceStatusCard from '@/components/dashboard/DeviceStatusCard'
import ObstacleTimeline from '@/components/dashboard/ObstacleTimeline'
import LiveMap from '@/components/dashboard/LiveMap'
import StatPill from '@/components/dashboard/StatPill'
import DeviceLinkBanner from '@/components/dashboard/DeviceLinkBanner'

const TITLES = { overview: 'Monitoring overview', location: 'Location', events: 'Event log', alerts: 'Alerts', device: 'Device status', reports: 'Reports', settings: 'Settings' }

function downloadEvents(events) {
  const header = ['Time', 'Direction', 'Distance (cm)', 'Severity', 'Message']
  const rows = events.map((event) => [event.timestamp, event.direction, event.distanceCm, event.severity, event.voiceCommand])
  const csv = [header, ...rows].map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'smart-glasses-event-log.csv'
  link.click()
  URL.revokeObjectURL(url)
}

function SectionHeading({ title, description, action }) {
  return <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><h2 className="font-display text-xl font-semibold text-ash-900">{title}</h2><p className="mt-1 text-sm text-ash-600">{description}</p></div>{action}</div>
}

export default function Dashboard() {
  const { events, status, history, currentLocation } = useTelemetry()
  const { device, loading: deviceLoading, error: deviceError } = useLinkedDevice()
  const [page, setPage] = useState('overview')
  const [query, setQuery] = useState('')
  const [severity, setSeverity] = useState('all')
  const [refreshing, setRefreshing] = useState(false)
  const [alertsEnabled, setAlertsEnabled] = useState(() => localStorage.getItem('sg-alerts') !== 'off')
  const [units, setUnits] = useState(() => localStorage.getItem('sg-distance-units') || 'cm')

  const dangerCount = events.filter((event) => event.severity === 'danger').length
  const averageDistance = events.length ? Math.round(events.reduce((sum, event) => sum + event.distanceCm, 0) / events.length) : null
  const filteredEvents = useMemo(() => events.filter((event) => {
    const matchesQuery = `${event.voiceCommand} ${event.direction} ${event.distanceCm} ${event.severity}`.toLowerCase().includes(query.toLowerCase())
    return matchesQuery && (severity === 'all' || event.severity === severity)
  }), [events, query, severity])

  function refresh() {
    setRefreshing(true)
    window.setTimeout(() => setRefreshing(false), 650)
    window.dispatchEvent(new CustomEvent('smart-glasses-refresh'))
  }

  function changeAlerts(value) {
    setAlertsEnabled(value)
    localStorage.setItem('sg-alerts', value ? 'on' : 'off')
  }

  function changeUnits(value) {
    setUnits(value)
    localStorage.setItem('sg-distance-units', value)
  }

  const distance = (cm) => units === 'm' ? `${(cm / 100).toFixed(2)} m` : `${cm} cm`

  return (
    <DashboardLayout status={status} page={page} pageTitle={TITLES[page]} onNavigate={setPage} onRefresh={refresh} refreshing={refreshing}>
      <div className="dashboard-main">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div><p className="mb-1 text-[10px] font-bold uppercase tracking-[1.5px] text-ash-600">Smart Glasses / Caregiver monitoring</p><h1 className="dashboard-heading">{TITLES[page]}</h1><p className="mt-2 max-w-2xl text-sm text-ash-600">Review device status, sample obstacle readings, and recorded movement.</p></div>
          <p className="text-xs text-ash-600">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</p>
        </div>

        <div className="sample-banner mb-5 flex items-start gap-3"><ShieldCheck size={17} className="mt-0.5 shrink-0"/><p><strong>Prototype preview · simulated data</strong><br/>The glasses are not connected yet. Sensor readings, location, battery, and device status are sample data for interface testing, not live safety information.</p></div>
        <DeviceLinkBanner device={device} loading={deviceLoading} error={deviceError} />

        {page === 'overview' && <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3"><StatPill label="Events logged" value={String(events.length)} hint="sample session"/><StatPill label="Close-range alerts" value={String(dangerCount)} hint="50 cm or less"/><StatPill label="Average distance" value={averageDistance !== null ? distance(averageDistance) : '—'} hint="across listed events"/></div>
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3"><div className="lg:col-span-2"><LiveMap current={currentLocation} history={history}/></div><section className="rounded-lg border border-line bg-white p-5"><h2 className="font-display text-sm font-semibold text-ash-900">Obstacle direction</h2><p className="mt-1 text-xs text-ash-600">Illustrative readings from left, center, and right sensors</p><div className="mt-2"><ObstacleRadar latest={events[0]}/></div></section></div>
          <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3"><div className="lg:col-span-2"><ObstacleTimeline events={events.slice(0, 6)}/><button type="button" onClick={() => setPage('events')} className="mt-3 text-sm font-medium text-signal hover:underline">View full event log →</button></div><DeviceStatusCard status={status}/></div>
        </>}

        {page === 'location' && <><SectionHeading title="Recorded movement" description="The route below is generated from sample coordinates."/><LiveMap current={currentLocation} history={history}/><div className="mt-4 grid gap-3 sm:grid-cols-3"><StatPill label="Latitude" value={currentLocation.latitude.toFixed(5)}/><StatPill label="Longitude" value={currentLocation.longitude.toFixed(5)}/><StatPill label="Estimated speed" value={`${currentLocation.speed ?? 0} m/s`}/></div></>}

        {page === 'events' && <><SectionHeading title="Sensor event history" description={`${filteredEvents.length} of ${events.length} events shown.`} action={<button type="button" onClick={() => downloadEvents(filteredEvents)} className="editorial-action"><Download size={15}/>Export CSV</button>}/><div className="event-tools mb-4"><label className="event-search"><Search size={15} aria-hidden="true"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search direction, message, distance…" aria-label="Search events"/></label><div className="choice-rail" aria-label="Filter by severity">{[{value:'all',label:'Every event'},{value:'danger',label:'Close range'},{value:'warning',label:'Caution'}].map((item) => <button key={item.value} type="button" onClick={() => setSeverity(item.value)} aria-pressed={severity === item.value} className={severity === item.value ? 'choice-option is-active' : 'choice-option'}>{item.label}</button>)}</div></div><ObstacleTimeline events={filteredEvents}/>{filteredEvents.length === 0 && <div className="empty-state"><Search size={20}/><strong>No matching events</strong><span>Try a different search or severity.</span><button type="button" onClick={() => {setQuery('');setSeverity('all')}}>Clear filters</button></div>}</>}

        {page === 'alerts' && <><SectionHeading title="Alert review" description="Review close-range readings and choose whether alert highlights appear in this dashboard." action={<button type="button" onClick={() => setPage('settings')} className="editorial-action"><Settings2 size={15}/>Alert preferences</button>}/><div className="alert-summary"><div><span className="alert-summary-icon"><AlertTriangle size={20}/></span><p className="alert-eyebrow">Close-range readings</p><strong>{dangerCount}</strong><span>of {events.length} sample events</span></div><button type="button" className={alertsEnabled ? 'alert-toggle is-on' : 'alert-toggle'} onClick={() => changeAlerts(!alertsEnabled)} aria-pressed={alertsEnabled}><span className="alert-toggle-dot"/>{alertsEnabled ? 'Highlights on' : 'Highlights muted'}</button></div><ObstacleTimeline events={events.filter((event) => event.severity === 'danger')}/>{events.filter((event) => event.severity === 'danger').length === 0 && <div className="empty-state">No close-range readings in this sample set.</div>}<p className="sample-note">These are simulated readings. Dashboard highlights are not push notifications and should not be used as a safety alert.</p></>}

        {page === 'device' && <><SectionHeading title="Device information" description="Connection details for the selected monitoring unit."/><div className="mb-4 flex items-center gap-3 border border-line bg-white p-5"><div className="flex h-11 w-11 items-center justify-center bg-paper"><Watch size={22}/></div><div className="min-w-0 flex-1"><h3 className="font-semibold text-ash-900">{device?.device_name || status.deviceName || 'Smart Glasses · Demo unit 01'}</h3><p className="mt-1 text-xs text-ash-600">{device?.id || status.deviceId || 'demo-glasses-001'}</p></div><span className="border border-amber-soft bg-amber-soft px-2 py-1 text-xs text-amber">Demo mode</span></div><DeviceStatusCard status={status}/><div className="mt-4"><ObstacleRadar latest={events[0]}/></div></>}

        {page === 'reports' && <><SectionHeading title="Session report" description="A quick summary of the currently available sample readings." action={<button type="button" onClick={() => downloadEvents(events)} className="editorial-action"><Download size={15}/>Download event CSV</button>}/><div className="report-heading"><div><p>MONITORING SESSION</p><h2>Unit 01 <span>· Demo data</span></h2><small>Generated {new Date().toLocaleString()}</small></div><FileBarChart size={30}/></div><div className="report-grid"><div><span>Total events</span><strong>{events.length}</strong><small>Recorded in sample feed</small></div><div><span>Close-range</span><strong>{dangerCount}</strong><small>At or below 50 cm</small></div><div><span>Average distance</span><strong>{averageDistance !== null ? distance(averageDistance) : '—'}</strong><small>Across available events</small></div></div><SectionHeading title="Included in this report" description="Export contains timestamp, direction, distance, severity, and sample message."/><ObstacleTimeline events={events.slice(0,5)}/></>}

        {page === 'settings' && <><SectionHeading title="Preferences" description="These preferences are saved in this browser."/><div className="max-w-2xl divide-y divide-line border-y border-line bg-white">
          <div className="flex items-center justify-between gap-4 p-4"><div className="flex items-start gap-3"><Bell size={18} className="mt-0.5 text-ash-600"/><div><p className="text-sm font-medium text-ash-900">Alert preference</p><p className="mt-1 text-xs text-ash-600">Controls the dashboard alert preference only. It does not send push notifications.</p></div></div><button type="button" onClick={() => changeAlerts(!alertsEnabled)} aria-pressed={alertsEnabled} className="flex items-center gap-2 border border-line px-3 py-2 text-xs font-medium hover:bg-ash-50">{alertsEnabled ? <Bell size={14}/> : <BellOff size={14}/>} {alertsEnabled ? 'Enabled' : 'Muted'}</button></div>
          <div className="flex items-center justify-between gap-4 p-4"><div><p className="text-sm font-medium text-ash-900">Distance units</p><p className="mt-1 text-xs text-ash-600">Choose how distances appear on the dashboard.</p></div><div className="choice-rail compact" aria-label="Distance units">{[{value:'cm',label:'Centimeters'},{value:'m',label:'Meters'}].map((item) => <button key={item.value} type="button" onClick={() => changeUnits(item.value)} aria-pressed={units === item.value} className={units === item.value ? 'choice-option is-active' : 'choice-option'}>{item.label}</button>)}</div></div>
          <div className="flex items-center justify-between gap-4 p-4"><div><p className="text-sm font-medium text-ash-900">Sample data updates</p><p className="mt-1 text-xs text-ash-600">The demo feed currently refreshes automatically when available.</p></div><span className="border border-amber-soft bg-amber-soft px-2 py-1 text-xs text-amber">Simulated</span></div>
          <div className="flex items-center justify-between gap-4 p-4"><div><p className="text-sm font-medium text-ash-900">Restore preferences</p><p className="mt-1 text-xs text-ash-600">Return dashboard preferences to their defaults.</p></div><button type="button" onClick={() => { changeAlerts(true); changeUnits('cm'); setQuery(''); setSeverity('all') }} className="flex items-center gap-2 border border-line px-3 py-2 text-xs font-medium hover:bg-ash-50"><RotateCcw size={14}/>Reset</button></div>
        </div><p className="mt-4 flex items-center gap-2 text-xs text-ash-600"><Settings2 size={14}/>Account authentication is managed by Supabase. Hardware pairing is not available until device firmware and registration are implemented.</p></>}
        <p className="mt-7 border-t border-line pt-4 text-[10px] leading-5 text-ash-400">Sample data is for prototype testing only. Do not use these readings for navigation, emergency response, or safety decisions.</p>
      </div>
    </DashboardLayout>
  )
}
