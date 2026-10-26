"""
YOLOv8 检测模块
负责目标检测：人员、工作服、安全帽、反光背心
"""

import cv2
import numpy as np
from pathlib import Path
from typing import Optional, List, Dict, Tuple
import time
import threading


class Detector:
    """YOLOv8 检测器"""
    
    # 检测类别
    CLASSES = [
        'person',           # 0 人员
        'helmet',          # 1 安全帽
        'safety_vest',    # 2 反光背心
        'workwear',       # 3 工作服
    ]
    
    # 未穿戴类别映射
    VIOLATION_MAP = {
        'helmet': 'no_helmet',
        'safety_vest': 'no_vest',
        'workwear': 'no_workwear',
    }
    
    def __init__(
        self,
        model_path: str = "models/ppe_detector.onnx",
        conf_threshold: float = 0.5,
        iou_threshold: float = 0.45,
        device: str = "auto"
    ):
        """
        初始化检测器
        
        Args:
            model_path: ONNX 模型路径
            conf_threshold: 置信度阈值
            iou_threshold: IOU 阈值
            device: 设备 ('auto', 'cpu', 'cuda')
        """
        self.model_path = model_path
        self.conf_threshold = conf_threshold
        self.iou_threshold = iou_threshold
        
        # 确定设备
        if device == "auto":
            self.device = self._detect_device()
        else:
            self.device = device
        
        # 模型
        self._model = None
        self._session = None
        self._input_shape = (640, 640)
        
        # 结果缓存
        self._last_results: List[Dict] = []
        self._lock = threading.Lock()
        
        # 初始化模型
        self._init_model()
    
    def _detect_device(self) -> str:
        """检测可用设备"""
        try:
            import torch
            if torch.cuda.is_available():
                return "cuda"
        except (ImportError, Exception):
            pass
        return "cpu"
    
    def _init_model(self):
        """初始化 ONNX 模型"""
        try:
            import onnxruntime as ort
            
            # 配置推理会话
            sess_options = ort.SessionOptions()
            sess_options.graph_optimization_level = (
                ort.GraphOptimizationLevel.ORT_ENABLE_ALL
            )
            
            if self.device == "cuda":
                providers = [
                    ('CUDAExecutionProvider', {
                        'device_id': 0,
                        'cudnn_conv_algo_search': 'EXHAUSTIVE',
                    }),
                    'CPUExecutionProvider',
                ]
            else:
                providers = ['CPUExecutionProvider']
            
            # 加载模型
            if not self.model_path.endswith('.onnx'):
                # 查找 ONNX 文件
                import glob
                onnx_files = glob.glob(self.model_path.replace('\\', '/').replace('//', '/') + '*.onnx')
                if onnx_files:
                    self.model_path = onnx_files[0]
                else:
                    raise FileNotFoundError(f"模型文件不存在: {self.model_path}")
            
            if not Path(self.model_path.replace('\\', '/')).exists():
                print(f"警告: 模型文件不存在 {self.model_path}")
                print("将使用模拟检测模式")
                self._is_loaded = False
                return
            
            self._session = ort.InferenceSession(
                self.model_path,
                sess_options=sess_options,
                providers=providers
            )
            
            self._model = self._session.get_inputs()[0].name
            self._is_loaded = True
            print(f"YOLOv8 检测器加载成功 ({self.device})")
            
        except Exception as e:
            print(f"YOLOv8 检测器初始化失败: {e}")
            print("将使用模拟检测模式")
            self._is_loaded = False
    
    def is_loaded(self) -> bool:
        """检查模型是否已加载"""
        return getattr(self, '_is_loaded', False)
    
    def detect(
        self,
        image: np.ndarray,
        size: Tuple[int, int] = (640, 640)
    ) -> List[Dict]:
        """
        检测图像中的目标
        
        Args:
            image: BGR 图像
            size: 输入尺寸
        
        Returns:
            [{
                'class_id': int,
                'class_name': str,
                'confidence': float,
                'bbox': [x1, y1, x2, y2],
                'track_id': Optional[int],
            }]
        """
        if not self.is_loaded():
            # 模拟检测
            return self._simulate_detection(image)
        
        try:
            # 预处理
            input_tensor = self._preprocess(image, size)
            
            # 推理
            outputs = self._session.run(
                None,
                {self._model: input_tensor}
            )
            
            # 后处理
            results = self._postprocess(outputs[0], image.shape)
            
            # 缓存结果
            with self._lock:
                self._last_results = results
            
            return results
            
        except Exception as e:
            print(f"检测失败: {e}")
            return []
    
    def _calc_iou(self, box1: List[float], box2: List[float]) -> float:
        """计算 IOU"""
        x1_1, y1_1, x2_1, y2_1 = box1
        x1_2, y1_2, x2_2, y2_2 = box2
        
        xi1 = max(x1_1, x1_2)
        yi1 = max(y1_1, y1_2)
        xi2 = min(x2_1, x2_2)
        yi2 = min(y2_1, y2_2)
        
        inter_area = max(0, xi2 - xi1) * max(0, yi2 - yi1)
        
        box1_area = (x2_1 - x1_1) * (y2_1 - y1_1)
        box2_area = (x2_2 - x1_2) * (y2_2 - y2_2)
        union_area = box1_area + box2_area - inter_area
        
        return inter_area / union_area if union_area > 0 else 0
    
    def _preprocess(
        self,
        image: np.ndarray,
        size: Tuple[int, int]
    ) -> np.ndarray:
        """预处理图像"""
        # 调整大小
        resized = cv2.resize(image, size)
        
        # 转 RGB
        rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)
        
        # 归一化
        normalized = rgb.astype(np.float32) / 255.0
        
        # HWC -> NCHW
        transposed = np.transpose(normalized, (2, 0, 1))
        
        # 添加 batch 维度
        batched = np.expand_dims(transposed, axis=0)
        
        return batched
    
    def _postprocess(
        self,
        output: np.ndarray,
        original_shape: Tuple[int, int, int]
    ) -> List[Dict]:
        """后处理检测结果"""
        results = []
        
        # 解析输出
        predictions = output[0]  # (batch, num_boxes, 5+num_classes)
        
        # 获取原始图像尺寸
        orig_h, orig_w = original_shape[:2]
        
        for pred in predictions:
            # 提取置信度最高的类别
            obj_conf = pred[4]
            if obj_conf < self.conf_threshold:
                continue
            
            class_scores = pred[5:]
            class_id = np.argmax(class_scores)
            class_conf = class_scores[class_id]
            
            # 综合置信度
            conf = obj_conf * class_conf
            if conf < self.conf_threshold:
                continue
            
            # 边界框
            cx, cy, w, h = pred[:4]
            
            # 转换到原图坐标
            x1 = (cx - w / 2) * orig_w / self._input_shape[1]
            y1 = (cy - h / 2) * orig_h / self._input_shape[0]
            x2 = (cx + w / 2) * orig_w / self._input_shape[1]
            y2 = (cy + h / 2) * orig_h / self._input_shape[0]
            
            class_name = self.CLASSES[class_id] if class_id < len(self.CLASSES) else f"unknown_{class_id}"
            
            results.append({
                'class_id': class_id,
                'class_name': class_name,
                'confidence': float(conf),
                'bbox': [float(x1), float(y1), float(x2), float(y2)],
                'track_id': None,
            })
        
        # NMS (OpenCV C++ 实现，比 Python 循环快 5-10 倍)
        if results:
            bboxes = [r['bbox'] for r in results]
            scores = [r['confidence'] for r in results]
            indices = cv2.dnn.NMSBoxes(
                bboxes, scores, self.conf_threshold, self.iou_threshold
            )
            if len(indices) > 0:
                results = [results[i] for i in indices.flatten()]
            else:
                results = []
        
        return results
    
    def _simulate_detection(self, image: np.ndarray) -> List[Dict]:
        """模拟检测 (无模型时返回空结果)"""
        return []
    
    def check_violation(
        self,
        detections: List[Dict],
        persons: List[Dict]
    ) -> List[Dict]:
        """
        检查违规
        
        Args:
            detections: 所有检测结果
            persons: 追踪的人员列表
        
        Returns:
            违规列表 [{
                'track_id': int,
                'violation_types': List[str],
                'persons': List[Dict],
            }]
        """
        violations = []
        
        # 按人员分组检测结果
        persons_in_frame = [d for d in detections if d['class_name'] == 'person']
        
        for person in persons:
            person_bbox = person.get('bbox')
            if not person_bbox:
                continue
            
            # 检查该人员的穿戴
            has_helmet = False
            has_vest = False
            has_workwear = False
            
            for det in detections:
                if not self._is_same_object(person_bbox, det['bbox']):
                    continue
                
                class_name = det['class_name']
                if class_name == 'helmet':
                    has_helmet = True
                elif class_name == 'safety_vest':
                    has_vest = True
                elif class_name == 'workwear':
                    has_workwear = True
            
            # 判断违规
            violation_types = []
            if not has_helmet:
                violation_types.append('no_helmet')
            if not has_vest:
                violation_types.append('no_vest')
            if not has_workwear:
                violation_types.append('no_workwear')
            
            if violation_types:
                violations.append({
                    'track_id': person.get('track_id'),
                    'person_track_id': person.get('track_id'),
                    'bbox': person_bbox,
                    'person_bbox': person_bbox,
                    'violation_types': violation_types,
                    'positions': [self._get_center(person_bbox)],
                })
        
        return violations
    
    def _is_same_object(
        self,
        bbox1: List[float],
        bbox2: List[float],
        iou_threshold: float = 0.3
    ) -> bool:
        """判断是否为同一目标"""
        return self._calc_iou(bbox1, bbox2) > iou_threshold
    
    def _get_center(self, bbox: List[float]) -> Tuple[float, float]:
        """获取边界框中心点"""
        x1, y1, x2, y2 = bbox
        return ((x1 + x2) / 2, (y1 + y2) / 2)
    
    def get_last_results(self) -> List[Dict]:
        """获取上次检测结果"""
        with self._lock:
            return self._last_results.copy()


def create_detector(**kwargs) -> Optional[Detector]:
    """创建检测器"""
    detector = Detector(**kwargs)
    return detector
