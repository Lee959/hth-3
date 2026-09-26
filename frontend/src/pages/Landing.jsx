import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const TESTIMONIALS = [
  'Taught me so much!',
  'So convient, love how hands-free it is',
  "Love that it's open source",
  "I dont have to spend any $$ on fitbits",
]

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M5 12h14" />
      <path d="M13 5l7 7-7 7" />
    </svg>
  )
}

export default function Landing() {
  const navigate = useNavigate()
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((value) => (value + 1) % TESTIMONIALS.length)
    }, 2800)
    return () => clearInterval(id)
  }, [])

  function startSignup() {
    navigate('/register')
  }

  function startSignin() {
    navigate('/signin')
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col gap-8 px-4 pb-10 pt-4 md:gap-10 md:px-8 md:pt-8">
      <section className="liquid-glass rounded-[2rem] px-6 py-10 text-center md:px-10 md:py-14">
        <h1 className="font-rajdhani text-5xl font-bold uppercase tracking-wide text-white md:text-7xl">Account-ABLE</h1>
      </section>

      <section className="liquid-glass grid gap-6 rounded-[2rem] p-5 md:grid-cols-[1fr_1.2fr] md:items-center md:gap-8 md:p-8">
        <div className="order-2 flex flex-col gap-4 md:order-1">
          <p className="font-rajdhani text-xs font-bold uppercase tracking-[0.2em] text-white/60">What people say</p>
          <div className="min-h-[84px] rounded-2xl border border-white/10 bg-white/5 px-4 py-5">
            <p className="font-rajdhani text-2xl font-semibold leading-tight text-white">“{TESTIMONIALS[index]}”</p>
          </div>
          <div className="flex items-center gap-2">
            {TESTIMONIALS.map((quote, quoteIndex) => (
              <button
                key={quote}
                type="button"
                onClick={() => setIndex(quoteIndex)}
                aria-label={`Show quote ${quoteIndex + 1}`}
                className={`h-2.5 w-7 rounded-full transition ${
                  quoteIndex === index ? 'bg-white/90' : 'bg-white/25 hover:bg-white/50'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="order-1 md:order-2">
          <img
            src="https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=1200&q=80"
            alt="Woman working out"
            className="h-72 w-full rounded-3xl object-cover md:h-96"
            loading="lazy"
          />
        </div>
      </section>

      <section className="liquid-glass flex flex-col items-center gap-5 rounded-[2rem] px-6 py-9 text-center md:px-10 md:py-12">
        <h2 className="font-rajdhani text-3xl font-bold uppercase tracking-wide text-white md:text-4xl">
          Discover the best workout companion
        </h2>

        <button
          type="button"
          onClick={startSignup}
          title="Create account"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-slate-900 transition hover:bg-white/90 disabled:cursor-not-allowed disabled:bg-white/25 disabled:text-white/60"
          aria-label="Sign up"
        >
          <ArrowIcon />
        </button>

        <button
          type="button"
          onClick={startSignin}
          title="Sign in"
          className="font-rajdhani text-sm font-semibold uppercase tracking-wide text-white/80 transition hover:text-white disabled:cursor-not-allowed disabled:text-white/45"
        >
          Already have an account?
        </button>
      </section>
    </div>
  )
}