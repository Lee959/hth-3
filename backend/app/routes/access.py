from flask import abort, g

from ..models import User, WorkoutSession


def owned_session_or_404(session_id: int) -> WorkoutSession:
    """The workout with this id if it belongs to the current user, else 404
    (not 403, so other users' workout ids aren't revealed)."""
    session = (
        WorkoutSession.query.join(User)
        .filter(WorkoutSession.id == session_id, User.auth0_sub == g.current_user_sub)
        .first()
    )
    if session is None:
        abort(404)
    return session
