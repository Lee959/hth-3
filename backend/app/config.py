import os


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev")
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL", "postgresql://hth3:hth3dev@localhost:5432/hth3_dev"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    AUTH0_DOMAIN = os.getenv("AUTH0_DOMAIN", "")
    AUTH0_AUDIENCE = os.getenv("AUTH0_AUDIENCE", "")
    AUTH0_ALGORITHMS = [os.getenv("AUTH0_ALGORITHMS", "RS256")]

    PRESAGE_API_KEY = os.getenv("PRESAGE_API_KEY", "")
    PRESAGE_API_BASE = os.getenv("PRESAGE_API_BASE", "https://api.physiology.presagetech.com")

    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
