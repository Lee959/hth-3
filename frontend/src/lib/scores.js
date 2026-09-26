// Shared by the home page summary (pages/Dashboard.jsx) and a single past
// workout's summary (components/WorkoutDetailPanel.jsx).

// Validated against the dark glass surface (dataviz palette check). Rose is
// everything heart-rate driven (heart rate, effort — echoing the HUD's
// rep-goal ring); teal is everything movement driven (reps, form, quality).
export const HEART_COLOR = '#f43f5e'
export const MOVEMENT_COLOR = '#10a898'

export function formRating(score) {
  if (score == null) return null
  if (score >= 85) return 'Excellent'
  if (score >= 70) return 'Good'
  if (score >= 50) return 'Fair'
  return 'Needs work'
}

export function effortRating(score) {
  if (score == null) return null
  if (score >= 80) return 'All out'
  if (score >= 60) return 'Hard'
  if (score >= 30) return 'Moderate'
  return 'Light'
}
