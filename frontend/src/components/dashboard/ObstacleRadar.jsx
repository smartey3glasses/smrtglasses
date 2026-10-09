const CX = 130
const CY = 120
const R_OUTER = 108
const R_INNER = 62

function polar(angleDeg, radius) {
  const rad = (angleDeg * Math.PI) / 180
  return {
    x: CX + radius * Math.cos(rad),
    y: CY - radius * Math.sin(rad)
  }
}

function sectorPath(startAngle, endAngle) {
  const o1 = polar(startAngle, R_OUTER)
  const o2 = polar(endAngle, R_OUTER)
  const i1 = polar(endAngle, R_INNER)
  const i2 = polar(startAngle, R_INNER)
  return [
    `M ${o1.x} ${o1.y}`,
    `A ${R_OUTER} ${R_OUTER} 0 0 1 ${o2.x} ${o2.y}`,
    `L ${i1.x} ${i1.y}`,
    `A ${R_INNER} ${R_INNER} 0 0 0 ${i2.x} ${i2.y}`,
    'Z'
  ].join(' ')
}

const ZONES = [
  { key: 'left', label: 'Left', range: [180, 120] },
  { key: 'center', label: 'Center', range: [120, 60] },
  { key: 'right', label: 'Right', range: [60, 0] }
]

function zoneColor(zoneKey, latest) {
  if (!latest) return '#D4D7D2'
  const isActive = latest.direction === zoneKey || latest.direction === 'multiple'
  if (!isActive) return '#D4D7D2'
  return latest.severity === 'danger' ? '#B23B32' : '#B5750C'
}

export default function ObstacleRadar({ latest }) {
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 260 150" className="w-full max-w-[300px]">
        {ZONES.map((zone) => (
          <path
            key={zone.key}
            d={sectorPath(zone.range[0], zone.range[1])}
            fill={zoneColor(zone.key, latest)}
            opacity={latest && (latest.direction === zone.key || latest.direction === 'multiple') ? 1 : 0.35}
          />
        ))}

        {ZONES.map((zone) => {
          const mid = (zone.range[0] + zone.range[1]) / 2
          const pos = polar(mid, R_OUTER + 16)
          return (
            <text
              key={zone.key}
              x={pos.x}
              y={pos.y}
              textAnchor="middle"
              className="fill-ash-600 font-body text-[11px] uppercase tracking-wide"
            >
              {zone.label}
            </text>
          )
        })}

        <line x1={CX - R_OUTER} y1={CY} x2={CX + R_OUTER} y2={CY} stroke="#E2E4DF" strokeWidth={1} />
      </svg>

      <div className="mt-2 text-center">
        {latest ? (
          <>
            <p className="font-display text-2xl font-semibold text-ash-900">
              {latest.distanceCm}
              <span className="ml-1 text-sm font-body font-normal text-ash-600">cm</span>
            </p>
            <p className="mt-1 text-sm text-ash-600">{latest.voiceCommand}</p>
          </>
        ) : (
          <p className="text-sm text-ash-600">No obstacles detected yet.</p>
        )}
      </div>
    </div>
  )
}
