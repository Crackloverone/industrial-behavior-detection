from collections import defaultdict
from time import monotonic


class EventTracker:
    """用连续帧和冷却时间抑制单帧误报与重复告警。"""

    def __init__(self, min_frames: int = 3, cooldown_seconds: float = 10.0):
        if min_frames < 1:
            raise ValueError("min_frames 必须大于 0")
        self.min_frames = min_frames
        self.cooldown_seconds = cooldown_seconds
        self._counts = defaultdict(int)
        self._last_alert = defaultdict(lambda: float("-inf"))

    def update(self, detections: list[dict], now: float | None = None) -> list[dict]:
        now = monotonic() if now is None else now
        active = {
            (item["model"], item["class_name"])
            for item in detections
            if item.get("violation")
        }
        known = set(self._counts)

        for key in known - active:
            self._counts[key] = 0
        for key in active:
            self._counts[key] += 1

        events = []
        for key in active:
            if self._counts[key] < self.min_frames:
                continue
            if now - self._last_alert[key] < self.cooldown_seconds:
                continue
            self._last_alert[key] = now
            events.append(
                {
                    "model": key[0],
                    "class_name": key[1],
                    "consecutive_frames": self._counts[key],
                    "timestamp": now,
                }
            )
        return events
