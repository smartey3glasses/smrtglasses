const now = Date.now()

export function getMockTelemetry() {
  return {
    mode: 'mock',
    disclaimer: 'Demo data only. These readings are simulated and must not be used for safety decisions.',
    device: {
      id: 'demo-glasses-001',
      name: 'Smart Glasses',
      status: 'demo',
      batteryPercent: 86,
      lastSeen: new Date(now).toISOString()
    },
    location: {
      latitude: 13.1391,
      longitude: 123.7438,
      label: 'Demo location, Legazpi City',
      recordedAt: new Date(now).toISOString()
    },
    sensors: {
      leftDistanceCm: 145,
      centerDistanceCm: 92,
      rightDistanceCm: 178,
      obstacleDetected: false
    },
    events: [
      { id: 'demo-event-1', type: 'obstacle', direction: 'center', distanceCm: 92, occurredAt: new Date(now - 4 * 60000).toISOString() },
      { id: 'demo-event-2', type: 'system', direction: 'device', message: 'Demo telemetry loaded', occurredAt: new Date(now - 12 * 60000).toISOString() },
      { id: 'demo-event-3', type: 'battery', direction: 'device', batteryPercent: 86, occurredAt: new Date(now - 21 * 60000).toISOString() }
    ]
  }
}
