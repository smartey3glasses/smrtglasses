import { useEffect, useState } from 'react'
import { useMockTelemetry } from '@/lib/mockData'

const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api'

export function useTelemetry() {
  const demo = useMockTelemetry()
  const [remote, setRemote] = useState(null)

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    async function loadTelemetry() {
      try {
        const response = await fetch(`${apiBase}/telemetry`, { signal: controller.signal })
        if (!response.ok) throw new Error('Telemetry API unavailable')
        const payload = await response.json()
        if (cancelled || payload.mode !== 'mock') return

        const events = (payload.events || []).map((event, index) => {
          const distanceCm = Number(event.distanceCm ?? 100)
          const direction = ['left', 'center', 'right'].includes(event.direction) ? event.direction : 'center'
          const severity = distanceCm <= 50 ? 'danger' : 'warning'
          return {
            id: event.id || `api-event-${index}`,
            deviceId: payload.device?.id || 'demo-glasses-001',
            direction,
            distanceCm,
            severity,
            voiceCommand: direction === 'left' ? 'Obstacle on the left. Move right.' : direction === 'right' ? 'Obstacle on the right. Move left.' : 'Obstacle ahead. Stop or move around.',
            latitude: payload.location?.latitude ?? 13.1391,
            longitude: payload.location?.longitude ?? 123.7438,
            timestamp: event.occurredAt || new Date().toISOString()
          }
        })

        const location = {
          id: 'api-current-location',
          deviceId: payload.device?.id || 'demo-glasses-001',
          latitude: payload.location?.latitude ?? 13.1391,
          longitude: payload.location?.longitude ?? 123.7438,
          speed: 0,
          accuracy: 5,
          timestamp: payload.location?.recordedAt || new Date().toISOString()
        }

        setRemote({
          events: events.length ? events : demo.events,
          status: {
            deviceId: payload.device?.id || 'demo-glasses-001',
            deviceName: payload.device?.name || 'Smart Glasses',
            batteryLevel: payload.device?.batteryPercent ?? 86,
            wifiStatus: 'demo',
            gpsStatus: 'demo',
            bluetoothStatus: 'demo',
            lastSeen: payload.device?.lastSeen || new Date().toISOString()
          },
          history: [location],
          currentLocation: location
        })
      } catch {
        if (!cancelled) setRemote(null)
      }
    }

    loadTelemetry()
    const interval = setInterval(loadTelemetry, 15000)
    return () => {
      cancelled = true
      controller.abort()
      clearInterval(interval)
    }
  }, [])

  return remote || demo
}
