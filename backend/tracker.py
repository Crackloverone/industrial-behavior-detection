"""
ByteTrack 追踪模块
用于多目标追踪，解决目标遮挡、重叠问题
"""

import numpy as np
from typing import List, Dict, Tuple, Optional
import time
import threading


class ByteTracker:
    """ByteTrack 追踪器"""
    
    def __init__(
        self,
        track_thresh: float = 0.5,
        track_buffer: int = 30,
        match_thresh: float = 0.8,
        lost_time_threshold: int = 30
    ):
        """
        初始化追踪器
        
        Args:
            track_thresh: 追踪置信度阈值
            track_buffer: 追踪缓冲区大小
            match_thresh: 匹配阈值
            lost_time_threshold: 丢失时间阈值 (帧数)
        """
        self.track_thresh = track_thresh
        self.track_buffer = track_buffer
        self.match_thresh = match_thresh
        self.lost_time_threshold = lost_time_threshold
        
        # 追踪目标
        self.tracks: List['Track'] = []
        self._track_id_counter = 0
        self._lock = threading.Lock()
        
        # 帧计数
        self.frame_id = 0
    
    def update(
        self,
        detections: List[Dict],
        image: Optional[np.ndarray] = None
    ) -> List[Dict]:
        """
        更新追踪
        
        Args:
            detections: 检测结果列表
            image: 图像 (可选)
        
        Returns:
            追踪结果列表
        """
        self.frame_id += 1
        
        if not detections:
            # 没有检测，处理丢失的轨迹
            self._handle_lost_tracks()
            return self._get_active_tracks()
        
        # 分离高低置信度检测
        high_detections = [
            d for d in detections 
            if d['confidence'] >= self.track_thresh
        ]
        low_detections = [
            d for d in detections 
            if d['confidence'] < self.track_thresh
        ]
        
        # 激活轨迹与消失轨迹分离
        remain_tracks, lose_tracks = self._split_tracks()
        
        # 第一阶段: 高置信度检测与激活轨迹匹配
        if remain_tracks:
            matched, unmatched = self._match(
                remain_tracks, 
                high_detections,
                self.match_thresh
            )
            
            for track, det in matched:
                track.update(det, self.frame_id)
            
            high_detections = [d for i, d in enumerate(high_detections) 
                         if i in unmatched]
        
        # 处理丢失轨迹与低置信度检测
        lose_tracks = [t for t in lose_tracks 
                      if self.frame_id - t.end_frame < self.lost_time_threshold]
        
        if lose_tracks and low_detections:
            matched, unmatched = self._match(
                lose_tracks, 
                low_detections,
                self.match_thresh * 0.5  # 更宽松的匹配
            )
            
            for track, det in matched:
                track.re_activate(det, self.frame_id)
            
            low_detections = [d for i, d in enumerate(low_detections) 
                             if i in unmatched]
        
        # 第二阶段: 创建新轨迹
        for det in high_detections:
            self._create_track(det)
        
        # 更新轨迹状态
        self.tracks.extend(lose_tracks)
        self._handle_lost_tracks()
        
        # 获取活跃轨迹
        return self._get_active_tracks()
    
    def _split_tracks(self) -> Tuple[List['Track'], List['Track']]:
        """分离激活和消失的轨迹"""
        with self._lock:
            active = []
            lost = []
            for track in self.tracks:
                if track.state == 'tracked':
                    active.append(track)
                else:
                    lost.append(track)
            return active, lost
    
    def _match(
        self,
        tracks: List['Track'],
        detections: List[Dict],
        threshold: float
    ) -> Tuple[List[Tuple['Track', Dict]], List[int]]:
        """匹配轨迹和检测（匈牙利算法，最优全局匹配）"""
        if not tracks or not detections:
            return [], list(range(len(detections)))
        
        # 计算代价矩阵
        cost_matrix = np.zeros((len(tracks), len(detections)))
        for i, track in enumerate(tracks):
            for j, det in enumerate(detections):
                cost_matrix[i, j] = 1 - self._calc_iou(track.bbox, det['bbox'])
        
        # 匈牙利算法求最优匹配
        try:
            from scipy.optimize import linear_sum_assignment
            row_indices, col_indices = linear_sum_assignment(cost_matrix)
        except ImportError:
            # scipy 不可用时降级为贪心匹配
            return self._greedy_match(tracks, detections, threshold)
        
        matched = []
        unmatched_det = set(range(len(detections)))
        for r, c in zip(row_indices, col_indices):
            if cost_matrix[r, c] < (1 - threshold):
                matched.append((tracks[r], detections[c]))
                unmatched_det.discard(c)
        
        return matched, sorted(unmatched_det)
    
    def _greedy_match(
        self,
        tracks: List['Track'],
        detections: List[Dict],
        threshold: float
    ) -> Tuple[List[Tuple['Track', Dict]], List[int]]:
        """贪心匹配（scipy 不可用时的降级方案）"""
        cost_matrix = np.zeros((len(tracks), len(detections)))
        for i, track in enumerate(tracks):
            for j, det in enumerate(detections):
                cost_matrix[i, j] = 1 - self._calc_iou(track.bbox, det['bbox'])
        
        matched = []
        unmatched_det = list(range(len(detections)))
        for i in range(len(tracks)):
            if not unmatched_det:
                break
            best_j = min(unmatched_det, key=lambda j: cost_matrix[i, j])
            if cost_matrix[i, best_j] < (1 - threshold):
                matched.append((tracks[i], detections[best_j]))
                unmatched_det.remove(best_j)
        
        return matched, unmatched_det
    
    def _create_track(self, detection: Dict):
        """创建新轨迹"""
        with self._lock:
            self._track_id_counter += 1
            track = Track(
                track_id=self._track_id_counter,
                start_frame=self.frame_id,
                end_frame=self.frame_id,
                state='tracked',
                class_id=detection['class_id'],
                bbox=detection['bbox'],
                confidence=detection['confidence']
            )
            self.tracks.append(track)
    
    def _handle_lost_tracks(self):
        """处理丢失的轨迹"""
        with self._lock:
            current_frame = self.frame_id
            self.tracks = [
                t for t in self.tracks
                if current_frame - t.end_frame <= self.lost_time_threshold
            ]
    
    def _get_active_tracks(self) -> List[Dict]:
        """获取活跃轨迹"""
        result = []
        for track in self.tracks:
            if track.state == 'tracked':
                result.append(track.to_dict())
        return result
    
    def _calc_iou(self, bbox1: List[float], bbox2: List[float]) -> float:
        """计算 IOU"""
        x1_1, y1_1, x2_1, y2_1 = bbox1
        x1_2, y1_2, x2_2, y2_2 = bbox2
        
        xi1 = max(x1_1, x1_2)
        yi1 = max(y1_1, y1_2)
        xi2 = min(x2_1, x2_2)
        yi2 = min(y2_1, y2_2)
        
        inter_area = max(0, xi2 - xi1) * max(0, yi2 - yi1)
        
        box1_area = (x2_1 - x1_1) * (y2_1 - y1_1)
        box2_area = (x2_2 - x1_2) * (y2_2 - y1_2)
        union_area = box1_area + box2_area - inter_area
        
        return inter_area / union_area if union_area > 0 else 0
    
    def reset(self):
        """重置追踪器"""
        with self._lock:
            self.tracks = []
            self._track_id_counter = 0
            self.frame_id = 0


