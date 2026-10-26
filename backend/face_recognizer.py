"""Lightweight employee face recognition based on OpenCV YuNet and SFace.
Supports multiple face photos per employee for improved recognition accuracy."""

from __future__ import annotations

import os
import threading
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import cv2
import numpy as np


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MODEL_DIR = PROJECT_ROOT / "models" / "face"


class FaceRecognizer:
    """Detect, align and recognize employees using multiple registered portraits."""

    def __init__(
        self,
        face_db_path: str | Path = "data/face_database",
        detector_model_path: str | Path | None = None,
        recognizer_model_path: str | Path | None = None,
        detection_threshold: float | None = None,
        recognition_threshold: float | None = None,
        recognition_margin: float | None = None,
    ):
        self.face_db_path = self._resolve_project_path(face_db_path)
        self.face_db_path.mkdir(parents=True, exist_ok=True)

        self.detector_model_path = Path(
            detector_model_path
            or os.getenv(
                "FACE_DETECTOR_MODEL",
                DEFAULT_MODEL_DIR / "face_detection_yunet_2023mar.onnx",
            )
        )
        self.recognizer_model_path = Path(
            recognizer_model_path
            or os.getenv(
                "FACE_RECOGNIZER_MODEL",
                DEFAULT_MODEL_DIR / "face_recognition_sface_2021dec.onnx",
            )
        )
        self.detection_threshold = self._env_float(
            "FACE_DETECTION_THRESHOLD", detection_threshold, 0.50
        )
        self.recognition_threshold = self._env_float(
            "FACE_RECOGNITION_THRESHOLD", recognition_threshold, 0.3
        )
        self.recognition_margin = self._env_float(
            "FACE_RECOGNITION_MARGIN", recognition_margin, 0.03
        )
        self.last_error = ""

        self._lock = threading.RLock()
        self._face_db: Dict[str, List[np.ndarray]] = {}
        self._employee_info: Dict[str, Dict] = {}
        self._load_models()

    @staticmethod
    def _resolve_project_path(path: str | Path) -> Path:
        value = Path(path)
        return value if value.is_absolute() else PROJECT_ROOT / value

    @staticmethod
    def _env_float(name: str, supplied: float | None, default: float) -> float:
        if supplied is not None:
            return float(supplied)
        return float(os.getenv(name, str(default)))

    def _load_models(self) -> None:
        missing = [
            str(path)
            for path in (self.detector_model_path, self.recognizer_model_path)
            if not path.exists()
        ]
        if missing:
            raise FileNotFoundError(f"人脸模型文件不存在: {', '.join(missing)}")

        self.detector = cv2.FaceDetectorYN.create(
            str(self.detector_model_path),
            "",
            (640, 640),
            self.detection_threshold,
            0.3,
            5000,
        )
        self.recognizer = cv2.FaceRecognizerSF.create(
            str(self.recognizer_model_path), ""
        )
        print(
            f"[FaceRecognizer] YuNet/SFace 加载成功, "
            f"检测阈值={self.detection_threshold:.2f}, "
            f"识别阈值={self.recognition_threshold:.2f}, "
            f"输入尺寸=640x640, CLAHE预处理=开启"
        )

    def _preprocess_image(self, image: np.ndarray) -> np.ndarray:
        """增强图像质量：直方图均衡化提升光照不均匀场景的检测率。"""
        if image is None or image.size == 0:
            return image
        lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        l_eq = clahe.apply(l)
        enhanced = cv2.merge([l_eq, a, b])
        return cv2.cvtColor(enhanced, cv2.COLOR_LAB2BGR)

    def _detect_faces(self, image: np.ndarray) -> np.ndarray:
        if image is None or image.size == 0 or image.ndim != 3:
            return np.empty((0, 15), dtype=np.float32)

        height, width = image.shape[:2]
        if width < 20 or height < 20:
            return np.empty((0, 15), dtype=np.float32)

        enhanced = self._preprocess_image(image)
        with self._lock:
            self.detector.setInputSize((width, height))
            _, faces = self.detector.detect(enhanced)
        if faces is None:
            return np.empty((0, 15), dtype=np.float32)

        min_size = int(min(width, height) * 0.03)
        min_size = max(min_size, 30)
        valid = []
        for face in faces:
            fw, fh = float(face[2]), float(face[3])
            if fw >= min_size and fh >= min_size:
                valid.append(face)
        return np.array(valid, dtype=np.float32) if valid else np.empty((0, 15), dtype=np.float32)

    @staticmethod
    def _largest_face(faces: np.ndarray) -> Optional[np.ndarray]:
        if len(faces) == 0:
            return None
        return max(faces, key=lambda face: float(face[2] * face[3]))

    def detect_face(self, image: np.ndarray) -> Optional[Tuple[int, int, int, int]]:
        face = self._largest_face(self._detect_faces(image))
        if face is None:
            return None
        return tuple(int(round(value)) for value in face[:4])

    def _extract_feature(self, image: np.ndarray, face: np.ndarray) -> np.ndarray:
        enhanced = self._preprocess_image(image)
        with self._lock:
            aligned = self.recognizer.alignCrop(enhanced, face)
            feature = self.recognizer.feature(aligned)
        feature = np.asarray(feature, dtype=np.float32).reshape(-1)
        norm = float(np.linalg.norm(feature))
        if norm <= 1e-12:
            raise ValueError("人脸特征提取失败")
        return feature / norm

    def register_employee(
        self,
        employee_number: str,
        image: np.ndarray,
        employee_info: Optional[Dict] = None,
    ) -> bool:
        """Register a face photo for an employee. Can be called multiple times."""
        self.last_error = ""
        employee_number = str(employee_number or "").strip()
        if not employee_number:
            self.last_error = "员工工号不能为空"
            return False

        faces = self._detect_faces(image)
        if len(faces) == 0:
            self.last_error = "未检测到人脸"
            return False

        try:
            feature = self._extract_feature(image, faces[0])
        except (cv2.error, ValueError) as exc:
            self.last_error = f"人脸特征提取失败: {exc}"
            return False

        # Create employee folder
        emp_dir = self.face_db_path / employee_number
        emp_dir.mkdir(parents=True, exist_ok=True)

        # Find next available index
        existing = sorted(emp_dir.glob("*.jpg"))
        next_idx = len(existing) + 1
        photo_path = emp_dir / f"face_{next_idx}.jpg"

        if not cv2.imwrite(str(photo_path), image):
            self.last_error = "人脸照片保存失败"
            return False

        with self._lock:
            if employee_number not in self._face_db:
                self._face_db[employee_number] = []
            self._face_db[employee_number].append(feature)
            self._employee_info[employee_number] = employee_info or {}

        print(f"[FaceRecognizer] 员工 {employee_number} 人脸照片 {next_idx} 注册成功 (共 {len(self._face_db[employee_number])} 张)")
        return True

    def load_employees_from_folder(self, database) -> int:
        """Load active employees and regenerate SFace embeddings from all portraits."""
        if not database:
            return 0

        loaded = 0
        for employee in database.get_employees():
            if employee.get("status", "active") != "active":
                continue

            employee_number = str(employee.get("employee_number", "")).strip()
            if not employee_number:
                continue

            emp_dir = self.face_db_path / employee_number
            info = {
                "id": employee.get("id"),
                "name": employee.get("name", ""),
                "employee_number": employee_number,
                "department": employee.get("department", ""),
                "position": employee.get("position", ""),
            }

            count = 0
            if emp_dir.is_dir():
                for photo in sorted(emp_dir.glob("*.jpg")):
                    image = cv2.imread(str(photo))
                    if image is not None:
                        faces = self._detect_faces(image)
                        if len(faces) > 0:
                            try:
                                feature = self._extract_feature(image, faces[0])
                                with self._lock:
                                    if employee_number not in self._face_db:
                                        self._face_db[employee_number] = []
                                    self._face_db[employee_number].append(feature)
                                    self._employee_info[employee_number] = info
                                count += 1
                            except Exception:
                                pass

            # Also check legacy single photo
            if count == 0:
                legacy = employee.get("face_photo_path") or employee.get("photo_path")
                if legacy:
                    photo_path = Path(legacy)
                    if photo_path.exists():
                        image = cv2.imread(str(photo_path))
                        if image is not None:
                            faces = self._detect_faces(image)
                            if len(faces) > 0:
                                try:
                                    feature = self._extract_feature(image, faces[0])
                                    with self._lock:
                                        self._face_db[employee_number] = [feature]
                                        self._employee_info[employee_number] = info
                                    count = 1
                                except Exception:
                                    pass

                # Also check legacy flat file
                if count == 0:
                    legacy_flat = self.face_db_path / f"{employee_number}.jpg"
                    if legacy_flat.exists():
                        image = cv2.imread(str(legacy_flat))
                        if image is not None:
                            faces = self._detect_faces(image)
                            if len(faces) > 0:
                                try:
                                    feature = self._extract_feature(image, faces[0])
                                    with self._lock:
                                        self._face_db[employee_number] = [feature]
                                        self._employee_info[employee_number] = info
                                    count = 1
                                except Exception:
                                    pass

            if count > 0:
                loaded += 1
                print(f"[FaceRecognizer] 员工 {employee_number} 加载 {count} 张人脸照片")

        return loaded

    def recognize_face(
        self, image: np.ndarray
    ) -> Tuple[Optional[str], Optional[float], Optional[Dict]]:
        """Recognize the largest usable face against all registered features."""
        with self._lock:
            registered = list(self._face_db.items())
        if not registered:
            return None, None, None

        face = self._largest_face(self._detect_faces(image))
        if face is None:
            return None, None, None

        try:
            query_feature = self._extract_feature(image, face)
        except (cv2.error, ValueError):
            return None, None, None

        # Vectorized: build matrix of all features and compute dot products at once
        all_features = []
        feature_to_employee = []
        for employee_number, features in registered:
            for feature in features:
                all_features.append(feature)
                feature_to_employee.append(employee_number)

        if not all_features:
            return None, None, None

        feature_matrix = np.array(all_features, dtype=np.float32)
        scores = feature_matrix @ query_feature
        best_idx = int(np.argmax(scores))
        best_score = float(scores[best_idx])
        best_number = feature_to_employee[best_idx]

        if best_number is None or best_score < self.recognition_threshold:
            return None, None, None

        # Find best score from a DIFFERENT employee
        mask = np.array([e != best_number for e in feature_to_employee])
        if mask.any():
            other_scores = scores[mask]
            second_best = float(np.max(other_scores))
        else:
            second_best = -1.0

        if second_best > 0 and best_score - second_best < self.recognition_margin:
            print(
                "[FaceRecognizer] 候选员工相似度过于接近，按未知人员处理: "
                f"best={best_score:.3f}, second={second_best:.3f}"
            )
            return None, None, None

        similarity = round(best_score * 100, 1)
        with self._lock:
            employee_info = self._employee_info.get(best_number)
        print(
            f"[FaceRecognizer] 识别成功: 工号 {best_number}, "
            f"余弦相似度 {similarity}%"
        )
        return best_number, similarity, employee_info

    def recognize_and_get_employee_id(
        self, image: np.ndarray, database
    ) -> Tuple[Optional[int], Optional[str], Optional[float]]:
        employee_number, similarity, _ = self.recognize_face(image)
        if employee_number and database:
            employee = database.get_employee_by_number(employee_number)
            if employee:
                return employee.get("id"), employee_number, similarity
        return None, employee_number, similarity

    def recognize_face_multi_frame(
        self, frames: List[np.ndarray], min_votes: int = 2
    ) -> Tuple[Optional[str], Optional[float], Optional[Dict]]:
        """多帧融合识别：对多帧结果投票，提高召回率。
        
        Args:
            frames: 连续帧图像列表
            min_votes: 最少投票数，低于此数视为未识别
        """
        if not frames:
            return None, None, None
        
        votes: Dict[str, List[float]] = {}
        for frame in frames:
            emp_number, similarity, info = self.recognize_face(frame)
            if emp_number and similarity is not None:
                votes.setdefault(emp_number, []).append(similarity)
        
        if not votes:
            return None, None, None
        
        best_number = max(votes, key=lambda k: len(votes[k]))
        vote_count = len(votes[best_number])
        
        if vote_count < min_votes:
            return None, None, None
        
        avg_similarity = round(sum(votes[best_number]) / vote_count, 1)
        with self._lock:
            employee_info = self._employee_info.get(best_number)
        
        print(
            f"[FaceRecognizer] 多帧融合识别: 工号 {best_number}, "
            f"投票 {vote_count}/{len(frames)}, 平均相似度 {avg_similarity}%"
        )
        return best_number, avg_similarity, employee_info

    def get_employee_count(self) -> int:
        with self._lock:
            return len(self._face_db)

    def get_employee_photo_count(self, employee_number: str) -> int:
        with self._lock:
            features = self._face_db.get(employee_number, [])
            return len(features)

    def unregister_employee(self, employee_number: str) -> None:
        employee_number = str(employee_number or "").strip()
        if not employee_number:
            return
        with self._lock:
            self._face_db.pop(employee_number, None)
            self._employee_info.pop(employee_number, None)

    def delete_photo(self, employee_number: str, photo_index: int) -> bool:
        """Delete a specific face photo by index."""
        emp_dir = self.face_db_path / employee_number
        photos = sorted(emp_dir.glob("*.jpg")) if emp_dir.is_dir() else []
        if photo_index < 0 or photo_index >= len(photos):
            return False

        target = photos[photo_index]
        target.unlink(missing_ok=True)

        # Rebuild feature list from remaining photos
        with self._lock:
            self._face_db.pop(employee_number, None)
        self._load_employee_features(employee_number)
        return True

    def _load_employee_features(self, employee_number: str):
        """Reload features for a single employee from disk."""
        emp_dir = self.face_db_path / employee_number
        features = []
        if emp_dir.is_dir():
            for photo in sorted(emp_dir.glob("*.jpg")):
                image = cv2.imread(str(photo))
                if image is not None:
                    faces = self._detect_faces(image)
                    if len(faces) > 0:
                        try:
                            feature = self._extract_feature(image, faces[0])
                            features.append(feature)
                        except Exception:
                            pass
        with self._lock:
            if features:
                self._face_db[employee_number] = features
            else:
                self._face_db.pop(employee_number, None)


def create_face_recognizer(**kwargs) -> FaceRecognizer:
    return FaceRecognizer(**kwargs)
