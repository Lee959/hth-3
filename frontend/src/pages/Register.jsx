import { Link } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext.jsx'

export default function Register() {
  const { loginWithRedirect, configured } = useAuth()

  // Same hosted-flow handoff as SignIn.jsx, but with screen_hint: 'signup'
  // so Auth0's Universal Login opens straight to its sign-up tab instead
  // of login — a new user finishes account creation there, then lands on
  // /dashboard (see appState.returnTo, read by Auth0ProviderWithNavigate.jsx's
  // onRedirectCallback).
  function onSubmit(event) {
    event.preventDefault()
    loginWithRedirect({
      authorizationParams: { screen_hint: 'signup' },
      appState: { returnTo: '/dashboard' },
    })
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-2xl items-center px-4 py-8 md:px-8">
      <section className="animate-page-enter liquid-glass w-full rounded-[2rem] p-6 md:p-8">
        <p className="font-rajdhani text-xs font-bold uppercase tracking-[0.2em] text-white/60">Create account</p>
        <h1 className="mt-2 font-rajdhani text-4xl font-bold uppercase tracking-wide text-white md:text-5xl">Account-ABLE</h1>
        <p className="mt-3 font-rajdhani text-sm text-white/60">
          {configured
            ? "You'll finish creating your account on Auth0's secure page — this form is just the on-ramp."
            : 'Sign up needs Auth0 configured — see docs/SETUP.md.'}
        </p>

        <form className="mt-6 grid gap-4" onSubmit={onSubmit}>
          <label className="grid gap-1.5">
            <span className="font-rajdhani text-xs font-bold uppercase tracking-wide text-white/65">Full name</span>
            <input
              type="text"
              placeholder="Jane Doe"
              className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 font-rajdhani text-white outline-none transition placeholder:text-white/40 focus:border-white/40"
            />
          </label>

          <label className="grid gap-1.5">
            <span className="font-rajdhani text-xs font-bold uppercase tracking-wide text-white/65">Email</span>
            <input
              type="email"
              placeholder="you@example.com"
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

          <label className="grid gap-1.5">
            <span className="font-rajdhani text-xs font-bold uppercase tracking-wide text-white/65">Confirm password</span>
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
            Create account
          </button>
        </form>

        <p className="mt-5 font-rajdhani text-sm text-white/75">
          Already have the Account?{' '}
          <Link to="/signin" className="font-bold uppercase tracking-wide text-white hover:text-rose-200">
            Sign in
          </Link>
        </p>
      </section>
    </div>
  )
}
