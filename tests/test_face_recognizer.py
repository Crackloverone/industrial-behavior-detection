from pathlib import Path

import numpy as np

from backend.face_recognizer import DEFAULT_MODEL_DIR, FaceRecognizer


def _recognizer_with_features(features, threshold=0.35, margin=0.03):
    recognizer = FaceRecognizer.__new__(FaceRecognizer)
    recognizer._lock = __import__("threading").RLock()
    recognizer._face_db = {
        employee: [np.asarray(feature, dtype=np.float32)]
        for employee, feature in features.items()
    }
    recognizer._employee_info = {
        employee: {"employee_number": employee} for employee in features
    }
    recognizer.recognition_threshold = threshold
    recognizer.recognition_margin = margin
    recognizer.recognition_min_face_size = 40
    recognizer._detect_faces = lambda image: np.asarray(
        [[0, 0, 100, 100] + [0] * 11], dtype=np.float32
    )
    return recognizer


def test_face_models_are_bundled():
    assert (DEFAULT_MODEL_DIR / "face_detection_yunet_2023mar.onnx").is_file()
    assert (DEFAULT_MODEL_DIR / "face_recognition_sface_2021dec.onnx").is_file()


def test_recognition_accepts_clear_best_match():
    recognizer = _recognizer_with_features(
        {"EMP001": [1.0, 0.0], "EMP002": [0.0, 1.0]}
    )
    recognizer._extract_feature = lambda image, face: np.asarray(
        [0.95, 0.05], dtype=np.float32
    )

    employee_number, similarity, _ = recognizer.recognize_face(
        np.zeros((120, 120, 3), dtype=np.uint8)
    )

    assert employee_number == "EMP001"
    assert similarity == 95.0


def test_recognition_rejects_score_below_threshold():
    recognizer = _recognizer_with_features({"EMP001": [1.0, 0.0]})
    recognizer._extract_feature = lambda image, face: np.asarray(
        [0.3, 0.95], dtype=np.float32
    )

    assert recognizer.recognize_face(np.zeros((120, 120, 3), dtype=np.uint8)) == (
        None,
        None,
        None,
    )


def test_recognition_rejects_ambiguous_candidates():
    recognizer = _recognizer_with_features(
        {"EMP001": [0.70, 0.70], "EMP002": [0.68, 0.72]}
    )
    recognizer._extract_feature = lambda image, face: np.asarray(
        [0.70, 0.70], dtype=np.float32
    )

    assert recognizer.recognize_face(np.zeros((120, 120, 3), dtype=np.uint8)) == (
        None,
        None,
        None,
    )
