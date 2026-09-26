from app.services.effort import effort_score, zone_minutes, zone_of


def test_zone_boundaries():
    assert zone_of(90, 200) is None  # 45% of max
    assert zone_of(100, 200) == 1  # 50%
    assert zone_of(139, 200) == 2  # 69.5%
    assert zone_of(160, 200) == 4  # 80%
    assert zone_of(199, 200) == 5


def test_zone_minutes_hold_until_next_reading():
    # 60s at 150 (zone 3 of 200), then 120s at 170 (zone 4); last reading has no duration.
    points = [(0, 150), (60, 170), (180, 120)]
    assert zone_minutes(points, 200) == [0.0, 0.0, 1.0, 2.0, 0.0]


def test_effort_score_saturates():
    assert effort_score([0, 0, 0, 0, 0], 0) == 0
    easy = effort_score([0, 0, 20, 0, 0], 0)  # 20 min zone 3
    hard = effort_score([0, 0, 0, 30, 0], 0)  # 30 min zone 4
    assert 45 <= easy <= 55
    assert 75 <= hard <= 85
    assert effort_score([0, 0, 0, 0, 300], 0) <= 100


def test_reps_count_without_heart_rate():
    assert effort_score([0, 0, 0, 0, 0], 100) > 0
