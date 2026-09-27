import { useLocation } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext.jsx'
import { useLoginRedirect } from '../auth/useLoginRedirect.js'

export default function SignIn() {
  const { loginWithRedirect, configured } = useAuth()
  const { startSignup, canStartAuth } = useLoginRedirect()
  const location = useLocation()

  // Credentials are collected on Auth0's own Universal Login page, not
  // here — the fields below stay for a fully custom login form the
  // product may still want, but until then this button hands off to the
  // hosted flow already wired in Auth0ProviderWithNavigate.jsx. `from`
  // (set by RequireAuth.jsx when it redirected here) sends the user back
  // to whatever protected route they were trying to reach; otherwise the
  // dashboard.
  function onSubmit(event) {
    event.preventDefault()
    loginWithRedirect({ appState: { returnTo: location.state?.from?.pathname ?? '/dashboard' } })
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-2xl items-center px-4 py-8 md:px-8">
      <section className="animate-page-enter liquid-glass w-full rounded-[2rem] p-6 md:p-8">
        <p className="font-rajdhani text-xs font-bold uppercase tracking-[0.2em] text-white/60">Sign in</p>
        <h1 className="mt-2 font-rajdhani text-4xl font-bold uppercase tracking-wide text-white md:text-5xl">Welcome back</h1>
        <p className="mt-3 font-rajdhani text-sm text-white/60">
          {configured
            ? "You'll finish signing in on Auth0's secure page — this form is just the on-ramp."
            : 'Sign in needs Auth0 configured — see docs/SETUP.md.'}
        </p>

        <form className="mt-6 grid gap-4" onSubmit={onSubmit}>
          <label className="grid gap-1.5">
            <span className="font-rajdhani text-xs font-bold uppercase tracking-wide text-white/65">Username</span>
            <input
              type="text"
              placeholder="your_username"
              className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 font-rajdhani text-white outline-none transition placeholder:text-white/40 focus:border-white/40"
            />
          </label>

          <label className="grid gap-1.5">
            <span className="font-rajdhani text-xs font-bold uppercase tracking-wide text-white/65">Password</span>
            <input
              type="password"
              placeholder="••••••••"
              className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 font-rajdhani text-white outline-none transition placeholder:text-white/40 focus:border-white/40"
            />
          </label>

          <button
            type="submit"
            disabled={!configured}
            className="mt-2 rounded-xl bg-white px-4 py-3 font-rajdhani text-sm font-bold uppercase tracking-wide text-slate-900 transition hover:bg-white/90 disabled:cursor-not-allowed disabled:bg-white/20 disabled:text-white/50"
          >
            Sign in
          </button>
        </form>

        <p className="mt-5 font-rajdhani text-sm text-white/75">
          Need an account?{' '}
          <button
            type="button"
            onClick={startSignup}
            disabled={!canStartAuth}
            className="font-bold uppercase tracking-wide text-white hover:text-rose-200 disabled:cursor-not-allowed disabled:text-white/40"
          >
            Create one
          </button>
        </p>
      </section>
    </div>
  )
}
