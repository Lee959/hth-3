function Stat({ label, value, unit }) {
  return (
    <div className="rounded-xl bg-slate-900 p-3 text-center">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-2xl font-semibold">{value ? Math.round(value) : '—'}</p>
      <p className="text-xs text-slate-500">{unit}</p>
    </div>
  )
}

export default function VitalsPanel({ vitals }) {
  const latest = vitals?.[0]

  return (
    <div className="grid grid-cols-3 gap-3">
      <Stat label="Heart rate" value={latest?.heart_rate_bpm} unit="bpm" />
      <Stat label="Breathing" value={latest?.breathing_rate_bpm} unit="rpm" />
      <Stat label="HRV" value={latest?.hrv_ms} unit="ms" />
    </div>
  )
}
