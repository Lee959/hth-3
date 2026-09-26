/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef2ff',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
        },
        // Landing page accent pink (waves, title's "ABLE", CTA's "now") —
        // same red/pink family as MuscleHeatmap.jsx's HEATMAP_RED scale.
        accent: {
          300: '#F0999A',
          400: '#E65659',
          500: '#DF2629',
        },
      },
      fontFamily: {
        // Anton: the big rep-count number. Rajdhani: everything else —
        // bold for titles, light (300) for subtitles/labels.
        anton: ['Anton', 'sans-serif'],
        rajdhani: ['Rajdhani', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
