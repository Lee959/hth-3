def test_without_auth0_or_dev_user_protected_routes_refuse(app, client):
    app.config["DEV_USER_SUB"] = ""
    assert client.get("/api/workouts/").status_code == 500


def test_dev_user_answers_without_a_token(client):
    resp = client.post("/api/workouts/", json={"started_at": "2026-09-26T18:00:00Z"})
    assert resp.status_code == 201
    session_id = resp.get_json()["id"]
    assert client.post(f"/api/workouts/{session_id}/sets", json={"exercise_name": "squat", "reps": 5}).status_code == 201

    history = client.get("/api/workouts/")
    assert history.status_code == 200
    assert [s["id"] for s in history.get_json()] == [session_id]
