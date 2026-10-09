export default function StatPill({ label, value, hint }) {
  return (
    <div className="rounded-lg border border-line bg-white px-5 py-4 shadow-panel">
      <p className="text-xs text-ash-600">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold text-ash-900">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-ash-400">{hint}</p>}
    </div>
  )
}
