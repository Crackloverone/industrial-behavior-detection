import os
import tempfile

import cv2
from flask import Flask, jsonify, request

from .detector import BehaviorDetector


def create_app(detector: BehaviorDetector | None = None) -> Flask:
    app = Flask(__name__)
    detector = detector or BehaviorDetector()

    @app.get("/health")
    def health():
        return jsonify({"status": "ok", "models": list(detector.models)})

    @app.post("/detect")
    def detect():
        if "image" not in request.files:
            return jsonify({"error": "请使用 image 字段上传图片"}), 400

        upload = request.files["image"]
        suffix = os.path.splitext(upload.filename or "")[1] or ".jpg"
        with tempfile.NamedTemporaryFile(suffix=suffix) as temp_file:
            upload.save(temp_file.name)
            frame = cv2.imread(temp_file.name)
        if frame is None:
            return jsonify({"error": "无法解析图片"}), 400

        detections = detector.detect(frame)
        return jsonify(
            {
                "detections": detections,
                "violations": [item for item in detections if item["violation"]],
            }
        )

    return app


def main() -> None:
    app = create_app()
    app.run(
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", "8000")),
    )


if __name__ == "__main__":
    main()
