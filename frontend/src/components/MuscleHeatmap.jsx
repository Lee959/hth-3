import { MuscleMap } from '@musclemap/react'

import GlassTile from './GlassTile.jsx'

// Brand red scale — 100 (lightest, score 0) through 500 (deepest, score
// 100). @musclemap/react's `monochromeColor`/`monochromeBaseColor` only
// take two endpoints and interpolate between them, so this drives the body
// off the lightest/deepest stops; the 200/300/400 shades aren't fed in
// directly but the library's interpolation lands close to them since
// they're already a roughly linear progression between the two endpoints.
export const HEATMAP_RED = {
  100: '#FADCDC',
  200: '#F6C1C2',
  300: '#F0999A',
  400: '#E65659',
  500: '#DF2629',
}

// @musclemap/react bakes two different neutral colors in, neither exposed
// through any prop (`monochromeBaseColor` only recolors muscles that are
// actually *scored* — present in `values` — not the ones that aren't):
//
// 1. The outer body/skin silhouette — one path, filled via an SVG gradient
//    in the library's own defs (id like "mm-r1-male-front-base").
// 2. Every individual unscored muscle shape — ~28 separate paths, each a
//    flat `fill="#3a465e"` (dark navy-grey), confirmed by inspecting the
//    live SVG's `fill` attributes with no scores set.
//
// Both need their own CSS override, since they're unrelated color sources:
// `stop-color` set in a stylesheet beats the gradient's own `stop-color`
// attribute, and a `fill` rule beats the paths' own `fill="#3a465e"`
// attribute — presentation attributes are the lowest-specificity layer in
// the cascade, so no `!important` or JS is needed for either. The gradient
// selector is broad on purpose (`[id$="-base"]`, survives a sex/view
// change); the muscle-fill selector is pinned to the exact hex the library
// currently ships, so it'll silently stop matching (reverting to the
// library's dark grey) if a future version changes that default — worth a
// quick visual check after bumping the dependency.
const BODY_BASE_GRADIENT = {
  start: '#FAF7F2',
  end: '#EDE6DA',
}
const UNSCORED_MUSCLE_FILL = '#3a465e' // the library's hardcoded default
const SURFACE_WHITE = '#FFFFFF'

/**
 * Wraps @musclemap/react — takes the { MUSCLE_GROUP: score } map from
 * useExerciseTracker and renders it as a heatmap (see
 * frontend/src/lib/muscleMap.js for the exercise -> muscle weight table
 * that produces these scores). `values` expects a `{ score }` object per
 * group, so we wrap each raw number here.
 *
 * Defaults to the front view only, to stay compact in its usual spot — its
 * own tile in the right-hand vertical column, below ExerciseTitle.jsx and
 * RepCounter.jsx. The Workout Saved summary screen renders two of these
 * side by side (view="FRONT" and view="BACK") for a fuller picture of what
 * was worked, matching @musclemap/react's own FRONT/BACK-only view prop.
 */
export default function MuscleHeatmap({ scores = {}, figureWidth = 130, view = 'FRONT' }) {
  const values = Object.fromEntries(
    Object.entries(scores).map(([group, score]) => [group, { score }]),
  )

  return (
    <GlassTile className="muscle-heatmap flex justify-center p-3">
      <style>{`
        .muscle-heatmap svg [id$="-base"] stop:first-child { stop-color: ${BODY_BASE_GRADIENT.start}; }
        .muscle-heatmap svg [id$="-base"] stop:last-child { stop-color: ${BODY_BASE_GRADIENT.end}; }
        .muscle-heatmap svg path[fill="${UNSCORED_MUSCLE_FILL}"] { fill: ${SURFACE_WHITE}; }
      `}</style>
      <MuscleMap
        values={values}
        view={view}
        glow
        showLegend={false}
        figureWidth={figureWidth}
        monochromeColor={HEATMAP_RED[500]}
        monochromeBaseColor={HEATMAP_RED[100]}
      />
    </GlassTile>
  )
}
