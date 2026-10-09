import { useEffect, useRef, useState } from 'react'

const DEVICE_ID = 'device-001'

const BASE_LAT = 14.5995
const BASE_LNG = 120.9842

const VOICE_COMMANDS = {
  left: 'Obstacle on the left. Move right.',
  center: 'Obstacle ahead. Stop or move around.',
  right: 'Obstacle on the right. Move left.',
  multiple: 'Obstacles detected. Stop.'
}

function randomId() {
  return Math.random().toString(36).slice(2, 10)
}

function randomDirection() {
  const roll = Math.random()
  if (roll < 0.3) return 'left'
  if (roll < 0.6) return 'right'
  if (roll < 0.85) return 'center'
  return 'multiple'
}

function makeObstacleEvent(offsetMinutes) {
  const direction = randomDirection()
  const distanceCm = Math.round(30 + Math.random() * 90)
  const severity = distanceCm <= 50 ? 'danger' : 'warning'
  return {
    id: randomId(),
    deviceId: DEVICE_ID,
    direction,
    distanceCm,
    severity,
    voiceCommand: VOICE_COMMANDS[direction],
    latitude: BASE_LAT + (Math.random() - 0.5) * 0.004,
    longitude: BASE_LNG + (Math.random() - 0.5) * 0.004,
    timestamp: new Date(Date.now() - offsetMinutes * 60_000).toISOString()
  }
}

export function seedObstacleEvents(count = 8) {
  return Array.from({ length: count }, (_, i) => makeObstacleEvent(i * 6)).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )
}

export function seedDeviceStatus() {
  return {
    deviceId: DEVICE_ID,
    deviceName: 'Smart Glasses \u2014 Unit 01',
    batteryLevel: 76,
    wifiStatus: 'online',
    gpsStatus: 'online',
    bluetoothStatus: 'online',
    lastSeen: new Date().toISOString()
  }
}

export function seedLocationHistory(count = 12) {
  return Array.from({ length: count }, (_, i) => ({
    id: randomId(),
    deviceId: DEVICE_ID,
    latitude: BASE_LAT + Math.sin(i / 3) * 0.003,
    longitude: BASE_LNG + Math.cos(i / 4) * 0.003,
    speed: Math.round(Math.random() * 4 * 10) / 10,
    accuracy: Math.round(3 + Math.random() * 5),
    timestamp: new Date(Date.now() - (count - i) * 5 * 60_000).toISOString()
  }))
}

export function useMockTelemetry() {
  const [events, setEvents] = useState(() => seedObstacleEvents())
  const [status, setStatus] = useState(() => seedDeviceStatus())
  const [history] = useState(() => seedLocationHistory())
  const [currentLocation, setCurrentLocation] = useState(() => history[history.length - 1])
  const tick = useRef(0)

  useEffect(() => {
    const interval = setInterval(() => {
      tick.current += 1

      if (tick.current % 2 === 0) {
        setEvents((prev) => [makeObstacleEvent(0), ...prev].slice(0, 20))
      }

      setCurrentLocation((prev) => ({
        ...prev,
        id: randomId(),
        latitude: prev.latitude + (Math.random() - 0.5) * 0.0006,
        longitude: prev.longitude + (Math.random() - 0.5) * 0.0006,
        speed: Math.round(Math.random() * 4 * 10) / 10,
        timestamp: new Date().toISOString()
      }))

      setStatus((prev) => ({
        ...prev,
        batteryLevel: prev.batteryLevel ? Math.max(5, prev.batteryLevel - 0.4) : prev.batteryLevel,
        lastSeen: new Date().toISOString()
      }))
    }, 4000)

    return () => clearInterval(interval)
  }, [])

  return { events, status, history, currentLocation }
}
