"""Flask CLI commands (run with `flask --app run <command>`)."""
import json

import click

from .extensions import db
from .models import User

# Placeholder Auth0 subject so the demo user satisfies the NOT NULL/unique
# constraint without a real login; sign-in isn't wired up for it yet.
DEMO_USER = {
    "auth0_sub": "demo|example-user",
    "email": "demo@example.com",
    "display_name": "Demo User",
    "age": 28,
    "weight_kg": 70.0,
    "height_cm": 175.0,
}


def register_cli(app):
    @app.cli.command("seed-demo-user")
    def seed_demo_user():
        """Create (or refresh) the example user. Safe to re-run."""
        user = User.query.filter_by(auth0_sub=DEMO_USER["auth0_sub"]).first()
        created = user is None
        if created:
            user = User(auth0_sub=DEMO_USER["auth0_sub"])
            db.session.add(user)
        for field, value in DEMO_USER.items():
            setattr(user, field, value)
        db.session.commit()
        click.echo(("Created" if created else "Updated") + " demo user:")
        click.echo(json.dumps(user.to_dict(), indent=2))
