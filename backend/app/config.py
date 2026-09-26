import os


def _database_url() -> str:
    url = os.getenv("DATABASE_URL", "postgresql://hth3:hth3dev@localhost:5432/hth3_dev")
    # Tiger Cloud hands out postgres:// URLs; SQLAlchemy only accepts postgresql://.
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    if url.startswith("postgresql://"):
        # connect_timeout: fail fast when the database port is unreachable
        # (e.g. a Wi-Fi that blocks it) instead of waiting out the OS TCP
        # timeout for every address.
        # keepalives: VPNs and NAT routers silently drop connections that sit
        # idle for a few minutes; opening a new one costs seconds over a slow
        # link (TLS + login), so keep idle pooled connections alive instead.
        for key, value in [
            ("connect_timeout", "5"),
            ("keepalives", "1"),
            ("keepalives_idle", "30"),
            ("keepalives_interval", "10"),
            ("keepalives_count", "3"),
        ]:
            if f"{key}=" not in url:
                url += ("&" if "?" in url else "?") + f"{key}={value}"
    return url


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev")
    SQLALCHEMY_DATABASE_URI = _database_url()
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    # The database is reached over the internet: test pooled connections
    # before reusing them (they die when the network changes) and replace
    # them every 30 minutes. Not more often: over a slow link, replacing one
    # takes seconds, which a page load then waits on.
    SQLALCHEMY_ENGINE_OPTIONS = {"pool_pre_ping": True, "pool_recycle": 1800}

    AUTH0_DOMAIN = os.getenv("AUTH0_DOMAIN", "")
    AUTH0_AUDIENCE = os.getenv("AUTH0_AUDIENCE", "")
    AUTH0_ALGORITHMS = [os.getenv("AUTH0_ALGORITHMS", "RS256")]

    # Local development without Auth0: while AUTH0_DOMAIN/AUTH0_AUDIENCE are
    # unset, every request acts as the user with this auth0_sub (see
    # auth/decorators.py). Leave empty anywhere shared or deployed.
    DEV_USER_SUB = os.getenv("DEV_USER_SUB", "")

    PRESAGE_API_KEY = os.getenv("PRESAGE_API_KEY", "")
    PRESAGE_API_BASE = os.getenv("PRESAGE_API_BASE", "https://api.physiology.presagetech.com")

    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
