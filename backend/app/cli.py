"""Flask CLI commands (run with `flask --app run <command>`)."""
import json

import click

from .extensions import db
from .models import User, WorkoutSession
from .seed_data import delete_workouts, seed_workouts

# Placeholder Auth0 subject so the demo user satisfies the NOT NULL/unique
# constraint without a real login. Point DEV_USER_SUB at it (backend/.env)
# to use it while Auth0 isn't configured.
DEMO_USER = {
    "auth0_sub": "demo|example-user",
    "email": "demo@example.com",
    "display_name": "Demo User",
    "age": 28,
    "weight_kg": 70.0,
    "height_cm": 175.0,
}


def _upsert_demo_user():
    user = User.query.filter_by(auth0_sub=DEMO_USER["auth0_sub"]).first()
    created = user is None
    if created:
        user = User(auth0_sub=DEMO_USER["auth0_sub"])
        db.session.add(user)
    for field, value in DEMO_USER.items():
        setattr(user, field, value)
    db.session.commit()
    return user, created


def register_cli(app):
    @app.cli.command("seed-demo-user")
    def seed_demo_user():
        """Create (or refresh) the example user. Safe to re-run."""
        user, created = _upsert_demo_user()
        click.echo(("Created" if created else "Updated") + " demo user:")
        click.echo(json.dumps(user.to_dict(), indent=2))

    @app.cli.command("seed-demo-data")
    @click.option("--reset", is_flag=True, help="Delete the demo user's existing workouts first.")
    def seed_demo_data(reset):
        """Fill the database with ~4 weeks of made-up workouts for the demo user."""
        user, _ = _upsert_demo_user()
        existing = WorkoutSession.query.filter_by(user_id=user.id).count()
        if existing and not reset:
            raise click.ClickException(
                f"The demo user already has {existing} workouts. Re-run with --reset to replace them."
            )
        if reset:
            click.echo(f"Deleted {delete_workouts(user)} existing demo workouts.")
        counts = seed_workouts(user)
        click.echo(
            "Seeded {workouts} workouts, {sets} sets, {reps} reps, {vitals} heart-rate readings.".format(**counts)
        )
