from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv

from .config import Config
from .extensions import db, migrate

load_dotenv()


def create_app(config_object: type = Config) -> Flask:
    app = Flask(__name__)
    app.config.from_object(config_object)

    CORS(app, origins=app.config["CORS_ORIGINS"], supports_credentials=True)

    db.init_app(app)
    migrate.init_app(app, db)

    from . import models  # noqa: F401  registers models with SQLAlchemy metadata

    from .routes.health import health_bp
    from .routes.workouts import workouts_bp
    from .routes.vitals import vitals_bp
    from .routes.pose import pose_bp

    app.register_blueprint(health_bp)
    app.register_blueprint(workouts_bp, url_prefix="/api/workouts")
    app.register_blueprint(vitals_bp, url_prefix="/api/vitals")
    app.register_blueprint(pose_bp, url_prefix="/api/pose")

    return app
