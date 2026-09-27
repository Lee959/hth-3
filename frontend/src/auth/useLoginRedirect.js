import { useAuth } from './AuthContext.jsx'

/**
 * The one place that knows how to kick off an Auth0 login/signup: normally
 * that's just `loginWithRedirect()` (optionally with `screen_hint:
 * 'signup'` to land on Auth0's sign-up tab instead of login), but while
 * Auth0Provider isn't mounted (no VITE_AUTH0_CLIENT_ID yet — see
 * Auth0ProviderWithNavigate.jsx) useAuth() falls back to a no-op, so this
 * also covers that gap by sending the browser straight at the tenant's
 * hosted login page if at least the domain is configured. Shared by
 * App.jsx's header (Log in, Sign up), SignIn.jsx's "Create one" link, and
 * Landing.jsx's closing CTA — every entry point into Auth0 goes through
 * here rather than a form page, so they can't drift out of sync with each
 * other.
 */
export function useLoginRedirect() {
  const { loginWithRedirect, configured } = useAuth()
  const auth0Domain = import.meta.env.VITE_AUTH0_DOMAIN
  const canStartAuth = configured || Boolean(auth0Domain)

  async function startLogin() {
    if (configured) {
      await loginWithRedirect()
      return
    }
    if (auth0Domain) window.location.assign(`https://${auth0Domain}/u/login`)
  }

  async function startSignup() {
    if (configured) {
      await loginWithRedirect({
        authorizationParams: { screen_hint: 'signup' },
        appState: { returnTo: '/dashboard' },
      })
      return
    }
    if (auth0Domain) window.location.assign(`https://${auth0Domain}/u/login?screen_hint=signup`)
  }

  return { startLogin, startSignup, canStartAuth }
}
