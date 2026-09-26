from app.seed_data import score_rep


def test_score_rep_matches_frontend_formula():
    # Inside the tempo band: 0.5*80 + 0.3*90 + 0.2*100
    tempo, form = score_rep("squat", 80, 90, 2.0)
    assert tempo == 100
    assert form == 87


def test_score_rep_rushed_and_untimed():
    tempo, _ = score_rep("squat", 80, 90, 0.75)  # half the 1.5s lower bound
    assert tempo == 50
    tempo, form = score_rep("squat", 80, 90, None)  # first rep: tempo left out, reweighted
    assert tempo is None
    assert round(form, 2) == round((0.5 * 80 + 0.3 * 90) / 0.8, 2)
