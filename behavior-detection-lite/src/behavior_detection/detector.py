from pathlib import Path
from typing import Iterable

import cv2
from ultralytics import YOLO

from .config import MODEL_SPECS, ModelSpec


class BehaviorDetector:
    def __init__(
        self,
        enabled: Iterable[str] = ("workwear", "smoking", "sleeping"),
        confidence: float = 0.35,
        iou: float = 0.45,
        device: str | None = None,
    ):
        self.confidence = confidence
        self.iou = iou
        self.device = device
        self.specs: dict[str, ModelSpec] = {}
        self.models: dict[str, YOLO] = {}

        for key in enabled:
            if key not in MODEL_SPECS:
                raise ValueError(f"未知模型: {key}")
            spec = MODEL_SPECS[key]
            if not spec.path.is_file():
                raise FileNotFoundError(f"模型文件不存在: {spec.path}")
            self.specs[key] = spec
            self.models[key] = YOLO(str(spec.path))

    def detect(self, frame) -> list[dict]:
        detections = []
        for key, model in self.models.items():
            kwargs = {
                "source": frame,
                "conf": self.confidence,
                "iou": self.iou,
                "verbose": False,
            }
            if self.device:
                kwargs["device"] = self.device

            result = model.predict(**kwargs)[0]
            if result.boxes is None:
                continue

            spec = self.specs[key]
            for box in result.boxes:
                class_id = int(box.cls.item())
                raw_class = str(result.names[class_id])
                detections.append(
                    {
                        "model": key,
                        "model_name": spec.display_name,
                        "class_id": class_id,
                        "class_name": raw_class,
                        "label": spec.class_names.get(raw_class, raw_class),
                        "confidence": round(float(box.conf.item()), 4),
                        "bbox": [round(float(v), 2) for v in box.xyxy[0].tolist()],
                        "violation": raw_class in spec.violation_classes,
                    }
                )
        return detections

    @staticmethod
    def draw(frame, detections: list[dict]):
        output = frame.copy()
        for item in detections:
            x1, y1, x2, y2 = map(int, item["bbox"])
            color = (0, 0, 255) if item["violation"] else (0, 180, 0)
            text = f'{item["model"]}:{item["class_name"]} {item["confidence"]:.2f}'
            cv2.rectangle(output, (x1, y1), (x2, y2), color, 2)
            cv2.putText(
                output,
                text,
                (x1, max(20, y1 - 8)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.55,
                color,
                2,
                cv2.LINE_AA,
            )
        return output

    def detect_file(self, image_path: str | Path) -> tuple[list[dict], object]:
        frame = cv2.imread(str(image_path))
        if frame is None:
            raise ValueError(f"无法读取图片: {image_path}")
        detections = self.detect(frame)
        return detections, self.draw(frame, detections)
