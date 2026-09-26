/**
 * Generic angle-based rep counter — mirrors backend/app/pose_engine/rep_counter.py.
 * "down"/"up" describe the angle, not literal body position: a bicep curl's
 * "down" state (small elbow angle, arm bent) plays the same role as a
 * squat's "down" state (small knee angle, knees bent), even though the limb
 * moves opposite directions — so one class covers both.
 */
export class RepCounter {
  constructor(downAt, upAt) {
    this.downAt = downAt
    this.upAt = upAt
    this.state = 'up'
    this.reps = 0
  }

  update(angleDeg) {
    if (this.state === 'up' && angleDeg <= this.downAt) {
      this.state = 'down'
    } else if (this.state === 'down' && angleDeg >= this.upAt) {
      this.state = 'up'
      this.reps += 1
    }
    return this.reps
  }
}
