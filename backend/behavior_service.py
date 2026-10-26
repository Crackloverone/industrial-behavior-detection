"""EasyAIoT 轻量行为检测模块的 FastAPI 集成层。"""

from __future__ import annotations

import os
import threading
from collections.abc import Iterable

from behavior_detection.config import MODEL_SPECS
from behavior_detection.detector import BehaviorDetector
from behavior_detection.events import EventTracker


VIOLATION_TYPES = {
    ("uniform", "clothes"): "no_vest",
    ("workwear", "no_workwear"): "no_workwear",
    ("smoking", "smoking"): "smoking",
    ("sleeping", "sleep"): "sleeping",
}


class BehaviorDetectionService:
    """延迟加载行为模型，并按摄像头维护连续帧事件状态。"""

    def __init__(
        self,
        enabled: Iterable[str] = ("workwear", "smoking", "sleeping"),
        confidence: float = 0.35,
        iou: float = 0.45,
        min_frames: int = 3,
        cooldown_seconds: float = 10.0,
        device: str | None = None,
    ):
        self.enabled = tuple(enabled)
        self.confidence = confidence
        self.iou = iou
        self.min_frames = min_frames
        self.cooldown_seconds = cooldown_seconds
        self.device = device
        self.detector: BehaviorDetector | None = None
        self.error: str | None = None
        self._trackers: dict[str, EventTracker] = {}
        self._lock = threading.Lock()

    def load(self) -> bool:
        try:
            self.detector = BehaviorDetector(
                enabled=self.enabled,
                confidence=self.confidence,
                iou=self.iou,
                device=self.device,
            )
            self.error = None
            return True
        except Exception as exc:
            self.detector = None
            self.error = str(exc)
            return False

    @property
    def loaded(self) -> bool:
        return self.detector is not None

    def status(self) -> dict:
        models = []
        for key in self.enabled:
            spec = MODEL_SPECS[key]
            models.append(
                {
                    "key": key,
                    "name": spec.display_name,
                    "path": str(spec.path),
                    "exists": spec.path.is_file(),
                    "loaded": self.loaded and key in self.detector.models,
                }
            )
        return {
            "loaded": self.loaded,
            "enabled": list(self.enabled),
            "confidence": self.confidence,
            "iou": self.iou,
            "min_frames": self.min_frames,
            "cooldown_seconds": self.cooldown_seconds,
            "device": self.device or "auto",
            "error": self.error,
            "models": models,
        }

    def detect(self, image, source_id: str | int | None = None) -> dict:
        if not self.detector:
            return {"detections": [], "violations": [], "events": []}

        with self._lock:
            raw_detections = self.detector.detect(image)
        detections = []
        violations = []
        for item in raw_detections:
            violation_type = VIOLATION_TYPES.get(
                (item["model"], item["class_name"])
            )
            normalized = {
                **item,
                "source": "behavior",
                "class_name": item["class_name"],
                "display_name": item["label"],
                "violation_type": violation_type,
            }
            detections.append(normalized)
            if item["violation"] and violation_type:
                violations.append(
                    {
                        "violation_type": violation_type,
                        "bbox": item["bbox"],
                        "person_bbox": item["bbox"],
                        "confidence": item["confidence"],
                        "model": item["model"],
                        "class_name": item["class_name"],
                        "label": item["label"],
                        "source": "behavior",
                    }
                )

        tracker_key = str(source_id if source_id is not None else "default")
        with self._lock:
            tracker = self._trackers.setdefault(
                tracker_key,
                EventTracker(
                    min_frames=self.min_frames,
                    cooldown_seconds=self.cooldown_seconds,
                ),
            )
            events = tracker.update(raw_detections)

        for event in events:
            event["violation_type"] = VIOLATION_TYPES.get(
                (event["model"], event["class_name"])
            )
        return {
            "detections": detections,
            "violations": violations,
            "events": [event for event in events if event["violation_type"]],
        }


def create_behavior_service() -> BehaviorDetectionService:
    enabled = tuple(
        item.strip()
        for item in os.getenv(
            "BEHAVIOR_MODELS", "workwear,smoking,sleeping"
        ).split(",")
        if item.strip()
    )
    service = BehaviorDetectionService(
        enabled=enabled,
        confidence=float(os.getenv("BEHAVIOR_CONFIDENCE", "0.35")),
        iou=float(os.getenv("BEHAVIOR_IOU", "0.45")),
        min_frames=int(os.getenv("BEHAVIOR_MIN_FRAMES", "3")),
        cooldown_seconds=float(os.getenv("BEHAVIOR_COOLDOWN", "10")),
        device=os.getenv("BEHAVIOR_DEVICE") or None,
    )
    service.load()
    return service
