import { Link } from 'react-router-dom'

export default function SignIn() {
  function onSubmit(event) {
    event.preventDefault()
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-2xl items-center px-4 py-8 md:px-8">
      <section className="animate-page-enter liquid-glass w-full rounded-[2rem] p-6 md:p-8">
        <p className="font-rajdhani text-xs font-bold uppercase tracking-[0.2em] text-white/60">Sign in</p>
        <h1 className="mt-2 font-rajdhani text-4xl font-bold uppercase tracking-wide text-white md:text-5xl">Welcome back</h1>
        <p className="mt-3 font-rajdhani text-sm text-white/60">
          Sign in with username and password. This is frontend-only for now; Auth0 form submit wiring can be added next.
        </p>

        <form className="mt-6 grid gap-4" onSubmit={onSubmit}>
          <label className="grid gap-1.5">
            <span className="font-rajdhani text-xs font-bold uppercase tracking-wide text-white/65">Username</span>
            <input
              required
              type="text"
              placeholder="your_username"
              className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 font-rajdhani text-white outline-none transition placeholder:text-white/40 focus:border-white/40"
            />
          </label>

          <label className="grid gap-1.5">
            <span className="font-rajdhani text-xs font-bold uppercase tracking-wide text-white/65">Password</span>
            <input
              required
              type="password"
              placeholder="••••••••"
              className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 font-rajdhani text-white outline-none transition placeholder:text-white/40 focus:border-white/40"
            />
          </label>

          <button
            type="submit"
            className="mt-2 rounded-xl bg-white px-4 py-3 font-rajdhani text-sm font-bold uppercase tracking-wide text-slate-900 transition hover:bg-white/90"
          >
            Sign in
          </button>
        </form>

        <p className="mt-5 font-rajdhani text-sm text-white/75">
          Need an account?{' '}
          <Link to="/register" className="font-bold uppercase tracking-wide text-white hover:text-rose-200">
            Create one
          </Link>
        </p>
      </section>
    </div>
  )
}
