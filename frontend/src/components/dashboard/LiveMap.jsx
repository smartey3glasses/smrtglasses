import { CircleMarker, MapContainer, Polyline, TileLayer, useMap } from 'react-leaflet'
import { useEffect } from 'react'

function RecenterOnMove({ lat, lng }) {
  const map = useMap()
  useEffect(() => {
    map.panTo([lat, lng], { animate: true })
  }, [lat, lng, map])
  return null
}

export default function LiveMap({ current, history }) {
  const path = [...history, current].map((point) => [point.latitude, point.longitude])

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-white shadow-panel">
      <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
        <h2 className="font-display text-sm font-semibold text-ash-900">Current location</h2>
        <span className="font-mono text-xs text-ash-400">
          {current.latitude.toFixed(5)}, {current.longitude.toFixed(5)}
        </span>
      </div>
      <div className="h-72 w-full">
        <MapContainer
          center={[current.latitude, current.longitude]}
          zoom={16}
          scrollWheelZoom={false}
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Polyline positions={path} pathOptions={{ color: '#146D68', weight: 3, opacity: 0.6 }} />
          <CircleMarker
            center={[current.latitude, current.longitude]}
            radius={8}
            pathOptions={{ color: '#146D68', fillColor: '#1B8A85', fillOpacity: 1, weight: 2 }}
          />
          <RecenterOnMove lat={current.latitude} lng={current.longitude} />
        </MapContainer>
      </div>
    </div>
  )
}
