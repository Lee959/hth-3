import { useEffect, useRef, useState } from 'react'

import { useCameraPalette } from '../hooks/useCameraPalette.js'

// Camera-off palette, pulled from the session HUD: the rose rep-goal ring,
// a violet between it and the brand indigo, and the teal gauge default.
const DEFAULT_GLOWS = ['rgb(244 63 94)', 'rgb(124 58 237)', 'rgb(45 212 191)']

/**
 * The backdrop behind the non-immersive pages. Glass only looks like glass
 * when there's something colorful behind it to blur, so this always gives
 * the liquid-glass surfaces (see index.css) light to catch, in one of two
 * styles:
 *
 * - Camera on: the live camera feed, heavily blurred and mirrored like a
 *   selfie view, under three glows whose colors are sampled from the feed
 *   (useCameraPalette.js) — so the whole page takes on the room's colors.
 * - Camera off / blocked / unavailable: the same three glows in the HUD's
 *   own palette, slowly drifting over near-black.
 *
 * The glow colors cross-fade, so switching styles (or the room's colors
 * changing) blends instead of snapping. Purely decorative, so hidden from
 * screen readers.
 */
export default function AmbientBackground({ stream }) {
  const videoRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const live = Boolean(stream) && playing
  const palette = useCameraPalette(videoRef, live)
  const glows = live && palette ? palette : DEFAULT_GLOWS

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.srcObject = stream ?? null
    if (!stream) setPlaying(false)
  }, [stream])

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        onPlaying={() => setPlaying(true)}
        className={`absolute inset-0 h-full w-full -scale-x-[1.15] scale-y-[1.15] object-cover blur-[40px] saturate-150 transition-opacity duration-1000 ${
          live ? 'opacity-70' : 'opacity-0'
        }`}
      />

      <div
        className="animate-drift absolute -left-[10%] -top-[15%] h-[55vmax] w-[55vmax] rounded-full blur-[100px] transition-[background-color,opacity] duration-1000"
        style={{ backgroundColor: glows[0], opacity: live ? 0.35 : 0.3 }}
      />
      <div
        className="animate-drift-slow absolute -right-[15%] top-[10%] h-[50vmax] w-[50vmax] rounded-full blur-[110px] transition-[background-color,opacity] duration-1000"
        style={{ backgroundColor: glows[1], opacity: live ? 0.35 : 0.3 }}
      />
      <div
        className="animate-drift absolute -bottom-[25%] left-[20%] h-[45vmax] w-[45vmax] rounded-full blur-[110px] transition-[background-color,opacity] duration-1000"
        style={{ backgroundColor: glows[2], opacity: live ? 0.3 : 0.2 }}
      />

      {/* Vignette keeps the edges close to the session screen's black; a touch
          lighter over the camera so the room still reads through. */}
      <div
        className={`absolute inset-0 transition-colors duration-1000 ${
          live
            ? 'bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.15)_30%,rgba(0,0,0,0.65)_100%)]'
            : 'bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.6)_100%)]'
        }`}
      />
    </div>
  )
}