class Track:
    """追踪轨迹"""
    
    def __init__(
        self,
        track_id: int,
        start_frame: int,
        end_frame: int,
        state: str,
        class_id: int,
        bbox: List[float],
        confidence: float
    ):
        self.track_id = track_id
        self.start_frame = start_frame
        self.end_frame = end_frame
        self.state = state
        self.class_id = class_id
        self.bbox = bbox
        self.confidence = confidence
        self.positions = [bbox]
    
    def update(self, detection: Dict, frame_id: int):
        """更新轨迹"""
        self.end_frame = frame_id
        self.bbox = detection['bbox']
        self.confidence = detection['confidence']
        self.state = 'tracked'
        self.positions.append(self.bbox)
    
    def re_activate(self, detection: Dict, frame_id: int):
        """重新激活轨迹"""
        self.update(detection, frame_id)
    
    def mark_lost(self, frame_id: int):
        """标记为丢失"""
        self.state = 'lost'
        self.end_frame = frame_id
    
    def to_dict(self) -> Dict:
        """转换为字典"""
        return {
            'track_id': self.track_id,
            'class_id': self.class_id,
            'bbox': self.bbox,
            'confidence': self.confidence,
            'state': self.state,
        }


def create_tracker(**kwargs) -> ByteTracker:
    """创建追踪器"""
    return ByteTracker(**kwargs)