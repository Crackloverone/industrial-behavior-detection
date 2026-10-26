from behavior_detection.events import EventTracker


def violation(model="smoking", class_name="smoking"):
    return {
        "model": model,
        "class_name": class_name,
        "violation": True,
    }


def test_requires_consecutive_frames():
    tracker = EventTracker(min_frames=3, cooldown_seconds=10)

    assert tracker.update([violation()], now=0) == []
    assert tracker.update([violation()], now=1) == []
    assert len(tracker.update([violation()], now=2)) == 1


def test_resets_after_clear_frame():
    tracker = EventTracker(min_frames=2, cooldown_seconds=0)

    assert tracker.update([violation()], now=0) == []
    assert tracker.update([], now=1) == []
    assert tracker.update([violation()], now=2) == []


def test_cooldown_suppresses_duplicate_alert():
    tracker = EventTracker(min_frames=1, cooldown_seconds=10)

    assert len(tracker.update([violation()], now=0)) == 1
    assert tracker.update([violation()], now=5) == []
    assert len(tracker.update([violation()], now=10)) == 1
