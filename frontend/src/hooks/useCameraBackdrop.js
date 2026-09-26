import { useCallback, useEffect, useState } from 'react'

const PREF_KEY = 'accountable:camera-backdrop'

function readPref() {
  try {
    return localStorage.getItem(PREF_KEY) === 'on'
  } catch {
    return false
  }
}

function writePref(on) {
  try {
    localStorage.setItem(PREF_KEY, on ? 'on' : 'off')
  } catch {
    // storage blocked (private mode etc.) — the toggle still works for this visit
  }
}

/**
 * Optional live-camera backdrop for the non-immersive pages. Off until the
 * user turns it on (then remembered), so the home page never pops a camera
 * permission prompt on its own.
 *
 * `active` should be false on /session: that page opens its own stream via
 * useCamera.js, and two getUserMedia() streams fight over the camera on
 * most browsers — so this one is stopped whenever it isn't needed. React
 * runs this effect's cleanup before the session page's mount effect, so the
 * camera is released before the session asks for it.
 *
 * `status`: 'off' | 'starting' | 'live' | 'blocked' (permission denied) |
 * 'unavailable' (no camera, or it's in use elsewhere).
 */
export function useCameraBackdrop({ active }) {
  const [enabled, setEnabled] = useState(readPref)
  const [stream, setStream] = useState(null)
  const [status, setStatus] = useState('off')

  useEffect(() => {
    if (!active || !enabled) {
      setStatus('off')
      return undefined
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('unavailable')
      return undefined
    }

    let cancelled = false
    let opened = null
    setStatus('starting')
    navigator.mediaDevices
      .getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' }, audio: false })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop())
          return
        }
        opened = s
        setStream(s)
        setStatus('live')
      })
      .catch((err) => {
        if (!cancelled) setStatus(err?.name === 'NotAllowedError' ? 'blocked' : 'unavailable')
      })

    return () => {
      cancelled = true
      opened?.getTracks().forEach((t) => t.stop())
      setStream(null)
    }
  }, [active, enabled])

  const toggle = useCallback(() => {
    setEnabled((on) => {
      writePref(!on)
      return !on
    })
  }, [])

  return { enabled, status, stream, toggle }
}
