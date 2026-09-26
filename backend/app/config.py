import os


def _database_url() -> str:
    url = os.getenv("DATABASE_URL", "postgresql://hth3:hth3dev@localhost:5432/hth3_dev")
    # Tiger Cloud hands out postgres:// URLs; SQLAlchemy only accepts postgresql://.
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    return url


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev")
    SQLALCHEMY_DATABASE_URI = _database_url()
    SQLALCHEMY_TRACK_MODIFICATIONS = False

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
