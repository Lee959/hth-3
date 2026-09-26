import { createContext, useContext } from 'react'

/**
 * Every scroll-linked animation on the landing page (framer-motion's
 * useScroll, in WaveField/PerspectiveImage/MetricsMarquee via Landing.jsx)
 * needs this: App.jsx's shell is `h-screen overflow-hidden` with `<main>`
 * as its own `overflow-y-auto` region, so `<main>` — not `window` — is
 * what actually scrolls. useScroll's default target (`window`) never
 * fires here, so every call needs `container: useAppScrollContainer()`
 * pointing at the real scrolling element instead.
 *
 * This is a Context (App.jsx provides the same ref object it attaches to
 * its own <main>), not a `document.querySelector('main')` lookup — a
 * lookup done during a component's render can run before <main> is even
 * in the DOM (the whole tree, main included, commits together on first
 * mount), and framer-motion's useScroll binds its scroll listener once at
 * mount from whatever `container.current` was at that moment; a ref
 * object's `.current` changing later doesn't re-trigger that effect, so a
 * lookup that missed on the first render would silently stay broken
 * forever. Reading the *same* ref object App.jsx's <main> is attached to
 * sidesteps this: React guarantees a parent's DOM refs are committed
 * before any descendant's effects run, so it's already correct by the
 * time useScroll's effect fires, on every render including the first.
 */
export const ScrollContainerContext = createContext(null)

export function useAppScrollContainer() {
  return useContext(ScrollContainerContext)
}
