import { Battery, Bluetooth, Satellite, Wifi } from 'lucide-react'

function stateColor(state) {
  if (state === 'online') return 'text-signal-light'
  if (state === 'searching') return 'text-amber'
  return 'text-danger'
}

function stateLabel(state) {
  if (state === 'online') return 'Connected'
  if (state === 'searching') return 'Searching'
  return 'Offline'
}

function batteryColor(level) {
  if (level === null) return 'text-ash-400'
  if (level > 30) return 'text-signal-light'
  return 'text-danger'
}

export default function DeviceStatusCard({ status }) {
  const rows = [
    {
      label: 'Battery',
      icon: Battery,
      color: batteryColor(status.batteryLevel),
      value: status.batteryLevel !== null ? `${Math.round(status.batteryLevel)}%` : 'Unavailable'
    },
    {
      label: 'Wi-Fi',
      icon: Wifi,
      color: stateColor(status.wifiStatus),
      value: stateLabel(status.wifiStatus)
    },
    {
      label: 'GPS',
      icon: Satellite,
      color: stateColor(status.gpsStatus),
      value: stateLabel(status.gpsStatus)
    },
    {
      label: 'Bluetooth',
      icon: Bluetooth,
      color: stateColor(status.bluetoothStatus),
      value: stateLabel(status.bluetoothStatus)
    }
  ]

  return (
    <div className="rounded-lg border border-line bg-white p-5 shadow-panel">
      <h2 className="font-display text-sm font-semibold text-ash-900">Device status</h2>
      <div className="mt-4 grid grid-cols-2 gap-4">
        {rows.map((row) => {
          const Icon = row.icon
          return (
            <div key={row.label} className="flex items-start gap-2.5">
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${row.color}`} strokeWidth={2} />
              <div>
                <p className="text-xs text-ash-600">{row.label}</p>
                <p className="text-sm font-medium text-ash-900">{row.value}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
