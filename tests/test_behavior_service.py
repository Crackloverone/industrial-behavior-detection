from backend.behavior_service import BehaviorDetectionService


class FakeDetector:
    def detect(self, _image):
        return [
            {
                "model": "smoking",
                "model_name": "抽烟检测",
                "class_id": 0,
                "class_name": "smoking",
                "label": "抽烟",
                "confidence": 0.91,
                "bbox": [10, 20, 30, 40],
                "violation": True,
            }
        ]


def test_behavior_result_is_compatible_with_monitor_api():
    service = BehaviorDetectionService(
        enabled=("smoking",),
        min_frames=3,
        cooldown_seconds=10,
    )
    service.detector = FakeDetector()

    first = service.detect(object(), source_id=1)
    second = service.detect(object(), source_id=1)
    third = service.detect(object(), source_id=1)

    assert first["detections"][0]["source"] == "behavior"
    assert first["violations"][0]["violation_type"] == "smoking"
    assert first["events"] == []
    assert second["events"] == []
    assert third["events"][0]["violation_type"] == "smoking"
