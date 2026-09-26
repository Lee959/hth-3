"""Auth0 JWT verification for API routes.

The frontend logs in with the Auth0 SPA SDK and attaches the resulting
access token as `Authorization: Bearer <token>`. This decorator verifies
that token against Auth0's JWKS (no shared secret needed) and stashes the
decoded claims on flask.g for the route to use.
"""
import functools

import jwt
from flask import current_app, g, jsonify, request


class AuthError(Exception):
    def __init__(self, message: str, status_code: int = 401):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _get_token_from_header() -> str:
    auth_header = request.headers.get("Authorization", "")
    parts = auth_header.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise AuthError("Authorization header must be 'Bearer <token>'")
    return parts[1]


def requires_auth(fn):
    @functools.wraps(fn)
    def wrapper(*args, **kwargs):
        domain = current_app.config["AUTH0_DOMAIN"]
        audience = current_app.config["AUTH0_AUDIENCE"]

        if not domain or not audience:
            return jsonify({"error": "Auth0 is not configured on the server"}), 500

        try:
            token = _get_token_from_header()
            jwks_client = jwt.PyJWKClient(f"https://{domain}/.well-known/jwks.json")
            signing_key = jwks_client.get_signing_key_from_jwt(token)
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=current_app.config["AUTH0_ALGORITHMS"],
                audience=audience,
                issuer=f"https://{domain}/",
            )
        except AuthError as err:
            return jsonify({"error": err.message}), err.status_code
        except jwt.PyJWTError as err:
            return jsonify({"error": f"Invalid token: {err}"}), 401

        g.current_user_sub = payload["sub"]
        g.current_user_claims = payload
        return fn(*args, **kwargs)

    return wrapper
