from app.models import User


def test_derived_body_metrics():
    user = User(age=28, weight_kg=70.0, height_cm=175.0)
    assert user.bmi == 22.9
    assert user.bmi_category == "normal"
    assert user.healthy_weight_range_kg == [56.7, 76.3]
    assert user.estimated_max_heart_rate == 188  # 208 - 0.7 * 28
    zones = user.heart_rate_zones
    assert [z["min_bpm"] for z in zones] == [94, 113, 132, 150, 169]
    assert zones[-1]["max_bpm"] == 188


def test_bmi_category_bands():
    assert User(weight_kg=50, height_cm=175).bmi_category == "underweight"  # 16.3
    assert User(weight_kg=85, height_cm=175).bmi_category == "overweight"  # 27.8
    assert User(weight_kg=100, height_cm=175).bmi_category == "obese"  # 32.7


def test_missing_profile_gives_none():
    user = User()
    assert user.bmi is None
    assert user.bmi_category is None
    assert user.healthy_weight_range_kg is None
    assert user.heart_rate_zones is None
