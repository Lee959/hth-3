import { useAuth } from './AuthContext.jsx'

/**
 * The one place that knows how to kick off an Auth0 login: normally that's
 * just `loginWithRedirect()`, but while Auth0Provider isn't mounted (no
 * VITE_AUTH0_CLIENT_ID yet — see Auth0ProviderWithNavigate.jsx) useAuth()
 * falls back to a no-op, so this also covers that gap by sending the
 * browser straight at the tenant's hosted login page if at least the
 * domain is configured. Shared by App.jsx's header "Log in" button and
 * Landing.jsx's closing CTA so both go to Auth0 the same way.
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

  return { startLogin, canStartAuth }
}
